# Deployment: Fly.io + Neon + WorkOS

## Architecture

Production runs as a single Hono process on Fly.io (port 3001) serving both the API and the
built React SPA from `dist/client/`. Neon is the production Postgres database. WorkOS handles
authentication via AuthKit (invitation-only, email + password).

## Infrastructure

| Thing | Where | How to update |
|-------|-------|---------------|
| App code + frontend | Fly.io container | `fly deploy` |
| Database schema | Neon Postgres | Automatic via `release_command` on deploy |
| Database data | Neon Postgres | Persistent, survives deploys |
| Secrets | Fly.io secrets | `fly secrets set KEY="value"` |

## Fly.io Secrets

All required secrets (set via `fly secrets set` or `fly secrets import`):

```
DATABASE_URL          # Neon connection string (must contain "neon.tech")
ANTHROPIC_API_KEY     # Anthropic API key
WORKOS_API_KEY        # WorkOS Production API key
WORKOS_CLIENT_ID      # WorkOS Production Client ID
WORKOS_COOKIE_PASSWORD  # 32+ char random string (openssl rand -base64 32)
WORKOS_REDIRECT_URI   # https://<your-app>.fly.dev/api/auth/callback
APP_URL               # https://<your-app>.fly.dev (used for CORS)
```

## Deploy Workflow

### Code changes
```bash
fly deploy    # Builds Docker image, runs migrations, swaps traffic
```

### Schema changes
1. Edit `server/db/schema.ts`
2. `bun run db:generate` — creates SQL file in `drizzle/`
3. Commit the migration file alongside the schema change
4. `fly deploy` — `release_command` runs `server/migrate.ts` before traffic switches

The `release_command` in `fly.toml` ensures migrations always run before the new code goes
live. If the migration fails, the deploy is aborted and the old version keeps running.

### Secrets changes
```bash
fly secrets set KEY="value"    # Restarts machine with new value
fly secrets list               # Show names (values hidden)
```

## Docker Build (multi-stage)

Three stages in `Dockerfile`:
1. **deps** — `bun install --production` (no devDependencies)
2. **build** — full install + `bun run build` (compiles React → `dist/client/`)
3. **runtime** — copies `node_modules` from deps, `dist/` from build, `server/`, `drizzle/`

`drizzle/` is included in the runtime image so `server/migrate.ts` can read the SQL files.

## WorkOS Production Setup

- Environment: **Production** (not Staging) — uses real credentials
- Auth method: Email + Password, **invitation-only** (Allow sign-ups is OFF)
- To add a user: WorkOS dashboard → Users → Invitations → "Invite user"
- AuthKit hosted at: `<your-subdomain>.authkit.app`
- Redirect URI registered in WorkOS: `https://<your-app>.fly.dev/api/auth/callback`

## Monitoring

```bash
fly logs          # Tail live logs
fly status        # Machine health + current release
fly releases      # List recent deploys (for rollback)
```

## Rollback

```bash
fly releases                          # Find previous image hash
fly deploy --image <previous-image>   # Redeploy previous version
```

## Cost

`shared-cpu-1x` with `auto_stop_machines = "stop"` and `min_machines_running = 0`.
Machine stops when idle, restarts on next request (~1-2s cold start). For a personal tool
used a few times a day, cost is near zero (within Fly.io free allowance with credit card on file).

> Note: A credit card must be on file with Fly.io — trial machines stop after 5 minutes,
> which breaks OAuth callback flows that take longer than that.
