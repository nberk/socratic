import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { fetchTopic, deleteTopic, createLesson, type Topic } from "../api";
import ConfirmDialog from "../components/shared/ConfirmDialog";

export default function TopicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingLesson, setStartingLesson] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopic(id!)
      .then(setTopic)
      .catch((err) => {
        console.error("Failed to load topic:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Redirect straight to lesson unless it's completed (which has value: concepts, summary)
  useEffect(() => {
    if (loading || !topic) return;
    const lesson = topic.lessons?.[0];
    if (!lesson) {
      let cancelled = false;
      setStartingLesson(true);
      createLesson(topic.id)
        .then((newLesson) => {
          if (!cancelled) navigate(`/lessons/${newLesson.id}`, { replace: true });
        })
        .catch((err) => {
          if (!cancelled) {
            setStartingLesson(false);
            setError(err instanceof Error ? err.message : "Failed to start lesson.");
          }
        });
      return () => { cancelled = true; };
    } else if (lesson.status !== "completed") {
      navigate(`/lessons/${lesson.id}`, { replace: true });
    }
  }, [loading, topic]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirmDelete() {
    if (!topic) return;
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deleteTopic(topic.id);
      navigate("/");
    } catch (err) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : "Failed to delete topic. Please try again.");
    }
  }

  if (loading || startingLesson) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">
          {startingLesson ? "Starting lesson..." : "Loading..."}
        </p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">
          {error ? `Failed to load topic: ${error}` : "Topic not found"}
        </p>
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const lesson = topic.lessons?.[0];
  const concepts = topic.concepts ?? [];

  const lessonCount = topic.lessons?.length ?? 0;
  const confirmMsg =
    lessonCount + concepts.length > 0
      ? `Delete "${topic.title}" and all its ${lessonCount} lesson(s) and ${concepts.length} concept(s)? This cannot be undone.`
      : `Delete "${topic.title}"? This cannot be undone.`;

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        message={confirmMsg}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{topic.title}</h1>
            {topic.description && (
              <p className="mt-1 text-sm text-zinc-500">{topic.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
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

      {/* Lesson card — only shown for completed lessons (in-progress redirects away) */}
      {lesson && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Completed
              </span>
              <h2 className="mt-2 text-base font-semibold text-zinc-900 truncate">
                {lesson.title}
              </h2>
              <div className="mt-3">
                <span className="text-xs text-zinc-500">
                  All {lesson.plan.length} sections complete
                </span>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-zinc-100">
                  <div className="h-1.5 w-full rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
            <Link
              to={`/lessons/${lesson.id}`}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Review →
            </Link>
          </div>
        </div>
      )}

      {/* Concepts */}
      {concepts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Concepts Learned
            <span className="ml-2 font-normal normal-case text-zinc-300">
              {concepts.length}
            </span>
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {concepts.map((concept) => (
              <div
                key={concept.id}
                className="rounded-lg border border-zinc-200 bg-white p-3"
              >
                <p className="text-sm font-medium text-zinc-900">
                  {concept.name}
                </p>
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                  {concept.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
