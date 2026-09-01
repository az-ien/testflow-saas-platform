# TestFlow QE engine plan

This document is the architecture comparison between TestFlow **today** and the **target evidence-driven QE engine**. TestFlow must remain a multi-tenant SaaS. Do not replace its dashboard, API, PostgreSQL/Sequelize, Redis/BullMQ, auth, billing, or worker model with a local Copilot/git toolkit.

---

## Status at a glance

| Area | TestFlow today | Target engine | Gap |
|------|----------------|---------------|-----|
| Product shape | Multi-tenant SaaS | Same SaaS, deeper QE agents | Keep SaaS packaging. |
| Planner | Evidence-first heuristic + optional LLM; unmatched AC kept for review/unsupported | Evidence-first scenarios only | **Phase 4 done.** LLM still optional. |
| Validator | VERIFIED / NEEDS_REVIEW / UNSUPPORTED; start URL is not control proof | Reject anything not observed in the UI | **Phase 5 done.** |
| Explorer | Interactive Chromium (goto, snapshot, login fill/click, same-origin crawl, action log) | Same, plus richer authenticated flows | Phase 2 landed. SPA/iframe/upload gaps remain. |
| Evidence | URLs, DOM, screenshots, actions, console, network in `scenario_evidence` | Planner/generator/healer consume the same evidence end to end | Action log exists; later agents still underuse it. |
| Approval | SaaS dashboard + policies | Keep TestFlow human review | Keep TestFlow. |
| Generator | Playwright files in `pages/`, `fixtures/`, `test-data/`, `tests/` written to a workspace and compile-checked | Same, using only discovered selectors | **Phase 7 done.** |
| Execution | Generated workspace run with COMPILES / EXECUTED / PASSED / FAILED; customer-repo worker unchanged | Same | **Phase 8 done** for generated Playwright files. |
| Healer | Reproduce in Chromium, patch observed locators, isolation rerun, approval before apply | Same | **Phases 10–11 done** for generated Playwright files. |
| MCP | Optional stdio stub, default off | Optional backend behind `BrowserAutomationInterface` | Do not couple the SaaS to VS Code/Copilot MCP. |
| GitHub | Issue import + workspace diff → approval → feature-branch PR | Same; never `main` | **Phase 9 done.** |
| POM / fixtures / test-data | Workspace TypeScript from discovered locators (also stored in JSONB) | Same | Files also persist for PR review. |

Honest summary: **explore, plan, validate, generate, execute generated Playwright files, browser-heal those files, and publish via stored workspace diff + approval + feature-branch PR are in place.** Customer-repo source healing remains thinner.

---

## What already exists in TestFlow (keep)

### SaaS platform — do not replace

- Authentication (JWT + API keys) and user-scoped multi-tenancy
- Projects, requirements, dashboard, approvals
- PostgreSQL + Sequelize (this repo does **not** use Prisma)
- Redis + BullMQ (`test-runs` and `ai-workflow`)
- Stripe billing and API keys
- Existing test-executor worker and multi-framework runners (Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium)
- GitHub inbound webhooks and outbound signed run webhooks
- Frontend navigation for Requirements, AI Test Plans, Scenarios, Approvals, Generated Tests, Test Runs, Healing, Coverage

### Agentic workflow — keep the job chain, deepen the agents

Job chain already implemented in `backend/src/workers/processors.ts`:

```text
EXPLORE_APPLICATION → PLAN_TEST → VALIDATE_SCENARIOS
        → human approval (WAIT_FOR_APPROVAL)
        → GENERATE_TEST (workspace + compile + git diff)
        → human git-publish approval (token present)
        → feature-branch PR (never `main`)
        → EXECUTE_GENERATED_TEST (generated files)
        → ANALYZE_FAILURE (browser reproduce) → HEAL_TEST → RE_RUN_TEST
```

Traceability tables already exist (`Requirement`, `TestPlan`, `Scenario`, `ScenarioEvidence`, `ScenarioValidation`, `GeneratedTest`, `TestRun`, `HealingAttempt`, `AiActivity`, `WorkflowJob`).

Agent folders already exist:

