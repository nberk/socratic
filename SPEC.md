# Socratic Learning App — Technical Specification

## Problem

Learning through Socratic dialogue with Claude is effective in the moment, but concepts fade without reinforcement. There is no system to (1) capture what was learned during a teaching session and (2) schedule spaced reviews to cement that knowledge over time.

## Solution

A web app with two core modes:

1. **Learn**: Socratic teaching sessions where Claude creates a lesson plan, assesses your knowledge per section, and doesn't let you advance until you demonstrate understanding. Concepts are automatically extracted during the conversation.

2. **Review**: Daily spaced repetition sessions where you answer free-response questions about previously learned concepts. Claude grades your answers and the system schedules the next review using the FSRS algorithm.

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | **Bun** | Fast, native TypeScript, compatible npm ecosystem |
| Frontend | **React 19 + Vite** | Fast dev server, simple SPA — no SSR needed for a personal tool |
| Backend | **Hono** (on Bun) | Lightweight, TypeScript-native, built-in streaming support for Claude responses |
| Database | **Postgres** — local (Docker) for dev, **Neon** for prod | Relational model fits the data; Neon gives anywhere access |
| ORM | **Drizzle** | Type-safe, lightweight, first-class Postgres/Neon support, schema-as-code |
| AI | **@anthropic-ai/sdk** | Direct SDK for streaming conversations and structured tool_use |
| SRS | **ts-fsrs** | FSRS algorithm: better scheduling than SM-2, ~25% fewer reviews for same retention |
| Styling | **Tailwind CSS** | Utility-first, rapid iteration |
| Routing | **React Router v7** | Client-side routing for the SPA |

### Design Decision: Why Hono over Express

Hono is built for modern runtimes (Bun, Deno, Cloudflare Workers). It has native streaming response support via Web Standards (`ReadableStream`), which is essential for streaming Claude's responses. It's also TypeScript-first with type-safe route parameters. Express would work but requires more boilerplate for streaming.

### Design Decision: Why FSRS over SM-2

SM-2 (used by Anki since the 1980s) has a known failure mode called "ease hell" — the ease factor drifts downward over time, causing cards to be reviewed too frequently. FSRS (Free Spaced Repetition Scheduler) is its modern successor:

- Models memory with **stability** (how slowly you forget) and **difficulty** (how hard the material is)
- Lets you set a **target retention rate** (e.g. 90%) and schedules accordingly
- Benchmarks show ~25% fewer reviews for the same retention
- Adopted by Anki as an official alternative in 2023
- `ts-fsrs` is a mature TypeScript implementation

### Design Decision: Why Claude Grades Reviews (Not Self-Grading)

Traditional SRS (Anki) has users self-rate their recall. This introduces systematic bias — people tend to be too generous with themselves. Since our review questions are free-response, Claude can evaluate the answer against the stored `ideal_answer` and provide:
- An objective FSRS rating (Again/Hard/Good/Easy)
- Specific feedback on what was correct and what was missed
- This creates a tighter feedback loop for learning

---

## Architecture

