import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

console.log("Running migrations...");

if (url.includes("neon.tech")) {
  const sql = neon(url);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
} else {
  const client = postgres(url, { max: 1 });
  const db = drizzlePostgres(client);
  await migratePostgres(db, { migrationsFolder: "./drizzle" });
  await client.end();
}

console.log("Migrations complete");
