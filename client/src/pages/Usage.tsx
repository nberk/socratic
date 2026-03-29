import { useEffect, useState } from "react";
import { fetchUsageSummary, type UsageSummary } from "../api";
import CostSummary from "../components/shared/CostSummary";

export default function Usage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsageSummary()
      .then(setUsage)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">API Usage</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-6">
        <CostSummary data={usage} />
      </div>

      {usage && usage.allTime.callCount === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-sm text-zinc-500">No API calls recorded yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Start a lesson or review to begin tracking costs.
          </p>
        </div>
      )}
    </div>
  );
}
