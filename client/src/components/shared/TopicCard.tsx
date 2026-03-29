import { useState } from "react";
import { Link } from "react-router";
import type { Topic } from "../../api";
import TrashIcon from "./TrashIcon";
import ConfirmDialog from "./ConfirmDialog";

export default function TopicCard({
  topic,
  onDelete,
}: {
  topic: Topic;
  onDelete?: (id: string) => void;
}) {
  const lessonCount = topic.lessons?.length ?? 0;
  const conceptCount = topic.concepts?.length ?? 0;
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await onDelete!(topic.id);
    } catch {
      setDeleting(false);
    }
  }

  const confirmMsg =
    lessonCount + conceptCount > 0
      ? `Delete "${topic.title}" and all its ${lessonCount} lesson(s) and ${conceptCount} concept(s)? This cannot be undone.`
      : `Delete "${topic.title}"? This cannot be undone.`;

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        message={confirmMsg}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <Link
        to={`/topics/${topic.id}`}
        className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-medium text-zinc-900">{topic.title}</h3>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                className="rounded p-1 text-zinc-300 transition-colors hover:text-red-500 disabled:opacity-50"
                title="Delete topic"
              >
                <TrashIcon />
              </button>
            )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              topic.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {topic.status}
          </span>
        </div>
      </div>
      {topic.description && (
        <p className="mt-1 text-sm text-zinc-500">{topic.description}</p>
      )}
      <div className="mt-3 flex gap-4 text-xs text-zinc-400">
        <span>{lessonCount} lesson{lessonCount !== 1 ? "s" : ""}</span>
        <span>{conceptCount} concept{conceptCount !== 1 ? "s" : ""}</span>
      </div>
      </Link>
    </>
  );
}
