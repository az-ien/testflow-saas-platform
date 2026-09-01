import { PlaywrightAdapter } from './PlaywrightAdapter';

export type FrameworkAdapter = PlaywrightAdapter;

export const getFrameworkAdapter = (_framework?: string): PlaywrightAdapter => {
  // Playwright is the first-class agentic framework. Additional adapters can be added later.
  return new PlaywrightAdapter();
};

export { PlaywrightAdapter };
