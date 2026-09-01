# TestFlow → Jiten20-level QE engine: migration plan

This document is the Phase 1 architecture comparison. It describes what TestFlow already has, what the Jiten20 reference does, and what still has to be adapted into TestFlow’s SaaS architecture.

Jiten20 reference (behavioral only, not a copy source): [Jiten20/playwright-agentic-quality-engineering-framework](https://github.com/Jiten20/playwright-agentic-quality-engineering-framework).

TestFlow must remain a multi-tenant SaaS. Do not replace its dashboard, API, PostgreSQL/Sequelize, Redis/BullMQ, auth, billing, or worker model with Jiten20’s local Copilot + git toolkit.

---

## Status at a glance

| Area | TestFlow today | Jiten20 | Gap |
|------|----------------|---------|-----|
| Product shape | Multi-tenant SaaS | Local repo + VS Code/Copilot | Keep SaaS. Do not copy Jiten20 packaging. |
| Planner | Heuristic + optional LLM; can emit scenarios from acceptance criteria with weak UI match | Browser-tool planner (`planner_setup_page`, `browser_*`, `planner_save_plan`) | Evidence-first planning is incomplete. |
| Explorer | Real Chromium, **link crawl only** (no click/fill/login) | Interactive MCP browser exploration | **Highest-value gap.** Login-walled apps stop at the login page. |
| Evidence | URLs, DOM text, screenshots, console, network in `scenario_evidence` | Live snapshots during planning/generation/debug | Action log and locator-quality evidence are thin. |
| Validator | VERIFIED / NEEDS_REVIEW / UNSUPPORTED | Rejected unsupported specs committed as markdown | Over-verifies when `evidenceRefs` is just the start URL. |
| Approval | SaaS dashboard + policies | Human git/markdown review | **Keep TestFlow.** |
| Generator | Playwright-like files stored in **JSONB** | Real `pages/`, `fixtures/`, `test-data/`, `tests/` in git | Files are not a workspace; locators can be invented. |
| Execution | Existing multi-framework worker clones **customer repo** | `npx playwright test` on generated specs | Generated files are not what gets executed. |
| Healer | Log/string classification | MCP `test_run` / `test_debug` against live app | No browser reproduction. |
| MCP | Optional stdio stub, default off | First-class Playwright Test MCP in VS Code | Need an interface, not Copilot MCP. |
| GitHub | Issue import + optional feature-branch PR | Local git + Actions quality gate | Extend TestFlow; never commit `main`. |
| POM / fixtures / test-data | Generated as DB strings | Committed TypeScript modules | Adapt structure; do not copy SauceDemo pages. |

Honest summary: **the SaaS workflow is modeled. The QE engine is not yet Jiten20-depth.**

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
| Explorer | `backend/src/mcp/playwright/PlaywrightExplorer.ts` | Real browser, crawl-only |
| Planner | `backend/src/ai/planner/PlannerService.ts` | Evidence + heuristic fallback |
| Validator | `backend/src/ai/validator/` | Classification rules exist |
| Generator | `backend/src/ai/generator/` + `PlaywrightAdapter` | DB-stored Playwright-like source |
| Executor | `workers/test-executor/` | Real execution of **repo** tests |
| Analyzer / Healer | `backend/src/ai/healer/HealerService.ts` | Log text only |

---

## What is missing (engine depth)

1. **Interactive exploration** — click, fill, authenticated crawl, recorded actions, discovered locators.
2. **Evidence that the planner cannot ignore** — action log, post-login pages, selector candidates. Planner must not assume a feature exists without it.
3. **Strict validation** — `evidenceRefs: [startUrl]` must not count as proof of a control.
4. **Executable generation** — write `pages/`, `fixtures/`, `test-data/`, `tests/` to a workspace; syntax-check; use only discovered selectors.
5. **Generated-test execution statuses** — GENERATED / COMPILES / EXECUTED / PASSED / FAILED as distinct from “row created”.
6. **Workspace git flow** — generate → run → diff → approval → feature-branch PR. Never silent `main`.
7. **Browser-based failure analysis** — reopen the app, inspect DOM, classify test vs app vs selector vs timing vs env vs data.
8. **Safe healing** — propose a patch, rerun in isolation, refuse assertion deletion, require approval before repo change.
9. **BrowserAutomationInterface** — Agent → interface → Playwright or future MCP, without coupling the SaaS to VS Code MCP.
10. **End-to-end smoke** — requirement → real browser → evidence → scenario → approval → real spec on disk → real Playwright run → result.

---

## What can be adapted from Jiten20 (behavior, not files)

| Jiten20 behavior | How to adapt in TestFlow |
|------------------|--------------------------|
| Explore with a real browser before planning | `EXPLORE_APPLICATION` job using Playwright |
| Do not invent payments/discounts/email | Keep UNSUPPORTED; tighten evidence rules |
| Human review before generation | Keep dashboard approvals |
| POM + fixtures + test-data + tests | Generator target layout, written to a workspace |
| Healer must not weaken assertions | Keep `preserveAssertions`; enforce in healing validation |
| Feature-branch git, not `main` | Existing `GitHubService.createPullRequest` |
| Playwright as the deep path | Keep other frameworks for **execution** only |

---

## What must be rewritten for SaaS

- Copilot agent markdown (`.github/agents/*.agent.md`) → BullMQ processors + TypeScript services
- VS Code MCP (`.vscode/mcp.json`) → `BrowserAutomationInterface` with a Playwright implementation
- Markdown specs in git → `Scenario` + `ScenarioValidation` rows
- Local `npx playwright test` on a laptop → isolated worker + artifact store
- Single SauceDemo repo assumptions → tenant `applicationUrl` + project env credentials

---

## What should NOT be copied

- SauceDemo page objects (`LoginPage.ts`, `ProductsPage.ts`, …)
- Hardcoded `secret_sauce` / `standard_user` in product code
- `.github/agents/*.md` Copilot prompts as the runtime
- `.vscode/mcp.json` as the production browser layer
- Assuming Copilot, VS Code, or a developer laptop is the execution environment
- Jiten20’s local-only git workflow as a replacement for TestFlow tenancy

---

## Recommended migration order

Follow the product spec. Do not implement every phase at once.

| Phase | Focus | Production-quality exit |
|-------|--------|-------------------------|
| **1** | Architecture analysis (this document) | Honest gap list |
| **2** | Real Playwright exploration (interactive) | Click/fill/login, action log, no fictional UI |
| **3** | Evidence model | Actions, locators, screenshots restored for planner |
| **4** | Evidence-driven planner | No scenario without supporting evidence |
| **5** | Scenario validation | Stop over-verifying weak refs |
| **6** | Human approval | Already present; expose classification rationale |
| **7** | Real Playwright generation | Valid files, discovered selectors only |
| **8** | Real execution of **generated** tests | GENERATED/COMPILES/EXECUTED/PASSED/FAILED |
| **9** | Git/GitHub | Workspace diff → approval → feature-branch PR |
| **10** | Browser failure analysis | Reproduce with Playwright |
| **11** | Safe healing | Patch + rerun + approval; never drop assertions |
| **12** | Hardening and docs | E2E smoke + limitation list |

### First production change (Phase 2)

Upgrade exploration from “goto + collect links” to an interactive `BrowserAutomationInterface` implementation:

- Launch Playwright Chromium
- Navigate the live application
- Interact with observed controls (including login when project credentials exist)
- Capture DOM, screenshots, and an action log
- Store evidence in the existing `scenario_evidence` table

This is the smallest change that gives TestFlow a real Jiten20-style capability: **the planner can only see pages the browser actually reached.**

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
- Heuristic planner still contains some cart/product keyword bias; it is not a SauceDemo-only architecture, but it is not fully generic yet.
