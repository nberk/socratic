# Database Migrations in Production: Principles and Practice

> This document teaches production-grade migration discipline through this project's concrete implementation. The goal is transferable understanding — patterns that apply to any stack, team, or deployment model.

---

## The Fundamental Problem: Code and Schema Deploy Asynchronously

Most developers treat code and database as a unit: you write code, update the schema, ship both together, and everything works. **In production, this intuition breaks down.**

Here's the reality:

```
Timeline:
  0.00s  ──→ Deploy starts
  0.02s  ──→ New schema is live (migration runs first via release_command)
  0.03s  ──→ Old app is still handling traffic against new schema
  0.04s  ──→ First error if old code can't handle new schema
  0.15s  ──→ New app is live
```

Even with Fly's `release_command` — which runs migrations *before* traffic switches — there's a window where **code and schema are mismatched**. This gap is the root cause of all migration-related failures.

### Why This Window Exists

1. **Migrations must run before the new app starts** — you can't swap code+schema atomically
2. **Old app instances keep handling traffic** — they're not immediately killed; they're gracefully drained
3. **That drain takes time** — from milliseconds to minutes depending on long-running requests

This is true even in containerized deployments with sophisticated orchestration. The window is very small, but it's real.

### The Core Insight

**A migration is safe if and only if old code can run correctly against the new schema.** This is called *backward compatibility*.

A migration is *breaking* if old code fails the moment the schema changes. Examples:
- Dropping a column the old code reads
- Renaming a column
- Adding a NOT NULL column without a default
- Narrowing a type (e.g., `text` to `varchar(10)`)

Your entire migration discipline — from this point forward — is about **ensuring every migration is backward compatible**.

---

## Safe vs. Breaking Migrations: The Measure of Success

### Safe (Additive) Migrations

These migrations add new schema without removing or changing what exists. Old code still works:

| Migration | Old Code Behavior | Safe? |
|-----------|-------------------|-------|
| Add a nullable column | Reads NULL; ignores field | ✅ Yes |
| Add a table | Doesn't touch it; no impact | ✅ Yes |
| Add an index | Query still works (faster) | ✅ Yes |
| Widen a type (`varchar(50)` → `text`) | Reads the same data | ✅ Yes |
| Add a NOT NULL column with a default | Column is populated automatically | ✅ Yes (if default is meaningful) |

**Test**: Old code can run all its code paths without error, with or without the new schema elements.

### Breaking (Destructive) Migrations

These remove or alter what exists. Old code depends on them:

| Migration | Old Code Impact | Safe? |
|-----------|-----------------|-------|
| Drop a column | Code reads NULL/error | ❌ No |
| Rename a column | Code uses old name, fails | ❌ No |
| NOT NULL without default | New rows fail to insert | ❌ No |
| Narrow a type (`text` → `varchar(10)`) | Old long strings break | ❌ No |
| Change a constraint | Violates assumptions | ❌ No |

**Why they break**: The schema change happens instantly. Old code still expects the old structure. No grace period.

### The Consequence

If you deploy a breaking migration, your window of pain extends from milliseconds (schema changes instantly) to minutes (Fly gracefully drains old instances while new app handles the traffic). During that window, **errors will be logged and users may see failures**.

The only way to "undo" this is to roll back the entire release — revert the code, revert the schema, and absorb the data loss if writes happened between migration and rollback.

---

## The Expand-and-Contract Pattern: Safe Destructive Changes

You can't always stick to additive migrations. Sometimes you need to drop a column, rename one, or change a type. The solution is **expand-and-contract**: a three-phase approach that makes destructive changes safe.

### The Three Phases

**Phase 1: Expand** — Add new alongside old
- Add the new column/table/structure
- Populate it from the old one
- Don't remove the old thing yet
- **Old code still works** ✅

