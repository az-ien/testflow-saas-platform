# 🧠 SKILLS.md — TestFlow SaaS Platform

> **⚠️ AI AGENT DIRECTIVE — READ THIS FILE FIRST**
>
> Every AI agent (Cursor, Copilot, Gemini, Claude, etc.) **MUST** read this file before making any code change. After completing work, the agent **MUST** update the relevant sections (especially §6 Implementation Tracker and §7 Change Log) to keep this document in sync with reality.
>
> **Git is mandatory:** create your own branch, commit and push **all** work on that branch, and open a **new pull request**. **Never work on `main`.** Never commit, push, or merge directly to `main`.
>
> **Last Updated:** 2026-09-01
> **Updated By:** Cursor Grok 4.6

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Architecture & Tech Stack Standards](#2-architecture--tech-stack-standards)
3. [Coding Standards & Conventions](#3-coding-standards--conventions)
4. [File & Folder Conventions](#4-file--folder-conventions)
5. [Security & Auth Standards](#5-security--auth-standards)
6. [Implementation Tracker](#6-implementation-tracker)
7. [Change Log](#7-change-log)
8. [Agent Rules of Engagement](#8-agent-rules-of-engagement)

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Name** | TestFlow — AI Quality Engineering SaaS |
| **Purpose** | Explore applications, create evidence-based scenarios, validate them, generate Playwright tests, execute them, and heal failures — using existing TestFlow SaaS infrastructure. |
| **License** | MIT |
| **Repo Root** | `testflow-saas-platform/` |
| **Primary Language** | TypeScript (Node.js ≥ 20, TS 5.3) |
| **Frontend Language** | TypeScript (React 18, Vite) |
| **Knowledge base** | `skills/` (project status) + this file (coding standards) |

---

## 2. Architecture & Tech Stack Standards

### 2.1 System Architecture

```
Frontend → Backend API → Redis/BullMQ (test-runs + ai-workflow)
                ↓
         PostgreSQL (SaaS + AI QE models)
                ↓
     AI worker (plan/explore/validate/generate/heal)
     Test worker (clone/install/run/parse)
```

AI services live in `backend/src/ai/{planner,validator,generator,executor,healer}` with Playwright as the first-class agentic adapter. Do not add a chatbot as the product interface.

Detailed status: `skills/architecture.md`.

### 2.2 Mandatory Tech Stack

| Layer | Technology | Version Constraint |
|-------|------------|--------------------|
| **Frontend** | React, Vite, Tailwind CSS, Redux Toolkit, Recharts, lucide-react | React 18, Vite 5, Tailwind 3.4 |
| **Backend API** | Node.js, Express, TypeScript | Node ≥ 20, Express 4, TS 5.3 |
| **Auth** | JWT + API Key dual auth, bcryptjs | jsonwebtoken 9, bcryptjs 2 |
| **Database** | PostgreSQL 15, Sequelize ORM | Sequelize 6 |
| **Cache & Queue** | Redis 7, BullMQ | ioredis 5, BullMQ 5 |
| **Worker** | Docker-based workers: test executor + AI worker with Playwright Chromium | — |
| **Billing** | Stripe (Checkout + Billing Portal) | stripe 14 |
| **Monitoring** | Sentry, Winston with daily rotation | @sentry/node 7, winston 3 |
| **Infrastructure** | Terraform (AWS VPC, RDS, S3) | — |
| **Containers** | Docker, Docker Compose 3.9 | — |

### 2.3 Do NOT Introduce

- No alternative ORMs (Prisma, TypeORM, Drizzle) — use **Sequelize only**
- No alternative state managers — use **Redux Toolkit only**
- No alternative CSS frameworks — use **Tailwind CSS only** on frontend
- No alternative queue systems — use **BullMQ only**
- No alternative loggers — use **Winston only**
- No MongoDB or any non-PostgreSQL database

---

## 3. Coding Standards & Conventions

### 3.1 TypeScript / Backend

- **Strict TypeScript** — always use types, avoid `any` except in JSON-parsing edge cases
- **Async/Await** — never use raw `.then()` chains
- **Error Handling** — use the `AppError` hierarchy from `backend/src/middleware/errorHandler.ts`:
  - `AppError` (base, 500)
  - `NotFoundError` (404)
  - `ValidationError` (422)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `PlanLimitError` (429)
- **Logging** — always use the Winston `logger` from `config/logger.ts`, never `console.log`
- **Environment variables** — access via `process.env`, define defaults in `.env.example`
- **Import order** — external packages → internal config → internal modules → types
- **Section comments** — use the `// ─── Section Name ───...` style used throughout the codebase

### 3.2 Frontend (React)

- **Functional components only** — no class components
- **Redux Toolkit** for state — slices go in `frontend/src/features/<domain>/`
- **React Router v6** for routing — nested routes under `DashboardLayout`
- **Tailwind CSS** for styling — no inline `style={}` unless dynamic values are required
- **Lucide React** for icons — do not add Font Awesome, Heroicons, or others
- **Recharts** for charts — do not add Chart.js, D3, etc.
- **Axios** via `frontend/src/services/api.ts` — never use raw `fetch()`
- **Pages** live in `frontend/src/pages/` and follow `<Name>Page.tsx` naming
- **Route guards** — `PrivateRoute` and `PublicRoute` wrappers in `App.tsx`

### 3.3 Worker

- **BullMQ Worker** pattern — jobs processed via the `Worker` class in `worker.ts`
- **TestExecutor** class handles the full lifecycle: clone → install → run → parse → cleanup
- **Framework support** — Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium
- **Result parsing** — each framework has a dedicated parser method; results conform to the `TestResult` interface
- **Webhook notifications** — via `WebhookNotifier` class on lifecycle events (`run.started`, `run.status`, `run.completed`, `run.error`)
- **Cleanup** — always call `executor.cleanup()` in `finally` block

### 3.4 Database / Models

- **Sequelize models** live in `backend/src/models/` and `workers/test-executor/src/models/`
- **Associations** defined in `backend/src/models/index.ts`:
  - User → Projects, Subscription, TestRuns, Requirements, TestPlans, Scenarios
  - Requirement → TestPlan → Scenario → Evidence / Validation / GeneratedTest
  - TestRun → HealingAttempt
- **UUIDs** for all primary keys
- **Development** uses `sequelize.sync()` — production must use migration files from `backend/migrations/`
- Always scope QE queries by `userId` (and `projectId` when mutating workflow jobs)

### 3.5 External Test Execution Model

TestFlow is an **orchestration service** — it does not keep its own test suite. Each project points to an external repository. Each run:
1. Clones that repository into an isolated temporary worker directory
2. Installs dependencies from the repo manifest
3. Runs the configured framework
4. Parses machine-readable results
5. Removes the workspace

#### Supported Dependency Manifests

| Ecosystem | Supported Manifests |
|-----------|---------------------|
| Node.js | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `package.json` |
| Python | `requirements.txt` repositories; `pyproject.toml` detection exists but full install support is planned |
| Java | `pom.xml` via Maven |

#### Key API Fields

- **`testPattern`** — optional glob passed to the framework runner. If omitted, the framework's native test discovery is used.
- **`repoAccessToken`** — optional. For private repos, the worker injects this into the clone URL. For public repos, leave empty.
- **`repoProvider`** — `github`, `gitlab`, `bitbucket`, or `azure-devops`. Only GitHub webhook triggers are currently implemented; the others are accepted as metadata.

---

## 4. File & Folder Conventions

```
testflow-saas-platform/
├── SKILLS.md                   ← THIS FILE — AI agents read & update
├── skills/                     ← Living implementation knowledge
├── docs/                       ← QE engine and agent docs
├── README.md                   ← Public documentation / project status
├── .env.example                ← All env vars with descriptions
├── .gitignore
├── docker-compose.yml          ← Full local stack
├── package.json                ← Root workspace (minimal)
│
├── backend/                    ← Express API server
│   ├── src/
│   │   ├── app.ts              ← Entry point & middleware chain
│   │   ├── config/             ← database.ts, redis.ts, logger.ts
│   │   ├── middleware/         ← auth.ts, errorHandler.ts
│   │   ├── ai/                 ← planner, validator, generator, executor, healer, providers, adapters, browser
│   │   ├── mcp/playwright/     ← evidence collector + experimental MCP client
│   │   ├── orchestration/      ← AI workflow queue
│   │   ├── workers/aiWorker.ts ← AI BullMQ consumer
│   │   ├── models/             ← SaaS + AI QE models
│   │   ├── routes/             ← REST endpoints including QE
│   │   └── services/           ← Auth, RunQueue, GitHub, usage, access
│   ├── migrations/             ← Production database migrations
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   ← React dashboard
│   ├── src/
│   │   ├── App.tsx             ← Router + route guards
│   │   ├── main.tsx            ← React entry
│   │   ├── store.ts            ← Redux store
│   │   ├── hooks.ts            ← Typed Redux hooks
│   │   ├── index.css           ← Tailwind base styles
│   │   ├── features/           ← Redux slices: auth/, projects/, runs/
│   │   ├── layouts/            ← DashboardLayout
│   │   ├── pages/              ← Dashboard + AI QE workflow pages
│   │   └── services/           ← API client (axios)
│   ├── Dockerfile
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── workers/
│   ├── test-executor/          ← BullMQ test execution worker
│   └── ai-worker/Dockerfile    ← Playwright image running backend AI worker
│       ├── src/
│       │   ├── worker.ts       ← Job processor entry
│       │   ├── TestExecutor.ts ← Clone → Install → Run → Parse
│       │   ├── WebhookNotifier.ts
│       │   ├── config/         ← redis.ts, database.ts, logger.ts
│       │   └── models/         ← TestRun (worker-side model)
│       ├── Dockerfile
│       └── package.json
│
└── terraform/                  ← AWS infrastructure
    ├── main.tf                 ← VPC, RDS, S3, security groups
    └── variables.tf
```

### Naming Rules

| Item | Convention | Example |
|------|-----------|---------|
| Files (backend) | `PascalCase.ts` for classes/models, `camelCase.ts` for modules | `TestExecutor.ts`, `auth.ts` |
| Files (frontend pages) | `PascalCase` + `Page` suffix | `DashboardPage.tsx` |
| Redux slices | `<domain>Slice.ts` inside `features/<domain>/` | `authSlice.ts` |
| Routes | `lowercase.ts` | `projects.ts` |
| Environment vars | `SCREAMING_SNAKE_CASE` | `DB_HOST` |
| API endpoints | `/api/<resource>` (plural, lowercase) | `/api/projects`, `/api/runs` |
| Docker containers | `testflow_<service>` | `testflow_backend` |

---

## 5. Security & Auth Standards

### Authentication Flow

1. **JWT Authentication** — `Authorization: Bearer <token>` (15 min expiry)
2. **API Key Authentication** — `X-API-Key: tf_<key>` header
3. **Dual auth middleware** — `authenticate()` checks for API key first, falls back to JWT
4. **Refresh tokens** — 7-day expiry, used to obtain new access tokens
5. **Password hashing** — bcryptjs with default salt rounds

### Rate Limiting

| Scope | Window | Max Requests |
|-------|--------|-------------|
| Global (`/api/`) | 15 min | 200 |
| API Key (`/api/runs`) | 1 min | 60 |

### Security Middleware Stack (order matters)

1. Sentry request handler
2. `helmet()` — security headers
3. `cors()` — allowed origin: `FRONTEND_URL`
4. Rate limiters
5. `compression()`
6. Body parsers (10MB limit)
7. Morgan HTTP logging

### Webhook Signatures

- Outbound webhooks signed with `HMAC-SHA256`
- Verify via `X-TestFlow-Signature` header

### Webhook Events

| Event | When |
|-------|------|
| `run.started` | Worker picks up the job |
| `run.status` | Status changes (cloning → installing → running) |
| `run.completed` | Tests finished (passed/failed) |
| `run.error` | Unrecoverable error |

### Secrets Management

- All secrets in `.env` (gitignored)
- `.env.example` documents every variable with placeholder values
- **Never** hardcode secrets in source files

---

## 6. Implementation Tracker

### ✅ Completed

| Feature | Location | Notes |
|---------|----------|-------|
| Docker Compose local stack | `docker-compose.yml` | postgres, redis, backend, frontend, worker, debug tools |
| JWT + API Key auth | `backend/src/middleware/auth.ts` | Dual auth with `authenticate()` |
| User model + registration/login | `backend/src/models/User.ts`, `routes/auth.ts` | bcrypt hashing, API key generation |
| Project CRUD | `backend/src/routes/projects.ts` | Linked to user |
| Test Run API | `backend/src/routes/runs.ts` | Queue jobs via BullMQ |
| BullMQ worker | `workers/test-executor/` | Full lifecycle execution |
| Framework support | `TestExecutor.ts` | Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium |
| Result parsing | `TestExecutor.ts` | JSON + JUnit XML parsers |
| GitHub webhook triggers | `backend/src/routes/webhooks.ts` | Push + PR events |
| Outbound signed webhooks | `WebhookNotifier.ts` | HMAC-SHA256 signed |
| Stripe billing routes | `backend/src/routes/subscriptions.ts` | Checkout, portal, subscription |
| Stripe webhook hardening | `backend/src/app.ts`, `backend/src/routes/subscriptions.ts` | Raw-body signature verification, subscription metadata, update/delete events |
| Subscription model | `backend/src/models/Subscription.ts` | Tiers: free, starter, pro, business, enterprise |
| Production migration files | `backend/.sequelizerc`, `backend/config/config.js`, `backend/migrations/` | Sequelize CLI config plus initial schema migration for current models |
| Error handling hierarchy | `backend/src/middleware/errorHandler.ts` | AppError, NotFoundError, ValidationError, etc. |
| Winston logging | `backend/src/config/logger.ts` | Daily rotation |
| Sentry integration | `backend/src/app.ts` | Conditional on `SENTRY_DSN` |
| React dashboard | `frontend/src/pages/` | Dashboard, Projects, Runs, Settings, Pricing, Login, Register |
| Redux state management | `frontend/src/features/` | auth, projects, runs slices |
| Terraform foundation | `terraform/main.tf` | AWS VPC, RDS PostgreSQL, S3, security groups |
| AI QE models + migration | `backend/src/models/*`, `backend/migrations/20260901000000-create-ai-qe-schema.js` | Requirements through healing |
| Planner / validator / generator / executor / healer | `backend/src/ai/` | Evidence-first planner + strict validator; generator writes a Playwright workspace; executor runs those files; healer reproduces and patches locators |
| Playwright explorer | `backend/src/ai/browser/` + `mcp/playwright` re-export | Interactive Chromium via `BrowserAutomationInterface` (click/fill/login, action log). MCP backend is not production. |
| AI workflow queue | `backend/src/orchestration/` | EXPLORE, PLAN, VALIDATE, GENERATE, EXECUTE_GENERATED_TEST, ANALYZE, HEAL, RE_RUN |
| AI worker | `backend/src/workers/aiWorker.ts` | `ai-workflow` BullMQ consumer |
| QE APIs | `backend/src/routes/{requirements,testPlans,scenarios,approvals,generatedTests,healing,qe}.ts` | Authenticated + ownership-checked |
| AI QE frontend | `frontend/src/pages/*` | Workflow navigation |
| skills/ knowledge base | `skills/` | Status docs for the next agent |

### 🔧 In Progress / Partially Implemented

| Feature | Status | What Remains |
|---------|--------|-------------|
| S3 artifact uploads | Report dirs detected; local evidence screenshots stored | Wire `uploadReport()` to S3 and add authenticated download |
| GitLab/Bitbucket/Azure DevOps webhooks | Metadata accepted | Build inbound trigger routes |
| `pyproject.toml` support | Detection exists | Full package-manager install support |
| Playwright MCP stdio | Client exists; default backend is Playwright | Do not set `BROWSER_AUTOMATION_BACKEND=mcp` — it throws by design |
| GitHub generated-test PRs | Service + UI | OAuth app; token always required |
| Org tenancy | User+project isolation | Organization model |
| Stripe AI meters | API usage counters | Stripe billing dimensions |

### ❌ Not Yet Started

| Feature | Priority | Notes |
|---------|----------|-------|
| Terraform Redis/ElastiCache | MEDIUM | Redis not provisioned in cloud |
| Terraform ECS/EKS deployment | MEDIUM | No compute provisioning |
| Email verification flow | LOW | Feature flag exists (`FEATURE_EMAIL_VERIFICATION`) but not implemented |
| SendGrid email integration | LOW | `.env.example` has `SENDGRID_API_KEY`; no email sending code exists yet |
| Backend API integration tests | HIGH | AI unit tests exist; Postgres/API tests do not |
| Test suite for frontend | MEDIUM | No testing framework configured |
| CI/CD pipeline | HIGH | No GitHub Actions / workflow files |
| API documentation (OpenAPI/Swagger) | MEDIUM | No spec file |
| WebSocket real-time updates | LOW | Dashboard currently polls |
| Organization tenancy | MEDIUM | User isolation exists; org model does not |

---

## 7. Change Log

> **AI agents: Add an entry here every time you modify the codebase.**

| Date | Agent | Files Changed | Summary |
|------|-------|---------------|---------|
| 2026-09-01 | Cursor Grok 4.6 | healer, FailureReproducer, processors, healing UI, tests, docs/skills | Browser-reproduce generated-test failures, assertion-safe locator patches, isolation rerun, apply only after approval |
| 2026-09-01 | Cursor Grok 4.6 | generator, PlaywrightAdapter, GeneratedTestRunner, generated_tests statuses, execute route, UI, tests, docs/skills | Generate real Playwright workspaces from discovered selectors and execute those files (COMPILES / PASSED / FAILED) |
| 2026-09-01 | Cursor Grok 4.6 | planner, validator, evidence matching, scenario evidence_refs, tests, docs/skills | Evidence-first planner and strict validator (control locators required; start URL is not proof) |
| 2026-09-01 | Cursor Grok 4.6 | `SKILLS.md`, `README.md`, `skills/development-workflow.md` | Require AI agents to use a feature branch, push all work, and open a new PR — never work on `main` |
| 2026-09-01 | Cursor Grok 4.6 | docs, README, skills, McpBrowserAutomation comment | Removed third-party repo attribution; engine plan is TestFlow-owned (`docs/QE_ENGINE_PLAN.md`) |
| 2026-09-01 | Cursor Grok 4.6 | `docs/*`, `backend/src/ai/browser/*`, explorer/evidence/processors, tests, skills/README | Phase 1 analysis + Phase 2 interactive Playwright exploration (`BrowserAutomationInterface`, action log, credentialed login) |
| 2026-09-01 | Cursor Grok 4.6 | AI QE backend/frontend/workers/skills/README | Transformed TestFlow into an AI Quality Engineering SaaS while preserving existing SaaS infrastructure |
| 2026-05-15 | Initial | `SKILLS.md` | Created SKILLS.md with full project standards and implementation tracker |
| 2026-05-15 | Antigravity | `SKILLS.md`, `README.md` | Aligned both files: added orchestration model, dependency manifests, worker commands, webhook events, git conventions, and SendGrid to SKILLS; fixed bcryptjs, added SKILLS.md to project tree, and added AI agent note in README |
| 2026-08-31 | Codex | `backend/src/app.ts`, `backend/src/routes/subscriptions.ts`, `backend/.sequelizerc`, `backend/config/config.js`, `backend/migrations/20260831000000-create-initial-schema.js`, `.env.example`, `README.md`, `SKILLS.md` | Hardened Stripe webhooks and added Sequelize CLI production migration config with the initial schema migration |

---

## 8. Agent Rules of Engagement

### Before Making Any Change

1. **Create a new branch off `main`.** Do not check out `main` for implementation. Do not commit to `main`.
2. **Read this entire file** to understand the project standards
3. **Check §6 Implementation Tracker** to understand what exists and what doesn't
4. **Never duplicate** existing functionality — reuse existing services, models, and utilities
5. **Follow §3 Coding Standards** exactly — wrong patterns will break consistency

### While Making Changes

6. **Use existing patterns** — if you need a new route, follow the structure of `routes/projects.ts`; if a new model, follow `models/User.ts`
7. **Use the error hierarchy** — throw `AppError` subclasses, never send raw `res.status().json()` for errors in route handlers
8. **Use Winston logger** — never `console.log`
9. **Use environment variables** — add new ones to `.env.example` with documentation
10. **Maintain type safety** — always type function parameters and return values
11. **Keep Docker Compose updated** — if you add a new service, add it to `docker-compose.yml`

### After Making Changes

12. **Commit and push every change on your feature branch** — do not leave work only on the local machine, and do not push to `main`
13. **Open a new pull request** from your branch into `main`. Do not merge it yourself unless a human explicitly asks you to
14. **Update §6 Implementation Tracker** — move items from "Not Yet Started" → "In Progress" → "Completed" as appropriate
15. **Add a §7 Change Log entry** with: date, agent name, files changed, and a one-line summary
16. **Update §4 File & Folder Conventions** if you added new directories or changed the structure
17. **Update §2 Tech Stack** if you added a new dependency
18. **Verify README.md** — if your change affects the public API, architecture, or setup instructions, update the README too

### Git Commit Conventions

**Hard rule for every AI agent**

| Must | Must not |
|------|----------|
| Create a **new branch** from latest `main` before editing | Work, commit, or push on `main` |
| Commit **all** changes on that branch | Leave uncommitted work |
| Push the branch to `origin` | Force-push `main` |
| Open a **new pull request** targeting `main` | Push commits directly to `main` or reuse `main` as the working branch |

- Branch naming: `feature/<name>`, `fix/<name>`, `chore/<name>` (or the platform-required `cursor/<name>` prefix when running as a Cursor cloud agent)
- Commit messages: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...` (conventional commits)
- `main` is protected by policy even if the remote does not enforce it. Treat a direct commit to `main` as a process failure.

### Pricing Tiers (for reference when implementing billing logic)

| Plan | Price | Runs/month | Parallel Runners |
|------|-------|-----------|-----------------|
| Free | $0 | 50 | 1 |
| Starter | $29/mo | 500 | 2 |
| Pro | $99/mo | 5,000 | 5 |
| Business | $299/mo | 25,000 | 20 |
| Enterprise | Custom | Unlimited | 50+ |

### Supported Test Frameworks (for reference when modifying the worker)

| Framework | Language | Worker Command | Report Format |
|-----------|----------|----------------|---------------|
| Playwright | JS/TS | `npx playwright test <testPattern> --reporter=json` | JSON (`playwright-results.json`) |
| Playwright | Python | `python3 -m pytest <testPattern> --json-report` | JSON (`pytest-results.json`) |
| Cypress | JS/TS | `npx cypress run --spec <testPattern> --reporter junit` | JUnit XML (`cypress-*.xml`) |
| Jest | JS/TS | `npx jest <testPattern> --json --outputFile=test-results/jest-results.json` | JSON (`jest-results.json`) |
| Mocha | JS/TS | `npx mocha <testPattern> --reporter json` | JSON via stdout (`mocha-results.json`) |
| pytest | Python | `python3 -m pytest <testPattern> --json-report` | JSON (`pytest-results.json`) |
| TestNG | Java | `mvn -B test -Dsurefire.useFile=true` | Surefire XML (`target/surefire-reports/*.xml`) |
| Selenium | Multi | Maven, `npm test`, or pytest depending on manifest | JUnit XML or pytest JSON |

---

> **🔁 Reminder:** This is a living document. If you are an AI agent and you just finished a task, scroll up to §6 and §7 and **update them now**.
