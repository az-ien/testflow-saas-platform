# Testing

## Backend unit tests

```bash
cd backend
npm install
npm test
```

Jest + ts-jest. Tests do **not** require PostgreSQL, Redis, or an LLM key.

Covered now:

- Planner evidence mapping (`PlannerService.test.ts`)
- Hallucination classification; start-URL refs are not enough (`classification.test.ts`)
- Evidence matching for locators (`backend/src/ai/evidence/matching.test.ts`)
- Playwright generation + workspace layout (`GeneratorService.test.ts`, `PlaywrightAdapter.test.ts`)
- Generated-file compile and run against a local HTML fixture (`GeneratedTestRunner.test.ts`) — requires Playwright browsers (`npx playwright install chromium`)
- Healer categories, assertion preservation, and locator patches (`HealerService.test.ts`)
- Browser reproduce + isolation rerun of a stale locator (`healing.integration.test.ts`) — requires Playwright browsers
- Framework adapter defaulting to Playwright (`FrameworkAdapter.test.ts`)
- GitHub URL parsing, feature-branch guard, and workspace diffs (`GitHubService.test.ts`, `backend/src/ai/git/*.test.ts`)
- Heuristic provider fallback (`providers/index.test.ts`)
- User isolation helper (`projectAccess.test.ts`)
- Exploration policy, credentials, and MCP stub honesty (`backend/src/ai/browser/*.test.ts`)
- Real Chromium explorer against a local HTML fixture (`PlaywrightExplorer.test.ts`) — requires Playwright browsers (`npx playwright install chromium`)

## Frontend

```bash
cd frontend
npm install
npm run build
```

```bash
cd frontend
npm test
```

Vitest covers small pure helpers (`gitLabels`). There is still no Playwright UI suite for the dashboard.

## Manual workflow check

1. Register / login
2. Create a project with `applicationUrl` (e.g. a public demo site)
3. Add a requirement with acceptance criteria
4. Click **Plan with AI**
5. Watch the test plan move exploring → planning → validating → awaiting_approval
6. Approve verified scenarios
7. Inspect generated Playwright files (`pages/`, `fixtures/`, `test-data/`, `tests/`) and the stored workspace diff
8. If a GitHub token is configured, approve git publish (or reject to keep files in the dashboard)
9. Execute generated tests (no customer repository required)
10. On failure, open AI Healing and approve/reject the proposal

CI (`.github/workflows/ci.yml`) runs backend Jest (excluding slow Chromium suites), Sequelize migrations against Postgres, frontend build + Vitest, and the test-worker TypeScript build.

## Known test gaps

- `RUN_API_INTEGRATION=true` is required for live API/Postgres tests (placeholder suite exists)
- No Playwright UI tests of the SaaS dashboard
- Live MCP process is not integration-tested (not the production backend)
