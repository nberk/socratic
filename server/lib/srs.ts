import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type RecordLog,
} from "ts-fsrs";

const params = generatorParameters({
  maximum_interval: 365,
  request_retention: 0.9,
  enable_fuzz: true,
});

export const scheduler = fsrs(params);
export { createEmptyCard, Rating, State };
export type { Card, RecordLog };

/**
 * Convert a database row into a ts-fsrs Card object.
 */
export function cardFromRow(row: {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  } as Card;
}

/**
 * Map a string rating from Claude's grading to a ts-fsrs Rating enum.
 */
export function ratingFromString(
  rating: "again" | "hard" | "good" | "easy"
): Rating {
  const map = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  } as const;
  return map[rating];
}