```
learning_app/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── docker-compose.yml          # Local Postgres for dev
├── .env                        # DATABASE_URL, ANTHROPIC_API_KEY
├── .gitignore
│
├── server/                     # Hono backend (runs on Bun)
│   ├── index.ts                # Server entry, mounts all routes
│   ├── routes/
│   │   ├── topics.ts           # CRUD for learning topics
│   │   ├── lessons.ts          # Create lesson, get lesson details
│   │   ├── chat.ts             # Streaming Socratic conversation
│   │   ├── review.ts           # Get due cards, grade answers
│   │   └── concepts.ts         # Browse/filter concepts
│   ├── lib/
│   │   ├── claude.ts           # Anthropic client initialization
│   │   ├── prompts.ts          # System prompts for teaching + grading
│   │   ├── srs.ts              # FSRS scheduler init + helpers
│   │   └── types.ts            # Shared TypeScript types
│   └── db/
│       ├── index.ts            # Drizzle client (abstracts local vs Neon)
│       ├── schema.ts           # All table definitions
│       └── queries.ts          # Reusable query functions
│
├── client/                     # Vite + React frontend
│   ├── index.html
│   ├── vite.config.ts          # Includes proxy to backend
│   └── src/
│       ├── main.tsx
│       ├── App.tsx             # React Router setup
│       ├── api.ts              # Typed fetch helpers for all API routes
│       ├── pages/
│       │   ├── Dashboard.tsx   # Home: due reviews, active topics
│       │   ├── NewTopic.tsx    # Create a new learning topic
│       │   ├── TopicDetail.tsx # Topic overview with lessons + concepts
│       │   ├── Lesson.tsx      # Socratic chat session
│       │   ├── Review.tsx      # Daily spaced repetition review
│       │   └── Concepts.tsx    # Browse all extracted concepts
│       └── components/
│           ├── chat/
│           │   ├── ChatMessages.tsx
│           │   ├── ChatInput.tsx
│           │   └── LessonPlanSidebar.tsx
│           ├── review/
│           │   ├── ReviewCard.tsx
│           │   ├── ReviewFeedback.tsx
│           │   └── ReviewSummary.tsx
│           └── shared/
│               ├── Header.tsx
│               ├── TopicCard.tsx
│               └── DueCountBadge.tsx
│
└── drizzle/                    # Auto-generated migrations
    └── 0000_initial.sql
```

---

## Data Model

### `topics`
A high-level subject the user wants to learn.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| title | text | NOT NULL | e.g. "Rust Ownership" |
| description | text | | Optional detail or scope |
| status | text | NOT NULL DEFAULT 'active' | 'active' \| 'completed' |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| updated_at | timestamp | NOT NULL DEFAULT now() | |

### `lessons`
A single Socratic teaching session within a topic.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| topic_id | integer | NOT NULL, FK → topics(id) | |
| title | text | NOT NULL | Generated by Claude |
| plan | jsonb | NOT NULL | Array of `{ sectionTitle: string, objectives: string[] }` |
| current_section | integer | NOT NULL DEFAULT 0 | Index into the plan array |
| status | text | NOT NULL DEFAULT 'in_progress' | 'in_progress' \| 'completed' |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| completed_at | timestamp | | Set when status → 'completed' |

### `messages`
Conversation history for each lesson. Enables resuming sessions and provides context.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| lesson_id | integer | NOT NULL, FK → lessons(id) | |
| role | text | NOT NULL | 'user' \| 'assistant' |
| content | text | NOT NULL | Message text |
| section_index | integer | NOT NULL | Which lesson section this message belongs to |
| created_at | timestamp | NOT NULL DEFAULT now() | |

Index: `(lesson_id, created_at)` for ordered retrieval.

### `concepts`
A discrete piece of knowledge extracted from a teaching session. This is the atomic unit of spaced repetition.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| lesson_id | integer | NOT NULL, FK → lessons(id) | Which lesson it came from |
| topic_id | integer | NOT NULL, FK → topics(id) | Denormalized for query convenience |
| name | text | NOT NULL | Short label, e.g. "Move Semantics" |
| description | text | NOT NULL | One-paragraph explanation |
| question | text | NOT NULL | Free-response question for review |
| ideal_answer | text | NOT NULL | What a correct answer should cover |
| section_index | integer | NOT NULL | Which lesson section |
| created_at | timestamp | NOT NULL DEFAULT now() | |

### `review_cards`
FSRS scheduling state. One card per concept.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| concept_id | integer | NOT NULL, UNIQUE, FK → concepts(id) | 1:1 with concept |
| due | timestamp | NOT NULL | When the card is next due for review |
| stability | real | NOT NULL DEFAULT 0 | FSRS: how slowly you forget |
| difficulty | real | NOT NULL DEFAULT 0 | FSRS: how hard the material is |
| elapsed_days | integer | NOT NULL DEFAULT 0 | Days since last review |
| scheduled_days | integer | NOT NULL DEFAULT 0 | Interval to next review |
| reps | integer | NOT NULL DEFAULT 0 | Total successful reviews |
| lapses | integer | NOT NULL DEFAULT 0 | Times forgotten (rated "Again") |
| state | integer | NOT NULL DEFAULT 0 | 0=New, 1=Learning, 2=Review, 3=Relearning |
| last_review | timestamp | | When last reviewed |

Index: `(due)` for efficient "what's due today" queries.

