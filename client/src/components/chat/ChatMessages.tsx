import { useEffect, useRef } from "react";
import type { Message } from "../../api";
import MarkdownContent from "./MarkdownContent";

type Props = {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function AiIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4.5 w-4.5 text-zinc-500"
      >
        <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
        <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286a48.4 48.4 0 0 1 6.862 2.756l.975.513c.6.316 1.317.316 1.918 0l.032-.017Z" />
        <path d="M4.462 19.462c.42-.419.753-.89 1-1.395.453.214.902.435 1.347.662a6.742 6.742 0 0 1-1.286 1.794.75.75 0 0 1-1.06-1.06Z" />
      </svg>
    </div>
  );
}

function UserIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4.5 w-4.5 text-zinc-200"
      >
        <path
          fillRule="evenodd"
          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}

function AiMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <AiIcon />
      <div className="min-w-0 flex-1 pt-1">
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}

function UserMessage({
  content,
  error,
  onRetry,
}: {
  content: string;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2.5 text-white">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
        <UserIcon />
      </div>
      {error && onRetry && (
        <div className="mr-11 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-red-500">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-red-700">{error}</span>
          <button
            onClick={onRetry}
            className="ml-1 flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z" clipRule="evenodd" />
            </svg>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <AiIcon />
      <div className="min-w-0 flex-1 pt-1">
        <MarkdownContent content={content} />
        <span className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-zinc-400" />
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <AiIcon />
      <div className="flex items-center gap-1.5 pt-2.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0.15s" }} />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

export default function ChatMessages({ messages, streamingContent, isStreaming, error, onRetry }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isWaiting = isStreaming && !streamingContent;

  // Find the last user message index to attach retry UI
  const lastUserMsgIndex = error && onRetry
    ? messages.findLastIndex((m) => m.role === "user")
    : -1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isWaiting]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <UserMessage
              key={msg.id}
              content={msg.content}
              error={i === lastUserMsgIndex ? error : undefined}
              onRetry={i === lastUserMsgIndex ? onRetry : undefined}
            />
          ) : (
            <AiMessage key={msg.id} content={msg.content} />
          )
        )}

        {streamingContent && <StreamingMessage content={streamingContent} />}

        {isWaiting && <ThinkingIndicator />}

        {messages.length === 0 && !streamingContent && !isStreaming && (
          <div className="flex h-full items-center justify-center py-20">
            <p className="text-sm text-zinc-400">
              Send a message to start the conversation
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
