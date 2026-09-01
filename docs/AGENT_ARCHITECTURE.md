# Agent architecture

TestFlow keeps separate agents. There is no single autonomous agent that plans, generates, executes, and heals.

```text
Explorer → Planner → Validator → (Human approval) → Generator → Executor → Analyzer → Healer
```

Each agent is a TypeScript service invoked by a BullMQ job on the `ai-workflow` queue. The SaaS API, dashboard, tenancy, and test-executor worker stay outside this graph.

## Responsibilities

| Agent | Job | Allowed to do | Must not do |
|-------|-----|---------------|-------------|
| Explorer | `EXPLORE_APPLICATION` | Drive a real browser, record evidence | Invent pages or selectors |
| Planner | `PLAN_TEST` | Turn requirement + evidence into scenarios | Assume UI that was not observed |
| Validator | `VALIDATE_SCENARIOS` | Classify VERIFIED / NEEDS_REVIEW / UNSUPPORTED | Upgrade UNSUPPORTED to VERIFIED |
| Generator | `GENERATE_TEST` | Produce Playwright files for **approved** scenarios | Generate for unsupported or unapproved rows |
| Executor | `EXECUTE_GENERATED_TEST` + existing `test-runs` worker | Run **generated** Playwright files in isolation; keep customer-repo runs | Silently write to `main` |
| Analyzer | `ANALYZE_FAILURE` | Reproduce in a browser, classify, propose an assertion-safe patch | Weaken tests |
| Healer | `HEAL_TEST` | Apply an approved patch to the generated workspace, optional feature-branch PR | Remove assertions or write `main` |

Human approval sits between validate and generate, and again before a healed patch becomes a repository change.

## Browser automation abstraction

```text
Agent (Explorer, later Analyzer/Healer)
        ↓
BrowserAutomationInterface
        ↓
┌─────────────────────┬──────────────────────────┐
│ Playwright (default)│ MCP (not production yet) │
└─────────────────────┴──────────────────────────┘
```

- Interface: `backend/src/ai/browser/BrowserAutomationInterface.ts`
- Playwright implementation: `backend/src/ai/browser/PlaywrightBrowserAutomation.ts`
- Factory: `createBrowserAutomation()` (`BROWSER_AUTOMATION_BACKEND`, default `playwright`)
- MCP implementation exists only as an explicit non-production stub. An IDE Playwright Test MCP session is not the TestFlow runtime.

Agents must not import `chromium` directly except inside the Playwright adapter.

## Data flow

```text
Requirement + Project.applicationUrl
        ↓
Explorer (Playwright session)
        ↓
scenario_evidence (url, dom, screenshot, action, console, network)
        ↓
Planner (heuristic and/or LLM)
        ↓
Scenario rows
        ↓
Validator
        ↓
Dashboard approval
        ↓
GeneratedTest.files (JSONB) + workspace on disk
        ↓
EXECUTE_GENERATED_TEST / optional GitHub feature-branch PR
        ↓
Failure → Analyzer → HealingAttempt → approval → isolated re-run
```

## What is production-quality today

- Explorer uses real Chromium and records an action log (Phase 2).
- Evidence is stored in PostgreSQL (`scenario_evidence`) and screenshots under `ARTIFACT_DIR`.
- Planner emits scenarios from observed controls; unmatched or invented features stay review/unsupported (Phase 4).
- Validator requires observed controls; a start URL is not enough (Phase 5).
- Approval workflow, generated Playwright workspace compile/run, and browser healing of generated files.

## What is still thinner than the target engine

- Customer-repo **source** healing (connected-repo runs are classified, not patched).
- Workspace git-as-default (feature-branch PR is still optional and token-gated).
