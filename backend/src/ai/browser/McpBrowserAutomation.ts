import { BrowserAction, ElementLocator } from '../types';
import {
  BrowserAutomationInterface,
  BrowserLaunchOptions,
  PageSnapshot,
} from './BrowserAutomationInterface';

/**
 * MCP-backed browser automation is intentionally not a production path.
 * TestFlow is a multi-tenant SaaS; an IDE Playwright Test MCP
 * server is not equivalent to a pooled worker browser.
 *
 * Isolate the capability here instead of pretending stdio MCP works.
 */
export class McpBrowserAutomation implements BrowserAutomationInterface {
  private fail(): never {
    throw new Error(
      'MCP browser automation is not implemented as a production backend. ' +
        'Use PlaywrightBrowserAutomation (BROWSER_AUTOMATION_BACKEND=playwright). ' +
        'PlaywrightMcpClient remains an experimental stdio adapter only.'
    );
  }

  async launch(_options?: BrowserLaunchOptions): Promise<void> {
    this.fail();
  }

  async goto(_url: string): Promise<void> {
    this.fail();
  }

  async snapshot(): Promise<PageSnapshot> {
    this.fail();
  }

  async click(_locator: ElementLocator): Promise<void> {
    this.fail();
  }

  async fill(_locator: ElementLocator, _value: string): Promise<void> {
    this.fail();
  }

  async screenshot(_filePath: string): Promise<string> {
    this.fail();
  }

  currentUrl(): string {
    this.fail();
  }

  async title(): Promise<string> {
    this.fail();
  }

  actions(): BrowserAction[] {
    return [];
  }

  consoleMessages(): string[] {
    return [];
  }

  networkErrors(): string[] {
    return [];
  }

  async close(): Promise<void> {
    return;
  }
}

export default McpBrowserAutomation;
