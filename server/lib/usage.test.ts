import { describe, it, expect } from "vitest";
import { calculateCostMillicents } from "./usage";

describe("calculateCostMillicents", () => {
  it("calculates correct cost for claude-sonnet-4-6", () => {
    // 1000 input at $3/MTok: (1000/1M) * 3 * 100_000 = 300 millicents
    // 500 output at $15/MTok: (500/1M) * 15 * 100_000 = 750 millicents
    // total = 1050
    const cost = calculateCostMillicents("claude-sonnet-4-6", 1000, 500);
    expect(cost).toBe(1050);
  });

  it("calculates correct cost for claude-haiku-4-5", () => {
    // 1000 input at $1/MTok: (1000/1M) * 1 * 100_000 = 100 millicents
    // 500 output at $5/MTok: (500/1M) * 5 * 100_000 = 250 millicents
    // total = 350
    const cost = calculateCostMillicents("claude-haiku-4-5", 1000, 500);
    expect(cost).toBe(350);
  });

  it("returns 0 for unknown model", () => {
    const cost = calculateCostMillicents("gpt-4", 1000, 500);
    expect(cost).toBe(0);
  });

  it("returns 0 for zero tokens", () => {
    const cost = calculateCostMillicents("claude-sonnet-4-6", 0, 0);
    expect(cost).toBe(0);
  });

  it("rounds to nearest integer", () => {
    // 1 input at $3/MTok: (1/1M) * 3 * 100_000 = 0.3
    // 1 output at $15/MTok: (1/1M) * 15 * 100_000 = 1.5
    // total = 1.8, rounded = 2
    const cost = calculateCostMillicents("claude-sonnet-4-6", 1, 1);
    expect(cost).toBe(2);
  });

  it("handles large token counts", () => {
    // 1M input at $3/MTok: 300_000 millicents
    // 1M output at $15/MTok: 1_500_000 millicents
    // total = 1_800_000
    const cost = calculateCostMillicents("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBe(1_800_000);
  });

  it("handles input-only scenario", () => {
    // 10000 input at $3/MTok: (10000/1M) * 3 * 100_000 = 3000
    const cost = calculateCostMillicents("claude-sonnet-4-6", 10000, 0);
    expect(cost).toBe(3000);
  });

  it("handles output-only scenario", () => {
    // 10000 output at $15/MTok: (10000/1M) * 15 * 100_000 = 15000
    const cost = calculateCostMillicents("claude-sonnet-4-6", 0, 10000);
    expect(cost).toBe(15000);
  });
});
