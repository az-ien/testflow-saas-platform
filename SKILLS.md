# 🧠 SKILLS.md — TestFlow SaaS Platform

> **⚠️ AI AGENT DIRECTIVE — READ THIS FILE FIRST**
>
> Every AI agent (Cursor, Copilot, Gemini, Claude, etc.) **MUST** read this file before making any code change. After completing work, the agent **MUST** update the relevant sections (especially §6 Implementation Tracker and §7 Change Log) to keep this document in sync with reality.
>
> **Last Updated:** 2026-05-15
> **Updated By:** Initial creation

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
| **Name** | TestFlow — Test Execution SaaS Platform |
| **Purpose** | Run Playwright, Cypress, Selenium, pytest, TestNG, Jest, and Mocha tests from external repositories via API. View results in a live dashboard. |
| **License** | MIT |
| **Repo Root** | `testflow-saas-platform/` |
| **Primary Language** | TypeScript (Node.js ≥ 20, TS 5.3) |
| **Frontend Language** | TypeScript (React 18, Vite) |

---

## 2. Architecture & Tech Stack Standards

### 2.1 System Architecture

```
┌─────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend API  │────▶│   Redis + Queue │
│  React/Vite  │     │  Express/TS    │     │   BullMQ        │
│  Port 3000   │     │  Port 5000     │     │   Port 6379     │
└─────────────┘     └────────────────┘     └────────┬────────┘
                            │                        │
                     ┌──────▼──────┐          ┌──────▼──────┐
                     │  PostgreSQL │          │   Worker(s)  │
                     │  Port 5432  │          │  Clone/Run   │
                     └─────────────┘          └──────────────┘
```

### 2.2 Mandatory Tech Stack

| Layer | Technology | Version Constraint |
|-------|------------|--------------------|
| **Frontend** | React, Vite, Tailwind CSS, Redux Toolkit, Recharts, lucide-react | React 18, Vite 5, Tailwind 3.4 |
| **Backend API** | Node.js, Express, TypeScript | Node ≥ 20, Express 4, TS 5.3 |
| **Auth** | JWT + API Key dual auth, bcryptjs | jsonwebtoken 9, bcryptjs 2 |
| **Database** | PostgreSQL 15, Sequelize ORM | Sequelize 6 |
| **Cache & Queue** | Redis 7, BullMQ | ioredis 5, BullMQ 5 |
| **Worker** | Docker-based worker with Node.js, Playwright Chromium, Python/pytest, Java 17, Maven | — |
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
  - User → Projects (one-to-many)
  - User → Subscription (one-to-one)
  - User → TestRuns (one-to-many)
  - Project → TestRuns (one-to-many)
- **UUIDs** for all primary keys
- **Development** uses `sequelize.sync()` — production must use migration files (not yet created)

---

## 4. File & Folder Conventions

