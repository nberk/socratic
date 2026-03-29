# CLAUDE.md

## Project Overview

Socratic Learning App — a web app with two modes:
1. **Learn**: Socratic teaching sessions where Claude creates a lesson plan, assesses knowledge per section via dialogue, and extracts concepts when the student demonstrates understanding
2. **Review**: Daily spaced repetition using FSRS algorithm where Claude grades free-response answers

Single-user. No login required locally; WorkOS auth available for production. Personal learning tool — built to understand concepts, not just ship features.

## Learning Philosophy

This app is **dual-purpose**: a functional learning tool AND a vehicle for the developer to learn
the concepts behind what we build together. Getting things working is never enough on its own —
the goal is always transferable understanding.

When implementing features, Claude should:
- Teach the "why" before the "what" — ask Socratic questions that lead to discovery
- Explain the underlying concepts (protocols, security models, tradeoffs) as they appear in code
- Connect implementation choices to first principles, not just "this is how WorkOS does it"
- Ensure every concept introduced can be recognized and applied in a different stack

Current learning focus: **Authentication** — HTTP statelessness, cookies, OAuth 2.0, JWTs,
session sealing, CSRF, and token refresh. Concepts should be portable beyond WorkOS.

**Living lessons doc**: As new concepts are encountered or gotchas are discovered during
implementation, Claude should update `docs/auth-lessons.md`. This doc is the raw material
for a future reusable auth skill.

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 (client-side SPA)
- **Backend**: Hono (on Bun) — TypeScript-native, built-in SSE streaming
- **Database**: PostgreSQL — local via Docker (dev), Neon (prod)
- **ORM**: Drizzle (schema-as-code, type-safe)
- **AI**: @anthropic-ai/sdk (streaming + tool_use)
- **SRS**: ts-fsrs (FSRS algorithm, target 90% retention)
- **Error tracking**: Sentry (`@sentry/node` backend, `@sentry/react` frontend)

## Commands

**Claude preview**: use `preview_start "client"` and `preview_start "server-local"` for UI testing (no login required). Use `preview_start "server"` only when testing the WorkOS auth flow itself. Configs in `.claude/launch.json`. Vite binds to `0.0.0.0` (required — macOS defaults to IPv6 `::1`; preview browser connects via `127.0.0.1` IPv4 and would get ERR_CONNECTION_REFUSED otherwise).

```bash
bun run dev              # Start both servers (backend + frontend)
bun run dev:server       # Backend only — Hono on port 3001 (auto-restart via --watch)
bun run dev:client       # Frontend only — Vite on port 5173 (HMR)
bun run build            # Build frontend for production
bun run start            # Production server — NODE_ENV=production bun server/index.ts
bun run db:generate      # Generate migration from schema changes
bun run db:push          # Push schema directly to database (dev shortcut)
bun run db:migrate       # Run pending migrations
bun run db:studio        # Open Drizzle Studio (database browser)
bun run db:reset-dev     # Reset Neon dev branch to parent (main); requires NEON_PROJECT_ID env var
bun run deploy           # Deploy to Fly with Sentry build args (sources .env automatically)
```

## Project Structure

```
server/                     # Hono backend
├── index.ts                # Entry point, middleware stack, mounts routes, port 3001
├── routes/
│   ├── auth.ts             # WorkOS auth: /login, /callback, /me, /logout
│   ├── topics.ts           # CRUD for topics
│   ├── lessons.ts          # Create lesson + generate plan via Claude
│   ├── chat.ts             # SSE streaming Socratic conversation with tool_use
│   ├── review.ts           # Get due cards, grade answers via Claude + FSRS
│   ├── concepts.ts         # Browse/filter concepts
│   └── usage.ts            # API cost tracking per topic/lesson
├── lib/
│   ├── auth.ts             # WorkOS client init + authMiddleware (cookie → LocalUser)
│   ├── validators.ts       # Zod schemas for POST body validation
│   ├── claude.ts           # Anthropic client init + MODEL constant
│   ├── dates.ts            # Date formatting helpers
│   ├── prompts.ts          # System prompts (teaching, grading) + tool definitions
│   ├── srs.ts              # FSRS scheduler config + helpers (cardFromRow, ratingFromString)
│   ├── types.ts            # Shared TypeScript types
│   └── usage.ts            # API usage tracking helpers
├── migrate.ts              # Runs pending Drizzle migrations — used by Fly release_command
└── db/
    ├── index.ts            # Drizzle client — auto-detects local Postgres vs Neon by URL
    ├── schema.ts           # All 7 tables with relations
    └── queries.ts          # Reusable query functions

client/                     # Vite + React SPA
├── index.html
├── vite.config.ts          # Proxy /api → localhost:3001, outDir → dist/client
└── src/
    ├── main.tsx
    ├── App.tsx              # Auth gate (GET /api/auth/me) → Login or AppContent
    ├── api.ts               # Typed fetch helpers + SSE streaming via AsyncGenerator
    ├── pages/
    │   ├── Login.tsx        # Login screen with WorkOS sign-in button
    │   ├── Dashboard.tsx    # Home: due reviews, active topics
    │   ├── NewTopic.tsx     # Create topic form
    │   ├── TopicDetail.tsx  # Topic overview with lessons + concepts
    │   ├── Lesson.tsx       # Socratic chat session
    │   ├── Review.tsx       # Card-by-card review loop
    │   ├── Concepts.tsx     # Searchable concept browser
    │   └── Usage.tsx        # API cost dashboard
    ├── contexts/
    │   └── FullscreenContext.tsx  # Fullscreen toggle for lesson view
    └── components/
        ├── chat/            # ChatMessages, ChatInput, LessonPlanSidebar
        ├── review/          # ReviewCard, ReviewFeedback, ReviewSummary
        └── shared/          # Header, TopicCard, DueCountBadge, TrashIcon

drizzle/                    # Auto-generated migrations
drizzle.config.ts           # Points at server/db/schema.ts
docker-compose.yml          # Postgres 16 on port 5432
```

