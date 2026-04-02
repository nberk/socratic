import { db } from "../db/index";
import { apiUsage } from "../db/schema";

// Pricing in dollars per million tokens
const PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
};

/**
 * Convert token counts to cost in millicents (1 millicent = $0.00001).
 * Returns integer for safe storage.
 */
export function calculateCostMillicents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  // dollars = (tokens / 1M) * pricePerMTok
  // millicents = dollars * 100 (cents) * 1000 (millicents)
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok * 100_000;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok * 100_000;
  return Math.round(inputCost + outputCost);
}

/**
 * Fire-and-forget usage tracking — never throws, never disrupts the caller.
 */
export function trackUsage(params: {
  model: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  topicId?: string | null;
  lessonId?: string | null;
}): void {
  const model = params.model;
  const costMillicents = calculateCostMillicents(model, params.inputTokens, params.outputTokens);

  db.insert(apiUsage)
    .values({
      endpoint: params.endpoint,
      model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costMillicents,
      topicId: params.topicId ?? null,
      lessonId: params.lessonId ?? null,
    })
    .catch((err) => {
      console.error("[usage] Failed to track API usage:", err);
    });
}
