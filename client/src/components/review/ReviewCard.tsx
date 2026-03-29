import { useState } from "react";
import type { DueCard } from "../../api";

type Props = {
  card: DueCard;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  disabled: boolean;
  currentIndex: number;
  totalCards: number;
};

export default function ReviewCard({
  card,
  onSubmit,
  onSkip,
  disabled,
  currentIndex,
  totalCards,
}: Props) {
  const [answer, setAnswer] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || disabled) return;
    onSubmit(answer.trim());
    setAnswer("");
  }

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

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {card.concept.name}
        </h3>
        <p className="mt-3 text-lg leading-relaxed text-zinc-900">
          {card.concept.question}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              if (answer.trim() && !disabled) {
                onSubmit(answer.trim());
                setAnswer("");
              }
            }
          }}
          disabled={disabled}
          placeholder="Type your answer..."
          rows={5}
          className="w-full resize-none rounded-lg border border-zinc-300 px-4 py-3 text-sm leading-relaxed focus:border-zinc-500 focus:outline-none disabled:bg-zinc-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={disabled || !answer.trim()}
          className="mt-2 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed"
        >
          {disabled ? "Grading..." : "Submit Answer"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="mt-2 w-full rounded-lg border border-zinc-300 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:text-zinc-300 disabled:cursor-not-allowed"
        >
          I Know This
        </button>
      </form>
    </div>
  );
}
