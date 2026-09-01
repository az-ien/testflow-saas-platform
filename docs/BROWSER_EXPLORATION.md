# Browser exploration

Phase 2 of the Jiten20-depth upgrade. The explorer must observe a real UI. It must not invent pages, buttons, or workflows.

## Lifecycle

```text
EXPLORE_APPLICATION
        ↓
Launch Playwright Chromium (headless, --no-sandbox)
        ↓
Goto project/plan applicationUrl
        ↓
Snapshot DOM + interactive elements + screenshot
        ↓
If a login form is observed and TEST_USERNAME/TEST_PASSWORD (or APP_/E2E_/LOGIN_ equivalents) exist:
        fill username, fill password (redacted in the action log), click submit
        snapshot the resulting page
        ↓
Same-origin link crawl by clicking observed links (or goto if the link is not on the current page)
        ↓
Limited safe clicks (for example Add to cart / Continue) — never logout/delete
        ↓
Persist evidence, close the browser
        ↓
PLAN_TEST consumes the stored exploration
```

## Credentials

Read from `projects.environment_variables` only:

- Username: `TEST_USERNAME`, `TEST_USER`, `APP_USERNAME`, `APP_USER`, `E2E_USERNAME`, `E2E_USER`, `LOGIN_USERNAME`, `LOGIN_USER`, `PLAYWRIGHT_USERNAME`
- Password: `TEST_PASSWORD`, `APP_PASSWORD`, `E2E_PASSWORD`, `LOGIN_PASSWORD`, `PLAYWRIGHT_PASSWORD`

If a login form is visible and credentials are missing, exploration **stops at the public pages**. It records that authenticated areas were not observed. The planner must not assume they exist.

Password fill values are never written to the action log.

## Safety

- Stay on the same origin as `applicationUrl`
- Do not follow `mailto:`, `javascript:`, or external links
- Do not click logout, delete, destroy, unsubscribe, or similar controls
- One Chromium context per job
- Artifacts stored under `{ARTIFACT_DIR}/{userId}/{projectId}/{correlationId}`

## What this is not

- Not a full site crawler or security scanner
- Not Jiten20’s Copilot MCP session (`planner_setup_page` / `browser_*` tools)
- Not SauceDemo-specific. Login is detected from a password field plus username/submit controls

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `EXPLORATION_MAX_PAGES` | `6` (or `project.explorationMaxPages`) | Max captured page states |
| `EXPLORATION_TIMEOUT_MS` | `45000` | Playwright default timeout |
| `ARTIFACT_DIR` | `/tmp/testflow-artifacts` | Screenshot root |
| `BROWSER_AUTOMATION_BACKEND` | `playwright` | `mcp` is not a working production backend |

## Known limitations

- SPA routes that never change the URL are captured only when a click is classified as safe or is a same-origin link.
- File uploads, iframes, and native dialogs are not explored yet.
- Cluster-level browser sandboxing (gVisor/Firecracker) is not implemented; isolation is per-job Chromium + path prefixing.
