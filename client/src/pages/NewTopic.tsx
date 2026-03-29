import { useState } from "react";
import { useNavigate } from "react-router";
import { createTopic, createLesson } from "../api";

export default function NewTopic() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");

    try {
      const topic = await createTopic(title.trim(), description.trim() || undefined);
      // Automatically create the first lesson
      const lesson = await createLesson(topic.id);
      navigate(`/lessons/${lesson.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">New Topic</h1>
      <p className="mt-1 text-sm text-zinc-500">
        What do you want to learn? Claude will create a lesson plan and guide you
        through it using the Socratic method.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-zinc-700"
          >
            Topic
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Rust Ownership, Quantum Mechanics, React Hooks..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            disabled={loading}
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-zinc-700"
          >
            Details{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any specific areas you want to focus on, your current level, etc."
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed"
        >
          {loading ? "Creating lesson plan..." : "Start Learning"}
        </button>
      </form>
    </div>
  );
}
