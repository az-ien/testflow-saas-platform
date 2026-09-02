export const qualityGateWorkflow = (): string => `name: TestFlow quality gate

on:
  pull_request:
  push:
    branches-ignore:
      - main
      - master
      - production
  workflow_dispatch:

jobs:
  playwright:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci || npm install
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --reporter=html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report
          if-no-files-found: ignore
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-traces
          path: test-results
          if-no-files-found: ignore
`;
