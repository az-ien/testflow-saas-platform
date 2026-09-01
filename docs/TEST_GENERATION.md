# Test generation

This document describes the **current** generator and the target engine. Phase 7 is not complete.

## Current behavior (honest)

`GeneratorService` + `PlaywrightAdapter` produce Playwright-like TypeScript **stored in `generated_tests.files` JSONB**.

Typical paths inside that JSON:

```text
pages/<Name>Page.ts
tests/generated/<scenario-key>.spec.ts
fixtures/baseTest.ts
```

That is a useful shape. It is **not** yet:

- written to an isolated workspace
- compiled with `tsc` / Playwright
- executed as the generated files
- guaranteed to use only selectors discovered during exploration

“Generated successfully” currently means “a database row was created.” It does not mean COMPILES, EXECUTED, PASSED, or FAILED.

Executing a generated test still clones the **customer repository** and runs that repo’s existing tests.

## Target (Phase 7–8)

```text
Approved scenario
        ↓
Write pages/, fixtures/, test-data/, tests/ into a workspace
        ↓
Validate syntax
        ↓
Run Playwright against those files
        ↓
Store GENERATED / COMPILES / EXECUTED / PASSED / FAILED separately
```

Selectors and URLs must come from exploration evidence. No invented workflows.

## Safety

- Generation runs only for approved scenarios.
- UNSUPPORTED scenarios cannot be approved for generation.
- Never commit generated files to `main`.
