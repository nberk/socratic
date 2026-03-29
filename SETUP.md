# Getting the Socratic Learning App Running

Everything is built. These are the remaining steps to go from code to a working app.

---

## Step 1: Set Your API Key

Edit `.env` in the project root and replace the placeholder with your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

You can find/create keys at https://console.anthropic.com/settings/keys

---

## Step 2: Set Up the Database

You need a Postgres database. Pick **one** of these options:

### Option A: Local Postgres via Docker

Requires Docker Desktop to be running.

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5432`. The `.env` is already configured for this:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_app
```

### Option B: Neon (cloud Postgres)

1. Go to https://console.neon.tech and create a new project (or use an existing one)
2. Copy the connection string from the Neon dashboard
3. Update `.env`:
```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## Step 3: Run the Database Migration

This creates all 6 tables (topics, lessons, messages, concepts, review_cards, review_logs):

```bash
bun run db:push
```

To verify it worked:
```bash
bun run db:studio
```
This opens Drizzle Studio in your browser where you can inspect the tables.

---

## Step 4: Start the Dev Servers

Run both the backend (Hono on port 3001) and frontend (Vite on port 5173):

```bash
bun run dev
```

Or start them separately in two terminals:
```bash
# Terminal 1 — backend (auto-restarts on changes)
bun run dev:server

# Terminal 2 — frontend (hot module replacement)
bun run dev:client
```

Open http://localhost:5173 in your browser.

---

## Step 5: Try It Out

### First teaching session
1. Click **New Topic** on the dashboard
2. Enter a topic (e.g., "Rust Ownership") and optionally a description
3. Click **Start Learning** — Claude will generate a lesson plan and begin the Socratic dialogue
4. Chat back and forth — Claude will assess your knowledge, ask probing questions, and not let you advance until you demonstrate understanding
5. When you complete a section, concepts are automatically extracted and added to your review queue

### First review session
1. After completing at least one lesson section, go to the **Dashboard**
2. You'll see a due review count — click it or navigate to **Review**
3. Read the question, type a free-response answer, and submit
4. Claude grades your answer and shows feedback (what you got right, what you missed)
5. The FSRS algorithm schedules the next review (could be minutes, days, or weeks depending on your rating)

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `bun run dev` | Start both servers |
| `bun run dev:server` | Start backend only (port 3001) |
| `bun run dev:client` | Start frontend only (port 5173) |
| `bun run build` | Build frontend for production |
| `bun run db:generate` | Generate a new migration from schema changes |
| `bun run db:push` | Push schema directly to database (dev shortcut) |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:studio` | Open Drizzle Studio (database browser) |

---

## Troubleshooting

**"Cannot connect to the Docker daemon"**
→ Open Docker Desktop first, then run `docker compose up -d`

**"relation does not exist" errors**
→ Migrations haven't run. Run `bun run db:push`

**Chat responses aren't streaming**
→ Check that `ANTHROPIC_API_KEY` is set correctly in `.env`. The server logs (terminal running `dev:server`) will show errors.

**Vite proxy errors / API calls failing**
→ Make sure the backend is running on port 3001. The Vite config proxies `/api/*` requests to `localhost:3001`.

**Type errors when running `bunx tsc --noEmit`**
→ The codebase type-checks clean as of the initial build. If you've made changes, run `bunx tsc --noEmit` to see what needs fixing.
