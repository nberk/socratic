import { Hono } from "hono";
import { sql, gte, eq, and } from "drizzle-orm";
import { db } from "../db/index";
import { apiUsage, topics } from "../db/schema";
import type { LocalUser } from "../lib/auth";
import { startOfDay, startOfWeek, startOfMonth } from "../lib/dates";

const app = new Hono<{ Variables: { user: LocalUser } }>();

async function aggregateUsage(since: Date | null, userId: string) {
  const sinceCondition = since ? gte(apiUsage.createdAt, since) : undefined;
  const conditions = and(eq(topics.userId, userId), sinceCondition);

  const [result] = await db
    .select({
      totalInputTokens: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)::int`,
      totalCostMillicents: sql<number>`coalesce(sum(${apiUsage.costMillicents}), 0)::int`,
      callCount: sql<number>`count(*)::int`,
    })
    .from(apiUsage)
    .innerJoin(topics, eq(apiUsage.topicId, topics.id))
    .where(conditions);

  return result!;
}

app.get("/summary", async (c) => {
  const now = new Date();
  const userId = c.var.user.id;

  const [today, thisWeek, thisMonth, allTime] = await Promise.all([
    aggregateUsage(startOfDay(now), userId),
    aggregateUsage(startOfWeek(now), userId),
    aggregateUsage(startOfMonth(now), userId),
    aggregateUsage(null, userId),
  ]);

  return c.json({ today, thisWeek, thisMonth, allTime });
});

export default app;
