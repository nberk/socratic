BEGIN;

-- Phase 2: lessons.id serial → uuid
-- Phase 3: concepts.id serial → uuid

-- 1. Add UUID columns (auto-populated by PostgreSQL)
ALTER TABLE "lessons" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE "concepts" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid() NOT NULL;

-- 2. Add UUID FK columns for dependent tables (nullable during migration)
ALTER TABLE "messages" ADD COLUMN "lesson_id_new" uuid;
ALTER TABLE "review_cards" ADD COLUMN "concept_id_new" uuid;
ALTER TABLE "api_usage" ADD COLUMN "lesson_id_new" uuid;

-- 3. Backfill FKs via JOIN
UPDATE "messages" m SET lesson_id_new = l.id_new FROM "lessons" l WHERE m.lesson_id = l.id;
UPDATE "review_cards" rc SET concept_id_new = c.id_new FROM "concepts" c WHERE rc.concept_id = c.id;
UPDATE "api_usage" a SET lesson_id_new = l.id_new FROM "lessons" l WHERE a.lesson_id = l.id;

-- Also need to update concepts.lesson_id since concepts.id is being migrated too
ALTER TABLE "concepts" ADD COLUMN "lesson_id_new" uuid;
UPDATE "concepts" c SET lesson_id_new = l.id_new FROM "lessons" l WHERE c.lesson_id = l.id;

-- 4. Drop old FK constraints (in dependency order)
ALTER TABLE "review_cards" DROP CONSTRAINT "review_cards_concept_id_concepts_id_fk";
ALTER TABLE "messages" DROP CONSTRAINT "messages_lesson_id_lessons_id_fk";
ALTER TABLE "concepts" DROP CONSTRAINT "concepts_lesson_id_lessons_id_fk";
ALTER TABLE "api_usage" DROP CONSTRAINT "api_usage_lesson_id_lessons_id_fk";
DROP INDEX IF EXISTS "messages_lesson_created_idx";

-- 5. Drop old PK and integer columns
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_pkey";
ALTER TABLE "concepts" DROP CONSTRAINT "concepts_pkey";
ALTER TABLE "lessons" DROP COLUMN "id";
ALTER TABLE "concepts" DROP COLUMN "id";
ALTER TABLE "messages" DROP COLUMN "lesson_id";
ALTER TABLE "review_cards" DROP COLUMN "concept_id";
ALTER TABLE "concepts" DROP COLUMN "lesson_id";
ALTER TABLE "api_usage" DROP COLUMN "lesson_id";

-- 6. Rename UUID columns to final names
ALTER TABLE "lessons" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "concepts" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "concepts" RENAME COLUMN "lesson_id_new" TO "lesson_id";
ALTER TABLE "messages" RENAME COLUMN "lesson_id_new" TO "lesson_id";
ALTER TABLE "review_cards" RENAME COLUMN "concept_id_new" TO "concept_id";
ALTER TABLE "api_usage" RENAME COLUMN "lesson_id_new" TO "lesson_id";

-- 7. Set NOT NULL on required FKs (api_usage.lesson_id stays nullable)
ALTER TABLE "messages" ALTER COLUMN "lesson_id" SET NOT NULL;
ALTER TABLE "concepts" ALTER COLUMN "lesson_id" SET NOT NULL;
ALTER TABLE "review_cards" ALTER COLUMN "concept_id" SET NOT NULL;

-- 8. Restore PKs with defaults
ALTER TABLE "lessons" ADD PRIMARY KEY ("id");
ALTER TABLE "lessons" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "concepts" ADD PRIMARY KEY ("id");
ALTER TABLE "concepts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- 9. Restore FK constraints
ALTER TABLE "messages" ADD CONSTRAINT "messages_lesson_id_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_lesson_id_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_concept_id_concepts_id_fk"
  FOREIGN KEY ("concept_id") REFERENCES "concepts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_lesson_id_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE no action ON UPDATE no action;

-- 10. Restore indexes
CREATE INDEX "messages_lesson_created_idx" ON "messages" USING btree ("lesson_id", "created_at");

COMMIT;