## Database

8 tables: `users`, `topics`, `lessons`, `messages`, `concepts`, `review_cards`, `review_logs`, `api_usage`

- Schema defined in `server/db/schema.ts` using Drizzle's `pgTable`
- Relations defined alongside tables (Drizzle relational queries)
- `server/db/index.ts` auto-selects driver: `postgres` for local, `@neondatabase/serverless` for Neon (checks if URL contains "neon.tech")
- Key indexes: `messages(lesson_id, created_at)`, `review_cards(due)`, unique constraint on `review_cards(concept_id)`
- `users.workos_id` has a unique constraint — used to look up the local user after WorkOS authenticates
- `topics.user_id` is a nullable FK to `users.id` — nullable to support pre-auth data; backfilled on first login

## Key Architecture Patterns

### Streaming Chat (SSE)
`POST /api/chat` uses Anthropic SDK streaming → Hono `streamSSE` → client `AsyncGenerator` in `api.ts`. Events: `text`, `section_complete`, `done`, `error`.

### Concept Extraction via tool_use
Claude calls `section_complete` tool inline during teaching when the student demonstrates understanding. The server intercepts the tool call mid-stream, saves concepts + creates review cards, advances the lesson section, then sends a continuation to Claude for the next section.

### FSRS Scheduling
- Config: `maximum_interval: 365`, `request_retention: 0.9`, `enable_fuzz: true`
- On concept creation: `createEmptyCard(new Date())` → due immediately
- On review: `scheduler.repeat(card, now)[rating]` → new card state
- Claude grades answers (again/hard/good/easy) mapped via `ratingFromString()`

### Review Grading
Claude evaluates free-response answers against `concept.ideal_answer` using the `grade_answer` tool. Returns structured `{ rating, feedback, correct_points, missed_points }`.

Grading philosophy: assess against a **minimum conceptual bar**, not a checklist. Pass if core understanding is demonstrated even with gaps. Always surface ways the answer could be better, regardless of grade. Don't fail for minor omissions when the core concept is clearly shown.

### Sentry Error Tracking

- **`server/instrument.ts`**: Must be imported second in `server/index.ts` (after dotenv, before everything else) — Sentry uses OpenTelemetry to patch libraries at load time; loading after Anthropic SDK breaks AI monitoring
- **Double-condition guard**: `enabled: NODE_ENV === "production" && !!SENTRY_DSN` — prevents dev noise and is zero-overhead for forks with no DSN
- **`setupHonoErrorHandler(app)`**: Catches unhandled crashes; does NOT catch errors caught inside try/catch blocks — those need manual `Sentry.captureException()`
- **`Sentry.setUser()`**: Called in `authMiddleware` after user is attached; tags all subsequent events with user ID
- **Source maps**: Sentry vite plugin uploads maps during `bun run build`. Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as build-time env vars. On Fly, pass via `--build-arg` (runtime secrets are not available during Docker build). The `oven/bun` base image also requires `ca-certificates` to be installed for the upload to succeed.

**Deploy command with source maps:**
```bash
bun run deploy
```
`scripts/deploy.sh` sources `.env` via `set -a / source / set +a`, then calls `fly deploy` with build args. Also passes `SENTRY_RELEASE=$(git rev-parse HEAD)` for release tracking. CI-compatible: if vars are already in the environment, the `.env` source step is skipped.

### Neon HTTP Driver Constraint
The Neon serverless HTTP driver (`@neondatabase/serverless`) does not support `db.transaction()`.
Multi-step operations (e.g., cascade deletes, concept + review_card inserts) use sequential
queries against `db` directly. Partial failures can leave orphaned rows but not corrupted
state; a retry or re-run cleans them up. This is acceptable for a single-user app.
If transaction support is needed later, switch to the WebSocket driver or use local Postgres.

