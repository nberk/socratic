# Auth Lessons Learned

A running record of concepts discovered while implementing WorkOS auth. Intended to become a
reusable skill for implementing authentication in future projects — concepts first, implementation
second.

---

## Core Mental Models

### HTTP is stateless — sessions are a layer on top
Every HTTP request arrives with no memory of previous requests. The server has no idea who you
are unless you prove it on every single request. A session token (cookie, JWT, etc.) is just
a repeatable proof-of-identity the client sends with each request.

### Two doors, two locks
When a user authenticates via OAuth, two sessions are created:
1. **Your app's session** — e.g. an encrypted cookie on your domain
2. **The identity provider's session** — a cookie on WorkOS/Google/GitHub's domain

Logout must destroy **both**. Deleting your local cookie only locks your door. The IdP's session
stays alive and will auto-approve the next sign-in silently. Always call the IdP's logout endpoint
(`getLogoutUrl()` in WorkOS) to end their session too.

### Two separate cookie jars
The browser maintains cookies per domain. Your `wos-session` cookie lives on `localhost`.
WorkOS's session cookie lives on `authkit.workos.com`. Your server never sees WorkOS's cookie;
WorkOS never sees yours. They are completely independent.

---

## Cookie Flags

| Flag | Protects against | How |
|------|-----------------|-----|
| `HttpOnly` | XSS | JS engine cannot read the cookie — `document.cookie` won't show it |
| `SameSite=Lax` | CSRF | Browser withholds cookie on cross-site sub-resource requests (not just GET filtering — it filters by *context*, not method) |
| `Secure` | Network interception | Cookie only sent over HTTPS |

**Key distinction**: `SameSite=Lax` doesn't block cross-site GET requests — it blocks cross-site
*sub-resource* requests (images, iframes, fetch). Top-level navigation GET requests (clicking a
link) still carry the cookie. That's intentional — it's the forged background request that's the
CSRF threat.

---

## OAuth 2.0 Authorization Code Flow

**Why three parties?** Passwords must only be typed on the system that owns them. If your app
asked for the user's Google password, you'd be handling credentials you have no right to hold —
and every transit is an attack surface.

**The flow:**
1. Your server generates an authorization URL and redirects the browser there
2. User authenticates on the IdP's hosted page
3. IdP redirects back to your server's callback with a short-lived `?code=`
4. Your server exchanges the code for tokens using `CLIENT_SECRET`
5. Your server sets an encrypted cookie and redirects the browser to the app

**Why the callback is server-side**: Only the server can hold `CLIENT_SECRET`. The code exchange
must happen server-to-server — if the token landed in the browser (e.g. `window.location.hash`),
`CLIENT_SECRET` would have to be in frontend code, which is public.

**Why `window.location.href` not `fetch()` for login**: OAuth requires real browser navigation
so the browser follows the redirect chain to the IdP's login page. `fetch()` receives the redirect
as data and does nothing visible.

---

## JWTs

Structure: `header.payload.signature` — all base64url-encoded, dot-separated.

- **Header**: algorithm used to sign (`RS256`, etc.)
- **Payload**: claims — `sub` (user id), `email`, `exp` (expiry), etc. **Readable by anyone.**
- **Signature**: tamper-evident seal. If payload is changed, signature becomes invalid.

**Why readable payload isn't a problem**: The signature ensures the payload hasn't been tampered
with. Reading it reveals nothing an attacker can exploit — they can't forge a valid signature
without the private key.

**Asymmetric cryptography**: WorkOS signs with their private key. Your server verifies with
WorkOS's public key (fetched from their JWKS endpoint using `clientId`). The public key can verify
but cannot sign — so possession of the public key gives you no forgery capability.

**Why tokens expire**: A stolen JWT is valid until expiry. Short expiry (`~1 hour`) limits the
attacker's window. There's no early revocation for JWTs — expiry is the only mechanism.

---

## Sealed Sessions (WorkOS-specific)

A "sealed session" is the entire session state (JWT + refresh token) encrypted into an opaque
blob and stored in a cookie.

- Encrypted with `WORKOS_COOKIE_PASSWORD` — a symmetric key only your server knows
- The browser stores the blob but cannot read it (HttpOnly + encrypted)
- Your server decrypts it on every request — no database lookup, no shared state

**Why seal the refresh token inside the cookie**: The refresh token is the high-value credential
(it can generate new JWTs indefinitely). Encrypting it at rest means even your own server logs
and error reporters never see it in plaintext — least exposure principle.

**Stateless scaling benefit**: Any server instance can independently decrypt the cookie. No shared
session database, no sticky sessions, no bottleneck.

**`WORKOS_COOKIE_PASSWORD` requirements**: Must be secret, 32+ characters, random. If it leaks,
anyone can decrypt every user's sealed session and extract their refresh token.

---

## Token Refresh

Access tokens are short-lived (~1 hour). Refresh tokens are long-lived.

**Refresh flow in middleware:**
1. `session.authenticate()` — validates JWT locally (crypto only, no network)
2. If expired: `session.refresh()` — server calls WorkOS with refresh token, gets new JWT
3. Re-seal new JWT + (possibly rotated) refresh token → write new `Set-Cookie`
4. Continue request as authenticated

If you don't update the cookie after refresh, the browser keeps the stale sealed session. Next
request will hit the same expired-token path and loop forever.

The refresh is invisible to the user — no logout, no interruption.

---

## Frontend Auth Gate (SPA pattern)

`HttpOnly` cookies are invisible to JavaScript. React cannot check `document.cookie` for the
session token. Instead:

