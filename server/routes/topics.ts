import { Hono } from "hono";
import { listTopics, getTopicById, createTopic, deleteTopic } from "../db/queries";
import { createTopicSchema, uuidParam } from "../lib/validators";
import type { LocalUser } from "../lib/auth";

const app = new Hono<{ Variables: { user: LocalUser } }>();

app.get("/", async (c) => {
  const allTopics = await listTopics(c.var.user.id);
  return c.json(allTopics);
});

app.get("/:id", async (c) => {
  const parseId = uuidParam.safeParse(c.req.param("id"));
  if (!parseId.success) return c.json({ error: "Invalid topic ID" }, 400);
  const topic = await getTopicById(parseId.data, c.var.user.id);
  if (!topic) return c.json({ error: "Topic not found" }, 404);
  return c.json(topic);
});

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const topic = await createTopic(c.var.user.id, parsed.data.title, parsed.data.description);
  return c.json(topic, 201);
});

app.delete("/:id", async (c) => {
  const parseId = uuidParam.safeParse(c.req.param("id"));
  if (!parseId.success) return c.json({ error: "Invalid topic ID" }, 400);
  const deleted = await deleteTopic(parseId.data, c.var.user.id);
  if (!deleted) return c.json({ error: "Topic not found" }, 404);
  return c.json({ success: true });
});

export default app;
