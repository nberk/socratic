import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  real,
  index,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(topics),
}));

// ─── Topics ──────────────────────────────────────────

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const topicsRelations = relations(topics, ({ many, one }) => ({
  user: one(users, { fields: [topics.userId], references: [users.id] }),
  lessons: many(lessons),
  concepts: many(concepts),
  apiUsage: many(apiUsage),
}));

// ─── Lessons ─────────────────────────────────────────

export type LessonPlanSection = {
  sectionTitle: string;
  objectives: string[];
};

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id),
  title: text("title").notNull(),
  plan: jsonb("plan").notNull().$type<LessonPlanSection[]>(),
  currentSection: integer("current_section").notNull().default(0),
  sectionSummaries: jsonb("section_summaries").notNull().default([]).$type<string[]>(),
  status: text("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  topic: one(topics, {
    fields: [lessons.topicId],
    references: [topics.id],
  }),
  messages: many(messages),
  concepts: many(concepts),
  apiUsage: many(apiUsage),
}));

// ─── Messages ────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    sectionIndex: integer("section_index").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("messages_lesson_created_idx").on(table.lessonId, table.createdAt)]
);

export const messagesRelations = relations(messages, ({ one }) => ({
  lesson: one(lessons, {
    fields: [messages.lessonId],
    references: [lessons.id],
  }),
}));

// ─── Concepts ────────────────────────────────────────

export const concepts = pgTable("concepts", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  question: text("question").notNull(),
  idealAnswer: text("ideal_answer").notNull(),
  sectionIndex: integer("section_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conceptsRelations = relations(concepts, ({ one }) => ({
  lesson: one(lessons, {
    fields: [concepts.lessonId],
    references: [lessons.id],
  }),
  topic: one(topics, {
    fields: [concepts.topicId],
    references: [topics.id],
  }),
  reviewCard: one(reviewCards),
}));

// ─── Review Cards (FSRS state) ──────────────────────

export const reviewCards = pgTable(
  "review_cards",
  {
    id: serial("id").primaryKey(),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id),
    due: timestamp("due").notNull(),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: integer("state").notNull().default(0), // 0=New, 1=Learning, 2=Review, 3=Relearning
    lastReview: timestamp("last_review"),
  },
  (table) => [
    unique("review_cards_concept_id_unique").on(table.conceptId),
    index("review_cards_due_idx").on(table.due),
  ]
);

export const reviewCardsRelations = relations(reviewCards, ({ one, many }) => ({
  concept: one(concepts, {
    fields: [reviewCards.conceptId],
    references: [concepts.id],
  }),
  logs: many(reviewLogs),
}));

// ─── Review Logs ─────────────────────────────────────

export const reviewLogs = pgTable("review_logs", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id")
    .notNull()
    .references(() => reviewCards.id),
  rating: integer("rating").notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
  state: integer("state").notNull(),
  elapsedDays: integer("elapsed_days").notNull(),
  scheduledDays: integer("scheduled_days").notNull(),
  reviewedAt: timestamp("reviewed_at").notNull().defaultNow(),
});

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  card: one(reviewCards, {
    fields: [reviewLogs.cardId],
    references: [reviewCards.id],
  }),
}));

// ─── API Usage Tracking ─────────────────────────────

export const apiUsage = pgTable(
  "api_usage",
  {
    id: serial("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costMillicents: integer("cost_millicents").notNull(),
    topicId: uuid("topic_id").references(() => topics.id),
    lessonId: uuid("lesson_id").references(() => lessons.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("api_usage_created_at_idx").on(table.createdAt),
    index("api_usage_topic_id_idx").on(table.topicId),
  ]
);

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  topic: one(topics, {
    fields: [apiUsage.topicId],
    references: [topics.id],
  }),
  lesson: one(lessons, {
    fields: [apiUsage.lessonId],
    references: [lessons.id],
  }),
}));
