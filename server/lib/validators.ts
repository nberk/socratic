import { z } from "zod";

// ─── Common ──────────────────────────────────────────

export const uuidParam = z.string().uuid();
export const lessonIdParam = z.string().uuid();

// ─── Topics ──────────────────────────────────────────

export const createTopicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

// ─── Lessons ─────────────────────────────────────────

export const createLessonSchema = z.object({
  topicId: z.string().uuid(),
});

// ─── Chat ────────────────────────────────────────────

export const chatMessageSchema = z.object({
  lessonId: z.string().uuid(),
  message: z.string().min(1).max(10000).optional(),
  initiate: z.boolean().optional(),
}).refine(
  (data) => data.message || data.initiate,
  { message: "Either message or initiate is required" }
);

// ─── Review ──────────────────────────────────────────

export const gradeAnswerSchema = z.object({
  cardId: z.number().int().positive(),
  answer: z.string().min(1).max(10000),
});

export const conceptIdParam = z.string().uuid();

export const skipCardSchema = z.object({
  cardId: z.number().int().positive(),
});
