import { BrowserAutomationInterface } from './BrowserAutomationInterface';
import { PlaywrightBrowserAutomation } from './PlaywrightBrowserAutomation';
import { McpBrowserAutomation } from './McpBrowserAutomation';

export type BrowserBackend = 'playwright' | 'mcp';

export const resolveBrowserBackend = (explicit?: BrowserBackend): BrowserBackend => {
  if (explicit) return explicit;
  const env = (process.env.BROWSER_AUTOMATION_BACKEND || 'playwright').toLowerCase();
  return env === 'mcp' ? 'mcp' : 'playwright';
};

/**
 * Agents depend on BrowserAutomationInterface, not a specific MCP or Playwright type.
 * Default is direct Playwright. MCP is an explicit, currently unimplemented backend.
 */
export const createBrowserAutomation = (explicit?: BrowserBackend): BrowserAutomationInterface => {
  const backend = resolveBrowserBackend(explicit);
  if (backend === 'mcp') {
    return new McpBrowserAutomation();
  }
  return new PlaywrightBrowserAutomation();
};
