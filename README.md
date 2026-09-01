# TestFlow AI Quality Engineering

An AI Quality Engineering SaaS: provide an application and requirements, and the platform explores the product, creates evidence-based scenarios, validates them, waits for human approval, generates Playwright tests, executes them, and heals failures.

This repository is the existing TestFlow SaaS platform **transformed**, not replaced. Cloud execution, auth, billing, and multi-framework workers remain the infrastructure layer. The agentic workflow is adapted from the concepts in [`Jiten20/playwright-agentic-quality-engineering-framework`](https://github.com/Jiten20/playwright-agentic-quality-engineering-framework) — that repository was **not copied**.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)

## Product Overview

| Layer | Role |
|-------|------|
| Product | Requirement → explore → plan → validate → approve → generate → execute → heal |
| Platform | Auth, projects, Redis/BullMQ, isolated test workers, Stripe, GitHub webhooks |
| Agentic core | Planner, Playwright explorer/MCP, validator, generator, healer |

Playwright is the first-class framework for the AI workflow. Cypress, Selenium, pytest, TestNG, Jest, and Mocha remain supported for **execution**.

## Architecture

```text
┌─────────────┐     ┌────────────────┐     ┌─────────────────┐
│  Frontend    │────▶│  Backend API   │────▶│ Redis + BullMQ  │
│  React/Vite  │     │  Express/TS    │     │ test-runs       │
│  Port 3000   │     │  Port 5000     │     │ ai-workflow     │
└─────────────┘     └───────┬────────┘     └────────┬────────┘
                            │                       │
                     ┌──────▼──────┐         ┌──────▼──────┐
                     │ PostgreSQL  │         │ AI worker   │
                     │ Port 5432   │         │ Test worker │
                     └─────────────┘         └─────────────┘
```

Details, APIs, models, and the migration matrix live in [`skills/architecture.md`](skills/architecture.md).

## Core Workflow

```text
Requirement → AI Planner → Playwright exploration → Evidence
    → Validator (VERIFIED | NEEDS_REVIEW | UNSUPPORTED)
    → Human approval → Generator → Isolated execution
    → Healer on failure → Approval → Re-run → Dashboard
```

This is an orchestrated job chain, not a chatbot.

## Current Features

- Multi-framework cloud test execution (retained)
- External GitHub/GitLab/Bitbucket/Azure DevOps repositories (retained)
- JWT + API key authentication (retained)
- Stripe subscriptions (retained)
- Requirements, AI test plans, scenarios, approvals, generated tests, healing, coverage
- Playwright application exploration with evidence storage
- Hallucination / evidence validation
- Optional GitHub issue import and feature-branch pull requests
- Usage limits for runs, planning, exploration, and healing

## Completed

See also [`skills/completed-work.md`](skills/completed-work.md).

**Retained SaaS**

- Docker Compose stack for frontend, backend, PostgreSQL, Redis, test worker
- JWT and API key authentication
- Project and test-run APIs
- BullMQ test execution for Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium-style projects
- GitHub inbound webhook route for push and pull request events
- Outbound signed run webhooks
- Stripe checkout, billing portal, subscription routes, and webhook signature verification
- Sequelize production migrations for the original schema
- Terraform foundation for AWS VPC, RDS PostgreSQL, and S3

**AI QE (implemented in this transformation)**

- Requirements CRUD and GitHub issue import API
- Asynchronous explore → plan → validate workflow (`ai-workflow` queue)
- Playwright explorer with per-job Chromium context
- Scenario classification: VERIFIED / NEEDS_REVIEW / UNSUPPORTED
- Human approval for plans, scenarios, and healing
- Playwright test generation with requirement tags and page objects
- Generated test review, optional GitHub PR, and execution via the existing worker
- Failure analysis + healing history + approved re-run
- QE dashboard, coverage, and AI activity audit log
- Additive database migration `20260901000000-create-ai-qe-schema.js`
- Unit tests for planner, validator, generator, healer, adapters, GitHub parsing, and ownership checks

## Partially Completed

| Feature | Status | What works | What remains | Known issues |
|---------|--------|------------|--------------|--------------|
| Playwright MCP stdio | Client present | Optional `PlaywrightMcpClient`; default exploration uses Playwright Chromium | Process pooling, robust JSON-RPC | MCP disabled unless `PLAYWRIGHT_MCP_ENABLED=true` |
| S3 artifact uploads | Report dirs detected | Local evidence screenshots under `ARTIFACT_DIR` | S3 upload + signed URLs | `uploadReport()` still returns null |
| GitHub PRs for generated tests | API + UI | Feature branch + PR when a token exists | OAuth app, review UX | No token → PR creation fails |
| AI usage billing | Limits enforced in API | Planning/healing/exploration counters | Stripe meters | Stripe still run-centric |
| Token encryption | Not in logs | Tokens passed only into the owning job | Encrypt at rest | Plaintext DB columns |
| Org tenancy | User + project checks | Cross-user QE records are rejected | Organization model | Single-user projects |
| GitLab/Bitbucket/Azure inbound triggers | Metadata accepted | Provider stored on project | Inbound routes | GitHub only |
| `pyproject.toml` install | Detection exists | Python repos detected | Poetry/pdm/uv install | Unchanged worker debt |
| Terraform Redis/compute | Foundation only | VPC, RDS, S3 | ElastiCache, ECS/EKS | Unchanged |

## Remaining Work

- Authenticated artifact download API
- Encrypt repo tokens and env vars at rest
- API integration tests, frontend tests, GitHub Actions CI
- OpenAPI spec
- Jira import, org RBAC, WebSockets
- Additional generator adapters beyond Playwright
- Cluster-level browser sandboxing
- Email verification / SendGrid

Do not treat these as done. Details: [`skills/remaining-work.md`](skills/remaining-work.md).

## Known Limitations

- Without `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, planning uses the heuristic provider (evidence-based, not LLM-creative).
- Application exploration requires a reachable `applicationUrl` from the AI worker.
- Generated tests are stored in the database until a human opens a PR; they are not silently committed.
- Unsupported scenarios cannot be approved for generation.
- Multi-framework AI generation is not implemented; only Playwright generation is first-class.
- Local artifacts are not yet served through an authenticated download API.

## Development Setup

```bash
git clone https://github.com/az-ien/testflow-saas-platform.git
cd testflow-saas-platform
cp .env.example .env
```

Install Node 20+ for host development. Agents and humans should read `SKILLS.md` and the `skills/` directory before changing code.

## Running Locally

### Docker Compose

```bash
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:5000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

```bash
docker compose --profile debug up -d
```

### Host processes

```bash
cd backend && npm install && npm run dev
cd backend && npm run dev:ai-worker
cd frontend && npm install && npm run dev
cd workers/test-executor && npm install && npm run dev
```

## Testing

```bash
cd backend && npm test
cd frontend && npm run build
```

See [`skills/testing.md`](skills/testing.md).

## Deployment

Production migrations:

```bash
cd backend
NODE_ENV=production npm run migrate
```

Terraform still provisions VPC, RDS, and S3 only. Service orchestration is separate. See [`skills/deployment.md`](skills/deployment.md).

## Roadmap

1. Artifact download + S3
2. Encrypt secrets at rest
3. CI and API integration tests
4. Hardened Playwright MCP session pool
5. Organization RBAC
6. Additional generator adapters
7. Stripe meters for AI planning/healing

## API usage (unchanged execution path)

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"securepass","firstName":"John","lastName":"Doe"}'

curl -X POST http://localhost:5000/api/projects \
  -H "X-API-Key: tf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo","applicationUrl":"https://www.saucedemo.com","repoProvider":"github","framework":"playwright"}'

curl -X POST http://localhost:5000/api/requirements \
  -H "X-API-Key: tf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"uuid","title":"Successful checkout","acceptanceCriteria":"Login\nAdd backpack\nComplete order"}'

curl -X POST http://localhost:5000/api/test-plans \
  -H "X-API-Key: tf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"requirementId":"uuid"}'
```

Existing `POST /api/runs` still queues isolated test execution.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Redux Toolkit |
| Backend | Node.js, Express, TypeScript, Sequelize |
| AI | Configurable LLM providers + heuristic fallback |
| Exploration | Playwright Chromium (optional Playwright MCP) |
| Queue | Redis 7, BullMQ (`test-runs`, `ai-workflow`) |
| Billing | Stripe |
| IaC | Terraform (AWS foundation) |

## Documentation for the next agent

| File | Purpose |
|------|---------|
| `SKILLS.md` | Coding standards and tracker |
| `skills/` | Living implementation knowledge |

## License

MIT © TestFlow
