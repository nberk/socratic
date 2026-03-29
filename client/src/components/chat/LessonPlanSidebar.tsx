import { useState } from "react";
import type { LessonPlanSection, Concept } from "../../api";

type Props = {
  plan: LessonPlanSection[];
  currentSection: number;
  lessonStatus: string;
  concepts: Concept[];
};

export default function LessonPlanSidebar({
  plan,
  currentSection,
  lessonStatus,
  concepts,
}: Props) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 640);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  if (collapsed) {
    return (
      <aside className="flex shrink-0 flex-col items-center border-l border-zinc-200 bg-zinc-50 py-3 px-1.5">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
          title="Show lesson plan"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="mt-3 text-xs font-semibold tracking-wider text-zinc-400" style={{ writingMode: "vertical-lr" }}>
          Lesson Plan
        </span>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Lesson Plan
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
          title="Hide lesson plan"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {plan.map((section, i) => {
          const isCompleted = i < currentSection;
          const isCurrent = i === currentSection && lessonStatus !== "completed";
          const sectionConcepts = concepts.filter((c) => c.sectionIndex === i);

          const isSectionCollapsed = isCompleted && collapsedSections.has(i);
          const toggleSection = () => {
            if (!isCompleted) return;
            setCollapsedSections((prev) => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              return next;
            });
          };

          return (
            <div
              key={i}
              className={`rounded-md border px-3 py-2 ${
                isCurrent
                  ? "border-zinc-400 bg-white"
                  : isCompleted
                    ? "border-zinc-200 bg-zinc-100"
                    : "border-zinc-200"
              }`}
            >
              <div
                className={`flex items-center gap-2 ${isCompleted && sectionConcepts.length > 0 ? "cursor-pointer" : ""}`}
                onClick={sectionConcepts.length > 0 ? toggleSection : undefined}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {isCompleted ? "\u2713" : i + 1}
                </span>
                <span
                  className={`flex-1 text-xs font-medium ${
                    isCurrent ? "text-zinc-900" : "text-zinc-600"
                  }`}
                >
                  {section.sectionTitle}
                </span>
                {isCompleted && sectionConcepts.length > 0 && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${isSectionCollapsed ? "-rotate-90" : ""}`}
                  >
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0l-4.25-4.25a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {sectionConcepts.length > 0 && !isSectionCollapsed && (
                <div className="mt-2 ml-7 space-y-1">
                  {sectionConcepts.map((concept) => (
                    <div
                      key={concept.id}
                      className="text-xs text-zinc-500"
                      title={concept.description}
                    >
                      {concept.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lessonStatus === "completed" && (
        <div className="mt-4 rounded-md bg-emerald-50 p-3 text-center">
          <p className="text-sm font-medium text-emerald-700">
            Lesson Complete!
          </p>
          <p className="mt-1 text-xs text-emerald-600">
            {concepts.length} concept{concepts.length !== 1 ? "s" : ""} added to
            your review queue.
          </p>
        </div>
      )}
    </aside>
  );
}
