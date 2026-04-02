import { Hono } from "hono";
import { db } from "../db";
import { users, topics } from "../db/schema";
import { isNull } from "drizzle-orm";

const isProd = process.env.NODE_ENV === "production";
const isWorkOSMode = Boolean(process.env.WORKOS_API_KEY);
const devBypassToken = process.env.DEV_BYPASS_TOKEN;
const home = isProd ? "/" : "http://localhost:5173/";

const app = new Hono();

if (!isWorkOSMode) {
  // ─── Local mode ───────────────────────────────────────────
  // No login required. All routes return success or redirect home.

  app.get("/me", (c) => c.json({ user: { id: "local", email: "local@localhost" } }));
  app.get("/login", (c) => c.redirect(home));
  app.get("/logout", (c) => c.redirect(home));
  app.get("/callback", (c) => c.redirect(home));
} else {
  // ─── WorkOS mode ──────────────────────────────────────────
  const { WorkOS } = await import("@workos-inc/node");

  const clientId = process.env.WORKOS_CLIENT_ID!;
  const workos = new WorkOS(process.env.WORKOS_API_KEY, { clientId });
  const redirectUri = process.env.WORKOS_REDIRECT_URI!;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD!;
  const COOKIE_NAME = "wos-session";

  // Redirect browser to WorkOS hosted login page
  app.get("/login", (c) => {
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      clientId,
      redirectUri,
      provider: "authkit",
    });
    return c.redirect(authorizationUrl);
  });

  // WorkOS redirects here after login with ?code=...
  app.get("/callback", async (c) => {
    const code = c.req.query("code");
    if (!code) return c.json({ error: "Missing code" }, 400);

    let sealedSession: string;
    let workosUser: { id: string; email: string; firstName: string | null; lastName: string | null };
    try {
      // Exchange code for sealed session + user info in one call
      const result = await workos.userManagement.authenticateWithCode({
        clientId,
        code,
        session: { sealSession: true, cookiePassword },
      });
      if (!result.sealedSession) {
        console.error("[auth] callback succeeded but sealedSession is missing");
        return c.redirect(`${home}?error=auth_failed`);
      }
      sealedSession = result.sealedSession;
      workosUser = result.user;
    } catch (err) {
      console.error("[auth] callback authentication failed:", err);
      // Code expired or WorkOS unreachable — redirect to login to retry
      return c.redirect(`${home}?error=auth_failed`);
    }

    // JIT upsert: create user on first login, update their info on subsequent logins
    const [localUser] = await db
      .insert(users)
      .values({
        workosId: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName,
        lastName: workosUser.lastName,
      })
      .onConflictDoUpdate({
        target: users.workosId,
        set: {
          email: workosUser.email,
          firstName: workosUser.firstName,
          lastName: workosUser.lastName,
        },
      })
      .returning();

    // Backfill: claim any existing topics that have no owner
    if (localUser) {
      await db.update(topics).set({ userId: localUser.id }).where(isNull(topics.userId));
    }

    // Set the sealed session as an HttpOnly cookie
    c.header(
      "Set-Cookie",
      `${COOKIE_NAME}=${sealedSession}; Path=/; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
    );

    return c.redirect(home);
  });

  // Returns current user if session is valid (used by React to check auth state)
  app.get("/me", async (c) => {
    // Dev bypass: allow agent access with Bearer token (non-production only)
    if (devBypassToken && !isProd) {
      if (c.req.header("authorization") === `Bearer ${devBypassToken}`) {
        return c.json({ user: { id: "local-dev", email: "dev@localhost" } });
      }
    }

    const cookie = c.req.header("cookie") ?? "";
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const sessionData = match?.[1];
    if (!sessionData) return c.json({ user: null }, 401);

    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData,
        cookiePassword,
      });

      const result = await session.authenticate();
      if (result.authenticated) {
        return c.json({ user: result.user });
      }

      // Try refresh if access token expired
      const refreshResult = await session.refresh({ cookiePassword });
      if (!refreshResult.authenticated) return c.json({ user: null }, 401);

      // Update cookie with new sealed session
      c.header(
        "Set-Cookie",
        `${COOKIE_NAME}=${refreshResult.sealedSession}; Path=/; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`
      );
      return c.json({ user: refreshResult.user });
    } catch (err) {
      // Corrupted cookie, changed password, WorkOS SDK error — treat as unauthenticated
      console.error("[auth] /me session error:", err);
      return c.json({ user: null }, 401);
    }
  });

  // Clear the session cookie and invalidate WorkOS session
  app.get("/logout", async (c) => {
    const cookie = c.req.header("cookie") ?? "";
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const sessionData = match?.[1];

    c.header("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);

    if (sessionData) {
      try {
        const session = workos.userManagement.loadSealedSession({ sessionData, cookiePassword });
        const logoutUrl = await session.getLogoutUrl();
        return c.redirect(logoutUrl);
      } catch {
        // Session unreadable — just redirect home
      }
    }

    return c.redirect(home);
  });
}

export default app;
