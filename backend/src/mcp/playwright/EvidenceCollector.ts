import { ExplorationResult } from '../../ai/types';

export const toEvidenceRecords = (exploration: ExplorationResult) => {
  const records: Array<{
    kind: string;
    url?: string;
    summary: string;
    payload: Record<string, unknown>;
    artifactPath?: string;
  }> = [];

  records.push({
    kind: 'observation',
    url: exploration.startUrl,
    summary: `Exploration started at ${exploration.startUrl}`,
    payload: { observations: exploration.observations, error: exploration.error || null },
  });

  for (const page of exploration.pages) {
    records.push({
      kind: 'url',
      url: page.url,
      summary: page.title || page.url,
      payload: { title: page.title, headings: page.headings },
    });
    records.push({
      kind: 'dom',
      url: page.url,
      summary: `DOM snapshot for ${page.title || page.url}`,
      payload: { snapshot: page.snapshot, interactiveElements: page.interactiveElements },
    });
    if (page.screenshotPath) {
      records.push({
        kind: 'screenshot',
        url: page.url,
        summary: `Screenshot of ${page.url}`,
        payload: {},
        artifactPath: page.screenshotPath,
      });
    }
  }

  if (exploration.consoleMessages.length) {
    records.push({
      kind: 'console',
      url: exploration.startUrl,
      summary: `${exploration.consoleMessages.length} console messages`,
      payload: { messages: exploration.consoleMessages },
    });
  }

  if (exploration.networkErrors.length) {
    records.push({
      kind: 'network',
      url: exploration.startUrl,
      summary: `${exploration.networkErrors.length} network errors`,
      payload: { errors: exploration.networkErrors },
    });
  }

  return records;
};
