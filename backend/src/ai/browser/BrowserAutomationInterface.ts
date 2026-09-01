import {
  BrowserAction,
  ElementLocator,
  ExploredPage,
  InteractiveElement,
} from '../types';

export interface BrowserLaunchOptions {
  timeoutMs?: number;
  headless?: boolean;
}

export interface PageSnapshot {
  url: string;
  title: string;
  headings: string[];
  interactiveElements: InteractiveElement[];
  text: string;
}

export interface BrowserAutomationInterface {
  launch(options?: BrowserLaunchOptions): Promise<void>;
  goto(url: string): Promise<void>;
  snapshot(): Promise<PageSnapshot>;
  click(locator: ElementLocator): Promise<void>;
  fill(locator: ElementLocator, value: string): Promise<void>;
  screenshot(filePath: string): Promise<string>;
  currentUrl(): string;
  title(): Promise<string>;
  actions(): BrowserAction[];
  consoleMessages(): string[];
  networkErrors(): string[];
  close(): Promise<void>;
}

export const emptyExploredPage = (snapshot: PageSnapshot, extras?: Partial<ExploredPage>): ExploredPage => ({
  url: snapshot.url,
  title: snapshot.title,
  snapshot: snapshot.text,
  interactiveElements: snapshot.interactiveElements,
  headings: snapshot.headings,
  ...extras,
});
