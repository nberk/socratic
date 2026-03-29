BEGIN;

-- 1. Add UUID column to topics (auto-populated by PostgreSQL)
ALTER TABLE "topics" ADD COLUMN "id_new" uuid DEFAULT gen_random_uuid() NOT NULL;

-- 2. Add UUID FK columns to child tables (nullable during migration)
ALTER TABLE "lessons" ADD COLUMN "topic_id_new" uuid;
ALTER TABLE "concepts" ADD COLUMN "topic_id_new" uuid;
ALTER TABLE "api_usage" ADD COLUMN "topic_id_new" uuid;

-- 3. Backfill via JOIN
UPDATE "lessons" l SET topic_id_new = t.id_new FROM "topics" t WHERE l.topic_id = t.id;
UPDATE "concepts" c SET topic_id_new = t.id_new FROM "topics" t WHERE c.topic_id = t.id;
UPDATE "api_usage" a SET topic_id_new = t.id_new FROM "topics" t WHERE a.topic_id = t.id;

-- 4. Drop old FK constraints
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_topic_id_topics_id_fk";
ALTER TABLE "concepts" DROP CONSTRAINT "concepts_topic_id_topics_id_fk";
ALTER TABLE "api_usage" DROP CONSTRAINT "api_usage_topic_id_topics_id_fk";
DROP INDEX IF EXISTS "api_usage_topic_id_idx";

-- 5. Drop old PK and integer columns
ALTER TABLE "topics" DROP CONSTRAINT "topics_pkey";
ALTER TABLE "topics" DROP COLUMN "id";
ALTER TABLE "lessons" DROP COLUMN "topic_id";
ALTER TABLE "concepts" DROP COLUMN "topic_id";
ALTER TABLE "api_usage" DROP COLUMN "topic_id";

-- 6. Rename UUID columns to final names
ALTER TABLE "topics" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "lessons" RENAME COLUMN "topic_id_new" TO "topic_id";
ALTER TABLE "concepts" RENAME COLUMN "topic_id_new" TO "topic_id";
ALTER TABLE "api_usage" RENAME COLUMN "topic_id_new" TO "topic_id";

-- 7. Set NOT NULL on required FKs (api_usage stays nullable)
ALTER TABLE "lessons" ALTER COLUMN "topic_id" SET NOT NULL;
ALTER TABLE "concepts" ALTER COLUMN "topic_id" SET NOT NULL;

-- 8. Restore PK + default
ALTER TABLE "topics" ADD PRIMARY KEY ("id");
ALTER TABLE "topics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- 9. Restore FK constraints
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;

-- 10. Restore index
CREATE INDEX "api_usage_topic_id_idx" ON "api_usage" USING btree ("topic_id");

COMMIT;
