import { describe, it, expect } from "vitest";
import {
  createTopicSchema,
  createLessonSchema,
  chatMessageSchema,
  gradeAnswerSchema,
  skipCardSchema,
} from "./validators";

describe("createTopicSchema", () => {
  it("accepts valid title only", () => {
    const result = createTopicSchema.safeParse({ title: "HTTP Basics" });
    expect(result.success).toBe(true);
  });

  it("accepts title with description", () => {
    const result = createTopicSchema.safeParse({
      title: "HTTP Basics",
      description: "Learn about HTTP methods, status codes, and headers",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createTopicSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const result = createTopicSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts title at exactly 200 chars", () => {
    const result = createTopicSchema.safeParse({ title: "x".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("rejects description over 2000 chars", () => {
    const result = createTopicSchema.safeParse({
      title: "Valid",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing description (optional)", () => {
    const result = createTopicSchema.safeParse({ title: "Valid" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
    }
  });

  it("rejects non-string title", () => {
    const result = createTopicSchema.safeParse({ title: 123 });
    expect(result.success).toBe(false);
  });
});

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("createLessonSchema", () => {
  it("accepts valid UUID topicId", () => {
    const result = createLessonSchema.safeParse({ topicId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects integer topicId", () => {
    const result = createLessonSchema.safeParse({ topicId: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID string topicId", () => {
    const result = createLessonSchema.safeParse({ topicId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing topicId", () => {
    const result = createLessonSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("chatMessageSchema", () => {
  it("accepts message with lessonId", () => {
    const result = chatMessageSchema.safeParse({ lessonId: VALID_UUID, message: "hello" });
    expect(result.success).toBe(true);
  });

  it("accepts initiate with lessonId", () => {
    const result = chatMessageSchema.safeParse({ lessonId: VALID_UUID, initiate: true });
    expect(result.success).toBe(true);
  });

  it("rejects when neither message nor initiate is provided", () => {
    const result = chatMessageSchema.safeParse({ lessonId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it("rejects empty message", () => {
    const result = chatMessageSchema.safeParse({ lessonId: VALID_UUID, message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects message over 10000 chars", () => {
    const result = chatMessageSchema.safeParse({
      lessonId: VALID_UUID,
      message: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts message at exactly 10000 chars", () => {
    const result = chatMessageSchema.safeParse({
      lessonId: VALID_UUID,
      message: "x".repeat(10000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects integer lessonId", () => {
    const result = chatMessageSchema.safeParse({ lessonId: 1, message: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID string lessonId", () => {
    const result = chatMessageSchema.safeParse({ lessonId: "not-a-uuid", message: "hi" });
    expect(result.success).toBe(false);
  });
});

describe("gradeAnswerSchema", () => {
  it("accepts valid cardId and answer", () => {
    const result = gradeAnswerSchema.safeParse({ cardId: 1, answer: "explanation" });
    expect(result.success).toBe(true);
  });

  it("rejects empty answer", () => {
    const result = gradeAnswerSchema.safeParse({ cardId: 1, answer: "" });
    expect(result.success).toBe(false);
  });

  it("rejects answer over 10000 chars", () => {
    const result = gradeAnswerSchema.safeParse({
      cardId: 1,
      answer: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing answer", () => {
    const result = gradeAnswerSchema.safeParse({ cardId: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects cardId: 0", () => {
    const result = gradeAnswerSchema.safeParse({ cardId: 0, answer: "test" });
    expect(result.success).toBe(false);
  });
});

describe("skipCardSchema", () => {
  it("accepts valid cardId", () => {
    const result = skipCardSchema.safeParse({ cardId: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects cardId: 0", () => {
    const result = skipCardSchema.safeParse({ cardId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative cardId", () => {
    const result = skipCardSchema.safeParse({ cardId: -1 });
    expect(result.success).toBe(false);
  });
});
