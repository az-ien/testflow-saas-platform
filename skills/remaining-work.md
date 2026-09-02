# Remaining work

These are not implemented. Do not mark them complete.

## Infrastructure that cannot be finished in application code

- Sandboxed browser sessions at the cluster level (gVisor/Firecracker). Current isolation is per-job Chromium context + path prefixing, plus optional Docker/ECS task isolation in Terraform.
- GitHub OAuth App install and inline PR review comments (needs a registered GitHub App).
- Live Stripe product meters in the Stripe dashboard (code emits meter events when `STRIPE_METER_*` is set).

## Explicitly not done / not copied

- There is **no chatbot** that generates tests from free-form chat
- Default-branch commits are **not** performed
- Demo-app page objects and hardcoded demo credentials are **not** the product source of truth
- Playwright MCP is **not** a production backend (direct Playwright is)