**Phase 2: Deploy new app** — Use the new thing
- New code writes to the new column/table
- New code reads from the new one
- Old code is gone (you've redeployed with new code)
- **Old code no longer matters** ✅

**Phase 3: Contract** — Remove old alongside new
- Drop the old column/table/constraint
- **Nothing depends on it anymore** ✅

### Concrete Example: Changing `topics.id` from Serial to UUID

This project's `uuid-topics` migration is a textbook expand-and-contract. Here's how it maps:

**Phase 1: Expand** (in the migration):
```sql
-- Add new UUID columns alongside old integer ones
ALTER TABLE topics ADD COLUMN id_new uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE lessons ADD COLUMN topic_id_new uuid;
ALTER TABLE concepts ADD COLUMN topic_id_new uuid;

-- Backfill the new columns from the old ones via JOIN
UPDATE lessons l SET topic_id_new = t.id_new FROM topics t WHERE l.topic_id = t.id;
UPDATE concepts c SET topic_id_new = t.id_new FROM topics t WHERE c.topic_id = t.id;

-- Drop old constraints (required before dropping referenced columns)
ALTER TABLE lessons DROP CONSTRAINT lessons_topic_id_topics_id_fk;
ALTER TABLE concepts DROP CONSTRAINT concepts_topic_id_topics_id_fk;

-- Drop and rename in one transaction
ALTER TABLE topics DROP COLUMN id;
ALTER TABLE topics RENAME COLUMN id_new TO id;
ALTER TABLE lessons DROP COLUMN topic_id;
ALTER TABLE lessons RENAME COLUMN topic_id_new TO topic_id;
-- ... and so on
```

**At the end of Phase 1**: The schema has changed, but logically it's the same structure. Old code can still run.

**Phase 2: Deploy** (happens automatically with `fly deploy`):
- New code uses `string` for topic IDs instead of `number`
- Old code is completely replaced

**Phase 3: Contract** (would be a follow-up migration):
- Drop any remaining old columns
- Remove compatibility shims
- (In this case, Phase 1 and 3 happened in the same transaction, so there's no separate step — but the *pattern* remains)

### Why This Pattern is Worth Learning

Expand-and-contract is not unique to this project. It's the standard approach in any mature engineering organization:
- **Stripe**: Uses it for all breaking API changes
- **AWS**: Uses it for schema evolutions in DynamoDB
- **Postgres itself**: Uses it internally for type changes
- **Every framework with a solid migration story**: Teaches this pattern

When you see a migration split across multiple releases, or deployed in stages over weeks — you're seeing expand-and-contract.

---

## Environment Strategy: Testing Real Migrations Against Real Data

Without a way to test migrations on production-shaped data, you're guessing. Your options are:

1. **Dump/restore production to local** — slow, data diverges immediately, not representative
2. **Run on production directly** — no safety net
3. **Synthetic staging** — doesn't match the real data shape/volume

This project uses **Neon branching** as a fourth option: synthetic staging with real production data.

### How Neon Branching Works

Neon uses copy-on-write storage. When you create a branch:

```
Neon storage: fork of production data
├── Shared: production data (read-only, zero-copy)
└── Writable layer: changes you make (instant to create, fast to read)
```

Creating a branch costs almost nothing and gives you a full, live copy of production. You can:
- Run migrations against it
- Test your app against it
- Throw it away when done
- Repeat as needed

**Key advantage**: Real data without risking production.

### The Environment Sequence

```
┌─────────────┐
│   Local Dev │  ← Fast iteration, no real data, disposable
│ (Docker)    │
└──────┬──────┘
       ↓
┌─────────────┐
│ Neon Branch │  ← Real production data, no risk, disposable
│  (Staging)  │
└──────┬──────┘
       ↓
┌─────────────┐
│  Neon Main  │  ← Production, no second chances
│   (Prod)    │
└─────────────┘
```

**Each step answers a different question:**
1. **Local**: "Does my code work at all?"
2. **Neon branch**: "Does my migration work against real data? Can the app handle the new schema?"
3. **Neon main**: "Does it work in production?"

### Evolution: Neon Branching → CI/CD

This workflow is manual today. Scaling to CI/CD looks like:

```yaml
on: pull_request
steps:
  1. Create Neon branch from main
  2. Run migration against branch
  3. Run app tests against branch
  4. If all pass: approve for merge
  5. On merge: auto-deploy to production
  6. Delete branch
```

This is the end state. For now, the manual workflow teaches the same discipline.

---

## Rollback: The Strategy Depends on What You Shipped

You've deployed a migration. Something went wrong. Your options:

### Option 1: Revert the Release (Safe if migration was additive)

Fly lets you revert to the previous release in seconds. This redeploys old code against the new schema.

**This only works if your migration was backward compatible.** If the migration was additive (added columns, added tables, added indexes), old code runs fine on the new schema. Writes go to the new schema, old code ignores the new parts.

**Example**: You added a `metadata` column and new code was supposed to use it. Old code reverted. Old code ignores the column, new writes never populate it, but the app works.

**If the migration was destructive** (dropped a column, renamed one), old code fails immediately. Rollback doesn't help — it just leaves you with the new schema but old code trying to read the dropped column.

### Option 2: Down Migrations (Complex, error-prone)

Write explicit SQL to undo the migration. Example: "add back the column we dropped, re-backfill the old data."

**Why this is risky**: After the migration, new code writes to the new schema. Down-migrations can't restore that data. You're choosing between:
- Losing new writes after the migration
- Leaving data in an inconsistent state

Postgres supports this via explicit down migrations, but they're a last resort, not a standard rollback.

### Option 3: Point-in-Time Restore (Nuclear option)

Rewind the database to a point before the migration. Neon and AWS RDS both support this.

**Cost**: All writes after the migration are lost. Your app goes dark or serves stale data for several minutes.

### The Real Strategy: Get the Migration Right the First Time

The right rollback strategy isn't *choosing* a rollback method — it's **ensuring your migration is additive so reverting the release is safe and fast**.

This is why expand-and-contract matters. It ensures your migration is safe to revert.

---

## This Project's Implementation: Concrete Process

Now that you understand the principles, here's how this specific project implements them.

### Environment Variables

Before you begin, set these in `.env` (one-time setup):

```env
# Neon CLI auth
NEON_API_KEY=your_key_from_neon.tech_account_settings
NEON_PROJECT_ID=silent-haze-12345678  # Get from: neonctl projects list
```

### One-Time Setup: Neon CLI

Install the Neon CLI if you haven't already:
```bash
npm install -g neonctl
neonctl auth  # Opens browser to log in
```

Or use the `NEON_API_KEY` env var for non-interactive use (CI, scripts).

### The Repeatable Process: 6 Steps

For **every** schema change, follow this workflow:

#### Step 1: Create a Neon Branch

```bash
./scripts/neon-branch.sh create test/your-migration-name
```

This creates an instant copy of production with a full dataset. Save the printed connection string.

Naming convention: `test/<feature-name>` (e.g., `test/uuid-topics`)

#### Step 2: Generate the Migration SQL

**If Drizzle can auto-generate it** (adding columns, creating tables):

```bash
# After editing server/db/schema.ts:
bun run db:generate
# Inspect the generated file in drizzle/
```

**If you need a hand-written migration** (type changes, complex backfills):

- Create `drizzle/000N_description.sql` by hand
- Follow the numbering from `drizzle/meta/_journal.json`
- Use `--> statement-breakpoint` between statements (Drizzle's delimiter)
- Wrap everything in `BEGIN; ... COMMIT;` for atomicity

The uuid-topics migration is a good example of when and how to hand-write.

#### Step 3: Test Against the Branch

```bash
DATABASE_URL="connection-string-from-step-1" bun run db:migrate
```

You should see "Migrations complete" with no errors. `server/migrate.ts` auto-detects `neon.tech` in the URL and uses the Neon HTTP driver.

#### Step 4: Test the App Against the Branch

In one shell:
```bash
DATABASE_URL="connection-string-from-step-1" bun run dev:server
```

In another:
```bash
bun run dev:client
```

Manually verify the key flows that touch the migrated data. Don't skip this — Neon branches are free and fast; using them is how you prevent production incidents.

#### Step 5: Commit and Deploy

```bash
git add drizzle/000N_*.sql drizzle/meta/ server/db/schema.ts \
        # ... all changed app files
git commit -m "Migrate topics.id from serial to uuid"
git push
fly deploy
```

`fly deploy` runs the migration via `release_command = "bun server/migrate.ts"` against production **before** traffic switches. If the migration fails, the deploy is aborted and old code keeps running.

This is your safety net.

#### Step 6: Clean Up

```bash
./scripts/neon-branch.sh delete test/your-migration-name
```

### Helper Script: `scripts/neon-branch.sh`

This script wraps Neon CLI commands:

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../.env" 2>/dev/null || true

CMD=${1:-}
NAME=${2:-}

case $CMD in
  create)
    neonctl branches create --project-id "$NEON_PROJECT_ID" --name "$NAME"
    echo ""
    echo "Connection string:"
    neonctl connection-string --project-id "$NEON_PROJECT_ID" \
      --branch "$NAME" --database-name neondb --role-name neondb_owner
    ;;
  delete)
    neonctl branches delete --project-id "$NEON_PROJECT_ID" "$NAME"
    ;;
  list)
    neonctl branches list --project-id "$NEON_PROJECT_ID"
    ;;
  url)
    neonctl connection-string --project-id "$NEON_PROJECT_ID" \
      --branch "$NAME" --database-name neondb --role-name neondb_owner
    ;;
  *)
    echo "Usage: $0 create|delete|list|url <branch-name>"
    exit 1
    ;;