### `review_logs`
History of every review event. Enables analytics and future FSRS parameter optimization.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PRIMARY KEY | |
| card_id | integer | NOT NULL, FK → review_cards(id) | |
| rating | integer | NOT NULL | 1=Again, 2=Hard, 3=Good, 4=Easy |
| state | integer | NOT NULL | Card state at review time |
| elapsed_days | integer | NOT NULL | |
| scheduled_days | integer | NOT NULL | |
| reviewed_at | timestamp | NOT NULL DEFAULT now() | |

---

## Core Flows

### Flow 1: Socratic Teaching Session

```
User creates topic → POST /api/topics
         │
         ▼
User starts lesson → POST /api/lessons
  Claude generates lesson plan (3-6 sections)
  Stored as JSONB in lessons.plan
         │
         ▼
Chat loop → POST /api/chat (streaming SSE)
  ┌─────────────────────────────────────────┐
  │ Claude's system prompt instructs it to:  │
  │  • Assess what user already knows        │
  │  • Never give answers directly           │
  │  • Guide through Socratic questions      │
  │  • Not advance until understanding shown │
  └─────────────────────────────────────────┘
         │
         ▼
When user demonstrates understanding:
  Claude calls section_complete tool
  ┌──────────────────────────────────────────┐
  │ Tool input (structured):                  │
  │  concepts: [{                             │
  │    name: "Move Semantics",                │
  │    description: "When a value...",         │
  │    question: "What happens to...",         │
  │    ideal_answer: "The original variable..." │
  │  }],                                      │
  │  section_summary: "User demonstrated..."   │
  └──────────────────────────────────────────┘
         │
         ▼
Server processes tool call:
  1. INSERT concepts into concepts table
  2. INSERT review cards (due = now) into review_cards
  3. UPDATE lessons.current_section += 1
  4. Return tool result → Claude continues to next section
         │
         ▼
After final section → lesson marked 'completed'
```

**Design Decision: Concept Extraction via tool_use**

Rather than post-processing conversations to extract concepts, we define a `section_complete` tool that Claude calls naturally when it determines the user understands. This is better because:
- Claude has full context of what was taught and where the user struggled
- The extracted concepts, questions, and ideal answers are contextually rich
- It happens inline — no separate API call or batch job
- Claude can tailor the review question to the user's specific misconceptions

### Flow 2: Daily Review

```
User opens /review → GET /api/review/due
  Query: review_cards WHERE due <= now()
  Join with concepts for question data
         │
         ▼
For each due card:
  1. Show concept.question
  2. User writes free-response answer
  3. POST /api/review/grade { cardId, answer }
         │
         ▼
Server grades via Claude:
  • Sends: user's answer + concept.ideal_answer + concept.description
  • Claude returns structured output:
    { rating, feedback, correct_points, missed_points }
         │
         ▼
FSRS scheduling:
  • Map Claude's rating → FSRS Rating enum
  • scheduler.repeat(card, now)[rating]
  • UPDATE review_cards with new state
  • INSERT review_logs entry
         │
         ▼
Show feedback to user:
  • What was correct / what was missed
  • "Next review in X days"
  • Click "Next" → next due card
         │
         ▼
When no more due cards → ReviewSummary
  • Cards reviewed, accuracy breakdown
```

**Rating Mapping**:

| Claude Assessment | FSRS Rating | Meaning |
|---|---|---|
| Completely wrong or blank | Again (1) | Failed recall, reset to learning |
| Partially correct, major gaps | Hard (2) | Recalled with significant difficulty |
| Mostly correct, minor gaps | Good (3) | Recalled with acceptable effort |
| Perfectly correct, effortless | Easy (4) | Perfect recall, extend interval |

---

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| **Dashboard** | `/` | Due review count (prominent CTA), active topics list, recent activity |
| **New Topic** | `/topics/new` | Title + optional description form |
| **Topic Detail** | `/topics/:id` | Lessons list with progress, concepts extracted, stats |
| **Lesson** | `/lessons/:id` | Chat interface with lesson plan sidebar and concepts sidebar |
| **Review** | `/review` | Focused card-by-card review: question → answer → feedback → next |
| **Concepts** | `/concepts` | Searchable/filterable table of all concepts with SRS state |