```
testflow-saas-platform/
├── SKILLS.md                   ← THIS FILE — AI agents read & update
├── README.md                   ← Public documentation
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
│   │   ├── models/             ← User, Project, TestRun, Subscription, index.ts
│   │   ├── routes/             ← auth, projects, runs, webhooks, subscriptions
│   │   └── services/           ← AuthService.ts, RunQueue.ts
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
│   │   ├── pages/              ← All pages (*Page.tsx)
│   │   └── services/           ← API client (axios)
│   ├── Dockerfile
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── workers/
│   └── test-executor/          ← BullMQ worker
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
| Subscription model | `backend/src/models/Subscription.ts` | Tiers: free, starter, pro, business, enterprise |
| Error handling hierarchy | `backend/src/middleware/errorHandler.ts` | AppError, NotFoundError, ValidationError, etc. |
| Winston logging | `backend/src/config/logger.ts` | Daily rotation |
| Sentry integration | `backend/src/app.ts` | Conditional on `SENTRY_DSN` |
| React dashboard | `frontend/src/pages/` | Dashboard, Projects, Runs, Settings, Pricing, Login, Register |
| Redux state management | `frontend/src/features/` | auth, projects, runs slices |
| Terraform foundation | `terraform/main.tf` | AWS VPC, RDS PostgreSQL, S3, security groups |

### 🔧 In Progress / Partially Implemented

| Feature | Status | What Remains |
|---------|--------|-------------|
| S3 artifact uploads | Report dirs detected | Wire `uploadReport()` to actually upload to S3 and return signed URLs |
| GitLab/Bitbucket/Azure DevOps webhooks | Metadata accepted | Build inbound trigger routes for these providers |
| `pyproject.toml` support | Detection exists | Full package-manager install support needed |
| Stripe webhook hardening | Basic implementation | Add raw-body handling for signature verification |

### ❌ Not Yet Started

| Feature | Priority | Notes |
|---------|----------|-------|
| Production migration files | HIGH | Currently using `sequelize.sync()`; need proper migration files |
| Terraform Redis/ElastiCache | MEDIUM | Redis not provisioned in cloud |
| Terraform ECS/EKS deployment | MEDIUM | No compute provisioning |
| Email verification flow | LOW | Feature flag exists but not implemented |
| Test suite for backend | HIGH | Jest configured but no tests written |
| Test suite for frontend | MEDIUM | No testing framework configured |
| CI/CD pipeline | HIGH | No GitHub Actions / workflow files |
| API documentation (OpenAPI/Swagger) | MEDIUM | No spec file |
| WebSocket real-time updates | LOW | Dashboard currently polls |
| Multi-tenancy isolation | LOW | Basic user scoping exists |

---

## 7. Change Log

> **AI agents: Add an entry here every time you modify the codebase.**

| Date | Agent | Files Changed | Summary |
|------|-------|---------------|---------|
| 2026-05-15 | Initial | `SKILLS.md` | Created SKILLS.md with full project standards and implementation tracker |

---

## 8. Agent Rules of Engagement

### Before Making Any Change

1. **Read this entire file** to understand the project standards
2. **Check §6 Implementation Tracker** to understand what exists and what doesn't
3. **Never duplicate** existing functionality — reuse existing services, models, and utilities
4. **Follow §3 Coding Standards** exactly — wrong patterns will break consistency

### While Making Changes

5. **Use existing patterns** — if you need a new route, follow the structure of `routes/projects.ts`; if a new model, follow `models/User.ts`
6. **Use the error hierarchy** — throw `AppError` subclasses, never send raw `res.status().json()` for errors in route handlers
7. **Use Winston logger** — never `console.log`
8. **Use environment variables** — add new ones to `.env.example` with documentation
9. **Maintain type safety** — always type function parameters and return values
10. **Keep Docker Compose updated** — if you add a new service, add it to `docker-compose.yml`

### After Making Changes

11. **Update §6 Implementation Tracker** — move items from "Not Yet Started" → "In Progress" → "Completed" as appropriate
12. **Add a §7 Change Log entry** with: date, agent name, files changed, and a one-line summary
13. **Update §4 File & Folder Conventions** if you added new directories or changed the structure
14. **Update §2 Tech Stack** if you added a new dependency
15. **Verify README.md** — if your change affects the public API, architecture, or setup instructions, update the README too

### Pricing Tiers (for reference when implementing billing logic)

| Plan | Price | Runs/month | Parallel Runners |
|------|-------|-----------|-----------------|
| Free | $0 | 50 | 1 |
| Starter | $29/mo | 500 | 2 |
| Pro | $99/mo | 5,000 | 5 |
| Business | $299/mo | 25,000 | 20 |
| Enterprise | Custom | Unlimited | 50+ |

### Supported Test Frameworks (for reference when modifying the worker)

| Framework | Language | Report Format |
|-----------|----------|--------------|
| Playwright | JS/TS or Python | JSON (`playwright-results.json`) or pytest JSON |
| Cypress | JS/TS | JUnit XML (`cypress-*.xml`) |
| Jest | JS/TS | JSON (`jest-results.json`) |
| Mocha | JS/TS | JSON via stdout (`mocha-results.json`) |
| pytest | Python | JSON (`pytest-results.json`) |
| TestNG | Java | Surefire XML (`target/surefire-reports/*.xml`) |
| Selenium | Multi | JUnit XML or pytest JSON depending on manifest |

---

> **🔁 Reminder:** This is a living document. If you are an AI agent and you just finished a task, scroll up to §6 and §7 and **update them now**.
