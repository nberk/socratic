const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out — please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Topics ──────────────────────────────────────────

export type Topic = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lessons?: Lesson[];
  concepts?: Concept[];
};

export async function fetchTopics(): Promise<Topic[]> {
  return request("/topics");
}

export async function fetchTopic(id: string): Promise<Topic> {
  return request(`/topics/${id}`);
}

export async function createTopic(
  title: string,
  description?: string
): Promise<Topic> {
  return request("/topics", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export async function deleteTopic(id: string): Promise<void> {
  await request(`/topics/${id}`, { method: "DELETE" });
}

// ─── Lessons ─────────────────────────────────────────

export type LessonPlanSection = {
  sectionTitle: string;
  objectives: string[];
};

export type Lesson = {
  id: string;
  topicId: string;
  title: string;
  plan: LessonPlanSection[];
  currentSection: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  messages?: Message[];
  concepts?: Concept[];
  topic?: Topic;
};

export type Message = {
  id: number;
  lessonId: string;
  role: "user" | "assistant";
  content: string;
  sectionIndex: number;
  createdAt: string;
};

export async function fetchLesson(id: string): Promise<Lesson> {
  return request(`/lessons/${id}`);
}

export async function createLesson(topicId: string): Promise<Lesson> {
  return request("/lessons", {
    method: "POST",
    body: JSON.stringify({ topicId }),
  });
}

// ─── Chat (SSE streaming) ────────────────────────────

export type ChatEvent =
  | { type: "text"; content: string }
  | {
      type: "section_complete";
      concepts: Concept[];
      summary: string;
      lessonStatus: string;
      currentSection: number;
    }
  | { type: "done" }
  | { type: "error"; content: string };

export async function* streamChat(
  lessonId: string,
  message: string | null,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const body = message
    ? { lessonId, message }
    : { lessonId, initiate: true };
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error("Chat request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) {
          try {
            yield JSON.parse(data) as ChatEvent;
          } catch {
            // skip malformed events
          }
        }
      }
    }
  }

  // Flush any remaining data in the buffer
  if (buffer.trim()) {
    const remaining = buffer.trim();
    if (remaining.startsWith("data:")) {
      const data = remaining.slice(5).trim();
      if (data) {
        try {
          yield JSON.parse(data) as ChatEvent;
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

// ─── Review ──────────────────────────────────────────

export type Concept = {
  id: string;
  lessonId: string;
  topicId: string;
  name: string;
  description: string;
  question: string;
  idealAnswer: string;
  sectionIndex: number;
  createdAt: string;
  reviewCard?: ReviewCard;
  topic?: Topic;
};

export type ReviewCard = {
  id: number;
  conceptId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string | null;
  concept?: Concept;
};

export type DueCard = ReviewCard & {
  concept: Concept & { topic: Topic };
};

export type GradeResult = {
  rating: "again" | "hard" | "good" | "easy";
  feedback: string;
  correct_points: string[];
  missed_points: string[];
};

export type GradeResponse = {
  grade: GradeResult;
  scheduling: {
    nextDue: string;
    scheduledDays: number;
    state: number;
  };
};

export async function fetchDueCards(): Promise<DueCard[]> {
  return request("/review/due");
}

export async function gradeAnswer(
  cardId: number,
  answer: string
): Promise<GradeResponse> {
  return request("/review/grade", {
    method: "POST",
    body: JSON.stringify({ cardId, answer }),
  });
}

export type SkipResponse = {
  scheduling: {
    nextDue: string;
    scheduledDays: number;
    state: number;
  };
};

export async function skipCard(cardId: number): Promise<SkipResponse> {
  return request("/review/skip", {
    method: "POST",
    body: JSON.stringify({ cardId }),
  });
}

// ─── Concepts ────────────────────────────────────────

export async function fetchConcepts(topicId?: string): Promise<Concept[]> {
  const query = topicId ? `?topicId=${topicId}` : "";
  return request(`/concepts${query}`);
}

// ─── Usage ───────────────────────────────────────────

export type UsagePeriod = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostMillicents: number;
  callCount: number;
};

export type UsageSummary = {
  today: UsagePeriod;
  thisWeek: UsagePeriod;
  thisMonth: UsagePeriod;
  allTime: UsagePeriod;
};

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return request("/usage/summary");
}