esac
```

Usage:
```bash
./scripts/neon-branch.sh create test/my-feature     # Create + print connection string
./scripts/neon-branch.sh url test/my-feature        # Print connection string for existing branch
./scripts/neon-branch.sh list                       # List all branches
./scripts/neon-branch.sh delete test/my-feature     # Delete when done
```

---

## Applied Example: `topics.id` Serial → UUID

This project's `uuid-topics` migration is the canonical example of expand-and-contract in action. See `docs/db-migration-learnings.md` for the conceptual deep dive.

### The Challenge

Drizzle cannot auto-generate a `serial → uuid` migration cleanly (it would try to drop and recreate tables, losing data). The solution: hand-write using the add-backfill-rename pattern.

### The Migration SQL

All steps happen in a single transaction (BEGIN/COMMIT) to ensure atomicity:

```sql
BEGIN;

-- Phase 1: Add UUID column to topics with auto-generated values
ALTER TABLE "topics" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid() NOT NULL;

-- Add UUID FK columns to child tables (nullable during migration)
ALTER TABLE "lessons" ADD COLUMN "topic_id_new" uuid;
ALTER TABLE "concepts" ADD COLUMN "topic_id_new" uuid;
ALTER TABLE "api_usage" ADD COLUMN "topic_id_new" uuid;

