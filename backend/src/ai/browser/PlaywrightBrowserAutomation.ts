import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import {
  BrowserAction,
  ElementLocator,
  InteractiveElement,
} from '../types';
import {
  BrowserAutomationInterface,
  BrowserLaunchOptions,
  PageSnapshot,
} from './BrowserAutomationInterface';
import { isPasswordField, preferredSelector, resolvePlaywrightLocator } from './locators';
import { logger } from '../../config/logger';

type RawElement = {
  tag: string;
  role?: string | null;
  name?: string | null;
  testId?: string | null;
  type?: string | null;
  href?: string | null;
  placeholder?: string | null;
  text?: string | null;
  id?: string | null;
  disabled?: boolean;
};

export class PlaywrightBrowserAutomation implements BrowserAutomationInterface {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly actionLog: BrowserAction[] = [];
  private readonly consoles: string[] = [];
  private readonly networks: string[] = [];

  async launch(options: BrowserLaunchOptions = {}): Promise<void> {
    this.browser = await chromium.launch({
      headless: options.headless !== false,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(options.timeoutMs || 15000);
    this.page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        this.consoles.push(`${msg.type()}: ${msg.text()}`);
      }
    });
    this.page.on('response', (response) => {
      if (response.status() >= 400) {
        this.networks.push(`${response.status()} ${response.url()}`);
      }
    });
  }

  async goto(url: string): Promise<void> {
    const page = this.requirePage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      this.record({ type: 'goto', url: page.url(), result: 'ok' });
    } catch (err: any) {
      this.record({ type: 'goto', url, result: 'failed', error: err.message });
      throw err;
    }
  }

  async snapshot(): Promise<PageSnapshot> {
    const page = this.requirePage();
    const collected = (await page.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [data-test], [data-testid]'));
      const interactive = nodes.slice(0, 80).map((node) => {
        const el = node;
        const text = ((el.innerText || el.textContent || '') + '').trim().slice(0, 80);
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          name: el.getAttribute('aria-label') || el.getAttribute('name') || el.name || null,
          testId: el.getAttribute('data-testid') || el.getAttribute('data-test'),
          type: el.getAttribute('type') || el.type || null,
          href: el.getAttribute('href'),
          placeholder: el.getAttribute('placeholder'),
          text: text || null,
          id: el.id || null,
          disabled: Boolean(el.getAttribute('disabled') || el.disabled)
        };
      });
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 20);
      const text = (document.body && document.body.innerText ? document.body.innerText : '').slice(0, 4000);
      return { interactive: interactive, headings: headings, text: text };
    })()`)) as { interactive: RawElement[]; headings: string[]; text: string };

    const interactiveElements = collected.interactive.map((el) => {
      const mapped: InteractiveElement = {
        tag: el.tag,
        role: el.role || undefined,
        name: el.name || undefined,
        testId: el.testId || undefined,
        type: el.type || undefined,
        href: el.href || undefined,
        placeholder: el.placeholder || undefined,
        text: el.text || undefined,
        id: el.id || undefined,
        disabled: el.disabled,
      };
      mapped.selector = preferredSelector(mapped);
      return mapped;
    });

    const snapshot: PageSnapshot = {
      url: page.url(),
      title: await page.title(),
      headings: collected.headings,
      interactiveElements,
      text: collected.text,
    };
    this.record({
      type: 'snapshot',
      url: snapshot.url,
      result: 'ok',
      notes: `${snapshot.interactiveElements.length} controls`,
    });
    return snapshot;
  }

  async click(locator: ElementLocator): Promise<void> {
    const page = this.requirePage();
    try {
      await resolvePlaywrightLocator(page, locator).click({ timeout: 8000 });
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      this.record({ type: 'click', locator, url: page.url(), result: 'ok' });
    } catch (err: any) {
      this.record({ type: 'click', locator, url: page.url(), result: 'failed', error: err.message });
      throw err;
    }
  }

  async fill(locator: ElementLocator, value: string): Promise<void> {
    const page = this.requirePage();
    const redact = isPasswordField(locator);
    try {
      await resolvePlaywrightLocator(page, locator).fill(value, { timeout: 8000 });
      this.record({
        type: 'fill',
        locator,
        url: page.url(),
        result: 'ok',
        valueRedacted: redact,
        notes: redact ? 'value redacted' : `length=${value.length}`,
      });
    } catch (err: any) {
      this.record({
        type: 'fill',
        locator,
        url: page.url(),
        result: 'failed',
        error: err.message,
        valueRedacted: redact,
      });
      throw err;
    }
  }

  async screenshot(filePath: string): Promise<string> {
    const page = this.requirePage();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await page.screenshot({ path: filePath, fullPage: true });
    this.record({ type: 'screenshot', url: page.url(), result: 'ok', notes: filePath });
    return filePath;
  }

  currentUrl(): string {
    return this.page?.url() || '';
  }

  async title(): Promise<string> {
    return this.requirePage().title();
  }

  actions(): BrowserAction[] {
    return [...this.actionLog];
  }

  consoleMessages(): string[] {
    return [...this.consoles];
  }

  networkErrors(): string[] {
    return [...this.networks];
  }

  async close(): Promise<void> {
    try {
      await this.context?.close();
    } catch (err: any) {
      logger.debug('Browser context close failed', { error: err.message });
    }
    try {
      await this.browser?.close();
    } catch (err: any) {
      logger.debug('Browser close failed', { error: err.message });
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  private requirePage(): Page {
    if (!this.page) {
      throw new Error('Browser session is not launched');
    }
    return this.page;
  }

  private record(partial: Omit<BrowserAction, 'timestamp'>): void {
    this.actionLog.push({
      ...partial,
      timestamp: new Date().toISOString(),
    });
  }
}

export default PlaywrightBrowserAutomation;
