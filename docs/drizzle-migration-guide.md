# Drizzle Migration Best Practices

## The Problem We Solved

When migrating a large schema (serial → UUID across multiple tables), Drizzle Kit's auto-generator can't handle complex data transformations. You must create hand-written migrations instead.

## The Correct Process

### 1. Update Schema First
Modify `server/db/schema.ts` with the new column types. Don't run migrations yet.

### 2. Create Three Files (This Is Critical!)

When you hand-write a Drizzle migration, you MUST create all three:

#### a) `drizzle/000X_migration_name.sql`
The actual DDL statements (CREATE, ALTER, DROP, etc.)

```sql
BEGIN;
-- Your migration here
COMMIT;
```

#### b) `drizzle/meta/_journal.json` Entry
Register the migration in the journal so Drizzle knows it exists:

```json
{
  "idx": 6,
  "version": "7",
  "when": 1741087200000,
  "tag": "0006_uuid_lessons_concepts",
  "breakpoints": true
}
```

#### c) `drizzle/meta/000X_snapshot.json`
Copy the previous snapshot, then use `jq` to update column types to match post-migration state:

```bash
cp drizzle/meta/0005_snapshot.json drizzle/meta/0006_snapshot.json
jq '.id = "new-uuid" | .prevId = "previous-uuid" | .tables["public.lessons"].columns.id.type = "uuid"' drizzle/meta/0006_snapshot.json
```

⚠️ **Without the snapshot, drizzle-orm's `migrate()` function won't recognize the migration.**

### 3. The Big Change: Run SQL Directly

Drizzle Kit's `migrate()` function has issues with complex transactions on Neon. Instead, use Neon's transaction API directly:

```typescript
// DON'T use: bunx drizzle-kit migrate (fails with "write EPIPE")
// DO use: Direct SQL via Neon API

const sqlStatements = [
  "ALTER TABLE...",
  "UPDATE...",
  // ... all your SQL statements as an array
];

await neon.run_sql_transaction({
  projectId: "...",
  branchId: "...",
  sqlStatements
});
```

### 4. Update All Type Signatures

After schema changes, update:
- `server/db/queries.ts` — function parameter types
- `server/lib/validators.ts` — Zod schemas
- `server/routes/*.ts` — route handlers (add validation with `uuidParam.safeParse()`)
- `client/src/api.ts` — TypeScript types for API responses
- `client/src/pages/*.tsx` — remove any `parseInt()` calls on UUID fields

### 5. Verify in Database

After running the migration directly:

```typescript
// Check schema
const schema = await describeTableSchema(projectId, branchId, "lessons");
console.log(schema.raw.columns[0]); // Should show type: "uuid"
```

## The Data Migration Pattern

For serial → UUID with foreign keys:

```sql
-- 1. Create new UUID columns
ALTER TABLE target ADD COLUMN id_new uuid DEFAULT gen_random_uuid();

-- 2. Create new FK columns (nullable)
ALTER TABLE child ADD COLUMN parent_id_new uuid;

-- 3. Backfill via JOIN (maps old int IDs to new UUIDs)
UPDATE child c SET parent_id_new = p.id_new FROM parent p WHERE c.parent_id = p.id;

-- 4. Drop old constraints (in dependency order!)
ALTER TABLE child DROP CONSTRAINT child_parent_id_fk;
DROP INDEX IF EXISTS old_index;

-- 5. Drop old columns
ALTER TABLE target DROP CONSTRAINT target_pkey;
ALTER TABLE target DROP COLUMN id;
ALTER TABLE child DROP COLUMN parent_id;

-- 6. Rename new columns to final names
ALTER TABLE target RENAME COLUMN id_new TO id;
ALTER TABLE child RENAME COLUMN parent_id_new TO parent_id;

-- 7. Set NOT NULL
ALTER TABLE child ALTER COLUMN parent_id SET NOT NULL;

-- 8. Restore PK + default
ALTER TABLE target ADD PRIMARY KEY (id);
ALTER TABLE target ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 9. Restore FKs
ALTER TABLE child ADD CONSTRAINT child_parent_id_fk
  FOREIGN KEY (parent_id) REFERENCES target(id);

-- 10. Restore indexes
CREATE INDEX child_parent_id_idx ON child USING btree (parent_id);

COMMIT;
```

**Key principles:**
- Always wrap in `BEGIN...COMMIT`
- Drop constraints before dropping columns
- Use column renames, not drops + recreates
- Backfill via explicit JOINs for correctness
- Restore defaults and constraints last

## Checklist for Future UUID Migrations

- [ ] Update schema.ts
- [ ] Create `.sql` file with full transaction
- [ ] Add entry to `_journal.json`
- [ ] Copy & update snapshot with `jq`
- [ ] Update `queries.ts` function signatures
- [ ] Update `validators.ts` schemas
- [ ] Update route handlers with validation
- [ ] Update client `api.ts` types
- [ ] Update client components (remove parseInt)
- [ ] Run migration via direct SQL (not `db:migrate`)
- [ ] Verify schema in database
- [ ] Test full flow end-to-end

## Why Not Use `db:migrate`?

The `bunx drizzle-kit migrate` command works locally with Docker Postgres, but fails on Neon with "write EPIPE" errors. This is due to how Neon's connection pooler interacts with Drizzle's migration runner on complex transactions.

**Solution:** Use Neon's API directly via `run_sql_transaction()`.
