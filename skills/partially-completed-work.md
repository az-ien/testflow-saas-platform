# Partially completed work

| Feature | Status | What works | What remains | Known issues |
|---------|--------|------------|--------------|--------------|
| Playwright MCP stdio | Isolated stub | `PlaywrightMcpClient` can spawn `npx @playwright/mcp` when enabled. Production path uses `PlaywrightBrowserAutomation`. `BROWSER_AUTOMATION_BACKEND=mcp` throws rather than faking success. | JSON-RPC handshake, per-project MCP pool, mapping to planner tools | Not an IDE MCP session |
| GitHub generated-test PR | Diff + approval + feature-branch PR | Generate/heal store `workspaceDiff`. Token → `awaiting_approval` then human publish (heal approval is git approval). No token → dashboard only. Head cannot be `main`. | OAuth app install, file-level review comments | Public GitHub API rate limits apply without a token |
| GitHub issue import | API | `POST /api/requirements/import/github` imports open issues as requirements | UI button, pagination, Jira import | Needs a GitHub repo URL on the project |
| S3 artifact uploads | Worker detects report dirs | Evidence screenshots stored on local `ARTIFACT_DIR`. Run report directories still detected. | Upload to S3, signed URLs, authenticated artifact download route | `uploadReport()` still returns `null` |
| Billing for AI usage | Limits defined | `PLAN_LIMITS` includes planning/healing/exploration. `UsageMeter` enforces them. | Stripe meters, invoices, dashboard usage charts per AI dimension | Stripe still bills the original run-centric plans |
| Secret protection | Tokens stored, not logged | Repo tokens stay in DB and are only injected into clone URLs for that job | Encrypt `repoAccessToken` and env vars at rest | Tokens are still plaintext columns |
| Organization isolation | User isolation | Every QE entity has `userId` + `projectId` and is checked | Organization / team membership model | Multi-user orgs are not a first-class entity |
| Live LLM planning | Provider wired | OpenAI-compatible and Anthropic providers implemented | Prompt evaluation harness, cost tracking, per-tenant keys | Without API keys the heuristic provider is used |
| Frontend end-to-end browser verification | Pages implemented | Navigation and forms exist for the full workflow | Automated UI tests, production visual QA | This session verified TypeScript/unit tests; browser click-through depends on local stack |
| `pyproject.toml` worker install | Detection exists | Worker detects Python repos | Full poetry/pdm/uv install | Unchanged from prior TestFlow debt |
| GitLab / Bitbucket / Azure inbound webhooks | Metadata accepted | Provider enum still accepted | Inbound trigger routes | Unchanged |
| Terraform beyond foundation | VPC/RDS/S3 | Existing module kept | Redis, compute, AI worker service | Unchanged |
