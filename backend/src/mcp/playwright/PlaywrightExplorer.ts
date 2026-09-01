import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { logger } from '../../config/logger';
import { ExplorationResult, ExploredPage, InteractiveElement } from '../../ai/types';

export interface ExploreOptions {
  startUrl: string;
  maxPages?: number;
  timeoutMs?: number;
  artifactDir?: string;
  projectId: string;
  userId: string;
  correlationId: string;
}

const collectInteractive = async (page: Page): Promise<InteractiveElement[]> => {
  return page.$$eval('a, button, input, select, textarea, [role="button"], [data-test], [data-testid]', (nodes) =>
    nodes.slice(0, 80).map((node) => {
      const el = node as unknown as {
        tagName: string;
        getAttribute(name: string): string | null;
        name?: string;
        innerText?: string;
        textContent?: string | null;
      };
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || undefined,
        name: el.getAttribute('aria-label') || el.name || undefined,
        testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || undefined,
        type: el.getAttribute('type') || undefined,
        href: el.getAttribute('href') || undefined,
        placeholder: el.getAttribute('placeholder') || undefined,
        text: (el.innerText || el.textContent || '').trim().slice(0, 80) || undefined,
      };
    })
  );
};

const collectHeadings = async (page: Page): Promise<string[]> => {
  return page.$$eval('h1, h2, h3', (nodes) =>
    nodes.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 20)
  );
};

export class PlaywrightExplorer {
  async explore(options: ExploreOptions): Promise<ExplorationResult> {
    const maxPages = options.maxPages || parseInt(process.env.EXPLORATION_MAX_PAGES || '6', 10);
    const timeout = options.timeoutMs || parseInt(process.env.EXPLORATION_TIMEOUT_MS || '45000', 10);
    const result: ExplorationResult = {
      startUrl: options.startUrl,
      pages: [],
      observations: [],
      consoleMessages: [],
      networkErrors: [],
    };

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      page.on('console', (msg) => {
        if (['error', 'warning'].includes(msg.type())) {
          result.consoleMessages.push(`${msg.type()}: ${msg.text()}`);
        }
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          result.networkErrors.push(`${response.status()} ${response.url()}`);
        }
      });

      await page.goto(options.startUrl, { waitUntil: 'domcontentloaded' });
      const visited = new Set<string>();
      const queue = [page.url()];

      while (queue.length && result.pages.length < maxPages) {
        const url = queue.shift()!;
        if (visited.has(url)) continue;
        visited.add(url);
        if (page.url() !== url) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
        }
        const explored = await this.capturePage(page, options, result.pages.length);
        result.pages.push(explored);
        result.observations.push(`Observed ${explored.title || explored.url} with ${explored.interactiveElements.length} interactive controls.`);

        const sameOriginLinks = explored.interactiveElements
          .map((el) => el.href)
          .filter((href): href is string => Boolean(href))
          .map((href) => {
            try {
              return new URL(href, url).toString();
            } catch {
              return null;
            }
          })
          .filter((href): href is string => Boolean(href && href.startsWith(new URL(options.startUrl).origin)));

        for (const href of sameOriginLinks) {
          if (!visited.has(href) && queue.length + result.pages.length < maxPages) {
            queue.push(href);
          }
        }
      }

      await context.close();
    } catch (err: any) {
      logger.warn('Playwright exploration failed', { error: err.message, url: options.startUrl });
      result.error = err.message;
      result.observations.push(`Exploration failed: ${err.message}`);
    } finally {
      await browser?.close();
    }

    return result;
  }

  private async capturePage(page: Page, options: ExploreOptions, index: number): Promise<ExploredPage> {
    const interactiveElements = await collectInteractive(page);
    const headings = await collectHeadings(page);
    let screenshotPath: string | undefined;
    if (options.artifactDir) {
      const dir = path.join(options.artifactDir, options.userId, options.projectId, options.correlationId);
      fs.mkdirSync(dir, { recursive: true });
      screenshotPath = path.join(dir, `explore-${index}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    const snapshot = await page.evaluate(() => {
      const doc = (globalThis as { document?: { body?: { innerText?: string } } }).document;
      return doc?.body?.innerText?.slice(0, 4000) || '';
    });
    return {
      url: page.url(),
      title: await page.title(),
      snapshot,
      screenshotPath,
      interactiveElements,
      headings,
    };
  }
}

export default PlaywrightExplorer;
