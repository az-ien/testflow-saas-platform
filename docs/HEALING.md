# Healing

This document describes the **current** healer and the target engine. Phases 10–11 are not complete.

## Current behavior (honest)

`HealerService` classifies a failed run from error text, logs, and optional screenshot/video paths. It does **not** reopen a browser or re-run the test to verify a patch.

Categories today: `locator`, `timing`, `assertion`, `application_bug`, `test_data`, `environment`, `unknown`.

`preserveAssertions` is always true in the proposal object. There is not yet an automated check that a proposed file diff actually preserves assertions.

Approved healing may open a **feature-branch** pull request. It never writes to `main`.

## Target (Phases 10–11)

```text
Test fails
        ↓
Reproduce in a real browser (BrowserAutomationInterface)
        ↓
Inspect page + DOM
        ↓
Classify:
  1. Test defect
  2. Application defect
  3. Selector change
  4. Timing/wait issue
  5. Environment issue
  6. Data issue
  7. Unknown
        ↓
Propose a minimal patch in an isolated workspace
        ↓
Rerun the same test
        ↓
Require human approval before any repository change
```

## Critical safety rule

The healer must never “fix” a test by:

- Removing assertions
- Weakening assertions
- Removing important steps
- Changing expected behavior only to make the test pass
- Silently deleting coverage
