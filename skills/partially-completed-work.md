# Partially completed work

| Feature | Status | What works | What remains | Known issues |
|---------|--------|------------|--------------|--------------|
| Playwright MCP stdio | Isolated stub | Default exploration uses Playwright Chromium. `BROWSER_AUTOMATION_BACKEND=mcp` throws. | Not required for the SaaS path | Not an IDE MCP session |
| GitHub generated-test PR | Diff + approval + feature-branch PR | Token → approval → feature branch. No token → dashboard only. | OAuth app install, file-level review comments | Public API rate limits without a token |
| S3 artifact uploads | Sync when AWS CLI + bucket are configured | Local artifacts + authenticated download. Worker `aws s3 sync` when credentials exist. | Signed download URLs | Upload is no-op without AWS |
| Billing for AI usage | Limits + optional Stripe meters | `UsageMeter` + `STRIPE_METER_*` events | Stripe dashboard meter products | Stripe still also bills run-centric plans |
| Live LLM planning | Provider + per-project keys | OpenAI-compatible and Anthropic, project overrides | Prompt evaluation harness | Heuristic fallback without keys |
| Frontend end-to-end browser verification | Pages + Vitest unit | Navigation, import buttons, coverage totals | Playwright UI tests of the live stack | Click-through still needs Compose |
| Cluster browser sandbox | Per-job Chromium + ECS tasks | Path prefixing and Fargate isolation | gVisor/Firecracker | Not a hardened microVM |
