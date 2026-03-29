import { Link } from "react-router";
import type { GradeResponse } from "../../api";

type Props = {
  results: GradeResponse[];
};

export default function ReviewSummary({ results }: Props) {
  const total = results.length;
  const counts = {
    again: results.filter((r) => r.grade.rating === "again").length,
    hard: results.filter((r) => r.grade.rating === "hard").length,
    good: results.filter((r) => r.grade.rating === "good").length,
    easy: results.filter((r) => r.grade.rating === "easy").length,
  };
  const successRate =
    total > 0 ? Math.round(((counts.good + counts.easy) / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="rounded-lg border border-zinc-200 bg-white p-8">
        <h2 className="text-xl font-semibold text-zinc-900">
          Review Complete!
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          You reviewed {total} card{total !== 1 ? "s" : ""}
        </p>

        <div className="mt-6">
          <p className="text-4xl font-bold text-zinc-900">{successRate}%</p>
          <p className="text-sm text-zinc-500">success rate</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-md bg-red-50 p-2">
            <p className="text-lg font-semibold text-red-700">{counts.again}</p>
            <p className="text-xs text-red-600">Needs Review</p>
          </div>
          <div className="rounded-md bg-amber-50 p-2">
            <p className="text-lg font-semibold text-amber-700">{counts.hard}</p>
            <p className="text-xs text-amber-600">Getting There</p>
          </div>
          <div className="rounded-md bg-emerald-50 p-2">
            <p className="text-lg font-semibold text-emerald-700">
              {counts.good}
            </p>
            <p className="text-xs text-emerald-600">Solid</p>
          </div>
          <div className="rounded-md bg-blue-50 p-2">
            <p className="text-lg font-semibold text-blue-700">{counts.easy}</p>
            <p className="text-xs text-blue-600">Nailed It</p>
          </div>
        </div>

        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
