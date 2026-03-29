import { Link } from "react-router";

export default function DueCountBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="text-sm text-zinc-500">No reviews due</p>
        <p className="mt-1 text-xs text-zinc-400">You're all caught up!</p>
      </div>
    );
  }

  return (
    <Link
      to="/review"
      className="block rounded-lg border border-amber-200 bg-amber-50 p-6 text-center transition-colors hover:border-amber-300 hover:bg-amber-100"
    >
      <p className="text-3xl font-bold text-amber-700">{count}</p>
      <p className="mt-1 text-sm font-medium text-amber-600">
        review{count !== 1 ? "s" : ""} due
      </p>
      <p className="mt-2 text-xs text-amber-500">Click to start reviewing</p>
    </Link>
  );
}
