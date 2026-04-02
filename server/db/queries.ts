import { eq, lte, asc, desc, and, inArray } from "drizzle-orm";
import { db } from "./index";
import {
  topics,
  lessons,
  messages,
  concepts,
  reviewCards,
  reviewLogs,
  apiUsage,
} from "./schema";
import type { LessonPlanSection } from "./schema";
import { createEmptyCard } from "../lib/srs";
import type { ConceptInput } from "../lib/types";

// ─── Topics ──────────────────────────────────────────

export async function listTopics(userId: string) {
  return db.query.topics.findMany({
    where: eq(topics.userId, userId),
    orderBy: desc(topics.createdAt),
  });
}

export async function getTopicById(id: string, userId: string) {
  return db.query.topics.findFirst({
    where: and(eq(topics.id, id), eq(topics.userId, userId)),
    with: {
      lessons: {
        orderBy: asc(lessons.createdAt),
      },
      concepts: true,
    },
  });
}

export async function verifyTopicAccess(id: string, userId: string) {
  return db.query.topics.findFirst({
    where: and(eq(topics.id, id), eq(topics.userId, userId)),
    columns: { id: true },
  });
}

export async function deleteTopic(id: string, userId: string) {
  // Note: not using db.transaction() because neon-http driver doesn't support it.
  // Sequential deletes are acceptable for a single-user app; partial deletes leave
  // orphaned rows but no corruption, and a retry will clean them up.
  try {
  // Verify ownership before deleting anything
  const topic = await db.query.topics.findFirst({
    where: and(eq(topics.id, id), eq(topics.userId, userId)),
    columns: { id: true },
  });
  if (!topic) return undefined;

  // Nullify FKs on api_usage to preserve cost history
  await db
    .update(apiUsage)
    .set({ topicId: null, lessonId: null })
    .where(eq(apiUsage.topicId, id));

  // Delete in reverse dependency order (no cascade on FKs)
  // 1. Concepts → review_logs → review_cards → concepts
  const topicConcepts = await db.query.concepts.findMany({
    where: eq(concepts.topicId, id),
  });
  const conceptIds = topicConcepts.map((c) => c.id);

  if (conceptIds.length > 0) {
    const cards = await db.query.reviewCards.findMany({
      where: inArray(reviewCards.conceptId, conceptIds),
    });
    const cardIds = cards.map((c) => c.id);

    if (cardIds.length > 0) {
      await db.delete(reviewLogs).where(inArray(reviewLogs.cardId, cardIds));
      await db.delete(reviewCards).where(inArray(reviewCards.id, cardIds));
    }

    await db.delete(concepts).where(eq(concepts.topicId, id));
  }

  // 2. Lessons → messages → lessons
  const topicLessons = await db.query.lessons.findMany({
    where: eq(lessons.topicId, id),
  });
  const lessonIds = topicLessons.map((l) => l.id);

  if (lessonIds.length > 0) {
    await db.delete(messages).where(inArray(messages.lessonId, lessonIds));
    await db.delete(lessons).where(eq(lessons.topicId, id));
  }

  // 3. Topic
  const [deleted] = await db
    .delete(topics)
    .where(and(eq(topics.id, id), eq(topics.userId, userId)))
    .returning();
  return deleted;
  } catch (err) {
    throw new Error(`Failed to delete topic ${id}: ${err}`);
  }
}

export async function createTopic(userId: string, title: string, description?: string) {
  const [topic] = await db
    .insert(topics)
    .values({ userId, title, description })
    .returning();
  return topic;
}

// ─── Lessons ─────────────────────────────────────────

export async function createLesson(
  topicId: string,
  title: string,
  plan: LessonPlanSection[]
) {
  const [lesson] = await db
    .insert(lessons)
    .values({ topicId, title, plan })
    .returning();
  return lesson;
}

export async function getLessonById(id: string) {
  return db.query.lessons.findFirst({
    where: eq(lessons.id, id),
    with: {
      messages: {
        orderBy: asc(messages.createdAt),
      },
      concepts: true,
      topic: true,
    },
  });
}

export async function advanceLessonSection(lessonId: string, totalSections: number) {
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  });
  if (!lesson) throw new Error("Lesson not found");

  const nextSection = lesson.currentSection + 1;
  const isComplete = nextSection >= totalSections;

  const [updated] = await db
    .update(lessons)
    .set({
      currentSection: nextSection,
      status: isComplete ? "completed" : "in_progress",
      completedAt: isComplete ? new Date() : null,
    })
    .where(eq(lessons.id, lessonId))
    .returning();

  return updated!;
}

// ─── Messages ────────────────────────────────────────

