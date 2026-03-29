import { Hono } from "hono";
import { listConcepts } from "../db/queries";
import { uuidParam } from "../lib/validators";
import type { LocalUser } from "../lib/auth";

const app = new Hono<{ Variables: { user: LocalUser } }>();

app.get("/", async (c) => {
  const topicIdParam = c.req.query("topicId");
  const userId = c.var.user.id;

  if (topicIdParam) {
    const parseId = uuidParam.safeParse(topicIdParam);
    if (!parseId.success) return c.json({ error: "Invalid topic ID" }, 400);
    const allConcepts = await listConcepts(userId, parseId.data);
    return c.json(allConcepts);
  }

  const allConcepts = await listConcepts(userId);
  return c.json(allConcepts);
});

export default app;
