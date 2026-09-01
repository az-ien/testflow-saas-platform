# Remaining work

These are not implemented. Do not mark them complete.

## High priority

- Authenticated artifact download API (screenshots/traces scoped by user/project)
- Encrypt repository tokens and environment variables at rest
- Backend/API integration tests against PostgreSQL (Jest currently covers AI units + explorer/generator/healer browser tests)
- CI pipeline (GitHub Actions) for backend tests, frontend build, and migrations
- OpenAPI/Swagger for the new QE routes
- Per-tenant AI provider keys (today: process environment)

## Product

- Jira issue import
- Organization/team model and RBAC beyond user ownership
- WebSocket live updates (dashboard still polls/refreshes)
- Additional agentic framework adapters (Cypress, Selenium, pytest) — execution already works, generation does not
- Controlled locator self-healing that auto-opens a GitHub PR (`autoCreatePullRequest` + token still required)
- Coverage analytics beyond requirement/scenario/generated-test counts
- Email verification and SendGrid (flags exist)

## Infrastructure

- Terraform ElastiCache Redis
- Terraform ECS/EKS (or equivalent) for API, AI worker, and test worker
- Sandboxed browser sessions at the cluster level (gVisor/Firecracker). Current isolation is per-job Chromium context + path prefixing
- Production log shipping beyond Winston files + optional Sentry

## Explicitly not done / not copied

- There is **no chatbot** that generates tests from free-form chat
- Default-branch commits are **not** performed
- Demo-app page objects and hardcoded demo credentials are **not** the product source of truth
