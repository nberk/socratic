import { useEffect, useState } from "react";
import { fetchConcepts, fetchTopics, type Concept, type Topic } from "../api";

const stateLabels: Record<number, { label: string; color: string }> = {
  0: { label: "New", color: "bg-zinc-100 text-zinc-600" },
  1: { label: "Learning", color: "bg-amber-100 text-amber-700" },
  2: { label: "Review", color: "bg-emerald-100 text-emerald-700" },
  3: { label: "Relearning", color: "bg-red-100 text-red-700" },
};

export default function Concepts() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchConcepts(), fetchTopics()])
      .then(([c, t]) => {
        setConcepts(c);
        setTopics(t);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedTopic === undefined) return; // skip the duplicate initial fetch
    fetchConcepts(selectedTopic)
      .then(setConcepts)
      .catch((err) => setError(err.message));
  }, [selectedTopic]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Concepts</h1>
        <select
          value={selectedTopic ?? ""}
          onChange={(e) =>
            setSelectedTopic(
              e.target.value ? e.target.value : undefined
            )
          }
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {concepts.length === 0 && !error ? (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-sm text-zinc-500">
            No concepts yet. Complete lessons to extract concepts.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {concepts.map((concept) => {
            const card = concept.reviewCard;
            const state = (card ? stateLabels[card.state] : stateLabels[0])!;
            const dueDate = card ? new Date(card.due) : null;
            const isOverdue = dueDate && dueDate <= new Date();

            return (
              <div
                key={concept.id}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-zinc-900">
                        {concept.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${state.color}`}
                      >
                        {state.label}
                      </span>
                      {isOverdue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Due
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {concept.topic?.title}
                    </p>
                  </div>
                  {card && (
                    <div className="text-right text-xs text-zinc-400">
                      <p>{card.reps} reviews</p>
                      {dueDate && (
                        <p>
                          {isOverdue
                            ? "Due now"
                            : `Due ${dueDate.toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  {concept.description}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
