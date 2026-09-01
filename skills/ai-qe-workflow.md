# AI QE workflow

This is an orchestrated workflow, not a chatbot.

```text
User / Team
    ↓
SaaS Dashboard
    ↓
Create Project (application URL + optional git repo)
    ↓
Add Requirement (plain text, user story, GitHub issue)
    ↓
POST /api/test-plans  →  EXPLORE_APPLICATION
    ↓
PlaywrightExplorer (Chromium via BrowserAutomationInterface)
        ↓
Evidence store (URLs, DOM, screenshots, actions, console, network)
    ↓
Evidence store (URLs, DOM, screenshots, console, network)
    ↓
PLAN_TEST  →  scenarios
    ↓
VALIDATE_SCENARIOS
    ↓
VERIFIED | NEEDS_REVIEW | UNSUPPORTED
    ↓
Human approval  (WAIT_FOR_APPROVAL status)
    ↓
GENERATE_TEST  (Playwright adapter, reuse repo inventory when GitHub is readable)
    ↓
Review generated files / optional feature-branch PR
    ↓
Execute on test-runs worker
    ↓
PASS → dashboard
FAIL → ANALYZE_FAILURE → healing proposal → approval → HEAL_TEST → RE_RUN_TEST
```

## Classification rules

| Class | Meaning | Eligible for generation |
|-------|---------|-------------------------|
| `VERIFIED` | Requirement and observed UI both support the scenario | Yes after approval (or `verified_auto` policy) |
| `NEEDS_REVIEW` | Plausible but incomplete evidence or assumptions | Only if a human explicitly approves it |
| `UNSUPPORTED` | Invented UI or behaviour (e.g. credit-card on SauceDemo login) | Never |

The validator will not upgrade a deterministic `UNSUPPORTED` result to `VERIFIED` even if an LLM suggests it.

## Approval policy (`projects.approval_policy`)

| Value | Behaviour |
|-------|-----------|
| `always` | Default. Human must approve before generation |
| `verified_auto` | VERIFIED scenarios are marked approved; generation still follows `autoGenerateOnApprove` |
| `manual_all` | Same as always; kept for explicit UI copy |

`autoCreatePullRequest` defaults to **false**. Healing and generation never push to `main`.

## Job ownership

Every `ai-workflow` job carries `userId`, `projectId`, and `correlationId`. Processors refuse to load entities that do not match both IDs.

## Adding a framework adapter later

1. Implement `generate()` compatible with `PlaywrightAdapter`.
2. Register it in `getFrameworkAdapter(framework)`.
3. Keep Playwright as the default agentic path.
4. Continue using the existing test executor for runtime.
