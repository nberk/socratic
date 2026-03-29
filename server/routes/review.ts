import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/node";
import { getDueCards, getCardById, updateCard, createReviewLog } from "../db/queries";
import { anthropic, MODEL } from "../lib/claude";
import { gradingPrompt, gradeAnswerTool } from "../lib/prompts";
import { scheduler, cardFromRow, ratingFromString, Rating, type Card } from "../lib/srs";
import type { GradeResult } from "../lib/types";
import { trackUsage } from "../lib/usage";
import { gradeAnswerSchema, skipCardSchema } from "../lib/validators";
import type { LocalUser } from "../lib/auth";

const app = new Hono<{ Variables: { user: LocalUser } }>();

app.get("/due", async (c) => {
  const dueCards = await getDueCards(c.var.user.id);
  return c.json(dueCards);
});

app.post("/grade", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = gradeAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { cardId, answer } = parsed.data;

  const card = await getCardById(cardId);
  if (!card) return c.json({ error: "Card not found" }, 404);
  if (!card.concept) return c.json({ error: "Concept not found" }, 404);
  if (card.concept.topic?.userId !== c.var.user.id) return c.json({ error: "Card not found" }, 404);

  let response;
  try {
    // Ask Claude to grade the answer
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: "text",
          text: gradingPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `## Question
${card.concept.question}

## Student's Answer
${answer}

## Ideal Answer
${card.concept.idealAnswer}

## Concept Description
${card.concept.description}

Please evaluate the student's answer by calling the grade_answer tool.`,
        },
      ],
      tools: [{ ...gradeAnswerTool, cache_control: { type: "ephemeral" } }],
      tool_choice: { type: "tool", name: "grade_answer" },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      Sentry.captureException(err);
      return c.json({ error: "AI service temporarily unavailable." }, 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      // Rate limits are expected under load — warn, don't alert
      Sentry.captureMessage(`Review grade rate limited: ${err.message}`, "warning");
      return c.json({ error: "AI service is busy. Please try again in a moment." }, 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      // Connection failures are transient — warn, don't alert
      Sentry.captureMessage(`Review grade connection error: ${err.message}`, "warning");
      return c.json({ error: "Could not connect to AI service." }, 502);
    }
    if (err instanceof Anthropic.APIError) {
      Sentry.captureException(err);
      return c.json({ error: "AI service error. Please try again." }, 502);
    }
    throw err;
  }

  // Extract grading result
  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return c.json({ error: "Failed to grade answer" }, 500);
  }

  const gradeResult = toolBlock.input as GradeResult;
  const fsrsRating = ratingFromString(gradeResult.rating);

  trackUsage({
    model: MODEL,
    endpoint: "review_grade",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    topicId: card.concept.topicId,
    lessonId: card.concept.lessonId,
  });

  // Run FSRS scheduling
  const fsrsCard = cardFromRow(card);
  const now = new Date();
  const scheduling = scheduler.repeat(fsrsCard, now) as unknown as Record<number, { card: Card; log: unknown }>;
  const result = scheduling[fsrsRating]!;
  const newCard = result.card;

  // Enforce minimum 1-day interval between reviews
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const minDue = new Date(now.getTime() + ONE_DAY_MS);
  if (newCard.due.getTime() < minDue.getTime()) {
    newCard.due = minDue;
    newCard.scheduled_days = Math.max(newCard.scheduled_days, 1);
  }

  // Update the card in the database
  await updateCard(cardId, {
    due: newCard.due,
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    elapsedDays: newCard.elapsed_days,
    scheduledDays: newCard.scheduled_days,
    reps: newCard.reps,
    lapses: newCard.lapses,
    state: newCard.state,
    lastReview: now,
  });

  // Log the review
  await createReviewLog(
    cardId,
    fsrsRating,
    card.state,
    card.elapsedDays,
    card.scheduledDays
  );

  return c.json({
    grade: gradeResult,
    scheduling: {
      nextDue: newCard.due,
      scheduledDays: newCard.scheduled_days,
      state: newCard.state,
    },
  });
});

app.post("/skip", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = skipCardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { cardId } = parsed.data;

  const card = await getCardById(cardId);
  if (!card) return c.json({ error: "Card not found" }, 404);
  if (card.concept?.topic?.userId !== c.var.user.id) return c.json({ error: "Card not found" }, 404);

  // Run FSRS scheduling with Rating.Easy — no Anthropic call needed
  const fsrsCard = cardFromRow(card);
  const now = new Date();
  const scheduling = scheduler.repeat(fsrsCard, now) as unknown as Record<number, { card: Card; log: unknown }>;
  const result = scheduling[Rating.Easy]!;
  const newCard = result.card;

  // Enforce minimum 1-day interval (same floor as /grade)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const minDue = new Date(now.getTime() + ONE_DAY_MS);
  if (newCard.due.getTime() < minDue.getTime()) {
    newCard.due = minDue;
    newCard.scheduled_days = Math.max(newCard.scheduled_days, 1);
  }

  await updateCard(cardId, {
    due: newCard.due,
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    elapsedDays: newCard.elapsed_days,
    scheduledDays: newCard.scheduled_days,
    reps: newCard.reps,
    lapses: newCard.lapses,
    state: newCard.state,
    lastReview: now,
  });

  await createReviewLog(
    cardId,
    Rating.Easy,
    card.state,
    card.elapsedDays,
    card.scheduledDays
  );

  return c.json({
    scheduling: {
      nextDue: newCard.due,
      scheduledDays: newCard.scheduled_days,
      state: newCard.state,
    },
  });
});

export default app;
