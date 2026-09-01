import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger';
import { ExplorationResult, ExploredPage, InteractiveElement } from '../types';
import { BrowserAutomationInterface, emptyExploredPage } from './BrowserAutomationInterface';
import { createBrowserAutomation } from './createBrowserAutomation';
import { ExploreCredentials, hasExploreCredentials } from './credentials';
import { toLocator } from './locators';
import {
  findLoginForm,
  navigationTargets,
  normalizeUrl,
  safeExploreClicks,
} from './explorationPolicy';

export interface ExploreOptions {
  startUrl: string;
  maxPages?: number;
  timeoutMs?: number;
  artifactDir?: string;
  projectId: string;
  userId: string;
  correlationId: string;
  credentials?: ExploreCredentials;
}

const emptyResult = (startUrl: string): ExplorationResult => ({
  startUrl,
  pages: [],
  observations: [],
  consoleMessages: [],
  networkErrors: [],
  actionLog: [],
  authenticated: false,
  loginAttempted: false,
});

export class PlaywrightExplorer {
  constructor(
    private readonly createBrowser: () => BrowserAutomationInterface = createBrowserAutomation
  ) {}

  async explore(options: ExploreOptions): Promise<ExplorationResult> {
    const maxPages = options.maxPages || parseInt(process.env.EXPLORATION_MAX_PAGES || '6', 10);
    const timeout = options.timeoutMs || parseInt(process.env.EXPLORATION_TIMEOUT_MS || '45000', 10);
    const result = emptyResult(options.startUrl);
    const visited = new Set<string>();
    const browser = this.createBrowser();

    try {
      await browser.launch({ timeoutMs: timeout, headless: true });
      await browser.goto(options.startUrl);
      await this.captureCurrent(browser, options, result, visited, 'goto');

      await this.maybeLogin(browser, options, result, visited);

      await this.interactAndCrawl(browser, options, result, visited, maxPages);
    } catch (err: any) {
      logger.warn('Playwright exploration failed', { error: err.message, url: options.startUrl });
      result.error = err.message;
      result.observations.push(`Exploration failed: ${err.message}`);
    } finally {
      result.actionLog = browser.actions();
      result.consoleMessages = browser.consoleMessages();
      result.networkErrors = browser.networkErrors();
      await browser.close();
    }

    return result;
  }

  private async maybeLogin(
    browser: BrowserAutomationInterface,
    options: ExploreOptions,
    result: ExplorationResult,
    visited: Set<string>
  ): Promise<void> {
    const current = result.pages[result.pages.length - 1];
    if (!current) return;
    const form = findLoginForm(current.interactiveElements);
    if (!form) return;

    if (!hasExploreCredentials(options.credentials)) {
      result.observations.push(
        'Login form observed; credentials were not provided so authenticated pages were not explored.'
      );
      return;
    }

    result.loginAttempted = true;
    try {
      if (form.username) {
        await browser.fill(toLocator(form.username), options.credentials!.username!);
      }
      await browser.fill(toLocator(form.password), options.credentials!.password!);
      if (form.submit) {
        await browser.click(toLocator(form.submit));
      } else {
        result.observations.push('Login form observed but no submit control was found.');
        return;
      }
      await this.captureCurrent(browser, options, result, visited, 'click', true);
      const after = result.pages[result.pages.length - 1];
      const stillLogin = after ? Boolean(findLoginForm(after.interactiveElements)) : true;
      const urlChanged = normalizeUrl(browser.currentUrl()) !== normalizeUrl(current.url);
      if (!stillLogin || urlChanged) {
        result.authenticated = true;
        result.observations.push(`Authenticated exploration continued at ${browser.currentUrl()}.`);
      } else {
        result.observations.push(
          'Login was attempted from observed controls but the login form was still present afterwards.'
        );
      }
    } catch (err: any) {
      result.observations.push(`Login interaction failed: ${err.message}`);
    }
  }

