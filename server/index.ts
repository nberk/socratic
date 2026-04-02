import "dotenv/config";
import "./instrument"; // Sentry must init before any other import (OpenTelemetry patches at load time)
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import topicsRoutes from "./routes/topics";
import lessonsRoutes from "./routes/lessons";
import chatRoutes from "./routes/chat";
import reviewRoutes from "./routes/review";
import conceptsRoutes from "./routes/concepts";
import usageRoutes from "./routes/usage";
import authRoutes from "./routes/auth";
import { authMiddleware, type LocalUser } from "./lib/auth";
import { rateLimiter } from "hono-rate-limiter";

const isProd = process.env.NODE_ENV === "production";

// Validate required env vars at startup
for (const key of ["DATABASE_URL", "ANTHROPIC_API_KEY"] as const) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if (process.env.WORKOS_API_KEY) {
  for (const key of ["WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD", "WORKOS_REDIRECT_URI"] as const) {
    if (!process.env[key]) {
      console.error(`WorkOS auth enabled but missing: ${key}`);
      process.exit(1);
    }
  }
  console.log("Auth: WorkOS mode");
} else {
  console.log("Auth: local mode (no login required)");
}
if (process.env.DEV_BYPASS_TOKEN && !isProd) {
  console.log("Auth: dev bypass enabled (DEV_BYPASS_TOKEN set)");
}

// Log which database driver was selected
const dbUrl = process.env.DATABASE_URL!;
console.log(`Database: ${dbUrl.includes("neon.tech") ? "Neon (HTTP)" : "Local Postgres"}`);

const app = new Hono<{ Variables: { user: LocalUser; requestId: string } }>();

// ─── Middleware ───────────────────────────────────────

app.use("*", logger());

// Request ID — generated once per request, threaded through logs and Sentry
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isProd) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// CORS: restricted in production, permissive in dev
app.use(
  "/api/*",
  cors({
    origin: isProd ? (process.env.APP_URL || "") : "http://localhost:5173",
    credentials: true,
  })
);

// Health check (before auth — must be public for Fly.io health checks)
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── API Routes ──────────────────────────────────────

app.route("/api/auth", authRoutes);

// All routes below this line require authentication
app.use("/api/*", authMiddleware);

// Rate limiting — keyed by user ID (post-auth, so identity is known)
type AppEnv = { Variables: { user: LocalUser; requestId: string } };
const generalLimiter = rateLimiter<AppEnv>({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: (c) => c.get("user").id,
});
const claudeLimiter = rateLimiter<AppEnv>({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (c) => c.get("user").id,
});
app.use("/api/*", generalLimiter);
app.use("/api/chat", claudeLimiter);
app.use("/api/review/grade", claudeLimiter);

app.route("/api/topics", topicsRoutes);
app.route("/api/lessons", lessonsRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/review", reviewRoutes);
app.route("/api/concepts", conceptsRoutes);
app.route("/api/usage", usageRoutes);

// API-specific 404
app.all("/api/*", (c) => {
  return c.json({ error: "Not found" }, 404);
});

// ─── Static File Serving (Production) ────────────────

if (isProd) {
  app.use("*", serveStatic({ root: "./dist/client" }));

  // SPA fallback: serve index.html for any non-API route
  app.get("*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

// ─── Error Handling ──────────────────────────────────

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  console.error(`[${requestId}] ${c.req.method} ${c.req.path}`, err);

  const msg = err.message ?? "";
  const isDbDown =
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection refused") ||
    msg.includes("connect ECONNREFUSED");

  if (isDbDown) {
    // DB connectivity is an infrastructure issue, not a code bug — log but don't alert
    return c.json(
      { error: "Database unavailable — is Docker running? Try: docker compose up -d" },
      503
    );
  }

  // Report unexpected errors to Sentry (this is the safety net for routes without explicit try/catch)
  Sentry.withScope((scope) => {
    scope.setTag("request_id", requestId);
    Sentry.captureException(err);
  });

  return c.json({ error: "Internal server error", requestId }, 500);
});

// Captures any error that reaches Hono's error layer (unhandled crashes, middleware failures).
// Supplements app.onError — doesn't replace it. Errors caught inside try/catch in route
// files still need manual Sentry.captureException() calls.
Sentry.setupHonoErrorHandler(app);

const port = parseInt(process.env.PORT || "3001");
console.log(`Server running on http://localhost:${port} (${isProd ? "production" : "development"})`);

export default {
  port,
  fetch: app.fetch,
};
