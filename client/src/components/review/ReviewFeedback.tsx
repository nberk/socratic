import type { GradeResponse } from "../../api";

type Props = {
  result: GradeResponse;
  idealAnswer: string;
  onNext: () => void;
};

const ratingColors = {
  again: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Needs Review" },
  hard: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "Getting There" },
  good: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "Solid" },
  easy: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", label: "Nailed It" },
};

export default function ReviewFeedback({ result, idealAnswer, onNext }: Props) {
  const rating = result.grade.rating;
  const colors = ratingColors[rating];
  const nextDue = new Date(result.scheduling.nextDue);
  const daysUntil = Math.max(
    0,
    Math.round((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Rating badge */}
      <div
        className={`rounded-lg border ${colors.border} ${colors.bg} p-4 text-center`}
      >
        <p className={`text-lg font-semibold ${colors.text}`}>{colors.label}</p>
        <p className="mt-1 text-sm text-zinc-500">
          Next review in{" "}
          {daysUntil === 0
            ? "less than a day"
            : `${daysUntil} day${daysUntil !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Feedback */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Feedback
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          {result.grade.feedback}
        </p>

        {result.grade.correct_points.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-emerald-600">
              What you demonstrated:
            </p>
            <ul className="mt-1 space-y-1">
              {result.grade.correct_points.map((p, i) => (
                <li key={i} className="text-sm text-zinc-600">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.grade.missed_points.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-amber-600">To deepen your understanding:</p>
            <ul className="mt-1 space-y-1">
              {result.grade.missed_points.map((p, i) => (
                <li key={i} className="text-sm text-zinc-600">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Ideal answer */}
      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-600">
          Show ideal answer
        </summary>
        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="text-sm leading-relaxed text-zinc-600">{idealAnswer}</p>
        </div>
      </details>

      <button
        onClick={onNext}
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Next Card
      </button>
    </div>
  );
}
