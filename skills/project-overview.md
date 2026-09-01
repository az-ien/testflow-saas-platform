# Project Overview

**Name:** TestFlow AI Quality Engineering  
**Last updated:** 2026-09-01  
**Status:** Core AI QE workflow implemented on top of the existing SaaS execution platform.

TestFlow is no longer only a cloud test runner. It is an **AI Quality Engineering SaaS** where a team provides an application and requirements, and the platform:

1. Explores the live application
2. Creates evidence-based scenarios
3. Validates them for hallucination
4. Waits for human approval
5. Generates Playwright tests
6. Executes them on isolated workers
7. Analyzes failures and proposes healing fixes

The Jiten20 Playwright Agentic QE methodology (Planner, Generator, Healer, evidence validation, human approval, GitHub traceability) is the product workflow. Existing TestFlow SaaS infrastructure is the platform layer underneath that workflow.

## Repositories

| Role | URL |
|------|-----|
| This product | `https://github.com/az-ien/testflow-saas-platform` |
| Conceptual reference (not copied) | `https://github.com/Jiten20/playwright-agentic-quality-engineering-framework` |

## What was preserved

- React / Vite / Tailwind / Redux frontend
- Express / TypeScript API
- PostgreSQL + Sequelize
- Redis + BullMQ
- Test executor worker (clone → install → run → parse)
- JWT + API key auth
- Stripe billing routes
- GitHub inbound webhooks and outbound run webhooks
- Docker Compose and Terraform foundation
- Multi-framework execution (Playwright first-class for AI; Cypress, Selenium, pytest, TestNG, Jest, Mocha still supported for execution)

## Product identity

| Before | After |
|--------|--------|
| Repository → run tests → view results | Requirement → explore → plan → validate → approve → generate → execute → heal → report |

## Skills map

| File | Purpose |
|------|---------|
| `skills/project-overview.md` | This file |
| `skills/architecture.md` | System design and migration matrix |
| `skills/completed-work.md` | Working functionality |
| `skills/partially-completed-work.md` | Started but incomplete |
| `skills/remaining-work.md` | Not started |
| `skills/development-workflow.md` | How to run locally |
| `skills/ai-qe-workflow.md` | End-to-end AI workflow |
| `skills/testing.md` | How tests are organized |
| `skills/deployment.md` | Docker, Terraform, migrations |
| `SKILLS.md` | Agent coding standards (kept and extended) |
