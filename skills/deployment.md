# Deployment

## Local

`docker compose up -d --build` starts postgres, redis, backend, frontend, test worker, and AI worker.

## Production database

```bash
cd backend
NODE_ENV=production npm run migrate
```

Migrations:

1. `20260831000000-create-initial-schema.js` — original SaaS tables
2. `20260901000000-create-ai-qe-schema.js` — AI QE tables and additive columns
3. Additive generated-test, git, org, Jira, and AI-key migrations under `backend/migrations/`

Development still uses `sequelize.sync({ alter: true })` when `NODE_ENV !== 'production'`.

## Containers

| Image | Base | Command |
|-------|------|---------|
| backend | node:20-alpine | `node dist/app.js` |
| frontend | existing frontend Dockerfile | nginx/static preview |
| test-executor | Playwright jammy | `node dist/worker.js` |
| ai-worker | Playwright jammy | `node dist/workers/aiWorker.js` |

The AI worker image copies `backend/` source so it shares models, AI services, and processors.

## Terraform

`terraform/main.tf` provisions VPC, RDS PostgreSQL 15, S3, and security groups.

`terraform/compute.tf` adds ElastiCache Redis, an ECS cluster, and Fargate task definitions/services for the API, AI worker, and test worker. Images are variables (`api_image`, `ai_worker_image`, `test_worker_image`). A public load balancer is still not included.

## Environment

See `.env.example`. New variables:

- `AI_PROVIDER`
- `OPENAI_*` / `ANTHROPIC_*`
- `PLAYWRIGHT_MCP_*`
- `ARTIFACT_DIR`
- `AI_WORKER_CONCURRENCY`
- `EXPLORATION_MAX_PAGES`
- `EXPLORATION_TIMEOUT_MS`
- `ENCRYPTION_KEY`
- `LOG_SHIP_URL`
- `STRIPE_METER_*`
