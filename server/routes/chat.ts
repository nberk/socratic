import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import * as Sentry from "@sentry/node";
import {
  getLessonById,
  getMessagesForSection,
  saveMessage,
  saveConcepts,
  saveSectionSummary,
  advanceLessonSection,
} from "../db/queries";
import { anthropic, MODEL, MODEL_FAST } from "../lib/claude";
import { teachingSystemPromptStatic, teachingContextPrompt, sectionCompleteTool } from "../lib/prompts";
import type { SectionCompleteInput } from "../lib/types";
import type { LessonPlanSection } from "../db/schema";
import { trackUsage } from "../lib/usage";
import { chatMessageSchema } from "../lib/validators";
import type { LocalUser } from "../lib/auth";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const API_TIMEOUT_MS = 120_000;

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("overloaded") || msg.includes("529") || msg.includes("rate_limit");
  }
  return false;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const app = new Hono<{ Variables: { user: LocalUser } }>();

/**
 * Build the full system prompt for teaching calls.
 * Static persona block (cached) + dynamic lesson context + prior section summaries.
 */
function buildTeachingSystemPrompt(
  plan: LessonPlanSection[],
  section: number,
  summaries: string[],
) {
  const relevant = summaries.slice(0, section).filter(Boolean);
  const summaryBlocks =
    relevant.length > 0
      ? [{ type: "text" as const, text: `## Prior Sections\n${relevant.map((s, i) => `Section ${i + 1}: ${s}`).join("\n")}` }]
      : [];

  return [
    { type: "text" as const, text: teachingSystemPromptStatic, cache_control: { type: "ephemeral" as const } },
    { type: "text" as const, text: teachingContextPrompt(plan, section) },
    ...summaryBlocks,
  ];
}

/**
 * Strategy 3: When a section's conversation exceeds RECENT_MSG_COUNT,
 * summarize older messages with a fast/cheap model (Haiku) and only
 * keep the most recent messages verbatim. Caps per-turn input at a
 * roughly fixed size regardless of how long the section conversation goes.
 */
const RECENT_MSG_COUNT = 6;

