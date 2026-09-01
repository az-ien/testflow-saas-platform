# Development workflow

## Git (mandatory for AI agents)

Work on a **new branch**. Commit and push **all** changes on that branch. Open a **new pull request** into `main`.

Do **not** implement, commit, or push on `main`.

See `SKILLS.md` §8 and the README “AI agent git policy” section.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (recommended)
- PostgreSQL 15 and Redis 7 if running services on the host

## Configure

```bash
cp .env.example .env
```

For local AI QE without paid LLM keys, leave:

```bash
AI_PROVIDER=heuristic
```

To use an LLM:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=...
# or
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
```

## Docker Compose

```bash
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:5000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| AI worker | background |
| Test worker | background |

Debug tools:

```bash
docker compose --profile debug up -d
```

## Host processes

```bash
# API
cd backend && npm install && npm run dev

# AI worker
cd backend && npm run dev:ai-worker

# Test worker
cd workers/test-executor && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

In development the API runs `sequelize.sync({ alter: true })`. Production must use:

```bash
cd backend && NODE_ENV=production npm run migrate
```

## Coding rules

Follow `SKILLS.md`:

- Sequelize only
- Redux Toolkit only
- Tailwind only
- BullMQ only
- Winston only
- `AppError` hierarchy in route handlers
- No `console.log`

After a meaningful change, update:

- `README.md` status sections
- `skills/completed-work.md`
- `skills/partially-completed-work.md`
- `skills/remaining-work.md`
- `SKILLS.md` tracker and changelog
