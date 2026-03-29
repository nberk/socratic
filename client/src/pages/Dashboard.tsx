import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchTopics, fetchDueCards, deleteTopic, type Topic, type DueCard } from "../api";
import TopicCard from "../components/shared/TopicCard";
import DueCountBadge from "../components/shared/DueCountBadge";

export default function Dashboard() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteTopic(id: string) {
    try {
      await deleteTopic(id);
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete topic.");
    }
  }

  useEffect(() => {
    Promise.all([fetchTopics(), fetchDueCards()])
      .then(([t, d]) => {
        setTopics(t);
        setDueCards(d);
      })
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

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500 font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <Link
          to="/topics/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          New Topic
        </Link>
      </div>

      {/* Due reviews */}
      <div className="mt-6">
        <DueCountBadge count={dueCards.length} />
      </div>

      {/* Topics */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Your Topics
        </h2>
        {topics.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-sm text-zinc-500">No topics yet.</p>
            <Link
              to="/topics/new"
              className="mt-2 inline-block text-sm font-medium text-zinc-900 underline"
            >
              Create your first topic
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} onDelete={handleDeleteTopic} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