async function summarizeOlderMessages(
  messages: { role: string; content: string }[],
  topicId: string,
  lessonId: string,
): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL_FAST,
    max_tokens: 512,
    system: "Summarize this Socratic tutoring conversation concisely. Focus on: what the student knows, what they struggled with, key concepts discussed, and any misconceptions corrected. Keep it under 200 words.",
    messages: [{ role: "user", content: transcript }],
  });

  trackUsage({
    model: MODEL_FAST,
    endpoint: "chat_summarize",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    topicId,
    lessonId,
  });

  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }
  const { lessonId, message, initiate } = parsed.data;

  const lesson = await getLessonById(lessonId);
  if (!lesson) return c.json({ error: "Lesson not found" }, 404);
  if (lesson.topic?.userId !== c.var.user.id) return c.json({ error: "Lesson not found" }, 404);

  // For initiate requests, don't save a user message — just prompt Claude to begin
  if (!initiate) {
    await saveMessage(lessonId, "user", message!, lesson.currentSection);
  }

  // Strategy 2: Load only current section's messages (not the full history)
  const sectionHistory = await getMessagesForSection(lessonId, lesson.currentSection);
  const sectionSummaries = lesson.sectionSummaries ?? [];

  // Build current section messages
  // Strategy 3: If the section history is long, summarize older messages
  let sectionMessages: { role: "user" | "assistant"; content: string }[];
  let conversationSummary: string | null = null;

  if (sectionHistory.length > RECENT_MSG_COUNT) {
    const older = sectionHistory.slice(0, -RECENT_MSG_COUNT);
    const recent = sectionHistory.slice(-RECENT_MSG_COUNT);
    conversationSummary = await summarizeOlderMessages(
      older.map((m) => ({ role: m.role, content: m.content })),
      lesson.topicId,
      lesson.id,
    );
    sectionMessages = recent.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  } else {
    sectionMessages = sectionHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  // Prior section summaries are in the system prompt (buildTeachingSystemPrompt),
  // so claudeMessages only contains the current section's conversation.
  const claudeMessages: MessageParam[] = [
    // Inject conversation summary from older messages in this section
    ...(conversationSummary
      ? [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: `[Earlier in this section:\n${conversationSummary}]`,
                cache_control: { type: "ephemeral" as const },
              },
            ],
          },
        ]
      : []),
    // Recent messages (verbatim)
    ...(sectionMessages.length > 0
      ? sectionMessages
      : [{ role: "user" as const, content: "[Begin the lesson.]" }]),
  ];

  // Safety guard: API rejects messages ending with assistant role ("prefill" error).
  // This can happen if the last saved message was an assistant continuation intro.
  if (claudeMessages[claudeMessages.length - 1]?.role !== "user") {
    claudeMessages.push({ role: "user" as const, content: "[Continue the lesson.]" });
  }

  const plan = lesson.plan as LessonPlanSection[];

  const startTime = Date.now();
  const log = (step: string) =>
    console.log(`[chat] lesson=${lessonId} +${Date.now() - startTime}ms ${step}`);

  return streamSSE(c, async (stream) => {
    let fullResponse = "";
    let sectionCompleted = false;
    let extractedConcepts: SectionCompleteInput | null = null;

    try {
      // Retry loop for transient API errors (overloaded, rate limit)
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          log(`starting Claude API call (attempt ${attempt}/${MAX_RETRIES})`);

          // Strategy 1: Prompt caching on system prompt and tools.
          // Static block (persona + methodology) gets cache_control — cached across all sessions.
          // Dynamic block (lesson plan progress + current section) has no marker — changes each section.
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
          try {
          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: buildTeachingSystemPrompt(plan, lesson.currentSection, sectionSummaries),
            messages: claudeMessages,
            tools: [
              { ...sectionCompleteTool, cache_control: { type: "ephemeral" } },
            ],
            stream: true,
          }, { signal: controller.signal });

          log("streaming response");

          let currentToolInput = "";
          let isToolUse = false;
          let toolUseId = "";
          let streamInputTokens = 0;
          let streamOutputTokens = 0;

          for await (const event of response) {
            if (event.type === "message_start" && event.message.usage) {
              streamInputTokens = event.message.usage.input_tokens;
            } else if (event.type === "message_delta" && event.usage) {
              streamOutputTokens = event.usage.output_tokens;
            } else if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                isToolUse = true;
                toolUseId = event.content_block.id;
                currentToolInput = "";
                log("tool_use block started");
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                fullResponse += event.delta.text;
                await stream.writeSSE({
                  data: JSON.stringify({ type: "text", content: event.delta.text }),
                });
              } else if (event.delta.type === "input_json_delta") {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop" && isToolUse) {
              log("tool_use block complete, parsing input");
              try {
                extractedConcepts = JSON.parse(currentToolInput) as SectionCompleteInput;
                sectionCompleted = true;
                log(`parsed ${extractedConcepts.concepts.length} concepts`);
              } catch (parseErr) {
                console.error("[chat] Failed to parse tool input:", parseErr, "raw:", currentToolInput);
                Sentry.captureException(parseErr, {
                  extra: { rawToolInput: currentToolInput, lessonId },
                });
                // Skip concept extraction — conversation continues gracefully
              }
              isToolUse = false;
            }
          }

          trackUsage({
            model: MODEL,
            endpoint: "chat",
            inputTokens: streamInputTokens,
            outputTokens: streamOutputTokens,
            topicId: lesson.topicId,
            lessonId: lesson.id,
          });
          } finally {
            clearTimeout(timeout);
          }

          // Stream succeeded — break out of retry loop
          break;
        } catch (retryError) {
          const canRetry = isTransientError(retryError) && fullResponse === "" && attempt < MAX_RETRIES;
          if (canRetry) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            log(`transient error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
            await sleep(delay);
            continue;
          }
          // Not retryable, or text already sent to client — rethrow
          throw retryError;
        }
      }

      log("initial stream finished");

      // Save the assistant's text response (if any before tool call)
      if (fullResponse.trim()) {
        await saveMessage(lessonId, "assistant", fullResponse, lesson.currentSection);
        log("saved assistant message");
      }

      // If Claude called section_complete, process it
      if (sectionCompleted && extractedConcepts) {
        log("saving concepts");
        // Save concepts and create review cards
        const savedConcepts = await saveConcepts(
          lessonId,
          lesson.topicId,
          lesson.currentSection,
          extractedConcepts.concepts
        );
        log(`saved ${savedConcepts.length} concepts`);

        // Persist the section summary for future turns (Strategy 2)
        await saveSectionSummary(lessonId, lesson.currentSection, extractedConcepts.section_summary);
        log("saved section summary");

        // Advance to next section
        const updatedLesson = await advanceLessonSection(lessonId, plan.length);
        const newSection = updatedLesson.currentSection;
        const newStatus = updatedLesson.status;
        log(`advanced to section ${newSection}, status=${newStatus}`);

        // Send the section_complete event to the client
        await stream.writeSSE({
          data: JSON.stringify({
            type: "section_complete",
            concepts: savedConcepts,
            summary: extractedConcepts.section_summary,
            lessonStatus: newStatus,
            currentSection: newSection,
          }),
        });

        // If lesson isn't complete, continue with Claude's introduction of the next section
        if (newStatus !== "completed") {
          log("starting continuation call");

          // Build summaries including the just-completed section
          const updatedSummaries = [...sectionSummaries];
          updatedSummaries[lesson.currentSection] = extractedConcepts.section_summary;

          // Continuation only needs: transition prompt (prior summaries are in system prompt)
          const continuationMessages = [
            {
              role: "user" as const,
              content: `[Section ${lesson.currentSection + 1} just completed. Please introduce section ${newSection + 1}: "${plan[newSection]!.sectionTitle}".]`,
            },
          ];

          let continuationText = "";

          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              log(`continuation API call (attempt ${attempt}/${MAX_RETRIES})`);

              const contController = new AbortController();
              const contTimeout = setTimeout(() => contController.abort(), API_TIMEOUT_MS);
              try {
              const continuation = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 4096,
                system: buildTeachingSystemPrompt(plan, newSection, updatedSummaries),
                messages: continuationMessages,
                tools: [
                  { ...sectionCompleteTool, cache_control: { type: "ephemeral" } },
                ],
                stream: true,
              }, { signal: contController.signal });

              log("streaming continuation");

              let contInputTokens = 0;
              let contOutputTokens = 0;
              for await (const event of continuation) {
                if (event.type === "message_start" && event.message.usage) {
                  contInputTokens = event.message.usage.input_tokens;
                } else if (event.type === "message_delta" && event.usage) {
                  contOutputTokens = event.usage.output_tokens;
                } else if (
                  event.type === "content_block_delta" &&
                  event.delta.type === "text_delta"
                ) {
                  continuationText += event.delta.text;
                  await stream.writeSSE({
                    data: JSON.stringify({
                      type: "text",
                      content: event.delta.text,
                    }),
                  });
                }
              }

              trackUsage({
                model: MODEL,
                endpoint: "chat_continuation",
                inputTokens: contInputTokens,
                outputTokens: contOutputTokens,
                topicId: lesson.topicId,
                lessonId: lesson.id,
              });
              } finally {
                clearTimeout(contTimeout);
              }

              break;
            } catch (retryError) {
              const canRetry = isTransientError(retryError) && continuationText === "" && attempt < MAX_RETRIES;
              if (canRetry) {
                const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                log(`continuation transient error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
              }
              throw retryError;
            }
          }

          if (continuationText.trim()) {
            await saveMessage(
              lessonId,
              "assistant",
              continuationText,
              newSection
            );
            log("saved continuation message");
          }
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      if (isTransientError(error)) {
        log(`WARN: ${errMsg}`);
        if (stack) console.warn(stack);
        // Transient errors are expected under load — capture as warning to avoid alert noise
        Sentry.captureMessage(`Transient chat error after retries: ${errMsg}`, "warning");
      } else {
        log(`ERROR: ${errMsg}`);
        if (stack) console.error(stack);
        Sentry.captureException(error);
      }

      const userMessage = isTransientError(error)
        ? "Claude's servers are temporarily overloaded. Please try again in a moment."
        : "An error occurred during the conversation.";

      try {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "error",
            content: userMessage,
          }),
        });
      } catch {
        // Stream already closed (client disconnected)
      }
    } finally {
      log("sending done event");
      try {
        await stream.writeSSE({ data: JSON.stringify({ type: "done" }) });
      } catch {
        // Stream already closed (client disconnected)
      }
      log("complete");
    }
  });
});

export default app;
