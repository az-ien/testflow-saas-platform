import { GeneratedFile, PlannedScenario, RepoInventory } from '../types';
import {
  classifyStep,
  collectControls,
  controlForStep,
  DiscoveredControl,
  fillValueExpr,
  isPasswordControl,
  isUsernameControl,
  playwrightLocatorExpr,
  toPascal,
} from '../generator/controls';
import { assertGeneratedSafety } from '../generator/safety';

export class PlaywrightAdapter {
  generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
    inventory?: RepoInventory | null;
  }): GeneratedFile[] {
    void input.inventory;
    const controls = collectControls(input.scenario);
    const pageName = `${toPascal(input.scenario.title).slice(0, 48)}Page`;
    const specName = `${input.scenario.scenarioKey.toLowerCase()}.spec.ts`;
    const usedMethods = this.usedMethods(input.scenario, controls);

    const files: GeneratedFile[] = [
      {
        path: `pages/${pageName}.ts`,
        content: this.pageObject(pageName, controls, usedMethods, input.applicationUrl),
        language: 'typescript',
        kind: 'page_object',
      },
      {
        path: `fixtures/baseTest.ts`,
        content: this.fixture(pageName),
        language: 'typescript',
        kind: 'fixture',
      },
      {
        path: `test-data/users.ts`,
        content: this.testData(),
        language: 'typescript',
        kind: 'test_data',
      },
      {
        path: `tests/${specName}`,
        content: this.spec({
          requirementKey: input.requirementKey,
          requirementTitle: input.requirementTitle,
          scenario: input.scenario,
          pageName,
          controls,
          usedMethods,
        }),
        language: 'typescript',
        kind: 'test',
      },
      {
        path: 'playwright.config.ts',
        content: this.config(input.applicationUrl),
        language: 'typescript',
        kind: 'config',
      },
    ];

    assertGeneratedSafety(files);
    return files;
  }

  private usedMethods(
    scenario: PlannedScenario,
    controls: DiscoveredControl[]
  ): Set<string> {
    const methods = new Set<string>(['open']);
    for (const step of scenario.steps) {
      const kind = classifyStep(step);
      const control = controlForStep(step, controls);
      if (kind === 'fill' && control) methods.add(`fill${toPascal(control.key)}`);
      if (kind === 'click' && control) methods.add(`click${toPascal(control.key)}`);
      if (kind === 'verify' && control) methods.add(`expect${toPascal(control.key)}Visible`);
      if (!control && /log ?in|sign in/i.test(step.action) && this.canLogin(controls)) {
        methods.add('login');
      }
    }
    return methods;
  }

  private canLogin(controls: DiscoveredControl[]): boolean {
    const hasUser = controls.some((control) => isUsernameControl(control));
    const hasPassword = controls.some((control) => isPasswordControl(control));
    const hasSubmit = controls.some((control) =>
      /login|submit|sign/i.test(`${control.key} ${control.value}`)
    );
    return hasUser && hasPassword && hasSubmit;
  }

  private pageObject(
    pageName: string,
    controls: DiscoveredControl[],
    usedMethods: Set<string>,
    applicationUrl?: string | null
  ): string {
    const fields = controls.map((control) => `  readonly ${control.key}: Locator;`);
    const assignments = controls.map(
      (control) => `    this.${control.key} = ${playwrightLocatorExpr(control)};`
    );

    const methods: string[] = [
      `  async open(): Promise<void> {
    await this.page.goto(process.env.APP_URL || process.env.BASE_URL || ${JSON.stringify(applicationUrl || '/')});
  }`,
    ];

    for (const control of controls) {
      const fillName = `fill${toPascal(control.key)}`;
      const clickName = `click${toPascal(control.key)}`;
      const expectName = `expect${toPascal(control.key)}Visible`;
      if (usedMethods.has(fillName)) {
        methods.push(`  async ${fillName}(value: string): Promise<void> {
    await this.${control.key}.fill(value);
  }`);
      }
      if (usedMethods.has(clickName)) {
        methods.push(`  async ${clickName}(): Promise<void> {
    await this.${control.key}.click();
  }`);
      }
      if (usedMethods.has(expectName)) {
        methods.push(`  async ${expectName}(): Promise<void> {
    await expect(this.${control.key}).toBeVisible();
  }`);
      }
    }

    if (usedMethods.has('login')) {
      const user = controls.find((control) => isUsernameControl(control));
      const password = controls.find((control) => isPasswordControl(control));
      const submit = controls.find((control) =>
        /login|submit|sign/i.test(`${control.key} ${control.value}`)
      );
      if (user && password && submit) {
        methods.push(`  async login(username: string, password: string): Promise<void> {
    await this.${user.key}.fill(username);
    await this.${password.key}.fill(password);
    await this.${submit.key}.click();
  }`);
      }
    }

    return `import { expect, Locator, Page } from '@playwright/test';

export class ${pageName} {
${fields.join('\n')}

  constructor(readonly page: Page) {
${assignments.join('\n')}
  }

${methods.join('\n\n')}
}
`;
  }

  private spec(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    pageName: string;
    controls: DiscoveredControl[];
    usedMethods: Set<string>;
  }): string {
    const steps = input.scenario.steps
      .map((step) => {
        const kind = classifyStep(step);
        const control = controlForStep(step, input.controls);
        let body = 'await expect(app.page.locator(\'body\')).toBeVisible();';
        if (kind === 'navigate') {
          body = 'await app.open();';
        } else if (kind === 'fill' && control) {
          body = `await app.fill${toPascal(control.key)}(${fillValueExpr(step, control)});`;
        } else if (kind === 'click' && control) {
          body = `await app.click${toPascal(control.key)}();`;
        } else if (kind === 'verify' && control) {
          body = `await app.expect${toPascal(control.key)}Visible();`;
        } else if (/log ?in|sign in/i.test(step.action) && input.usedMethods.has('login')) {
          body = 'await app.login(credentials.username, credentials.password);';
        }
        return `    await test.step(${JSON.stringify(step.action)}, async () => {
      ${body}
    });`;
      })
      .join('\n\n');

    return `import { test, expect } from '../fixtures/baseTest';
import { credentials } from '../test-data/users';

// spec: ${input.requirementKey}
// scenario: ${input.scenario.scenarioKey}

test.describe(${JSON.stringify(input.requirementTitle)}, () => {
  test(${JSON.stringify(`${input.scenario.title} @generated @${input.requirementKey} @${input.scenario.scenarioKey}`)}, async ({ app }) => {
${steps}

    await expect(app.page).not.toHaveTitle(/error/i);
  });
});
`;
  }

  private fixture(pageName: string): string {
    return `import { test as base, expect } from '@playwright/test';
import { ${pageName} } from '../pages/${pageName}';

export const test = base.extend<{ app: ${pageName} }>({
  app: async ({ page }, use) => {
    await use(new ${pageName}(page));
  },
});

export { expect };
`;
  }

  private testData(): string {
    return `export const credentials = {
  username: process.env.TEST_USERNAME || '',
  password: process.env.TEST_PASSWORD || '',
};
`;
  }

  private config(applicationUrl?: string | null): string {
    const fallback = applicationUrl || '';
    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.APP_URL || process.env.BASE_URL || ${JSON.stringify(fallback)},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  outputDir: 'test-results',
});
`;
  }
}
