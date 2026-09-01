# TestFlow QE engine plan

This document is the architecture comparison between TestFlow **today** and the **target evidence-driven QE engine**. TestFlow must remain a multi-tenant SaaS. Do not replace its dashboard, API, PostgreSQL/Sequelize, Redis/BullMQ, auth, billing, or worker model with a local Copilot/git toolkit.

---

## Status at a glance

| Area | TestFlow today | Target engine | Gap |
|------|----------------|---------------|-----|
| Product shape | Multi-tenant SaaS | Same SaaS, deeper QE agents | Keep SaaS packaging. |
| Planner | Heuristic + optional LLM; can emit scenarios from acceptance criteria with weak UI match | Evidence-first scenarios only | Evidence-first planning is incomplete. |
| Explorer | Interactive Chromium (goto, snapshot, login fill/click, same-origin crawl, action log) | Same, plus richer authenticated flows | Phase 2 landed. SPA/iframe/upload gaps remain. |
| Evidence | URLs, DOM, screenshots, actions, console, network in `scenario_evidence` | Planner/generator/healer consume the same evidence end to end | Action log exists; later agents still underuse it. |
| Validator | VERIFIED / NEEDS_REVIEW / UNSUPPORTED | Reject anything not observed in the UI | Over-verifies when `evidenceRefs` is just the start URL. |
| Approval | SaaS dashboard + policies | Keep TestFlow human review | Keep TestFlow. |
| Generator | Playwright-like files stored in **JSONB** | Real `pages/`, `fixtures/`, `test-data/`, `tests/` in a workspace | Files are not a workspace; locators can be invented. |
| Execution | Existing multi-framework worker clones **customer repo** | Run the **generated** specs | Generated files are not what gets executed. |
| Healer | Log/string classification | Reproduce in a browser, patch, rerun | No browser reproduction. |
| MCP | Optional stdio stub, default off | Optional backend behind `BrowserAutomationInterface` | Do not couple the SaaS to VS Code/Copilot MCP. |
| GitHub | Issue import + optional feature-branch PR | Workspace diff → approval → feature-branch PR | Never commit `main`. |
| POM / fixtures / test-data | Generated as DB strings | Committed TypeScript modules from discovered locators | Do not hardcode a demo app. |

Honest summary: **the SaaS workflow is modeled. The QE engine is not yet at target depth.**

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
        → GENERATE_TEST
        → existing test worker (on customer repo)
        → ANALYZE_FAILURE → HEAL_TEST → RE_RUN_TEST
```

Traceability tables already exist (`Requirement`, `TestPlan`, `Scenario`, `ScenarioEvidence`, `ScenarioValidation`, `GeneratedTest`, `TestRun`, `HealingAttempt`, `AiActivity`, `WorkflowJob`).

Agent folders already exist:

| Agent | Location | Current depth |
|-------|----------|---------------|
| Explorer | `backend/src/ai/browser/PlaywrightExplorer.ts` | Interactive Chromium + action log |
| Planner | `backend/src/ai/planner/PlannerService.ts` | Evidence + heuristic fallback |
| Validator | `backend/src/ai/validator/` | Classification rules exist |
| Generator | `backend/src/ai/generator/` + `PlaywrightAdapter` | DB-stored Playwright-like source |
| Executor | `workers/test-executor/` | Real execution of **repo** tests |
| Analyzer / Healer | `backend/src/ai/healer/HealerService.ts` | Log text only |

---

## What is missing (engine depth)

1. **Evidence that the planner cannot ignore** — post-login pages and locator candidates must drive planning. Planner must not assume a feature exists without it.
2. **Strict validation** — `evidenceRefs: [startUrl]` must not count as proof of a control.
3. **Executable generation** — write `pages/`, `fixtures/`, `test-data/`, `tests/` to a workspace; syntax-check; use only discovered selectors.
4. **Generated-test execution statuses** — GENERATED / COMPILES / EXECUTED / PASSED / FAILED as distinct from “row created”.
5. **Workspace git flow** — generate → run → diff → approval → feature-branch PR. Never silent `main`.
6. **Browser-based failure analysis** — reopen the app, inspect DOM, classify test vs app vs selector vs timing vs env vs data.
7. **Safe healing** — propose a patch, rerun in isolation, refuse assertion deletion, require approval before repo change.
8. **Optional MCP backend** — Agent → `BrowserAutomationInterface` → Playwright or future MCP, without coupling the SaaS to an IDE MCP session.
9. **End-to-end smoke** — requirement → real browser → evidence → scenario → approval → real spec on disk → real Playwright run → result.

---

## Target engine behaviors (already the product rules)

| Behavior | How it lives in TestFlow |
|----------|--------------------------|
| Explore with a real browser before planning | `EXPLORE_APPLICATION` job using Playwright |
| Do not invent payments/discounts/email | Keep UNSUPPORTED; tighten evidence rules |
| Human review before generation | Keep dashboard approvals |
| POM + fixtures + test-data + tests | Generator target layout, written to a workspace |
| Healer must not weaken assertions | Keep `preserveAssertions`; enforce in healing validation |
| Feature-branch git, not `main` | Existing `GitHubService.createPullRequest` |
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
| **4** | Evidence-driven planner | No scenario without supporting evidence |
| **5** | Scenario validation | Stop over-verifying weak refs |
| **6** | Human approval | Already present; expose classification rationale |
| **7** | Real Playwright generation | Valid files, discovered selectors only |
| **8** | Real execution of **generated** tests | GENERATED/COMPILES/EXECUTED/PASSED/FAILED |
| **9** | Git/GitHub | Workspace diff → approval → feature-branch PR |
| **10** | Browser failure analysis | Reproduce with Playwright |
| **11** | Safe healing | Patch + rerun + approval; never drop assertions |
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

- Generator writes Playwright-like source into the database, not a runnable workspace.
- “Execute generated test” runs the **connected repository**, not the generated files.
- Healer does not reopen a browser.
- Playwright MCP stdio is experimental and is **not** the default exploration backend.
- Heuristic planner still contains some cart/product keyword bias; it is not a demo-app-only architecture, but it is not fully generic yet.
