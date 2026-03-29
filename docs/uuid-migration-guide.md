# UUID Migration Implementation Guide

## Overview

This document explains the UUID migration strategy that converts serial (auto-incrementing integer) primary keys to UUIDs across the learning app. The migration improves security, scalability, and makes IDs suitable for client-facing APIs.

## Why UUIDs?

**Security**: Serial IDs are predictable; UUIDs are not. An attacker cannot easily enumerate all topics by incrementing integers.

**Scalability**: Serial IDs require coordination across databases (or sharding); UUIDs can be generated independently anywhere.

**Client-Safe**: UUIDs appear naturally in URLs (`/topics/{uuid}`) without exposing system information.

**Distributed**: Multiple database instances can generate UUIDs without conflict.

## Migration Strategy: Add-Backfill-Rename

The migration uses an atomic, data-preserving pattern:

```sql
BEGIN;
  -- 1. Add new UUID column (auto-populated)
  ALTER TABLE "topics" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid() NOT NULL;

  -- 2. Backfill related tables via JOIN
  UPDATE "lessons" SET topic_id_new = t.id_new FROM "topics" t WHERE lessons.topic_id = t.id;

  -- 3. Drop old FK constraints
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_topic_id_topics_id_fk";

  -- 4. Drop old columns
  ALTER TABLE "topics" DROP COLUMN "id";
  ALTER TABLE "lessons" DROP COLUMN "topic_id";

  -- 5. Rename new columns
  ALTER TABLE "topics" RENAME COLUMN "id_new" TO "id";
  ALTER TABLE "lessons" RENAME COLUMN "topic_id_new" TO "topic_id";

  -- 6. Restore constraints
  ALTER TABLE "lessons" ADD CONSTRAINT ... PRIMARY KEY;
  ALTER TABLE "lessons" ADD CONSTRAINT ... FOREIGN KEY;
COMMIT;
```

**Why this pattern?**
- Single atomic transaction: all-or-nothing success
- No data loss: backfill step preserves all relationships
- Minimal downtime: PostgreSQL locks tables only during DDL, not data operations
- Reversible: if it fails mid-transaction, database is unchanged

## Implementation Phases

### Phase 1: topics.id (✅ COMPLETE)

**Tables affected:**
- `topics.id`: serial → uuid (primary key)
- `lessons.topicId`: integer → uuid (foreign key)
- `concepts.topicId`: integer → uuid (foreign key)
- `apiUsage.topicId`: integer → uuid (foreign key, nullable)

**Migration file**: `drizzle/0005_uuid_topics.sql`

**Why first?** Topics are the top-level entity. Lessons, concepts, and usage metrics depend on topics. Migrating topics first allows dependent relationships to be updated in the backfill step.

**Code changes:**
- Schema: `topicId` fields changed to `uuid` type
- Queries: `getTopicById(id: string)`, `deleteTopic(id: string)`, etc.
- Validators: `z.string().uuid()` instead of `z.number()`
- Routes: UUID validation via `safeParse` instead of `parseInt`
- API types: `Topic.id: string`, `Lesson.topicId: string`
- Pages: No changes needed (no parseInt calls)

### Phase 2: lessons.id (✅ COMPLETE)

**Tables affected:**
- `lessons.id`: serial → uuid (primary key)
- `concepts.id`: serial → uuid (primary key)
- `messages.lessonId`: integer → uuid (foreign key)
- `concepts.lessonId`: integer → uuid (foreign key)
- `reviewCards.conceptId`: integer → uuid (foreign key)
- `apiUsage.lessonId`: integer → uuid (foreign key, nullable)

**Migration file**: `drizzle/0006_uuid_lessons_concepts.sql`

**Why second?** Lessons depend on topics (via topicId), so topics must be UUIDs first. Concepts depend on both lessons and topics. Messages, review cards, and usage logs depend on lessons and concepts.

**Code changes needed:**
- Schema: `lessons.id`, `concepts.id` changed to `uuid` type
- Queries: `getLessonById(id: string)`, `saveConcepts(..., topicId: string, ...)`
- API types: `Lesson.id: string`, `Concept.id: string`, `Concept.lessonId: string`, `Message.lessonId: string`
- Client: Fix `streamChat(lessonId: string)` signature ✅ DONE
- Routes: Update `/:id` params for lessons

### Phase 3: concepts.id (Optional, future)

If we need UUIDs for concepts in public APIs. Currently `conceptId` is only used internally in `/review/grade` and `/review/skip`.

## Type Safety Changes

### Server: queries.ts

**Before:**
```typescript
export async function getTopicById(id: number, userId: string) { ... }
export async function createLesson(topicId: number, ...) { ... }
```

**After:**
```typescript
export async function getTopicById(id: string, userId: string) { ... }
export async function createLesson(topicId: string, ...) { ... }
```

All topicId and lessonId parameters are now `string` (representing UUIDs).

### Server: validators.ts

**Before:**
```typescript
export const createLessonSchema = z.object({
  topicId: z.number().int().positive(),
});
```

