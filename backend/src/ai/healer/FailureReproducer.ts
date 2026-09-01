import fs from 'fs';
import path from 'path';
import { InteractiveElement } from '../types';
import { BrowserAutomationInterface, PageSnapshot } from '../browser/BrowserAutomationInterface';
import { createBrowserAutomation } from '../browser/createBrowserAutomation';
import { ExploreCredentials, hasExploreCredentials } from '../browser/credentials';
import { findLoginForm } from '../browser/explorationPolicy';
import { toLocator } from '../browser/locators';
import { logger } from '../../config/logger';
import { ParsedLocator, parseFailedLocator } from './parseFailure';
import { locatorExists, suggestReplacement } from './matchControl';

export interface ReproductionResult {
  reachable: boolean;
  loginAttempted: boolean;
  authenticated: boolean;
  url?: string;
  title?: string;
  snapshot?: PageSnapshot;
  interactiveElements: InteractiveElement[];
  consoleMessages: string[];
  networkErrors: string[];
  screenshotPath?: string;
  error?: string;
  failedLocator: ParsedLocator | null;
  locatorFound: boolean;
  suggestedElement?: InteractiveElement;
}

export class FailureReproducer {
  constructor(
    private readonly createBrowser: () => BrowserAutomationInterface = createBrowserAutomation
  ) {}

  async reproduce(input: {
    startUrl?: string | null;
    error?: string;
    logs?: string[];
    credentials?: ExploreCredentials;
    artifactDir?: string;
    userId: string;
    projectId: string;
    correlationId: string;
  }): Promise<ReproductionResult> {
    const failedLocator = parseFailedLocator(`${input.error || ''} ${(input.logs || []).join(' ')}`);
    const empty: ReproductionResult = {
      reachable: false,
      loginAttempted: false,
      authenticated: false,
      interactiveElements: [],
      consoleMessages: [],
      networkErrors: [],
      failedLocator,
      locatorFound: false,
      error: input.startUrl ? undefined : 'No application URL configured for reproduction',
    };

    if (!input.startUrl) return empty;

    const browser = this.createBrowser();
    try {
      await browser.launch({ timeoutMs: 20000, headless: true });
      await browser.goto(input.startUrl);
      let snapshot = await browser.snapshot();
      const elements = [...snapshot.interactiveElements];
      let locatorFound = failedLocator ? locatorExists(failedLocator, elements) : false;
      let suggested = failedLocator && !locatorFound
        ? suggestReplacement(failedLocator, snapshot.interactiveElements)
        : undefined;

      const form = findLoginForm(snapshot.interactiveElements);
      if (form && hasExploreCredentials(input.credentials) && !locatorFound && !suggested) {
        empty.loginAttempted = true;
        try {
          if (form.username) await browser.fill(toLocator(form.username), input.credentials!.username!);
          await browser.fill(toLocator(form.password), input.credentials!.password!);
          if (form.submit) await browser.click(toLocator(form.submit));
          snapshot = await browser.snapshot();
          elements.push(...snapshot.interactiveElements);
          empty.authenticated = !findLoginForm(snapshot.interactiveElements);
          if (!locatorFound) {
            locatorFound = failedLocator ? locatorExists(failedLocator, snapshot.interactiveElements) : false;
          }
          if (!suggested && failedLocator && !locatorFound) {
            suggested = suggestReplacement(failedLocator, snapshot.interactiveElements)
              || suggestReplacement(failedLocator, elements);
          }
        } catch (err: any) {
          empty.error = `Login during reproduction failed: ${err.message}`;
        }
      }

      const screenshotPath = await this.capture(browser, input, 'heal-repro.png');

      return {
        reachable: true,
        loginAttempted: empty.loginAttempted,
        authenticated: empty.authenticated,
        url: snapshot.url,
        title: snapshot.title,
        snapshot,
        interactiveElements: elements,
        consoleMessages: browser.consoleMessages(),
        networkErrors: browser.networkErrors(),
        screenshotPath,
        error: empty.error,
        failedLocator,
        locatorFound,
        suggestedElement: suggested,
      };
    } catch (err: any) {
      logger.warn('Failure reproduction failed', { error: err.message, url: input.startUrl });
      return {
        ...empty,
        consoleMessages: browser.consoleMessages(),
        networkErrors: browser.networkErrors(),
        error: err.message,
      };
    } finally {
      await browser.close();
    }
  }

  private async capture(
    browser: BrowserAutomationInterface,
    input: { artifactDir?: string; userId: string; projectId: string; correlationId: string },
    filename: string
  ): Promise<string | undefined> {
    if (!input.artifactDir) return undefined;
    const dir = path.join(input.artifactDir, input.userId, input.projectId, input.correlationId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    try {
      return await browser.screenshot(filePath);
    } catch (err: any) {
      logger.debug('Healing screenshot failed', { error: err.message });
      return undefined;
    }
  }
}

export default FailureReproducer;
