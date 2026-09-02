import { GeneratedFile, PlannedScenario } from '../types';
import { classifyStep, collectControls, controlForStep, toPascal } from '../generator/controls';
import { assertGeneratedSafety } from '../generator/safety';

export class CypressAdapter {
  generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
  }): GeneratedFile[] {
    const pageName = `${toPascal(input.scenario.title).slice(0, 48)}Page`;
    const specName = `${input.scenario.scenarioKey.toLowerCase()}.cy.ts`;
    const files: GeneratedFile[] = [
      {
        path: `cypress/support/${pageName}.ts`,
        content: this.page(pageName, input.scenario),
        language: 'typescript',
        kind: 'page_object',
      },
      {
        path: `cypress/e2e/${specName}`,
        content: this.spec(input, pageName),
        language: 'typescript',
        kind: 'test',
      },
      {
        path: 'cypress/support/e2e.ts',
        content: `export {};\n`,
        language: 'typescript',
        kind: 'fixture',
      },
      {
        path: 'cypress/fixtures/users.ts',
        content: `export const credentials = {\n  username: process.env.TEST_USERNAME || process.env.CYPRESS_TEST_USERNAME || '',\n  password: process.env.TEST_PASSWORD || process.env.CYPRESS_TEST_PASSWORD || '',\n};\n`,
        language: 'typescript',
        kind: 'test_data',
      },
      {
        path: 'cypress.config.ts',
        content: `import { defineConfig } from 'cypress';\n\nexport default defineConfig({\n  e2e: {\n    baseUrl: process.env.APP_URL || '${input.applicationUrl || ''}',\n    specPattern: 'cypress/e2e/**/*.cy.ts',\n  },\n});\n`,
        language: 'typescript',
        kind: 'config',
      },
    ];
    assertGeneratedSafety(files);
    return files;
  }

  private page(pageName: string, scenario: PlannedScenario): string {
    const controls = collectControls(scenario);
    const body = scenario.steps.map((step) => {
      const kind = classifyStep(step);
      const control = controlForStep(step, controls);
      if (kind === 'navigate') return '    cy.visit(\'/\');';
      if (!control) return `    // ${step.action}`;
      const sel = control.kind === 'testid'
        ? `[data-testid="${control.value}"], [data-test="${control.value}"]`
        : control.value;
      if (kind === 'fill') return `    cy.get('${sel}').clear().type(value);`;
      if (kind === 'click') return `    cy.get('${sel}').click();`;
      return `    cy.contains('${control.value.replace(/'/g, "\\'")}');`;
    }).join('\n');
    return `export const ${pageName} = {\n  run(value = '') {\n${body}\n  },\n};\n`;
  }

  private spec(
    input: { requirementKey: string; scenario: PlannedScenario },
    pageName: string
  ): string {
    return `import { ${pageName} } from '../support/${pageName}';\nimport { credentials } from '../fixtures/users';\n\ndescribe('${input.requirementKey} ${input.scenario.title}', () => {\n  it('${input.scenario.title}', () => {\n    ${pageName}.run(credentials.username);\n  });\n});\n`;
  }
}
