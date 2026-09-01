# Test generation

Approved scenarios become a real Playwright workspace, then a compile check, then an optional run of **those** files.

## Layout

`GeneratorService` + `PlaywrightAdapter` emit:

```text
pages/<Name>Page.ts
fixtures/baseTest.ts
test-data/users.ts
tests/<scenario-key>.spec.ts
playwright.config.ts
```

Selectors come from scenario evidence (`testid:`, `selector:`, `name:`, `text:`, `id:`). Page object fields are assigned those locators and the spec calls the matching `fill` / `click` / `expectVisible` methods. Credentials are `process.env.TEST_USERNAME` and `process.env.TEST_PASSWORD` with no demo fallbacks.

## Workspace and statuses

The `GENERATE_TEST` job writes the files under:

```text
{ARTIFACT_DIR}/{userId}/{projectId}/generated-tests/{generatedTestId}/workspace
```

Then `playwright test --list` is the compile check.

| Field | Meaning |
|-------|---------|
| `status` | Lifecycle (`ready`, `pr_opened`, `executed`, …) |
| `compileStatus` | `pending` / `compiles` / `failed` |
| `executionStatus` | `pending` / `queued` / `running` / `passed` / `failed` / `error` |

`POST /api/generated-tests/:id/execute` runs the generated workspace (job `EXECUTE_GENERATED_TEST`). It does **not** clone the customer repository. Connected-repo execution remains on `POST /api/runs` and the existing test worker.

## Safety

- Generation runs only for approved scenarios.
- UNSUPPORTED scenarios cannot be approved for generation.
- Generated source must not include `waitForTimeout` or invented `.or(getByRole/getByLabel)` chains.
- Never commit generated files to `main`.