## Authentication

Auth is mode-switched at startup based on `WORKOS_API_KEY` presence:
- **Local mode** (default): No login. Single user seeded by migration 0004 (`workosId=NULL`). `authMiddleware` looks up this user on every request and attaches it to context automatically.
- **WorkOS mode**: Full AuthKit with sealed sessions. Requires all `WORKOS_*` env vars. WorkOS client only instantiated when `WORKOS_API_KEY` is present.

WorkOS AuthKit — hosted login page (email/password + OAuth). Sealed sessions stored as `HttpOnly` cookies.

- **`server/lib/auth.ts`**: `isWorkOSMode` flag + `authMiddleware` — in local mode: attaches seeded user; in WorkOS mode: unseals `wos-session` cookie, validates JWT, refreshes if expired, attaches `LocalUser` to Hono context
- **`server/routes/auth.ts`**: local mode: stub handlers return 200/redirect; WorkOS mode: `/login` (redirect to WorkOS), `/callback` (exchange code → seal session → JIT upsert user), `/me` (auth check for React), `/logout` (clear cookie + WorkOS session)
- **`client/src/App.tsx`**: Calls `GET /api/auth/me` on mount; renders `<Login />` on 401, full app on 200
- **Middleware order in `server/index.ts`**: logger → security headers → CORS → health check (public) → auth routes (public) → `authMiddleware` → all other API routes

## Environment Variables

Defined in `.env` (gitignored):
- `DATABASE_URL` — PostgreSQL connection string (local or Neon)
- `ANTHROPIC_API_KEY` — Anthropic API key
- `WORKOS_API_KEY` (optional) — When present, enables WorkOS auth mode. When absent, app runs in local single-user mode.
- `WORKOS_CLIENT_ID` — WorkOS client ID (from WorkOS dashboard > Environment settings)
- `WORKOS_COOKIE_PASSWORD` — 32+ char random string for sealing session cookies (`openssl rand -base64 32`)
- `WORKOS_REDIRECT_URI` — OAuth callback URL (dev: `http://localhost:3001/api/auth/callback`)
- `DEV_BYPASS_TOKEN` (optional) — When set alongside `WORKOS_API_KEY` in non-production, allows API access via `Authorization: Bearer <token>` header. Lets agents (Claude Code, curl) hit the API without browser-based OAuth. Ignored when `NODE_ENV=production`.
- `APP_URL` — Production app URL, used for CORS origin (prod only)
- `SENTRY_DSN` — Backend Sentry DSN (opt-in; only active when `NODE_ENV=production`)
- `VITE_SENTRY_DSN` — Frontend Sentry DSN (baked into JS bundle at build time; requires `VITE_` prefix)
- `SENTRY_AUTH_TOKEN` — Sentry auth token for source map uploads (build-time only)
- `SENTRY_ORG` — Sentry org slug (build-time only)
- `SENTRY_PROJECT` — Sentry project slug for frontend (build-time only)

## Conventions

- `docs/` is committed — process docs, learnings, and reference material live here
- TypeScript strict mode enabled (`noUncheckedIndexedAccess`, `strict`)
- Bun as package manager and runtime (use `bun` not `npm`/`yarn`)
- Drizzle for all database operations (no raw SQL)
- Hono route files export a `Hono` instance, mounted in `server/index.ts`
- Frontend API calls go through typed helpers in `client/src/api.ts`
- Tailwind CSS v4 (utility-first, configured via Vite plugin)
- No SSR — pure client-side SPA with Vite proxy for API calls

## Database Migration Discipline

- **Dev only**: `db:push` is acceptable for fast local iteration
- **Any schema change destined for prod**:
  1. `bun run db:generate` — creates the `.sql` migration file
  2. Commit the migration file alongside the schema change
  3. `fly deploy` — the `release_command` in `fly.toml` runs `server/migrate.ts` automatically before traffic switches over
- `server/migrate.ts` uses `drizzle-orm`'s `migrate()` function (not `drizzle-kit`) — reads SQL files from `drizzle/`, applies only unapplied ones, idempotent
- Never use `db:push` as a substitute for proper migrations on shared/prod data

## Planning Convention

For any feature spanning multiple files or requiring architectural decisions:
1. Write the full plan to `docs/<feature>.md` before touching code
2. Ask: "Are there any significant decisions that need your input?"
3. Execute section by section after the plan is reviewed

## Working Conventions

- **Scoped changes only**: fix the bug, add the feature — don't also refactor surrounding code. Flag improvements separately.
- **Git**: suggest what to commit and recommend a message; don't auto-commit unless asked. Format: `verb + what + context`.
- **Living docs**: when completing work that adds env vars, tables, commands, or new patterns — update this file and any relevant `docs/` file. That's part of done.
- **Error handling**: before declaring a feature done, consider null/empty/network-failure cases. Manual testing catches these retroactively — anticipate them.
