# Socratic Learning App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built_with-Bun-f9f1e1.svg)](https://bun.sh)

A personal learning tool powered by Claude AI. It teaches you any topic through back-and-forth conversation (Socratic method), then helps you remember what you learned through daily review sessions with smart scheduling.

## What Does This App Do?

### Learn Mode
Pick any topic you want to learn — say, "Rust Ownership" or "How the Immune System Works." Claude creates a lesson plan and teaches you through conversation. Instead of lecturing, it asks you questions, builds on what you already know, and guides you to understanding. When you demonstrate that you've grasped a concept, it automatically saves that concept for future review.

### Review Mode
Concepts you've learned enter a review queue. Each day, the app shows you the ones you're most likely to forget. You type an answer in your own words, Claude grades it and tells you what you got right and what you missed, and the app schedules your next review. Easy concepts get pushed further out; hard ones come back sooner. The goal is 90% retention with the fewest reviews possible.

<!-- Screenshots: uncomment when available -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
<!-- ![Lesson](docs/screenshots/lesson.png) -->

## Quick Start

No account or login needed for local use. You need:
- [Bun](https://bun.sh) — runtime and package manager
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for the local database
- An [Anthropic API key](https://console.anthropic.com)

**1. Clone and install:**
```bash
git clone https://github.com/nberk/socratic.git
cd socratic
bun install
```

**2. Create a `.env` file with the two required variables:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_app
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
That's it. These are the only two variables you need. See [`.env.example`](.env.example) for optional settings (auth, error tracking, deployment).

**3. Start the database:**
```bash
docker compose up -d
```
This starts a Postgres 16 container with a persistent volume (`pgdata`). Data survives container restarts.

**4. Create the schema:**
```bash
bun run db:push
```

**5. Start the app:**
```bash
bun run dev
```
Open http://localhost:5173 — no login required.

> **Stopping/restarting**: `docker compose stop` to pause, `docker compose down` to stop and remove the container (data in `pgdata` volume is preserved). Use `docker compose down -v` to also delete all data.

---

## Setting Up From Scratch

This guide assumes you're starting from zero. Follow each step in order.

### Step 1: Install Bun

Bun is the tool that runs the app. Open your terminal (on Mac: search for "Terminal" in Spotlight) and paste:

```bash
curl -fsSL https://bun.sh/install | bash
```

Close and reopen your terminal, then verify it worked:

```bash
bun --version
```

You should see a version number like `1.x.x`.

### Step 2: Install Docker Desktop

The app stores all your learning data (topics, lessons, review cards) in a database called PostgreSQL. Docker is a tool that runs PostgreSQL on your computer without you having to install and configure it manually.

1. Go to **https://www.docker.com/products/docker-desktop/**
2. Click the download button for your operating system (Mac, Windows, or Linux)
3. Open the downloaded file and follow the installer prompts
   - On Mac: drag Docker into your Applications folder
   - On Windows: follow the setup wizard (you may need to restart your computer)
4. Open Docker Desktop from your Applications / Start Menu
5. Wait for it to finish starting — you'll see a green "Running" indicator in the bottom-left corner

> Docker Desktop needs to be running whenever you use the app. Think of it like turning on the database before you use the app. You don't need to interact with Docker directly — just make sure it's open in the background.

### Step 3: Get an Anthropic API Key

The app uses Claude AI to teach and grade your answers. To connect to Claude, you need an API key — a secret password that identifies your account.

1. Go to **https://console.anthropic.com/** and create an account (or sign in if you already have one)
2. You'll need to add a payment method for API usage:
   - Go to **Settings > Billing** (or visit https://console.anthropic.com/settings/billing)
   - Add a credit card and load a small amount of credit ($5 is more than enough to start — each conversation costs a few cents)
3. Now go to **Settings > API Keys** (or visit https://console.anthropic.com/settings/keys)
4. Click **Create Key**
5. Give it a name (e.g., "learning app") and click **Create**
6. **Copy the key immediately** — it starts with `sk-ant-` and will only be shown once. If you lose it, you'll need to create a new one

> Keep your API key private. Anyone with your key can use your account and incur charges. Never share it or commit it to a public repository.

### Step 4: Download and Configure the App

If you haven't already, clone or download this project, then open a terminal in the project folder.

Install all the app's dependencies:

```bash
bun install
```

Now create your configuration file. Make a new file called `.env` in the project root with these two lines:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_app
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Replace `sk-ant-your-key-here` with the actual API key you copied in Step 3. These are the only two variables needed to run locally. All other settings in [`.env.example`](.env.example) are optional.

### Step 5: Start the Database

Make sure Docker Desktop is running, then:

```bash
docker compose up -d
```

This starts a PostgreSQL database in the background. Now create the tables:

```bash
bun run db:push
```

You should see output confirming the tables were created.

### Step 6: Start the App

```bash
bun run dev
```

This starts two things at once: the backend server and the frontend interface. Once you see output from both, open your browser and go to:

**http://localhost:5173**

You should see the dashboard. You're ready to go!

## Using the App

### Your First Lesson

1. Click **New Topic** on the dashboard
2. Enter what you want to learn (e.g., "Photosynthesis" or "JavaScript Closures")
3. Click **Start Learning**
4. Claude will greet you and begin asking questions — just chat naturally
5. As you work through each section, concepts are saved automatically
6. The lesson plan sidebar on the right tracks your progress

### Your First Review

1. After finishing at least one lesson section, go back to the **Dashboard**
2. You'll see a count of concepts ready for review — click **Review**
3. Read the question, type your best answer, and submit
4. Claude gives you feedback on what you got right and what you missed
5. Continue until all due cards are reviewed

Come back each day to review whatever's due. Consistency is what makes the spacing work.

## Stopping and Restarting

**To stop the app:** Press `Ctrl+C` in the terminal where you ran `bun run dev`.

**To restart later:**

```bash
docker compose up -d    # Start the database (if not already running)
bun run dev             # Start the app
```

Your data is saved in the database — nothing is lost when you stop.

## Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to the Docker daemon" | Open Docker Desktop and wait for it to fully start |
| "relation does not exist" errors | Run `bun run db:push` to create the database tables |
| Chat messages aren't appearing | Check that your `ANTHROPIC_API_KEY` is correct in the `.env` file |
| Page won't load at localhost:5173 | Make sure `bun run dev` is still running in your terminal |
| "command not found: bun" | Close and reopen your terminal after installing Bun |

## All Available Commands

| Command | What It Does |
|---------|-------------|
| `bun run dev` | Starts the full app (backend + frontend) |
| `bun run dev:server` | Starts only the backend server |
| `bun run dev:client` | Starts only the frontend |
| `bun run build` | Builds the frontend for production deployment |
| `bun run db:push` | Creates or updates database tables |
| `bun run db:studio` | Opens a visual database browser |

## Deployment

Want to deploy your own instance? The app runs on [Fly.io](https://fly.io) with a [Neon](https://neon.tech) PostgreSQL database. See [`docs/deployment.md`](docs/deployment.md) for full setup instructions, including WorkOS authentication for production use.

## Technical Overview

For developers who want to understand or modify the codebase:

- **Frontend:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 (client-side SPA)
- **Backend:** Hono running on Bun, with SSE streaming for real-time chat
- **Database:** PostgreSQL via Drizzle ORM (auto-detects local Docker vs cloud Neon)
- **AI:** Anthropic SDK with streaming responses and tool_use for concept extraction
- **Spaced Repetition:** ts-fsrs implementing the FSRS algorithm (365-day max interval, 90% target retention)
- **Auth:** No login in local mode. WorkOS AuthKit for production (set `WORKOS_*` env vars — see [docs/deployment.md](docs/deployment.md)).

See [`SPEC.md`](SPEC.md) for the full technical specification and [`CLAUDE.md`](CLAUDE.md) for development conventions.
