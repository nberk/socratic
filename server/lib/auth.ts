import type { Context, Next } from "hono";
import { WorkOS } from "@workos-inc/node";
import * as Sentry from "@sentry/node";
import { db } from "../db";
import { users } from "../db/schema";
import { eq, isNull } from "drizzle-orm";

export type LocalUser = typeof users.$inferSelect;

const isWorkOSMode = Boolean(process.env.WORKOS_API_KEY);
const devBypassToken = process.env.DEV_BYPASS_TOKEN;
const devBypassActive = isWorkOSMode && !!devBypassToken && process.env.NODE_ENV !== "production";

const workos = isWorkOSMode
  ? new WorkOS(process.env.WORKOS_API_KEY!, { clientId: process.env.WORKOS_CLIENT_ID! })
  : null;

const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD!;
const COOKIE_NAME = "wos-session";

export async function authMiddleware(c: Context, next: Next) {
  const useLocalUser = !isWorkOSMode ||
    (devBypassActive && c.req.header("authorization") === `Bearer ${devBypassToken}`);

  if (useLocalUser) {
    // Local mode or dev bypass: use the seeded local user (workosId IS NULL)
    const user = await db.query.users.findFirst({
      where: isNull(users.workosId),
    });
    if (!user) {
      return c.json(
        { error: "Local user not found — run: bun run db:push" },
        500
      );
    }
    c.set("user", user);
    Sentry.setUser({ id: String(user.id) });
    return next();
  }

  // WorkOS mode: validate sealed session cookie
  const cookie = c.req.header("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const sessionData = match?.[1];

  if (!sessionData) return c.json({ error: "Unauthorized" }, 401);

  let workosUser;
  try {
    const session = workos!.userManagement.loadSealedSession({
      sessionData,
      cookiePassword,
    });

    const result = await session.authenticate();

    if (result.authenticated) {
      workosUser = result.user;
    } else {
      // Access token expired — try refresh
      const refreshResult = await session.refresh({ cookiePassword });
      if (!refreshResult.authenticated) return c.json({ error: "Unauthorized" }, 401);

      // Issue updated cookie
      const isProd = process.env.NODE_ENV === "production";
      c.header(
        "Set-Cookie",
        `${COOKIE_NAME}=${refreshResult.sealedSession}; Path=/; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
      );
      workosUser = refreshResult.user;
    }
  } catch (err) {
    // Corrupted cookie, SDK error, network failure — treat as unauthenticated
    console.error("[auth] middleware session error:", err);
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Load local user by workosId
  const localUser = await db.query.users.findFirst({
    where: eq(users.workosId, workosUser.id),
  });
  if (!localUser) return c.json({ error: "Unauthorized" }, 401);

  c.set("user", localUser);
  Sentry.setUser({ id: String(localUser.id) });
  await next();
}
