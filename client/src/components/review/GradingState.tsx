import type { DueCard } from "../../api";

type Props = {
  card: DueCard;
  submittedAnswer: string;
  currentIndex: number;
  totalCards: number;
};

export default function GradingState({
  card,
  submittedAnswer,
  currentIndex,
  totalCards,
}: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between text-sm text-zinc-400">
        <span>
          Card {currentIndex + 1} of {totalCards}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {card.concept.topic.title}
        </span>
      </div>

      {/* Question */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {card.concept.name}
        </h3>
        <p className="mt-3 text-lg leading-relaxed text-zinc-900">
          {card.concept.question}
        </p>
      </div>

      {/* User's answer */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your answer
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {submittedAnswer}
        </p>
      </div>

      {/* Ideal answer */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Ideal answer
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {card.concept.idealAnswer}
        </p>
      </div>

      {/* Grading indicator */}
      <div className="mt-4 flex items-center justify-center gap-2 py-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-500">Grading your answer...</span>
      </div>
    </div>
  );
}
