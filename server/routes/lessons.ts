import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/node";
import { getLessonById, createLesson, getTopicById } from "../db/queries";
import { anthropic, MODEL } from "../lib/claude";
import { lessonPlanPrompt, createLessonPlanTool } from "../lib/prompts";
import type { LessonPlanInput } from "../lib/types";
import { trackUsage } from "../lib/usage";
import { createLessonSchema, lessonIdParam } from "../lib/validators";
import type { LocalUser } from "../lib/auth";

const app = new Hono<{ Variables: { user: LocalUser } }>();

app.get("/:id", async (c) => {
  const parseId = lessonIdParam.safeParse(c.req.param("id"));
  if (!parseId.success) return c.json({ error: "Invalid lesson ID" }, 400);
  const lesson = await getLessonById(parseId.data);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.topic?.userId !== c.var.user.id) return c.json({ error: "Lesson not found" }, 404);
  return c.json(lesson);
});

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { topicId } = parsed.data;

  const topic = await getTopicById(topicId, c.var.user.id);
  if (!topic) return c.json({ error: "Topic not found" }, 404);

  let response;
  try {
    // Ask Claude to generate a lesson plan
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: lessonPlanPrompt(topic.title, topic.description),
      messages: [
        {
          role: "user",
          content: `Please create a lesson plan for learning about "${topic.title}".`,
        },
      ],
      tools: [createLessonPlanTool],
      tool_choice: { type: "tool", name: "create_lesson_plan" },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      Sentry.captureException(err);
      return c.json({ error: "AI service temporarily unavailable." }, 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      // Rate limits are expected under load — warn, don't alert
      Sentry.captureMessage(`Lesson plan rate limited: ${err.message}`, "warning");
      return c.json({ error: "AI service is busy. Please try again in a moment." }, 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      // Connection failures are transient — warn, don't alert
      Sentry.captureMessage(`Lesson plan connection error: ${err.message}`, "warning");
      return c.json({ error: "Could not connect to AI service." }, 502);
    }
    if (err instanceof Anthropic.APIError) {
      Sentry.captureException(err);
      return c.json({ error: "AI service error. Please try again." }, 502);
    }
    throw err;
  }

  // Extract the tool call result
  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return c.json({ error: "Failed to generate lesson plan" }, 500);
  }

  const planInput = toolBlock.input as LessonPlanInput;
  const lesson = await createLesson(topicId, planInput.title, planInput.sections);

  trackUsage({
    model: MODEL,
    endpoint: "lesson_plan",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    topicId,
    lessonId: lesson!.id,
  });

  return c.json(lesson, 201);
});

export default app;
