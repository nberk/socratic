import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  fetchLesson,
  streamChat,
  deleteTopic,
  type Lesson as LessonType,
  type Message,
  type Concept,
} from "../api";
import ChatMessages from "../components/chat/ChatMessages";
import ChatInput from "../components/chat/ChatInput";
import LessonPlanSidebar from "../components/chat/LessonPlanSidebar";
import TrashIcon from "../components/shared/TrashIcon";
import ConfirmDialog from "../components/shared/ConfirmDialog";
import { useFullscreen } from "../contexts/FullscreenContext";

const STREAM_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isFullscreen, setFullscreen, toggleFullscreen } = useFullscreen();
  const [lesson, setLesson] = useState<LessonType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsFirstMessage, setNeedsFirstMessage] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fullscreen on unmount (navigating away from lesson)
  useEffect(() => {
    return () => setFullscreen(false);
  }, [setFullscreen]);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, setFullscreen]);

  useEffect(() => {
    fetchLesson(id!)
      .then((l) => {
        setLesson(l);
        setMessages(l.messages ?? []);
        setConcepts(l.concepts ?? []);
        // If no messages yet, send an initial message to kick off the Socratic session
        if (!l.messages || l.messages.length === 0) {
          setNeedsFirstMessage(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load lesson:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Automatically kick off Claude's intro when there are no messages yet
  useEffect(() => {
    if (needsFirstMessage && lesson && !isStreaming) {
      setNeedsFirstMessage(false);
      handleInitiate();
    }
  }, [needsFirstMessage, lesson, isStreaming]);

  const lastMessageRole = messages.length > 0 ? messages[messages.length - 1]!.role : null;
  const handleDismissError = useCallback(() => setError(null), []);

  // Start a streaming request to Claude (shared by handleSend and handleInitiate)
  const startStream = useCallback(
    async (message: string | null) => {
      if (!lesson || isStreaming) return;

      // Only add a user message to the UI if this is a real user message
      if (message) {
        const tempUserMsg: Message = {
          id: Date.now(),
          lessonId: lesson.id,
          role: "user",
          content: message,
          sectionIndex: lesson.currentSection,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempUserMsg]);
      }
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

      let fullText = "";
      try {
        for await (const event of streamChat(lesson.id, message, controller.signal)) {
          switch (event.type) {
            case "text":
              fullText += event.content;
              setStreamingContent(fullText);
              break;

            case "section_complete":
              setConcepts((prev) => [...prev, ...event.concepts]);
              setLesson((prev) =>
                prev
                  ? {
                      ...prev,
                      currentSection: event.currentSection,
                      status: event.lessonStatus,
                    }
                  : prev
              );
              // Reset streaming content since Claude will continue with new section intro
              if (event.lessonStatus !== "completed") {
                // Save the text so far as a message
                if (fullText.trim()) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now() + 1,
                      lessonId: lesson.id,
                      role: "assistant",
                      content: fullText,
                      sectionIndex: event.currentSection - 1,
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                }
                fullText = "";
                setStreamingContent("");
              }
              break;

            case "done":
              break;

            case "error":
              console.error("Chat error:", event.content);
              setError(event.content);
              break;
          }
        }

        // Save the final assistant message
        if (fullText.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 2,
              lessonId: lesson.id,
              role: "assistant",
              content: fullText,
              sectionIndex: lesson.currentSection,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.error("Streaming error:", err);
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("Response timed out. Please try again.");
        } else {
          setError(
            err instanceof Error ? err.message : "An unexpected error occurred."
          );
        }
      } finally {
        clearTimeout(timeout);
        setStreamingContent("");
        setIsStreaming(false);
      }
    },
    [lesson, isStreaming]
  );

  const handleSend = useCallback(
    (message: string) => startStream(message),
    [startStream]
  );

  const handleInitiate = useCallback(
    () => startStream(null),
    [startStream]
  );

  const handleRetry = useCallback(() => {
    setError(null);
    startStream(null);
  }, [startStream]);

  const handleConfirmDeleteTopic = useCallback(async () => {
    if (!lesson) return;
    setConfirmOpen(false);
    try {
      await deleteTopic(lesson.topicId);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete topic.");
    }
  }, [lesson, navigate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading lesson...</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-500">
          {error ? `Failed to load lesson: ${error}` : "Lesson not found"}
        </p>
        <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const deleteMsg = `Delete "${lesson.topic?.title ?? "this topic"}" and all its lessons and concepts? This cannot be undone.`;

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        message={deleteMsg}
        onConfirm={handleConfirmDeleteTopic}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className={`flex flex-col ${isFullscreen ? "h-dvh" : "h-[calc(100dvh-3.5rem)]"}`}>
        {/* Lesson header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={isStreaming}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 disabled:opacity-50"
            title="Delete topic"
          >
            <TrashIcon />
          </button>
        <Link
          to={`/topics/${lesson.topicId}`}
          className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          {lesson.topic?.title ?? "Topic"}
        </Link>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit full screen (Esc)" : "Enter full screen"}
          aria-expanded={isFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06L5.44 6.5H2.75a.75.75 0 000 1.5h5a.75.75 0 00.75-.75v-5a.75.75 0 00-1.5 0v2.69L3.28 2.22zM16.72 17.78a.75.75 0 001.06-1.06L14.56 13.5h2.69a.75.75 0 000-1.5h-5a.75.75 0 00-.75.75v5a.75.75 0 001.5 0v-2.69l3.72 3.72z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-5a.75.75 0 00-.75-.75h-5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM6.72 12.22L3.5 15.44v-2.69a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h5a.75.75 0 000-1.5H5.06l3.22-3.22a.75.75 0 00-1.06-1.06z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <ChatMessages
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          error={error}
          onRetry={error && !isStreaming ? handleRetry : undefined}
        />

        {error && lastMessageRole !== "user" && (
          <div className="flex items-center gap-3 border-t border-red-200 bg-red-50 px-4 py-2">
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button
              onClick={handleRetry}
              disabled={isStreaming}
              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Retry
            </button>
            <button
              onClick={handleDismissError}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {lesson.status === "completed" ? (
          <div className="border-t border-zinc-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-medium text-emerald-700">
              Lesson complete! {concepts.length} concepts added to your review
              queue.
            </p>
            <Link
              to={`/topics/${lesson.topicId}`}
              className="mt-1 inline-block text-sm text-emerald-600 underline"
            >
              Back to topic
            </Link>
          </div>
        ) : (
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        )}
      </div>

      {/* Sidebar */}
      <LessonPlanSidebar
        plan={lesson.plan}
        currentSection={lesson.currentSection}
        lessonStatus={lesson.status}
        concepts={concepts}
      />
        </div>
      </div>
    </>
  );
}