| Agent | Location | Current depth |
|-------|----------|---------------|
| Explorer | `backend/src/ai/browser/PlaywrightExplorer.ts` | Interactive Chromium + action log |
| Planner | `backend/src/ai/planner/PlannerService.ts` | Evidence + heuristic fallback |
| Validator | `backend/src/ai/validator/` | Classification rules exist |
| Generator | `backend/src/ai/generator/` + `PlaywrightAdapter` | Workspace Playwright layout from discovered locators |
| Executor | `backend/src/ai/executor/GeneratedTestRunner.ts` + existing `workers/test-executor/` | Generated files run in the AI worker; customer repos still use the test worker |
| Analyzer / Healer | `backend/src/ai/healer/` | Browser reproduce + assertion-safe locator patch + isolation rerun |

---

## What is missing (engine depth)

1. **Optional MCP backend** — Agent → `BrowserAutomationInterface` → Playwright or future MCP, without coupling the SaaS to an IDE MCP session.
2. **Full SaaS-path smoke** — dashboard click-through of requirement → explore → approve → generate → execute → heal still needs a live stack; engine unit/integration tests cover generate/run/heal/git.
3. **Customer-repo source healing** — connected-repo failures are classified from logs + a live page; only generated Playwright files are patched.
4. **CI quality gate on generated workspaces** — GitHub Actions report/trace upload after a feature-branch PR.

---

## Target engine behaviors (already the product rules)

| Behavior | How it lives in TestFlow |
|----------|--------------------------|
| Explore with a real browser before planning | `EXPLORE_APPLICATION` job using Playwright |
| Do not invent payments/discounts/email | Keep UNSUPPORTED; tighten evidence rules |
| Human review before generation | Keep dashboard approvals |
| POM + fixtures + test-data + tests | Generator target layout, written to a workspace |
| Healer must not weaken assertions | Keep `preserveAssertions`; enforce in healing validation |
| Feature-branch git, not `main` | Stored `workspaceDiff` + git publish approval + `GitHubService.createPullRequest` |
| Playwright as the deep path | Keep other frameworks for **execution** only |

---

## What must stay SaaS-shaped

- Agent markdown / IDE prompts are **not** the runtime — BullMQ processors + TypeScript services are
- VS Code MCP configs are **not** the production browser layer — `BrowserAutomationInterface` is
- Markdown specs in git are **not** the system of record — `Scenario` + `ScenarioValidation` rows are
- Laptop `npx playwright test` is **not** production execution — isolated workers + artifact store are
- A single demo app is **not** the architecture — tenant `applicationUrl` + project env credentials are

---

## What should not be hardcoded

- Demo-app page objects (`LoginPage.ts`, `ProductsPage.ts`, …)
- Hardcoded demo credentials in product code
- Copilot/VS Code as the execution environment
- A local-only git workflow as a replacement for TestFlow tenancy

---

## Recommended implementation order

Do not implement every phase at once.

| Phase | Focus | Production-quality exit |
|-------|--------|-------------------------|
| **1** | Architecture analysis (this document) | Honest gap list |
| **2** | Real Playwright exploration (interactive) | Click/fill/login, action log, no fictional UI — **done** |
| **3** | Evidence model | Actions, locators, screenshots restored for planner — **partial** |
| **4** | Evidence-driven planner | No scenario without supporting evidence — **done** |
| **5** | Scenario validation | Stop over-verifying weak refs — **done** |
| **6** | Human approval | Already present; expose classification rationale |
| **7** | Real Playwright generation | Valid files, discovered selectors only — **done** |
| **8** | Real execution of **generated** tests | GENERATED/COMPILES/EXECUTED/PASSED/FAILED — **done** |
| **9** | Git/GitHub | Workspace diff → approval → feature-branch PR — **done** |
| **10** | Browser failure analysis | Reproduce with Playwright — **done** for generated tests |
| **11** | Safe healing | Patch + isolation rerun + approval; never drop assertions — **done** for generated tests |
| **12** | Hardening and docs | E2E smoke + limitation list |

---

## Security notes that apply to every later phase

- Do not log passwords. Redact fill values for password fields.
- Browser jobs must stay same-origin relative to `applicationUrl`.
- Do not click logout/delete/destructive controls during exploration.
- Never commit generated or healed files to `main`.
- Tenant isolation (`userId` + `projectId`) stays on every AI job.

---

## Known limitations (current)

- Customer-repo test **source** is not patched; only generated Playwright workspaces are.
- Without a GitHub token, generated files stay in the dashboard (`gitStatus=unavailable`); they are never pushed.
- Playwright MCP stdio is experimental and is **not** the default exploration backend.
- Heuristic planner still contains some cart/product keyword bias; it is not a demo-app-only architecture, but it is not fully generic yet.
