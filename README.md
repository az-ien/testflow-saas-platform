# TestFlow — Test Execution SaaS Platform

> Run Playwright, Cypress, Selenium, pytest, TestNG, Jest, and Mocha tests from public or private external repositories via a single API call. View results in a live dashboard.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)

---

## ✨ Features

- **Multi-Framework Support** — Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium
- **External Test Repos** — Connect GitHub, GitLab, Bitbucket, or Azure DevOps repos; TestFlow does not require tests to live in this app
- **API-First** — Trigger test runs via REST API with a single `X-API-Key` header
- **Live Dashboard** — Real-time pass/fail charts, execution logs, and trend analytics
- **Webhook Notifications** — Receive signed callbacks when runs complete
- **GitHub Webhook Triggers** — Auto-run tests on GitHub push or pull request events
- **Stripe Billing** — Subscription tiers with usage-based limits
- **Scalable Workers** — BullMQ job queue with configurable parallelism
- **Artifact Detection** — Workers detect framework reports and expose run logs/results
- **Terraform IaC Foundation** — AWS VPC, RDS PostgreSQL, and S3 bucket provisioning

---

## Implementation Status

### Implemented

- Docker Compose local stack for frontend, backend, PostgreSQL, Redis, worker, and optional debug tools
- JWT and API key authentication
- Project and test-run APIs
- BullMQ-backed worker execution for Playwright, Cypress, Jest, Mocha, pytest, TestNG, and Selenium-style projects
- GitHub inbound webhook route for push and pull request events
- Outbound signed run webhooks
- Stripe checkout, billing portal, and subscription routes
- Stripe webhook signature verification with raw-body parsing and subscription metadata handling
- Sequelize CLI production migration config and initial schema migration
- Terraform foundation for AWS VPC, RDS PostgreSQL, S3 artifact bucket, and security groups

### Planned or Partially Implemented

- S3 artifact uploads: report directories are detected by the worker, but uploading to S3 and returning report URLs is still pending.
- GitLab, Bitbucket, and Azure DevOps inbound trigger routes: these providers are accepted as project metadata, but only GitHub webhook triggers are currently implemented.
- Terraform Redis/compute deployment: Redis/ElastiCache, ECS/EKS, load balancers, and service deployment are not provisioned by the current Terraform module.
- Python `pyproject.toml` dependency installation: the worker detects Python repositories, but full `pyproject.toml` package-manager support still needs to be wired in.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Backend API  │────▶│   Redis + Queue │
│  React/Vite  │     │  Express/TS    │     │   BullMQ        │
│  Port 3000   │     │  Port 5000     │     │   Port 6379     │
└─────────────┘     └────────────────┘     └────────┬────────┘
                            │                        │
                     ┌──────▼──────┐          ┌──────▼──────┐
                     │  PostgreSQL │          │   Worker(s)  │
                     │  Port 5432  │          │  Clone repo  │
                     └─────────────┘          │  Run tests   │
                                              │  Parse JSON  │
                                              │  Reports TBD │
                                              └──────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended)
- Or: Node.js ≥ 20, PostgreSQL 15, Redis 7

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/testflow-saas-platform.git
cd testflow-saas-platform
cp .env.example .env
# Edit .env with your own secrets (JWT_SECRET, Stripe keys, etc.)
```

### 2. Start with Docker Compose

```bash
docker compose up -d
```

This starts:
| Service    | URL                      |
|------------|--------------------------|
| Frontend   | http://localhost:3000     |
| Backend    | http://localhost:5000     |
| PostgreSQL | localhost:5432            |
| Redis      | localhost:6379            |

### 3. Start Debug Tools (optional)

```bash
docker compose --profile debug up -d
```
- PgAdmin → http://localhost:5050
- Redis Commander → http://localhost:8081
- Mailhog → http://localhost:8025

### 4. Local Development (without Docker)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Worker (separate terminal)
cd workers/test-executor && npm install && npm run dev
```

---

## 🔌 API Usage

### Authenticate

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"securepass","firstName":"John","lastName":"Doe"}'

# Login → returns accessToken + apiKey
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"securepass"}'
```

### Create a Project

```bash
curl -X POST http://localhost:5000/api/projects \
  -H "X-API-Key: tf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Playwright Tests",
    "repoUrl": "https://github.com/user/playwright-tests",
    "repoProvider": "github",
    "framework": "playwright",
    "repoBranch": "main",
    "testPattern": "tests/**/*.spec.ts",
    "repoAccessToken": "ghp_xxxxx"
  }'
```

### Trigger a Test Run

```bash
curl -X POST http://localhost:5000/api/runs \
  -H "X-API-Key: tf_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "uuid-from-above", "branch": "main"}'

# Response:
# { "runId": "...", "status": "queued", "estimatedStart": "within 30 seconds" }
```

### Get Results

```bash
curl http://localhost:5000/api/runs/{runId} \
  -H "X-API-Key: tf_your_api_key_here"

