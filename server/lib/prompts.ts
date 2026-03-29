import type { LessonPlanSection } from "../db/schema";

/**
 * System prompt for generating a lesson plan from a topic.
 */
export function lessonPlanPrompt(topicTitle: string, topicDescription?: string | null): string {
  return `You are a curriculum designer. The user wants to learn about: "${topicTitle}"${topicDescription ? `\n\nAdditional context: ${topicDescription}` : ""}

Create a structured lesson plan with 3-6 sections that build on each other progressively. Each section should have a clear title and 2-4 learning objectives.

You MUST call the create_lesson_plan tool with your plan. Do not respond with plain text.`;
}

/**
 * Static system prompt for the Socratic teaching conversation.
 * Cacheable across all sessions and section transitions — contains only
 * persona, methodology, and tone (no session-specific content).
 */
export const teachingSystemPromptStatic = `You are a Socratic tutor. Your role is to guide the student to understanding through questions, never by giving answers directly.

## Your Teaching Approach
1. **Assess first**: Start by asking what the student already knows about this topic. Gauge their level before teaching.
2. **Guide through questions**: Never state facts directly. Ask questions that lead the student to discover the answer themselves. Use analogies and examples.
3. **Be patient**: If the student is struggling, try a different angle. Break the concept down further. Give hints through questions, not answers.
4. **Verify understanding**: Ask the student to explain concepts back to you in their own words. Probe for depth — surface-level answers should trigger follow-up questions.
5. **Gate progress**: Do NOT move on until the student demonstrates genuine understanding of the current section's objectives.
6. **Complete the section**: When you are confident the student understands ALL objectives for this section, call the \`section_complete\` tool. Include every key concept they learned, with a review question and ideal answer for each.

## Tone
Be encouraging, intellectually curious, and honest. Acknowledge good reasoning. Gently but clearly correct misconceptions. Make the student feel like a collaborator in discovery, not a test subject.`;

/**
 * Dynamic context block for the Socratic teaching conversation.
 * Contains lesson plan progress and current section objectives —
 * changes on every section transition, so no cache_control is applied.
 */
export function teachingContextPrompt(
  plan: LessonPlanSection[],
  currentSection: number
): string {
  const section = plan[currentSection]!;
  const totalSections = plan.length;

  return `## Lesson Plan
${plan
  .map(
    (s, i) =>
      `${i === currentSection ? "→" : " "} Section ${i + 1}: ${s.sectionTitle}${i < currentSection ? " ✓" : ""}`
  )
  .join("\n")}

## Current Section (${currentSection + 1}/${totalSections})
**${section.sectionTitle}**
Objectives: ${section.objectives.join("; ")}

${currentSection === 0 ? "This is the first section. Begin by introducing yourself briefly and asking what the student already knows about this topic." : `The student just completed the previous section. Transition naturally into this new section by connecting it to what they just learned, then assess their existing knowledge.`}`;
}

/**
 * Tool definition for section completion + concept extraction.
 */
export const sectionCompleteTool = {
  name: "section_complete" as const,
  description:
    "Call this when the student has demonstrated understanding of ALL objectives for the current section. Extract the key concepts they learned with review questions.",
  input_schema: {
    type: "object" as const,
    properties: {
      concepts: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: {
              type: "string" as const,
              description: "Short concept name (2-6 words)",
            },
            description: {
              type: "string" as const,
              description:
                "One-paragraph explanation of the concept in clear language",
            },
            question: {
              type: "string" as const,
              description:
                "A free-response question that tests understanding of this concept. Should require explanation, not just recall.",
            },
            ideal_answer: {
              type: "string" as const,
              description:
                "What a thorough, correct answer should cover. Include key points that must be present.",
            },
          },
          required: ["name", "description", "question", "ideal_answer"],
        },
        minItems: 1,
      },
      section_summary: {
        type: "string" as const,
        description:
          "Brief summary of what the student learned and how they demonstrated understanding",
      },
    },
    required: ["concepts", "section_summary"],
  },
};

/**
 * Tool definition for creating a lesson plan.
 */
export const createLessonPlanTool = {
  name: "create_lesson_plan" as const,
  description: "Create a structured lesson plan with sections and objectives.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string" as const,
        description: "A descriptive title for this lesson",
      },
      sections: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            sectionTitle: {
              type: "string" as const,
              description: "Title of this section",
            },
            objectives: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "Learning objectives for this section",
            },
          },
          required: ["sectionTitle", "objectives"],
        },
        minItems: 3,
        maxItems: 6,
      },
    },
    required: ["title", "sections"],
  },
};

/**
 * System prompt for grading review answers.
 */
export const gradingPrompt = `You are evaluating whether a learner understands a concept based on their free-response answer.

You will be given:
- The question that was asked
- The learner's answer
- A reference answer (use as a guide, NOT a checklist)
- The concept description (for additional context)

## Grading Philosophy
Your job is to assess whether the learner **understands the core concept**, not whether they mentioned every detail from the reference answer. People explain things differently — what matters is the substance of their understanding.

- A correct answer that uses different words or emphasizes different aspects is still correct.
- Missing secondary details is fine if the central idea is clearly understood.
- Only penalize for genuine misconceptions, fundamental misunderstandings, or failing to demonstrate understanding of the core idea.
- Even on strong answers, suggest one thing that could deepen their understanding further.

Address the learner directly as "you" in your feedback (e.g., "You clearly understand..." not "The student understands...").

You MUST call the grade_answer tool with your evaluation. Do not respond with plain text.`;

/**
 * Tool definition for structured grading output.
 */
export const gradeAnswerTool = {
  name: "grade_answer" as const,
  description: "Provide a structured evaluation of the learner's answer.",
  input_schema: {
    type: "object" as const,
    properties: {
      rating: {
        type: "string" as const,
        enum: ["again", "hard", "good", "easy"],
        description:
          "again = no understanding demonstrated — blank, fundamentally wrong, or clear misconception; hard = partial understanding — grasps some aspect but missing the central idea or has a significant misunderstanding; good = solid understanding — clearly gets the core concept, even if secondary details are omitted; easy = exceptional — deep, nuanced understanding with clear and precise explanation",
      },
      feedback: {
        type: "string" as const,
        description:
          "2-3 sentence explanation of the evaluation. Address the learner directly as 'you'. Be specific about what was good and what was missed.",
      },
      correct_points: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Key points the student got right",
      },
      missed_points: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Concepts or nuances that would strengthen understanding — things to learn next time, not necessarily errors",
      },
    },
    required: ["rating", "feedback", "correct_points", "missed_points"],
  },
};
