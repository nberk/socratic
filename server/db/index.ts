import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL!;

function isNeonUrl(url: string): boolean {
  return url.includes("neon.tech");
}

function createDb() {
  if (isNeonUrl(databaseUrl)) {
    const sql = neon(databaseUrl);
    return drizzle(sql, { schema });
  } else {
    const client = postgres(databaseUrl);
    return drizzlePostgres(client, { schema });
  }
}

export const db = createDb();
