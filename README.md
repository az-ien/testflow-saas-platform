# TestFlow — Test Execution SaaS Platform

> Run Playwright, Cypress, Selenium, pytest, and TestNG tests from **any repo** via a single API call. View results in a live dashboard.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)

---

## ✨ Features

- **Multi-Framework Support** — Playwright, Cypress, Jest, Mocha, pytest, TestNG, Selenium
- **Any Repo, Any Language** — Connect GitHub, GitLab, Bitbucket, or Azure DevOps repos
- **API-First** — Trigger test runs via REST API with a single `X-API-Key` header
- **Live Dashboard** — Real-time pass/fail charts, execution logs, and trend analytics
- **Webhook Notifications** — Receive signed callbacks when runs complete
- **GitHub/GitLab Triggers** — Auto-run tests on push or pull request events
- **Stripe Billing** — Subscription tiers with usage-based limits
- **Scalable Workers** — BullMQ job queue with configurable parallelism
- **S3 Artifacts** — Screenshots, videos, and HTML reports stored in the cloud
- **Terraform IaC** — One-command AWS deployment (VPC, RDS, S3)

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
                                              │  Upload S3   │
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

## 🧪 Supported Frameworks

| Framework   | Language   | Test Command                                    |
|-------------|------------|-------------------------------------------------|
| Playwright  | JS/TS      | `npx playwright test --reporter=json`           |
| Cypress     | JS/TS      | `npx cypress run --reporter json`               |
| Jest        | JS/TS      | `npx jest --json`                               |
| Mocha       | JS/TS      | `npx mocha --reporter json`                     |
| pytest      | Python     | `python -m pytest --json-report`                |
| TestNG      | Java       | `mvn test`                                      |
| Selenium    | Multi      | `mvn test` / `pytest`                           |

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
| Auth           | JWT + API Key dual auth, bcrypt                 |
| Database       | PostgreSQL 15, Sequelize ORM                    |
| Cache & Queue  | Redis 7, BullMQ                                 |
| Test Workers   | Playwright (Chromium), Docker containers        |
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

### Deploy Services

Deploy the backend, frontend, and workers to ECS, EKS, or any Docker-compatible host. Point the environment variables to the Terraform outputs (RDS endpoint, S3 bucket name).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: add new feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © TestFlow
