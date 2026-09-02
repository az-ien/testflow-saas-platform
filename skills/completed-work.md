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
| AI generator | `backend/src/ai/generator/` + Playwright adapter | Approved scenarios → workspace Playwright files + compile check |
| Generated test runner | `backend/src/ai/executor/GeneratedTestRunner.ts` | `playwright test --list` (COMPILES) and `playwright test` (PASSED/FAILED) on generated files |
| AI healer | `backend/src/ai/healer/` | Browser reproduce, assertion-safe locator patch, isolation rerun, approval before apply |
| Configurable AI providers | `backend/src/ai/providers/` | heuristic, OpenAI-compatible, Anthropic |
| Playwright application explorer | `backend/src/ai/browser/` | Real Chromium: navigate, snapshot, fill/click login when credentials exist, same-origin crawl, action log |
| Evidence persistence | `ScenarioEvidence` + artifact dir | URLs, DOM, screenshots, console, network |
| Requirements API + UI | `/api/requirements`, `RequirementsPage` | Plain text, user story, GitHub issue import |
| Test plan workflow | `/api/test-plans` | Explore → plan → validate asynchronously |
| Scenario + approval UI | `/api/scenarios`, `/api/approvals` | Approve verified or selected scenarios |
| Generated test management | `/api/generated-tests` | File review, stored workspace diff, execute generated workspace, Open PR after git approval |
| Healing API + UI | `/api/healing` | History, approve/reject, re-run; token present → feature-branch PR after heal approval |
| Workspace git publish | `backend/src/ai/git/`, Approvals + Generated Tests | Diff vs connected branch, approval required, feature-branch PR only; no token → dashboard files |
| Coverage + AI activity | `/api/qe` | Dashboard summary and requirement coverage |
| AI worker | `backend/src/workers/aiWorker.ts` | BullMQ `ai-workflow` |
| QE data model + migration | `backend/migrations/20260901000000-create-ai-qe-schema.js` | Requirements through healing |
| Frontend AI QE navigation | `DashboardLayout`, new pages | Dashboard, requirements, plans, scenarios, approvals, generated tests, healing, coverage |
| Usage dimensions | `PLAN_LIMITS`, `UsageMeter` | planning, exploration, healing, runs |
| Ownership checks | `projectAccess.ts`, AI processors | userId + projectId on reads/writes |
| Unit tests | `backend/src/ai/**/*.test.ts` | Planner, validator, generator, healer, adapters, generated runner, workspace diff, feature-branch guard, GitHub parse, isolation |
| Artifact download | `/api/artifacts` | User/project prefix check; screenshots/traces |
| Secrets at rest | `FieldEncryption` | AES-256-GCM for tokens, env vars, and per-project AI/Jira keys |
| Per-project AI keys | `Project.aiProvider` + `getAiProvider(overrides)` | Falls back to process env, then heuristic |
| Jira import | `/api/requirements/import/jira` + UI | Requires Jira site/token on the project |
| Organizations | `/api/organizations` | Owner/admin/member; project access via org membership |
| WebSockets | `/ws` | JWT query token; workflow completion events |
| Cypress/pytest generation | `CypressAdapter`, `PytestAdapter` | Playwright remains default |
| Coverage analytics | `/api/qe/coverage` | Totals + automation % + review/unsupported |
| Email verification | `/api/auth/verify-email` + SendGrid | Gated by `FEATURE_EMAIL_VERIFICATION` |
| Generated quality gate | `.github/workflows/testflow-quality-gate.yml` in generated workspaces | Report + trace upload |
| SaaS CI | `.github/workflows/ci.yml` | Backend tests, migrate, frontend build |
| OpenAPI | `docs/openapi.yaml` | Served at `/api/openapi.yaml` |
| Inbound git webhooks | GitHub, GitLab, Bitbucket, Azure DevOps | Token/signature when configured |
| Terraform Redis/ECS | `terraform/compute.tf` | ElastiCache Redis + Fargate API/AI/test workers |
| Python package managers | `TestExecutor` | poetry / pdm / uv / pip |
| Log shipping | Winston HTTP transport | `LOG_SHIP_URL` |

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
| Generate automated tests | Completed — Playwright layout on disk + JSONB, compile-checked (Phase 7) |
| Execute in isolated workers | Completed for **generated** Playwright files (Phase 8) and connected-repo tests |
| Failed tests analyzed | Completed for generated Playwright files (Phase 10). Connected-repo failures are still log + live page, not source patches. |
| Propose healing fix | Completed for generated files (Phase 11). Isolation rerun must pass for high confidence; assertions cannot be dropped. |
| Approve fix and re-run | Completed — apply to generated workspace, then `RE_RUN_TEST`; verified only if that run passes. Token present → feature-branch PR. |
| Publish generated files | Completed (Phase 9) — stored diff, git approval, feature-branch PR; dashboard-only without a token |
| Traceability visible | Completed (coverage + scenario/plan/generated-test pages) |
