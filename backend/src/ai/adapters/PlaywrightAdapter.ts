import { GeneratedFile, PlannedScenario, RepoInventory } from '../types';

const toPascal = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

export class PlaywrightAdapter {
  generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
    inventory?: RepoInventory | null;
  }): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const inventory = input.inventory;
    const testDir = inventory?.testDir || 'tests/generated';
    const pagesDir = inventory?.pagesDir || 'pages';
    const pageName = `${toPascal(input.scenario.title).slice(0, 40) || 'Generated'}Page`;
    const specName = `${input.scenario.scenarioKey.toLowerCase()}.spec.ts`;
    const reusePages = inventory?.existingPages?.length ? inventory.existingPages : [];

    const pageObject = this.pageObject(pageName, input.scenario, input.applicationUrl);
    const spec = this.spec({
      requirementKey: input.requirementKey,
      requirementTitle: input.requirementTitle,
      scenario: input.scenario,
      pageName,
      applicationUrl: input.applicationUrl,
      reusePages,
    });

    files.push({
      path: `${pagesDir}/${pageName}.ts`,
      content: pageObject,
      language: 'typescript',
      kind: 'page_object',
    });
    files.push({
      path: `${testDir}/${specName}`,
      content: spec,
      language: 'typescript',
      kind: 'test',
    });

    if (!inventory?.existingFixtures?.length) {
      files.push({
        path: 'fixtures/baseTest.ts',
        content: this.fixture(pageName, pagesDir),
        language: 'typescript',
        kind: 'fixture',
      });
    }

    return files;
  }

  private pageObject(pageName: string, scenario: PlannedScenario, applicationUrl?: string | null): string {
    const locators = scenario.steps
      .filter((step) => step.target)
      .map((step) => {
        const field = toPascal(step.target || 'control');
        const target = step.target || '';
        const locator = /[#.\[:]/.test(target)
          ? `page.locator('${target.replace(/'/g, "\\'")}')`
          : `page.getByRole('button', { name: /${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i }).or(page.getByLabel(/${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)).or(page.getByTestId('${target}'))`;
        return `  readonly ${field}Control;`;
      });

    const uniqueLocators = [...new Set(locators)];

    return `import { Page, expect } from '@playwright/test';

export class ${pageName} {
  constructor(private readonly page: Page) {}
${uniqueLocators.length ? `\n${uniqueLocators.join('\n')}\n` : ''}
  async open(): Promise<void> {
    await this.page.goto(process.env.APP_URL || '${applicationUrl || '/'}');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/.+/);
  }
}
`;
  }

  private spec(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    pageName: string;
    applicationUrl?: string | null;
    reusePages: string[];
  }): string {
    const steps = input.scenario.steps
      .map(
        (step) => `    await test.step('${step.action.replace(/'/g, "\\'")}', async () => {
      ${this.stepBody(step, input.applicationUrl)}
    });`
      )
      .join('\n\n');

    return `import { test, expect } from '@playwright/test';
import { ${input.pageName} } from '../../pages/${input.pageName}';

// spec: ${input.requirementKey}
// scenario: ${input.scenario.scenarioKey}

test.describe('${input.requirementTitle.replace(/'/g, "\\'")}', () => {
  test('${input.scenario.title.replace(/'/g, "\\'")}', {
    tag: ['@generated', '@${input.requirementKey}', '@${input.scenario.scenarioKey}'],
    annotation: {
      type: 'requirement',
      description: '${input.requirementKey} — ${input.requirementTitle.replace(/'/g, "\\'")}'
    }
  }, async ({ page }) => {
    const app = new ${input.pageName}(page);
    await app.open();
    await app.expectLoaded();

${steps}

    await expect(page).not.toHaveTitle(/error/i);
  });
});
`;
  }

  private stepBody(step: { action: string; target?: string; expected?: string }, applicationUrl?: string | null): string {
    const action = step.action.toLowerCase();
    if (action.startsWith('open') || action.includes('navigate')) {
      return `await page.goto(process.env.APP_URL || '${applicationUrl || '/'}');`;
    }
    if (step.target && (action.includes('enter') || action.includes('type') || action.includes('fill'))) {
      const value = action.includes('password') ? "process.env.TEST_PASSWORD || ''" : "process.env.TEST_USERNAME || ''";
      return `await page.getByLabel(/${(step.target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i).or(page.getByPlaceholder(/${(step.target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)).or(page.getByTestId('${step.target}')).fill(${value});`;
    }
    if (step.target && (action.includes('click') || action.includes('submit') || action.includes('activate'))) {
      return `await page.getByRole('button', { name: /${(step.target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i }).or(page.getByText(/${(step.target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)).or(page.getByTestId('${step.target}')).click();`;
    }
    if (step.expected || action.startsWith('verify')) {
      const expected = (step.expected || step.action).replace(/'/g, "\\'");
      return `await expect(page.getByText(/${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i)).toBeVisible();`;
    }
    return `await expect(page.locator('body')).toBeVisible();`;
  }

  private fixture(pageName: string, pagesDir: string): string {
    return `import { test as base } from '@playwright/test';
import { ${pageName} } from '../${pagesDir}/${pageName}';

export const test = base.extend<{ app: ${pageName} }>({
  app: async ({ page }, use) => {
    await use(new ${pageName}(page));
  },
});

export { expect } from '@playwright/test';
`;
  }
}