-- Phase 1b: Backfill via JOIN — map old integer FK to new UUID
UPDATE "lessons" l SET topic_id_new = t.id_new FROM "topics" t WHERE l.topic_id = t.id;
UPDATE "concepts" c SET topic_id_new = t.id_new FROM "topics" t WHERE c.topic_id = t.id;
UPDATE "api_usage" a SET topic_id_new = t.id_new FROM "topics" t WHERE a.topic_id = t.id;

-- Drop old FK constraints (required before dropping the columns they reference)
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_topic_id_topics_id_fk";
ALTER TABLE "concepts" DROP CONSTRAINT "concepts_topic_id_topics_id_fk";
ALTER TABLE "api_usage" DROP CONSTRAINT "api_usage_topic_id_topics_id_fk";
DROP INDEX IF EXISTS "api_usage_topic_id_idx";

-- Drop old PK and columns
ALTER TABLE "topics" DROP CONSTRAINT "topics_pkey";
ALTER TABLE "topics" DROP COLUMN "id";
ALTER TABLE "lessons" DROP COLUMN "topic_id";
ALTER TABLE "concepts" DROP COLUMN "topic_id";
ALTER TABLE "api_usage" DROP COLUMN "topic_id";

-- Rename UUID columns to final names
ALTER TABLE "topics" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "lessons" RENAME COLUMN "topic_id_new" TO "topic_id";
ALTER TABLE "concepts" RENAME COLUMN "topic_id_new" TO "topic_id";
ALTER TABLE "api_usage" RENAME COLUMN "topic_id_new" TO "topic_id";

-- Set NOT NULL on required FKs
ALTER TABLE "lessons" ALTER COLUMN "topic_id" SET NOT NULL;
ALTER TABLE "concepts" ALTER COLUMN "topic_id" SET NOT NULL;

-- Restore PK + default
ALTER TABLE "topics" ADD PRIMARY KEY ("id");
ALTER TABLE "topics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Restore FK constraints
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;

-- Restore index
CREATE INDEX "api_usage_topic_id_idx" ON "api_usage" USING btree ("topic_id");

COMMIT;
```

**Key insight**: This all happens in one transaction. At the moment COMMIT executes, the schema changes atomically. Old code never sees intermediate states.

### Code Changes

All type signatures changed from `number` to `string` for topic IDs:

**Schema** (`server/db/schema.ts`):
```typescript
// Before
topics: serial("id").primaryKey()