# Response includes: status, summary, individual test results, logs, report URL
```

---

## 🧪 External Test Execution

TestFlow is an orchestration service. It does not keep its own product test suite inside this repository. Each project points to an external repository, and each run clones that repository into an isolated temporary worker directory, installs dependencies from the repo manifest, runs the configured framework, parses machine-readable results, then removes the workspace.

Supported dependency manifests:

| Ecosystem | Supported manifests |
|-----------|---------------------|
| Node.js   | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, or `package.json` |
| Python    | `requirements.txt` repositories; `pyproject.toml` detection exists, but full dependency installation support is planned |
| Java      | `pom.xml` via Maven |

Supported frameworks:

| Framework  | Language | Worker command | Parsed report |
|------------|----------|----------------|---------------|
| Playwright | JS/TS or Python | JS/TS: `npx playwright test <testPattern> --reporter=json`; Python: `python3 -m pytest <testPattern> --json-report` | JS/TS: `test-results/playwright-results.json`; Python: `test-results/pytest-results.json` |
| Cypress    | JS/TS    | `npx cypress run --spec <testPattern> --reporter junit` | `test-results/cypress-*.xml` |
| Jest       | JS/TS    | `npx jest <testPattern> --json --outputFile=test-results/jest-results.json` | `test-results/jest-results.json` |
| Mocha      | JS/TS    | `npx mocha <testPattern> --reporter json` | `test-results/mocha-results.json` |
| pytest     | Python   | `python3 -m pytest <testPattern> --json-report` | `test-results/pytest-results.json` |
| TestNG     | Java     | `mvn -B test -Dsurefire.useFile=true` | `target/surefire-reports/*.xml` |
| Selenium   | Multi    | Maven, `npm test`, or pytest depending on the repo manifest | JUnit XML or pytest JSON |

`testPattern` is optional. If omitted, the framework's native discovery behavior is used. For public repositories, leave `repoAccessToken` empty. Private repositories can provide `repoAccessToken`, which the worker injects into the clone URL for that run.

---

## 💰 Pricing Tiers

| Plan       | Price     | Runs/month | Parallel Runners |
|------------|-----------|------------|------------------|
| Free       | $0        | 50         | 1                |
| Starter    | $29/mo    | 500        | 2                |
| Pro        | $99/mo    | 5,000      | 5                |
| Business   | $299/mo   | 25,000     | 20               |
| Enterprise | Custom    | Unlimited  | 50+              |

---

## 🛠️ Tech Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| Frontend       | React 18, Vite, Tailwind CSS, Redux Toolkit, Recharts |
| Backend API    | Node.js, Express, TypeScript                    |
| Auth           | JWT + API Key dual auth, bcryptjs                |
| Database       | PostgreSQL 15, Sequelize ORM                    |
| Cache & Queue  | Redis 7, BullMQ                                 |
| Test Workers   | Docker workers with Node.js, Playwright Chromium, Python/pytest, Java 17, and Maven |
| Billing        | Stripe (Checkout + Billing Portal)              |
| Monitoring     | Sentry, Winston logging with rotation           |
| Infrastructure | Terraform (AWS VPC, RDS, S3)                    |
| Containers     | Docker, Docker Compose                          |

---

## 📁 Project Structure

```
testflow-saas-platform/
├── backend/                    # Express API server
│   ├── src/
│   │   ├── app.ts              # Entry point
│   │   ├── config/             # DB, Redis, Logger
│   │   ├── middleware/         # Auth, Error handling
│   │   ├── models/             # Sequelize models
│   │   ├── routes/             # REST endpoints
│   │   └── services/           # Business logic
│   ├── config/                 # Sequelize CLI config
│   ├── migrations/             # Production database migrations
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # React dashboard
│   ├── src/
│   │   ├── App.tsx             # Router
│   │   ├── features/           # Redux slices
│   │   ├── layouts/            # Dashboard layout
│   │   ├── pages/              # All pages
│   │   └── services/           # API client
│   ├── Dockerfile
│   └── package.json
├── workers/
│   └── test-executor/          # BullMQ worker
│       ├── src/
│       │   ├── worker.ts       # Job processor
│       │   ├── TestExecutor.ts # Clone → Install → Run → Parse
│       │   └── WebhookNotifier.ts
│       ├── Dockerfile
│       └── package.json
├── terraform/                  # AWS infrastructure
│   ├── main.tf
│   └── variables.tf
├── SKILLS.md                   # AI agent standards & implementation tracker
├── .env.example                # All configuration variables
├── .gitignore
├── docker-compose.yml          # Full local stack
└── README.md
```

---

## 🔗 Webhook Integration

Configure a `webhookUrl` on your project. TestFlow sends signed POST requests on:

| Event            | When                        |
|------------------|-----------------------------|
| `run.started`    | Worker picks up the job     |
| `run.status`     | Status changes (cloning → installing → running) |
| `run.completed`  | Tests finished (passed/failed) |
| `run.error`      | Unrecoverable error         |

Verify signatures with the `X-TestFlow-Signature` header (HMAC-SHA256).

---

## 🚢 Production Deployment

### AWS with Terraform

```bash
cd terraform
terraform init
terraform plan -var="db_password=YOUR_SECURE_PASSWORD"
terraform apply
```

This creates: VPC, 2 public + 2 private subnets, RDS PostgreSQL 15, S3 bucket, security groups.

### Run Database Migrations

```bash
cd backend
NODE_ENV=production npm run migrate
```

Run migrations after setting the production database environment variables and before starting the API service.

### Deploy Services

Deploy the backend, frontend, workers, and Redis to ECS, EKS, or any Docker-compatible host. Point the environment variables to the Terraform outputs (RDS endpoint, S3 bucket name). The current Terraform module provisions the AWS foundation only; service orchestration is still a separate deployment step.

---

## 🤝 Contributing

> **AI Agents:** Before making any changes, read `SKILLS.md` in the project root. After making changes, update its Implementation Tracker (§6) and Change Log (§7).

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: add new feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © TestFlow