  private async interactAndCrawl(
    browser: BrowserAutomationInterface,
    options: ExploreOptions,
    result: ExplorationResult,
    visited: Set<string>,
    maxPages: number
  ): Promise<void> {
    const clicked = new Set<string>();
    let safety = 0;
    while (result.pages.length < maxPages && safety < maxPages * 3) {
      safety += 1;
      const target = this.nextNavigationTarget(result, options.startUrl, visited);
      if (target) {
        try {
          const href = new URL(target.href!, options.startUrl).toString();
          if (this.elementOnCurrentPage(browser, result, target)) {
            await browser.click(toLocator(target));
            await this.captureCurrent(browser, options, result, visited, 'click', true);
          } else {
            await browser.goto(href);
            await this.captureCurrent(browser, options, result, visited, 'goto');
          }
          continue;
        } catch (err: any) {
          result.observations.push(`Navigation to ${target.href} failed: ${err.message}`);
          if (target.href) visited.add(normalizeUrl(new URL(target.href, options.startUrl).toString()));
          continue;
        }
      }

      const clickable = this.nextSafeClick(result, clicked);
      if (!clickable) break;
      const signature = clickable.selector || clickable.testId || clickable.text || `${clickable.tag}:${clickable.name}`;
      clicked.add(signature);
      try {
        await browser.click(toLocator(clickable));
        await this.captureCurrent(browser, options, result, visited, 'click', true);
      } catch (err: any) {
        result.observations.push(
          `Safe click on ${clickable.testId || clickable.text || clickable.name} failed: ${err.message}`
        );
      }
    }
  }

  private nextNavigationTarget(
    result: ExplorationResult,
    startUrl: string,
    visited: Set<string>
  ): InteractiveElement | undefined {
    const seen = new Set<string>();
    for (const page of result.pages) {
      for (const el of navigationTargets(page.interactiveElements, startUrl)) {
        const href = normalizeUrl(new URL(el.href!, startUrl).toString());
        if (visited.has(href) || seen.has(href)) continue;
        seen.add(href);
        return el;
      }
    }
    return undefined;
  }

  private nextSafeClick(result: ExplorationResult, clicked: Set<string>): InteractiveElement | undefined {
    const current = result.pages[result.pages.length - 1];
    if (!current) return undefined;
    return safeExploreClicks(current.interactiveElements).find((el) => {
      const signature = el.selector || el.testId || el.text || `${el.tag}:${el.name}`;
      return !el.disabled && !clicked.has(signature);
    });
  }

  private elementOnCurrentPage(
    browser: BrowserAutomationInterface,
    result: ExplorationResult,
    target: InteractiveElement
  ): boolean {
    const current = result.pages[result.pages.length - 1];
    if (!current) return false;
    if (normalizeUrl(current.url) !== normalizeUrl(browser.currentUrl())) return false;
    return current.interactiveElements.includes(target);
  }

  private async captureCurrent(
    browser: BrowserAutomationInterface,
    options: ExploreOptions,
    result: ExplorationResult,
    visited: Set<string>,
    reachedBy: ExploredPage['reachedBy'],
    force = false
  ): Promise<void> {
    const snapshot = await browser.snapshot();
    const url = normalizeUrl(snapshot.url);
    if (!force && visited.has(url) && result.pages.some((page) => normalizeUrl(page.url) === url)) {
      return;
    }
    visited.add(url);

    let screenshotPath: string | undefined;
    if (options.artifactDir) {
      const dir = path.join(options.artifactDir, options.userId, options.projectId, options.correlationId);
      fs.mkdirSync(dir, { recursive: true });
      screenshotPath = path.join(dir, `explore-${result.pages.length}.png`);
      try {
        await browser.screenshot(screenshotPath);
      } catch (err: any) {
        result.observations.push(`Screenshot failed: ${err.message}`);
        screenshotPath = undefined;
      }
    }

    const page = emptyExploredPage(snapshot, { screenshotPath, reachedBy });
    result.pages.push(page);
    result.observations.push(
      `Observed ${page.title || page.url} with ${page.interactiveElements.length} interactive controls via ${reachedBy}.`
    );
  }
}

export default PlaywrightExplorer;