---

## API Routes

| Method | Path | Purpose | Streaming |
|--------|------|---------|-----------|
| GET | `/api/topics` | List all topics | No |
| POST | `/api/topics` | Create topic | No |
| GET | `/api/topics/:id` | Get topic with lessons + concept count | No |
| POST | `/api/lessons` | Create lesson + generate plan via Claude | No |
| GET | `/api/lessons/:id` | Get lesson with messages + concepts | No |
| POST | `/api/chat` | Send message, stream Claude response | **Yes (SSE)** |
| GET | `/api/review/due` | Get cards due for review | No |
| POST | `/api/review/grade` | Grade answer via Claude, update FSRS | No |
| GET | `/api/concepts` | List/filter all concepts | No |

---

## Key Implementation Details

### System Prompts (`server/lib/prompts.ts`)

Two distinct prompts:

1. **Teaching prompt**: Instructs Claude to be a Socratic tutor. Never give answers directly. Assess before teaching. Gate progress on understanding. Call `section_complete` tool when confident the user understands, with well-crafted review questions.

2. **Grading prompt**: Instructs Claude to evaluate free-response answers against the ideal answer. Return a structured rating (again/hard/good/easy) with specific feedback on correct and missed points. Uses `temperature: 0` for consistency.

### Streaming Architecture

The `/api/chat` route uses the Anthropic SDK's streaming API and returns an SSE stream to the frontend:

```
Client → POST /api/chat { lessonId, message }
Server → Anthropic SDK stream → SSE → Client

When Claude emits a tool_use block (section_complete):
  1. Server pauses SSE
  2. Processes tool call (save concepts, create cards, advance section)
  3. Sends tool result back to Claude
  4. Resumes SSE with Claude's continuation
```

### FSRS Integration (`server/lib/srs.ts`)

```typescript
// Scheduler config
const params = generatorParameters({
  maximum_interval: 365,      // Cap at 1 year
  desired_retention: 0.9,     // Target 90% retention
  enable_fuzz: true,          // Slight randomness prevents review clustering
});
const scheduler = fsrs(params);

// On concept creation: createEmptyCard(new Date()) → due immediately
// On review: scheduler.repeat(card, now)[rating] → new card state
```

### Database Abstraction (`server/db/index.ts`)

Single module that exports a Drizzle client. Internally uses `postgres` driver for local dev or `@neondatabase/serverless` for Neon, based on `DATABASE_URL` format. The rest of the code never knows which driver is active.

---

## Database Setup

**Development**: `docker-compose.yml` with Postgres 16 on port 5432. `.env` contains:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_app
```

**Production**: Neon Postgres. Same schema, same migrations. Swap `DATABASE_URL` to Neon connection string.

**Auth**: None. Single user. If multi-user is needed later, add `user_id` FK to `topics` and auth middleware.

---

## Implementation Phases

### Phase 1: Foundation
- Project init with Bun
- Install all dependencies
- Docker Compose for local Postgres
- Drizzle schema + migration
- Hono server skeleton with health check
- Vite + React skeleton with proxy to backend
- Neon project setup via MCP

### Phase 2: Socratic Teaching
- System prompt engineering
- `section_complete` tool definition
- `/api/chat` streaming route with tool_use handling
- `/api/lessons` + `/api/topics` routes
- Chat UI components
- Lesson page with plan sidebar

### Phase 3: Spaced Repetition
- FSRS scheduler integration
- Review grading prompt
- `/api/review/due` + `/api/review/grade` routes
- Review UI components
- Full review loop

### Phase 4: Dashboard & Polish
- Dashboard with due count + active topics
- Topic detail page
- Concept browser
- Navigation
- Loading/empty/error states

---

## Verification

1. After migration: verify all 6 tables exist in Postgres
2. `bun run server/index.ts` → `GET /api/topics` returns `[]`
3. `bun run --cwd client dev` → Vite loads, API calls proxy correctly
4. Create topic → start lesson → verify Claude generates structured plan
5. Complete a teaching section → verify concepts and review cards created in DB
6. Navigate to `/review` → answer a question → verify Claude grades it and FSRS updates the card
7. Verify `review_cards.due` advances to a future date after a "good" rating