// After
topics: uuid("id").primaryKey().defaultRandom()
```

**Server validators** (`server/lib/validators.ts`):
```typescript
// Before
z.number().int().positive()

// After
z.string().uuid()
```

**Client types** (`client/src/api.ts`):
```typescript
// Before
interface Topic { id: number; ... }

// After
interface Topic { id: string; ... }
```

**All ID-handling code**: Removed `parseInt()` checks, adapted to string UUIDs.

---

## Pre-Deployment Checklist: Is This Migration Safe?

Before you run `fly deploy`, answer these questions:

### 1. Backward Compatibility
- ✅ Can old code (the current production version) run against the new schema?
- ✅ If old code reads a column you added, will it get NULL? Is that fine?
- ✅ If old code writes to a new table, are you OK with that?
- ❌ If the answer is "old code will fail," you have a breaking migration and need expand-and-contract.

### 2. Real-Data Testing
- ✅ Did you test this migration on a Neon branch with production data?
- ✅ Did you run the app against the branch and test affected flows?
- ✅ Did you check for edge cases (null values, unusual data shapes, large tables)?
- ❌ If you only tested locally or with test fixtures, the migration isn't validated.

### 3. Atomicity (Where Applicable)
- ✅ Is the migration wrapped in `BEGIN; ... COMMIT;`?
- ✅ Are related changes (e.g., add column + backfill + rename) in the same transaction?
- ❌ If changes span multiple migrations, they can partially fail, leaving the schema in an inconsistent state.

### 4. No Surprises
- ✅ Have you read the migration SQL before deploying?
- ✅ Do you understand what each step does and why?
- ✅ Have you checked for constraint/foreign key dependencies?
- ❌ If you auto-generated it without reviewing, something might break later.

### 5. Rollback Plan
- ✅ If something goes wrong, can you revert the release? (Safe if migration is additive)
- ✅ If the migration is destructive, do you have a point-in-time restore time window?
- ✅ Have you alerted the team before deploying?
- ❌ If you have no rollback plan, wait — don't deploy.

---

## Evolving to CI/CD: The Automation Dream

This manual process scales to automated CI/CD without changing the principles. Here's what happens:

### Pull Request Workflow (Future)

```yaml
name: Database Migrations
on: [pull_request]

jobs:
  test-migration:
    runs-on: ubuntu-latest
    steps:
      # 1. Create Neon branch from main
      - name: Create test branch
        run: neonctl branches create --from main --name test/pr-${{ github.event.number }}

      # 2. Run the migration against the branch
      - name: Run migration
        run: DATABASE_URL=<branch-url> bun run db:migrate

      # 3. Run integration tests against the branch
      - name: Test app
        run: bun test:integration

      # 4. Clean up
      - name: Delete branch
        run: neonctl branches delete test/pr-${{ github.event.number }}
```

### Deploy Workflow (Future)

```yaml
on: push main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: fly deploy
      # Fly's release_command runs the migration automatically
      # If migration fails, deploy is rolled back
```

### What Stays the Same

- **Migration safety rules** still apply — additive changes are safer
- **Expand-and-contract** is still the pattern for breaking changes
- **Rollback strategy** depends on whether the migration was backward compatible
- **Human review** of migration SQL is still important

### What Changes

- **Manual creation** → automated via neonctl API
- **Manual testing** → automated test suite
- **Manual cleanup** → automatic on merge/close
- **Deployment decision** → automatic on merge to main
- **Feedback loop** → seconds (CI) instead of minutes (manual)

The principles don't change; they just run faster.

---

## Summary: The Migration Mindset

Production database migrations are constraint problems:

1. **Code and schema deploy asynchronously** — there will be a mismatch window
2. **Your responsibility is to make that window safe** — via backward-compatible migrations
3. **Testing against real data is non-negotiable** — Neon branching makes this cheap
4. **Destructive changes need expand-and-contract** — to avoid breaking the mismatch window
5. **Rollback is only safe if your migration was additive** — choose your migration strategy accordingly

Every principle here applies whether you're shipping on a solo hobby project or a team at a scale-up. The tools change (GitHub Actions, Neon, Fly), but the discipline is the same.

Good migrations are the difference between shipping in confidence and shipping in fear. The checklist at the end of this doc is how you know which camp you're in.
