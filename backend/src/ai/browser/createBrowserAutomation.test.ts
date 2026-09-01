import { preferredSelector, toLocator } from './locators';
import { createBrowserAutomation, resolveBrowserBackend } from './createBrowserAutomation';
import { McpBrowserAutomation } from './McpBrowserAutomation';

describe('locators and browser factory', () => {
  it('prefers data-testid / data-test selectors discovered from the DOM', () => {
    expect(preferredSelector({ tag: 'button', testId: 'login-button' })).toContain('data-testid="login-button"');
    expect(toLocator({ tag: 'input', testId: 'username', placeholder: 'Username' }).testId).toBe('username');
  });

  it('defaults the browser backend to Playwright, not MCP', () => {
    const previous = process.env.BROWSER_AUTOMATION_BACKEND;
    delete process.env.BROWSER_AUTOMATION_BACKEND;
    expect(resolveBrowserBackend()).toBe('playwright');
    expect(createBrowserAutomation().constructor.name).toBe('PlaywrightBrowserAutomation');
    if (previous === undefined) delete process.env.BROWSER_AUTOMATION_BACKEND;
    else process.env.BROWSER_AUTOMATION_BACKEND = previous;
  });

  it('does not pretend MCP automation works', async () => {
    const mcp = new McpBrowserAutomation();
    await expect(mcp.launch()).rejects.toThrow(/not implemented as a production backend/i);
  });
});
