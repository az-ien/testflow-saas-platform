# Completed work

Only items that are implemented in this repository and covered by code, APIs, or unit tests.

## Existing SaaS (retained)

| Feature | Location | Notes |
|---------|----------|-------|
| Docker Compose local stack | `docker-compose.yml` | Now includes `ai-worker` |
| JWT + API key auth | `backend/src/middleware/auth.ts` | Unchanged dual auth |
| User registration/login | `backend/src/routes/auth.ts` | Unchanged |
| Project CRUD | `backend/src/routes/projects.ts` | Extended with application URL and approval policy |
| Test run API + BullMQ execution | `backend/src/routes/runs.ts`, `workers/test-executor/` | Still the execution layer |
| Multi-framework test execution | `TestExecutor.ts` | Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium |
| GitHub inbound webhooks | `backend/src/routes/webhooks.ts` | Push/PR auto-run retained |
| Outbound signed run webhooks | `WebhookNotifier.ts` | Retained |
| Stripe billing routes | `backend/src/routes/subscriptions.ts` | Retained |
| Production schema migration | `backend/migrations/20260831000000-create-initial-schema.js` | Retained |
| Terraform VPC/RDS/S3 foundation | `terraform/` | Retained |

## AI Quality Engineering (new, working)

| Feature | Location | Notes |
|---------|----------|-------|
| AI planner | `backend/src/ai/planner/` | Evidence-first scenarios; unmatched AC kept as review/unsupported |
| Hallucination validator | `backend/src/ai/validator/` | VERIFIED / NEEDS_REVIEW / UNSUPPORTED; start URL is not control proof |
| AI generator | `backend/src/ai/generator/` + Playwright adapter | Approved scenarios → Playwright files |
| AI healer | `backend/src/ai/healer/` | Failure analysis, no assertion deletion |
| Configurable AI providers | `backend/src/ai/providers/` | heuristic, OpenAI-compatible, Anthropic |
| Playwright application explorer | `backend/src/ai/browser/` | Real Chromium: navigate, snapshot, fill/click login when credentials exist, same-origin crawl, action log |
| Evidence persistence | `ScenarioEvidence` + artifact dir | URLs, DOM, screenshots, console, network |
| Requirements API + UI | `/api/requirements`, `RequirementsPage` | Plain text, user story, GitHub issue import |
| Test plan workflow | `/api/test-plans` | Explore → plan → validate asynchronously |
| Scenario + approval UI | `/api/scenarios`, `/api/approvals` | Approve verified or selected scenarios |
| Generated test management | `/api/generated-tests` | File review, optional GitHub PR, execute |
| Healing API + UI | `/api/healing` | History, approve/reject, re-run |
| Coverage + AI activity | `/api/qe` | Dashboard summary and requirement coverage |
| AI worker | `backend/src/workers/aiWorker.ts` | BullMQ `ai-workflow` |
| QE data model + migration | `backend/migrations/20260901000000-create-ai-qe-schema.js` | Requirements through healing |
| Frontend AI QE navigation | `DashboardLayout`, new pages | Dashboard, requirements, plans, scenarios, approvals, generated tests, healing, coverage |
| Usage dimensions | `PLAN_LIMITS`, `UsageMeter` | planning, exploration, healing, runs |
| Ownership checks | `projectAccess.ts`, AI processors | userId + projectId on reads/writes |
| Unit tests | `backend/src/ai/**/*.test.ts` | Planner, validator, generator, healer, adapters, GitHub parse, isolation |

## Definition-of-success mapping

| User step | Status |
|-----------|--------|
| Create an account | Completed (existing) |
| Create a project | Completed (now includes application URL) |
| Connect application/repository | Completed (application URL + optional repo) |
| Add a requirement | Completed |
| Ask AI to analyze the application | Completed (`POST /api/test-plans`) |
| Explore through Playwright | Completed for interactive exploration (Phase 2). Login-walled apps require project `TEST_USERNAME`/`TEST_PASSWORD`. |
| Create evidence-backed scenarios | Completed for observed UI (Phase 4). Unmatched criteria stay NEEDS_REVIEW or UNSUPPORTED. |
| Validate scenarios | Completed (Phase 5). A start URL is not treated as proof of a control. |
| Review/approve | Completed |
| Generate automated tests | Partial — Playwright-like files in DB, not a workspace run (Phase 7) |
| Execute in isolated workers | Completed for **connected repo** tests; generated files are not what runs (Phase 8) |
| Failed tests analyzed | Partial — log classification only (Phase 10) |
| Propose healing fix | Partial — no browser reproduce/rerun validation (Phase 11) |
| Approve fix and re-run | Completed |
| Traceability visible | Completed (coverage + scenario/plan/generated-test pages) |
