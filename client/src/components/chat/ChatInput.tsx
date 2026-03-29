import { useState, useRef, useEffect, useCallback } from "react";

type Props = {
  onSend: (message: string) => void;
  disabled: boolean;
};

const MIN_HEIGHT = 60;
const MAX_HEIGHT = Math.min(500, Math.floor(window.innerHeight * 0.5));
const DEFAULT_HEIGHT = 60;
const STORAGE_KEY = "chatInputHeight";

function loadSavedHeight(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT) return parsed;
    }
  } catch {}
  return DEFAULT_HEIGHT;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const [height, setHeight] = useState(loadSavedHeight);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    // Height = distance from cursor to viewport bottom, minus padding
    const newHeight = Math.min(
      MAX_HEIGHT,
      Math.max(MIN_HEIGHT, window.innerHeight - e.clientY - 56)
    );
    setHeight(newHeight);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    setHeight((h) => {
      try { localStorage.setItem(STORAGE_KEY, String(h)); } catch {}
      return h;
    });
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      ref={containerRef}
      className="bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.04)]"
    >
      {/* Drag handle — desktop only */}
      <div
        onMouseDown={handleMouseDown}
        className="group hidden h-3 cursor-row-resize items-center justify-center transition-colors hover:bg-zinc-100 active:bg-zinc-200 sm:flex"
      >
        <div className="h-0.5 w-10 rounded-full bg-zinc-300 transition-colors group-hover:bg-zinc-400" />
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl px-4 pb-4">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-300 focus-within:border-zinc-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled ? "Waiting for response..." : "Type your answer..."
            }
            style={{ height: `${height}px` }}
            className="flex-1 resize-none border-none bg-transparent px-3 py-2.5 text-sm focus:outline-none disabled:text-zinc-400"
          />
          <button
            type="submit"
            disabled={!canSend}
            className={`mb-2 mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              canSend
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