1. On mount, call `GET /api/auth/me` with `credentials: "include"`
2. Server decrypts cookie, validates session, returns user or 401
3. React renders app or login page based on response

This means auth state requires a server round-trip on every page load — acceptable because
`session.authenticate()` is local crypto (no network call to WorkOS for valid tokens).

---

## WorkOS-Specific Implementation Notes

- Pass `clientId` to the `WorkOS` constructor, not just to individual methods — the SDK needs
  it globally for JWKS fetching during JWT verification
- `sealSession: true` in `authenticateWithCode()` returns `sealedSession` blob (not raw tokens)
- `loadSealedSession()` requires `{ sessionData, cookiePassword, clientId }`
- Register both sign-in and post-logout redirect URIs in the WorkOS dashboard
- Email allowlist (dashboard: Authentication → Allowlist) is cleaner than code-level checks
- In dev, redirect to `http://localhost:5173/` after callback (Vite port); in prod, `/` works

---

## WorkOS Production Environment Setup

WorkOS has separate **Staging** and **Production** environments. They are completely independent —
different API keys, different users, different AuthKit configuration.

**Key differences from Staging:**
- You must configure auth methods explicitly (email/password is not auto-enabled)
- Self-service sign-up is disabled by default — invitation-only unless you enable "Allow sign-ups"
- Requires a credit card on the WorkOS account (even if usage is free)

**Invitation-only setup (recommended for personal/private apps):**
- Keep "Allow sign-ups" OFF in Authentication → Email + Password
- Invite users manually from the dashboard: Users → Invitations → "Invite user"
- Invited users receive an email link → click it → fill out sign-up form → redirected to callback

**Common failure mode:** If email+password auth is not enabled, the invitation sign-up form only
shows "Continue with SSO." Clicking it fails if no SSO providers are configured. Fix: enable
email+password in WorkOS → Authentication → Email + Password.

**User lifecycle:**
- Newly signed-up users start as "Inactive" until they complete sign-up via the callback
- If the callback fails mid-sign-up, the user stays Inactive with 0 sign-ins
- Fix: re-invite and retry (or manually activate via WorkOS dashboard)

---

## Authentication vs. Authorization (IDOR)

**Authentication** answers: who are you? (`authMiddleware` — confirms a valid session exists)
**Authorization** answers: are you allowed to touch *this specific resource*?

These are separate concerns. Passing authentication does not imply authorization.

**IDOR (Insecure Direct Object Reference)**: when an API accepts a resource ID and uses it
without verifying the requester owns that resource. Any authenticated user can enumerate
integer IDs to access other users' data.

**Fix pattern**: scope every query or route to the requesting user's identity.

**Return 404, not 403** for ownership failures: 403 reveals the resource exists (just not yours),
which is exploitable information. 404 is ambiguous — the attacker can't distinguish "doesn't
exist" from "belongs to someone else."

**Where to enforce** depends on the schema ownership chain:
- Table has direct `userId` FK → enforce inside the query (`AND userId = ?`)
- Ownership through a join (`lesson → topic → userId`) → check after fetch at route level
- List endpoint → filter via subquery before results return (`inArray` with nested SELECT)

**The chain for this app**:
```
users.id
  └─ topics.userId             ← enforce in query
       └─ lessons.topicId      ← enforce at route level (joins topic)
       └─ concepts.topicId     ← enforce at route level (joins concept.topic)
            └─ review_cards.conceptId
       └─ api_usage.topicId    ← enforce via innerJoin in aggregation query
```

---

## Why Agents Can't Do OAuth (and the Bypass Pattern)

OAuth's authorization code flow is inherently browser-based. It requires:
1. A real browser navigating to the IdP's login page
2. The user interacting with that page (typing credentials, clicking consent)
3. The IdP redirecting back to your callback URL with a `?code=`

An AI agent (Claude Code, a CI bot, a CLI tool) has no browser. It can make HTTP requests,
but it can't follow redirects to an interactive login page, fill in forms, or maintain a
browser cookie jar. There's no API endpoint that says "give me a session token for this
user" — that would defeat the entire purpose of OAuth (third-party auth without sharing
credentials).

**The bypass pattern**: Add a secret token (`DEV_BYPASS_TOKEN`) that the agent sends as an
`Authorization: Bearer <token>` header. The server recognizes this header and skips the
cookie-based WorkOS flow, instead using the seeded local user.

**Why this is safe**:
- **Double gate**: Requires both the token AND `NODE_ENV !== 'production'`. Even if the token
  leaks into a production deploy, the production guard prevents activation.
- **No browser collision**: Browsers never send `Authorization` headers automatically. They
  send cookies. So the bypass path and the WorkOS path are physically disjoint.
- **Same user, same permissions**: The bypass uses the same seeded local user as local mode.
  No privilege escalation. The only thing that changes is how the user is identified.

**Where the check lives**: The `/me` endpoint needs its own bypass check because it's mounted
before `authMiddleware` (it's a public route for React's auth gate). All other endpoints go
through `authMiddleware`, which has the bypass merged into its existing local-user condition.

---

## Gotchas Encountered

- **`clientId` missing from constructor**: SDK throws "Missing client ID" during JWT verification
  even if `clientId` is passed to `loadSealedSession()` — must also be in `new WorkOS(key, { clientId })`
- **Dev/prod redirect mismatch**: After callback, `c.redirect("/")` stays on port 3001 (backend)
  in dev. Must redirect to `http://localhost:5173/` in dev, `/` in prod
- **Logout not invalidating IdP session**: Deleting the local cookie is insufficient. Must call
  `session.getLogoutUrl()` and redirect the browser there. Requires post-logout redirect URI
  registered in WorkOS dashboard
