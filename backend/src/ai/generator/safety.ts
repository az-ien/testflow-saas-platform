import { GeneratedFile } from '../types';

const FORBIDDEN = [
  /waitForTimeout\s*\(/,
  /secret_sauce/,
  /standard_user/,
];

export const generatedFileIssues = (files: GeneratedFile[]): string[] => {
  const issues: string[] = [];
  const kinds = new Set(files.map((file) => file.kind));
  for (const required of ['test', 'page_object', 'fixture', 'test_data', 'config'] as const) {
    if (!kinds.has(required)) {
      issues.push(`Missing generated file kind: ${required}`);
    }
  }

  for (const file of files) {
    if (!file.path || !file.content) {
      issues.push(`Empty generated file: ${file.path || '(missing path)'}`);
      continue;
    }
    if (file.path.includes('..') || file.path.startsWith('/') || file.path.includes('\\')) {
      issues.push(`Unsafe generated path: ${file.path}`);
    }
    for (const pattern of FORBIDDEN) {
      if (pattern.test(file.content)) {
        issues.push(`${file.path} contains forbidden pattern ${pattern}`);
      }
    }
    if (/\.or\(\s*page\.getBy(Role|Label|Placeholder|Text)/.test(file.content)) {
      issues.push(`${file.path} invents locator fallback chains`);
    }
  }

  return issues;
};

export const assertGeneratedSafety = (files: GeneratedFile[]): void => {
  const issues = generatedFileIssues(files);
  if (issues.length) {
    throw new Error(`Generated Playwright files failed safety checks: ${issues.join('; ')}`);
  }
};
