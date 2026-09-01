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
- Healer categories and assertion preservation (`HealerService.test.ts`)
- Framework adapter defaulting to Playwright (`FrameworkAdapter.test.ts`)
- GitHub URL parsing (`GitHubService.test.ts`)
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

There is still no frontend test runner (pre-existing gap).

## Manual workflow check

1. Register / login
2. Create a project with `applicationUrl` (e.g. a public demo site)
3. Add a requirement with acceptance criteria
4. Click **Plan with AI**
5. Watch the test plan move exploring → planning → validating → awaiting_approval
6. Approve verified scenarios
7. Inspect generated Playwright files (`pages/`, `fixtures/`, `test-data/`, `tests/`)
8. Execute generated tests (no customer repository required)
9. On failure, open AI Healing and approve/reject the proposal

## Known test gaps

- No API integration tests against Postgres
- No worker isolation tests in CI
- No Playwright UI tests of the SaaS dashboard
- Live MCP process is not integration-tested