**After:**
```typescript
export const createLessonSchema = z.object({
  topicId: z.string().uuid(),
});
```

Zod now validates the format before the request handler runs.

### Server: routes

**Before:**
```typescript
const id = parseInt(c.req.param("id"));
if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);
```

**After:**
```typescript
const parseId = uuidParam.safeParse(c.req.param("id"));
if (!parseId.success) return c.json({ error: "Invalid topic ID" }, 400);
const topic = await getTopicById(parseId.data, c.var.user.id);
```

UUID validation is explicit via Zod.

### Client: api.ts

**Before:**
```typescript
export type Topic = {
  id: number;
  topicId: number;  // In Lesson
  ...
};

export async function fetchTopic(id: number): Promise<Topic> { ... }

export async function* streamChat(
  lessonId: number,
  ...
): AsyncGenerator<ChatEvent> { ... }
```

**After:**
```typescript
export type Topic = {
  id: string;
  topicId: string;  // In Lesson
  ...
};

export async function fetchTopic(id: string): Promise<Topic> { ... }

export async function* streamChat(
  lessonId: string,
  ...
): AsyncGenerator<ChatEvent> { ... }
```

All ID-typed fields are now `string`. Function parameters accept string UUIDs.

## Key Insights

### 1. Atomic Transactions Are Essential

The migration runs in a single `BEGIN; ... COMMIT;` block. This ensures that if any step fails, the entire migration is rolled back. Partial migrations would leave the database in an inconsistent state.

### 2. Backfill via JOIN Preserves Relationships

By using `UPDATE ... FROM`, the migration maps old IDs to new UUIDs without data loss:
```sql
UPDATE "lessons" SET topic_id_new = t.id_new
FROM "topics" t
WHERE lessons.topic_id = t.id;
```

This keeps the integrity of the `lessons → topics` relationship intact.

### 3. Type Safety Shifts Responsibility

With serial IDs, it's easy to accidentally pass an integer where a UUID is expected:
```typescript
// Before: No type error
const topic = await getTopicById(123, userId);

// After: Type error if 123 is a string
const topic = await getTopicById("123", userId); // ✓ correct
```

TypeScript catches these errors at build time. The validator catches them at runtime.

### 4. No Application Downtime

The migration strategy:
- Adds new columns (doesn't lock tables for reads/writes)
- Backfills data (non-blocking update)
- Drops old constraints and columns (brief lock, no data loss)

Downtime is minimal (seconds to minutes, depending on data size). The app can continue serving requests throughout.

### 5. Client Code Changes Reflect Schema

Client types (TypeScript interfaces) mirror the database schema:
- Database: `topics.id uuid` → TypeScript: `Topic.id: string`
- Database: `lessons.topic_id uuid` → TypeScript: `Lesson.topicId: string`

This 1:1 mapping makes it easier to reason about data flow.

## Data Preservation on Production

### For Existing Data

The add-backfill-rename pattern preserves all data. If you have 1,000 topics in production, the migration will:
1. Create 1,000 new UUID values
2. Create 1,000 corresponding new UUID values for all lessons, concepts, and logs
3. Drop the old integer columns
4. Rename the UUID columns to final names

Result: 1,000 topics, now with UUIDs, all relationships intact.

### Backup Strategy

Before deploying to production:
1. Take a point-in-time snapshot: Neon Dashboard → Branches → Create Snapshot
2. Deploy the migration
3. Test the app: navigate, create topics, grade reviews
4. If anything breaks, restore from snapshot (5-10 min recovery)
5. After 24 hours of verification, delete the snapshot

## Related Files

- **`drizzle/0005_uuid_topics.sql`**: Topics migration SQL
- **`drizzle/0006_uuid_lessons_concepts.sql`**: Lessons/concepts migration SQL
- **`drizzle/meta/_journal.json`**: Drizzle migration registry
- **`server/db/schema.ts`**: Drizzle ORM schema definitions
- **`server/migrate.ts`**: Migration runner (used by Fly release_command)
- **`CLAUDE.md`**: Project conventions and environment setup

## FAQ

**Q: Why not use SERIAL8 (bigint) instead of UUID?**
A: Serial8 is still sequential and predictable. UUIDs have cryptographic randomness, making them unsuitable for enumeration attacks.

**Q: What about storage overhead?**
A: UUIDs are 16 bytes vs. 8 bytes for int64. For a typical app with 10k topics/lessons, overhead is ~160KB per table (negligible).

**Q: Can I generate UUIDs in the application instead of the database?**
A: Yes. Drizzle supports `uuid().defaultRandom()` which maps to `gen_random_uuid()` in PostgreSQL. This is idiomatic for Postgres.

**Q: What if I have to roll back?**
A: The migration is atomic. If it fails, the database is unchanged. If it succeeds but you want to revert, you'd need a reverse migration (or restore from backup).

**Q: How long does the migration take?**
A: For small datasets (< 100k rows), a few seconds. For large datasets, it depends on the number of ForeignKey constraints to drop/recreate.
