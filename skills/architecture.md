# Architecture

## Runtime topology

```text
Frontend (React / Vite :3000)
        ↓
Backend API (Express / TS :5000)
        ↓
 PostgreSQL          Redis / BullMQ
        ↓                    ↓
                  ┌──────────┴──────────┐
                  │                     │
            AI worker             Test worker
         planner/validator       clone/install
         generator/healer        run/parse
         Playwright explorer     artifacts detect
```

## AI QE core

```text
backend/src/ai/
  planner/PlannerService.ts
  validator/ValidatorService.ts
  generator/GeneratorService.ts
  healer/HealerService.ts
  adapters/PlaywrightAdapter.ts
  providers/   heuristic | openai | anthropic
  browser/     BrowserAutomationInterface, Playwright backend, explorer

backend/src/mcp/playwright/
  PlaywrightExplorer.ts      # re-export of the explorer agent
  PlaywrightMcpClient.ts     # experimental stdio MCP — not the default backend
  EvidenceCollector.ts
```

AI providers are configurable via `AI_PROVIDER`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`. If no key is set, the **heuristic provider** still produces evidence-based plans and deterministic Playwright output so the workflow can run in development and CI.

## Workflow jobs (BullMQ queue `ai-workflow`)

| Job | Responsibility |
|-----|----------------|
| `EXPLORE_APPLICATION` | Playwright exploration + evidence persistence |
| `PLAN_TEST` | Scenario generation from requirement + evidence |
| `VALIDATE_SCENARIOS` | VERIFIED / NEEDS_REVIEW / UNSUPPORTED |
| `GENERATE_TEST` | Playwright files for approved scenarios |
| `ANALYZE_FAILURE` | Healer analysis of a failed run |
| `HEAL_TEST` | Apply approved fix policy (PR, never silent main) |
| `RE_RUN_TEST` | Enqueue isolated execution on `test-runs` |

`WAIT_FOR_APPROVAL` is a **plan/healing status**, not a processor. The chain stops until a human decision.

Existing queue `test-runs` is unchanged and remains the execution infrastructure.

## Traceability model

```text
User
 └─ Project
     └─ Requirement
         └─ TestPlan
             └─ Scenario
                 ├─ ScenarioEvidence
                 ├─ ScenarioValidation
                 ├─ Approval
                 └─ GeneratedTest
                     └─ TestRun
                         └─ HealingAttempt
```

Every AI write is also recorded in `ai_activities` and `workflow_jobs` with `userId`, `projectId`, and `correlationId`.

## Isolation

- API queries always filter `userId` from the authenticated principal.
- `getOwnedProject` / `assertOwned` reject cross-user access.
- AI processors re-check `userId` + `projectId` before mutating.
- Explorer workspaces and screenshots are stored under `{ARTIFACT_DIR}/{userId}/{projectId}/{correlationId}`.
- Customer repos are still cloned into `tmpdir/testflow-{runId}` and deleted after the run.
- Generated code is stored in the database. Opening a GitHub PR requires an explicit action and a repo token. Default branch writes are not performed.

## Migration matrix

| Component | Current state before this change | Status | Action | Reason |
|-----------|----------------------------------|--------|--------|--------|
| React dashboard | Execution-centric nav | DONE, then MODIFY | MODIFY | Keep stack, change IA to AI QE |
| Express API | Auth, projects, runs, billing, webhooks | DONE | KEEP + ADD | Add QE routes without replacing SaaS APIs |
| PostgreSQL / Sequelize | users, projects, test_runs, subscriptions | DONE | MODIFY | Add QE tables; keep existing entities |
| Redis / BullMQ | `test-runs` queue | DONE | KEEP + ADD | Add `ai-workflow` queue |
| Test executor worker | Multi-framework clone/run/parse | DONE | KEEP + MODIFY | On failure, enqueue `ANALYZE_FAILURE` |
| AI worker | Missing | ADD | ADD | Planner/MCP/validator/generator/healer |
| JWT + API keys | Working | DONE | KEEP | Still the auth plane |
| Stripe | Routes + webhook hardening | DONE | KEEP | Extend usage dimensions, do not remove |
| GitHub webhooks | Push/PR auto-run | DONE | KEEP + ADD | Add issue import and generated-test PRs |
| S3 artifact upload | Detect only | PARTIAL | KEEP | Still pending actual S3 upload |
| Terraform | VPC, RDS, S3 | PARTIAL | KEEP | Redis/compute still not provisioned |
| GitLab/Bitbucket inbound | Metadata only | PARTIAL | KEEP | Not required for AI QE core |
| `pyproject.toml` install | Detection only | PARTIAL | KEEP | Worker still needs package-manager wiring |
| Email verification / SendGrid | Flags only | REMAINING | KEEP | Out of AI QE core |
| Organization tenancy | User scoping only | REMAINING | KEEP | Documented; user isolation is enforced |
| Jiten20 repo files | N/A | N/A | DO NOT COPY | Concepts adapted, code not vendored |

## Important decisions

1. **Do not copy the Jiten20 repository.** Agents, POM examples, and SauceDemo tests stay as methodology, not product source.
2. **Playwright is the only first-class agentic framework.** Other frameworks remain executable through the existing worker.
3. **Heuristic fallback is required.** The product must not be a chatbot wrapper around a single vendor.
4. **Human approval is the default.** `approvalPolicy=verified_auto` can auto-mark VERIFIED scenarios, but generation still follows `autoGenerateOnApprove`.
5. **Never merge to the customer default branch.** PR creation is explicit and token-gated.
6. **Keep Sequelize.** Do not introduce another ORM.
7. **AI worker is a second backend entrypoint** compiled from `backend/src`, run on a Playwright image.
