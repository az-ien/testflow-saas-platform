import { GeneratedFile, PlannedScenario } from '../types';
import { classifyStep, collectControls, controlForStep } from '../generator/controls';
import { assertGeneratedSafety } from '../generator/safety';

const snake = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export class PytestAdapter {
  generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
  }): GeneratedFile[] {
    const files: GeneratedFile[] = [
      {
        path: 'pages/app_page.py',
        content: this.page(input),
        language: 'python',
        kind: 'page_object',
      },
      {
        path: `tests/test_${snake(input.scenario.scenarioKey)}.py`,
        content: this.spec(input),
        language: 'python',
        kind: 'test',
      },
      {
        path: 'conftest.py',
        content: `import pytest\nfrom playwright.sync_api import sync_playwright\n\n@pytest.fixture\ndef page():\n    with sync_playwright() as playwright:\n        browser = playwright.chromium.launch()\n        context = browser.new_context()\n        opened = context.new_page()\n        yield opened\n        context.close()\n        browser.close()\n`,
        language: 'python',
        kind: 'fixture',
      },
      {
        path: 'test_data/users.py',
        content: `import os\n\nUSERNAME = os.environ.get('TEST_USERNAME', '')\nPASSWORD = os.environ.get('TEST_PASSWORD', '')\n`,
        language: 'python',
        kind: 'test_data',
      },
      {
        path: 'pytest.ini',
        content: `[pytest]\naddopts = -q\ntestpaths = tests\n`,
        language: 'ini',
        kind: 'config',
      },
    ];
    assertGeneratedSafety(files);
    return files;
  }

  private page(input: { scenario: PlannedScenario; applicationUrl?: string | null }): string {
    const lines = [
      'from playwright.sync_api import Page',
      '',
      'class AppPage:',
      '    def __init__(self, page: Page):',
      '        self.page = page',
      '',
      '    def open(self):',
      `        self.page.goto("${input.applicationUrl || ''}")`,
    ];
    for (const step of input.scenario.steps) {
      const control = controlForStep(step, collectControls(input.scenario));
      const kind = classifyStep(step);
      if (!control || kind === 'navigate') continue;
      const name = snake(control.value);
      const sel = control.kind === 'testid' ? `[data-testid="${control.value}"]` : control.value;
      if (kind === 'fill') {
        lines.push(`    def fill_${name}(self, value: str):`);
        lines.push(`        self.page.locator(${JSON.stringify(sel)}).fill(value)`);
      } else if (kind === 'click') {
        lines.push(`    def click_${name}(self):`);
        lines.push(`        self.page.locator(${JSON.stringify(sel)}).click()`);
      }
    }
    return `${lines.join('\n')}\n`;
  }

  private spec(input: { requirementKey: string; scenario: PlannedScenario; applicationUrl?: string | null }): string {
    return `from pages.app_page import AppPage\nfrom test_data.users import USERNAME, PASSWORD\n\ndef test_${snake(input.scenario.scenarioKey)}(page):\n    app = AppPage(page)\n    app.open()\n    if USERNAME:\n        page.get_by_test_id("username").fill(USERNAME)\n    if PASSWORD:\n        page.get_by_test_id("password").fill(PASSWORD)\n`;
  }
}
