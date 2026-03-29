-- Make workos_id nullable to support local mode (no auth provider)
ALTER TABLE "users" ALTER COLUMN "workos_id" DROP NOT NULL;
--> statement-breakpoint
-- Seed the default local user (workos_id=NULL means local mode, no external provider)
INSERT INTO "users" ("workos_id", "email")
VALUES (NULL, 'local@localhost')
ON CONFLICT DO NOTHING;
