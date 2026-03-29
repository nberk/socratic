import { describe, it, expect } from "vitest";
import {
  lessonPlanPrompt,
  teachingContextPrompt,
  sectionCompleteTool,
  createLessonPlanTool,
  gradeAnswerTool,
} from "./prompts";
import type { LessonPlanSection } from "../db/schema";

const makePlan = (count: number): LessonPlanSection[] =>
  Array.from({ length: count }, (_, i) => ({
    sectionTitle: `Section ${i + 1}`,
    objectives: [`Objective ${i + 1}a`, `Objective ${i + 1}b`],
  }));

describe("lessonPlanPrompt", () => {
  it("includes the topic title", () => {
    const prompt = lessonPlanPrompt("HTTP Basics");
    expect(prompt).toContain('"HTTP Basics"');
  });

  it("includes description when provided", () => {
    const prompt = lessonPlanPrompt("HTTP Basics", "Focus on methods and status codes");
    expect(prompt).toContain("Additional context: Focus on methods and status codes");
  });

  it("omits additional context when description is null", () => {
    const prompt = lessonPlanPrompt("HTTP Basics", null);
    expect(prompt).not.toContain("Additional context");
  });

  it("omits additional context when description is undefined", () => {
    const prompt = lessonPlanPrompt("HTTP Basics", undefined);
    expect(prompt).not.toContain("Additional context");
  });

  it("omits additional context when description is empty string", () => {
    const prompt = lessonPlanPrompt("HTTP Basics", "");
    expect(prompt).not.toContain("Additional context");
  });
});

describe("teachingContextPrompt", () => {
  it("marks the current section with → arrow", () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 1);
    expect(prompt).toContain("→ Section 2: Section 2");
    expect(prompt).not.toContain("→ Section 1");
    expect(prompt).not.toContain("→ Section 3");
  });

  it("marks completed sections with checkmark", () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 2);
    expect(prompt).toContain("Section 1: Section 1 ✓");
    expect(prompt).toContain("Section 2: Section 2 ✓");
    expect(prompt).not.toContain("Section 3: Section 3 ✓");
  });

  it("shows correct 1-indexed section numbering", () => {
    const plan = makePlan(4);
    const prompt = teachingContextPrompt(plan, 0);
    expect(prompt).toContain("Current Section (1/4)");
  });

  it("includes section objectives", () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 0);
    expect(prompt).toContain("Objective 1a; Objective 1b");
  });

  it('says "first section" guidance when currentSection is 0', () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 0);
    expect(prompt).toContain("This is the first section");
  });

  it("says transition guidance when currentSection > 0", () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 1);
    expect(prompt).toContain("just completed the previous section");
  });

  it("handles minimum sections (3)", () => {
    const plan = makePlan(3);
    const prompt = teachingContextPrompt(plan, 0);
    expect(prompt).toContain("Current Section (1/3)");
  });

  it("handles maximum sections (6)", () => {
    const plan = makePlan(6);
    const prompt = teachingContextPrompt(plan, 5);
    expect(prompt).toContain("Current Section (6/6)");
  });
});

describe("tool definitions", () => {
  describe("sectionCompleteTool", () => {
    it("requires concepts and section_summary", () => {
      expect(sectionCompleteTool.input_schema.required).toEqual([
        "concepts",
        "section_summary",
      ]);
    });

    it("has concepts array with minItems 1", () => {
      expect(sectionCompleteTool.input_schema.properties.concepts.minItems).toBe(1);
    });

    it("requires name, description, question, ideal_answer on each concept", () => {
      const required = sectionCompleteTool.input_schema.properties.concepts.items.required;
      expect(required).toEqual(["name", "description", "question", "ideal_answer"]);
    });
  });

  describe("createLessonPlanTool", () => {
    it("requires title and sections", () => {
      expect(createLessonPlanTool.input_schema.required).toEqual(["title", "sections"]);
    });

    it("has sections array with minItems 3, maxItems 6", () => {
      const sections = createLessonPlanTool.input_schema.properties.sections;
      expect(sections.minItems).toBe(3);
      expect(sections.maxItems).toBe(6);
    });
  });

  describe("gradeAnswerTool", () => {
    it("requires rating, feedback, correct_points, missed_points", () => {
      expect(gradeAnswerTool.input_schema.required).toEqual([
        "rating",
        "feedback",
        "correct_points",
        "missed_points",
      ]);
    });

    it("has correct rating enum values", () => {
      expect(gradeAnswerTool.input_schema.properties.rating.enum).toEqual([
        "again",
        "hard",
        "good",
        "easy",
      ]);
    });
  });
});
