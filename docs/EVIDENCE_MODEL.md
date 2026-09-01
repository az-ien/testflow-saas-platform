# Evidence model

Evidence is the only legitimate source of “the application can do X.” Requirements describe intent. Evidence describes what the browser actually saw.

## Storage

Table: `scenario_evidence` (Sequelize model `ScenarioEvidence`).

Scoped by `userId` + `projectId`. Optionally linked to `requirementId`, `testPlanId`, `scenarioId`, `testRunId`, `healingAttemptId`.

Payload is JSONB. Screenshots are files referenced by `artifactPath`.

## Kinds used by exploration (Phase 2)

| Kind | Meaning |
|------|---------|
| `observation` | Start URL, explorer notes, `authenticated`, `loginAttempted` |
| `url` | A reached page URL and title |
| `dom` | Visible text snapshot, headings, interactive elements (including `testId` / selector candidates) |
| `screenshot` | PNG captured from Playwright |
| `action` | Ordered browser actions (`goto`, `fill`, `click`, `snapshot`, `screenshot`) with redacted secrets |
| `console` | page console errors/warnings |
| `network` | HTTP responses ≥ 400 |

The planner reloads this set in `loadExploration()` before `PLAN_TEST`.

## Traceability target

```text
Requirement
   → Exploration
   → Evidence
   → Scenario (evidenceRefs + rationale)
   → Approval
   → Generated test (requirement tags)
   → Execution artifacts
   → Healing proposal
```

A user should be able to answer:

1. Why did TestFlow generate this test?
2. What evidence proves this workflow exists?

## Rules

- Do not persist fictional UI.
- Do not treat “we have a start URL” as proof of a control. (Validator tightening is Phase 5; the explorer already refuses to invent post-login pages.)
- Password values must not appear in `action` payloads.
- Evidence records are append-style per plan; exploration replaces plan-level rows (`scenarioId` null) before planning.

## Not yet stored (later phases)

- Playwright traces / videos from **generated** test runs
- Healer DOM snapshots after reproducing a failure
- Git diffs as first-class evidence rows