export async function saveMessage(
  lessonId: string,
  role: "user" | "assistant",
  content: string,
  sectionIndex: number
) {
  const [message] = await db
    .insert(messages)
    .values({ lessonId, role, content, sectionIndex })
    .returning();
  return message;
}

export async function getMessagesForLesson(lessonId: string) {
  return db.query.messages.findMany({
    where: eq(messages.lessonId, lessonId),
    orderBy: asc(messages.createdAt),
  });
}

export async function getMessagesForSection(lessonId: string, sectionIndex: number) {
  return db.query.messages.findMany({
    where: and(eq(messages.lessonId, lessonId), eq(messages.sectionIndex, sectionIndex)),
    orderBy: asc(messages.createdAt),
  });
}

export async function saveSectionSummary(lessonId: string, sectionIndex: number, summary: string) {
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  });
  if (!lesson) throw new Error("Lesson not found");

  const summaries = [...(lesson.sectionSummaries || [])];
  summaries[sectionIndex] = summary;

  const [updated] = await db
    .update(lessons)
    .set({ sectionSummaries: summaries })
    .where(eq(lessons.id, lessonId))
    .returning();
  return updated!;
}

// ─── Concepts ────────────────────────────────────────

export async function saveConcepts(
  lessonId: string,
  topicId: string,
  sectionIndex: number,
  conceptInputs: ConceptInput[]
) {
  // Note: not using db.transaction() because neon-http driver doesn't support it.
  // Each concept+card pair is inserted sequentially. A partial failure leaves
  // orphaned concepts without cards, but the next section_complete will not
  // re-insert already-saved concepts (they have unique names per topic).
  try {
  const now = new Date();
  const savedConcepts = [];

  for (const c of conceptInputs) {
    const [concept] = await db
      .insert(concepts)
      .values({
        lessonId,
        topicId,
        name: c.name,
        description: c.description,
        question: c.question,
        idealAnswer: c.ideal_answer,
        sectionIndex,
      })
      .returning();

    // Create an FSRS card for this concept, due immediately
    const emptyCard = createEmptyCard(now);
    await db.insert(reviewCards).values({
      conceptId: concept!.id,
      due: emptyCard.due,
      stability: emptyCard.stability,
      difficulty: emptyCard.difficulty,
      elapsedDays: emptyCard.elapsed_days,
      scheduledDays: emptyCard.scheduled_days,
      reps: emptyCard.reps,
      lapses: emptyCard.lapses,
      state: emptyCard.state,
      lastReview: null,
    });

    savedConcepts.push(concept!);
  }

  return savedConcepts;
  } catch (err) {
    throw new Error(`Failed to save concepts for lesson ${lessonId}: ${err}`);
  }
}

export async function listConcepts(userId: string, topicId?: string) {
  if (topicId) {
    return db.query.concepts.findMany({
      where: eq(concepts.topicId, topicId),
      with: { reviewCard: true },
      orderBy: desc(concepts.createdAt),
    });
  }
  const userTopicIds = db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.userId, userId));

  return db.query.concepts.findMany({
    where: inArray(concepts.topicId, userTopicIds),
    with: { reviewCard: true, topic: true },
    orderBy: desc(concepts.createdAt),
  });
}

// ─── Review ──────────────────────────────────────────

export async function getDueCards(userId: string) {
  const now = new Date();
  const userConceptIds = db
    .select({ id: concepts.id })
    .from(concepts)
    .innerJoin(topics, eq(concepts.topicId, topics.id))
    .where(eq(topics.userId, userId));

  return db.query.reviewCards.findMany({
    where: and(lte(reviewCards.due, now), inArray(reviewCards.conceptId, userConceptIds)),
    with: {
      concept: {
        with: { topic: true },
      },
    },
    orderBy: asc(reviewCards.due),
  });
}

export async function getCardById(id: number) {
  return db.query.reviewCards.findFirst({
    where: eq(reviewCards.id, id),
    with: {
      concept: {
        with: { topic: true },
      },
    },
  });
}

export async function updateCard(
  cardId: number,
  cardState: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date;
  }
) {
  const [updated] = await db
    .update(reviewCards)
    .set({
      due: cardState.due,
      stability: cardState.stability,
      difficulty: cardState.difficulty,
      elapsedDays: cardState.elapsedDays,
      scheduledDays: cardState.scheduledDays,
      reps: cardState.reps,
      lapses: cardState.lapses,
      state: cardState.state,
      lastReview: cardState.lastReview,
    })
    .where(eq(reviewCards.id, cardId))
    .returning();
  return updated;
}

export async function createReviewLog(
  cardId: number,
  rating: number,
  state: number,
  elapsedDays: number,
  scheduledDays: number
) {
  const [log] = await db
    .insert(reviewLogs)
    .values({ cardId, rating, state, elapsedDays, scheduledDays })
    .returning();
  return log;
}
