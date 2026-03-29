import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "font-size-percent";
const DEFAULT_SIZE = 100;
const MIN_SIZE = 80;
const MAX_SIZE = 150;
const STEP = 5;

export default function FontSizeControl() {
  const [size, setSize] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : DEFAULT_SIZE;
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.fontSize = `${size}%`;
    localStorage.setItem(STORAGE_KEY, String(size));
  }, [size]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-full right-0 mb-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSize((s) => Math.max(MIN_SIZE, s - STEP))}
              disabled={size <= MIN_SIZE}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Decrease font size"
            >
              −
            </button>
            <button
              onClick={() => setSize(DEFAULT_SIZE)}
              className="min-w-[3.5rem] rounded-lg px-2 py-1.5 text-center text-sm font-medium text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors"
              title="Reset to 100%"
            >
              {size}%
            </button>
            <button
              onClick={() => setSize((s) => Math.min(MAX_SIZE, s + STEP))}
              disabled={size >= MAX_SIZE}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-medium text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Increase font size"
            >
              +
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-white shadow-md hover:bg-zinc-700 transition-colors text-sm font-semibold"
        title="Adjust font size"
      >
        Aa
      </button>
    </div>
  );
}
