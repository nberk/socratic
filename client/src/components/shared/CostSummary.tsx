import type { UsageSummary, UsagePeriod } from "../../api";

function formatCost(millicents: number): string {
  const dollars = millicents / 100_000;
  if (dollars < 0.01 && dollars > 0) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

function PeriodColumn({ label, period }: { label: string; period: UsagePeriod }) {
  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">
        {formatCost(period.totalCostMillicents)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">
        {formatTokens(period.totalInputTokens + period.totalOutputTokens)} tokens
      </p>
      <p className="text-xs text-zinc-400">
        {period.callCount} call{period.callCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function CostSummary({ data }: { data: UsageSummary | null }) {
  if (!data) return null;

  const { today, thisWeek, thisMonth, allTime } = data;

  // Don't render if there's no usage at all
  if (allTime.callCount === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        API Cost
      </h3>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <PeriodColumn label="Today" period={today} />
        <PeriodColumn label="Week" period={thisWeek} />
        <PeriodColumn label="Month" period={thisMonth} />
        <PeriodColumn label="All Time" period={allTime} />
      </div>
    </div>
  );
}
