import { GeneratedFile, PlannedScenario, RepoInventory } from '../types';
import { PlaywrightAdapter } from './PlaywrightAdapter';
import { CypressAdapter } from './CypressAdapter';
import { PytestAdapter } from './PytestAdapter';

export interface FrameworkGenerator {
  generate(input: {
    requirementKey: string;
    requirementTitle: string;
    scenario: PlannedScenario;
    applicationUrl?: string | null;
    inventory?: RepoInventory | null;
  }): GeneratedFile[];
}

export const getFrameworkAdapter = (framework?: string): FrameworkGenerator => {
  const name = (framework || 'playwright').toLowerCase();
  if (name === 'cypress') return new CypressAdapter();
  if (name === 'pytest' || name === 'selenium') return new PytestAdapter();
  return new PlaywrightAdapter();
};

export { PlaywrightAdapter, CypressAdapter, PytestAdapter };
