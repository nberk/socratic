import { describe, it, expect } from "vitest";
import { cardFromRow, ratingFromString, Rating, State } from "./srs";

describe("cardFromRow", () => {
  it("converts a DB row with all fields into a Card object", () => {
    const row = {
      due: new Date("2025-01-15T10:00:00Z"),
      stability: 4.567,
      difficulty: 6.123,
      elapsedDays: 3,
      scheduledDays: 7,
      reps: 5,
      lapses: 1,
      state: 2,
      lastReview: new Date("2025-01-08T10:00:00Z"),
    };

    const card = cardFromRow(row);

    expect(card.due).toEqual(row.due);
    expect(card.stability).toBe(4.567);
    expect(card.difficulty).toBe(6.123);
    expect(card.elapsed_days).toBe(3);
    expect(card.scheduled_days).toBe(7);
    expect(card.reps).toBe(5);
    expect(card.lapses).toBe(1);
    expect(card.state).toBe(2);
    expect(card.last_review).toEqual(row.lastReview);
  });

  it("maps lastReview: null to undefined", () => {
    const row = {
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReview: null,
    };

    const card = cardFromRow(row);
    expect(card.last_review).toBeUndefined();
  });

  it("preserves numeric precision for stability and difficulty", () => {
    const row = {
      due: new Date(),
      stability: 0.123456789,
      difficulty: 9.876543210,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReview: null,
    };

    const card = cardFromRow(row);
    expect(card.stability).toBe(0.123456789);
    expect(card.difficulty).toBe(9.876543210);
  });

  it("casts state number to State enum", () => {
    const states = [
      { num: 0, expected: State.New },
      { num: 1, expected: State.Learning },
      { num: 2, expected: State.Review },
      { num: 3, expected: State.Relearning },
    ];

    for (const { num, expected } of states) {
      const card = cardFromRow({
        due: new Date(),
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: num,
        lastReview: null,
      });
      expect(card.state).toBe(expected);
    }
  });
});

describe("ratingFromString", () => {
  it('maps "again" to Rating.Again (1)', () => {
    expect(ratingFromString("again")).toBe(Rating.Again);
    expect(ratingFromString("again")).toBe(1);
  });

  it('maps "hard" to Rating.Hard (2)', () => {
    expect(ratingFromString("hard")).toBe(Rating.Hard);
    expect(ratingFromString("hard")).toBe(2);
  });

  it('maps "good" to Rating.Good (3)', () => {
    expect(ratingFromString("good")).toBe(Rating.Good);
    expect(ratingFromString("good")).toBe(3);
  });

  it('maps "easy" to Rating.Easy (4)', () => {
    expect(ratingFromString("easy")).toBe(Rating.Easy);
    expect(ratingFromString("easy")).toBe(4);
  });
});
