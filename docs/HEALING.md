# Healing

Failed generated tests are reproduced in a real browser. Locator patches are checked against assertion-preservation rules, rerun in an isolated workspace, and applied only after human approval.

## Flow

```text
Generated test fails
        ↓
Reproduce with BrowserAutomationInterface (goto, snapshot, optional login)
        ↓
Classify:
  locator | timing | assertion | application_bug | test_data | environment | unknown
        ↓
If a replacement control is observed, patch locators only
        ↓
Refuse patches that drop expect() / skip the test / add waitForTimeout
        ↓
Isolation rerun of the patched workspace
        ↓
Human approval
        ↓
Apply to GeneratedTest workspace (store diff; feature-branch PR if a token exists)
        ↓
RE_RUN_TEST — verified only if that rerun passes
```

Connected-repo failures without generated files still get log + live-page classification. There is no customer-repo source patch.

## Safety

The healer must never “fix” a test by:

- Removing assertions
- Weakening assertions
- Adding `test.skip` / `test.fixme`
- Adding `waitForTimeout`
- Changing expected behaviour only to make the test pass

Approved healing stores a workspace diff. If the project has a GitHub token, TestFlow opens a **feature-branch** pull request (heal approval is git approval). Without a token, files stay in the dashboard. It never writes to `main`.
