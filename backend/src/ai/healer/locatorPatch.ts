import { GeneratedFile, InteractiveElement } from '../types';
import { preferredSelector } from '../browser/locators';
import { ParsedLocator } from './parseFailure';
import { assertionsPreserved } from './assertions';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const locatorExpressionForElement = (el: InteractiveElement): string | null => {
  if (el.testId) {
    return `page.locator('[data-testid="${el.testId}"], [data-test="${el.testId}"]')`;
  }
  const css = el.selector || preferredSelector(el);
  if (css) return `page.locator('${css.replace(/'/g, "\\'")}')`;
  if (el.id) return `page.locator('#${el.id}')`;
  if (el.text) return `page.getByText(${JSON.stringify(el.text)})`;
  return null;
};

const replaceToken = (content: string, from: string, to: string): string => {
  if (!from || from === to) return content;
  return content.replace(new RegExp(escapeRegExp(from), 'g'), to);
};

export const patchFilesForLocator = (
  files: GeneratedFile[],
  failed: ParsedLocator,
  replacement: InteractiveElement
): { files: GeneratedFile[]; issues: string[] } | null => {
  const nextValue = replacement.testId || replacement.id || replacement.name || replacement.text;
  if (!nextValue) return null;

  const patched = files.map((file) => {
    let content = file.content;
    if (failed.kind === 'testid' || failed.kind === 'selector') {
      content = replaceToken(content, failed.value, replacement.testId || nextValue);
    } else {
      content = replaceToken(content, failed.value, nextValue);
    }
    if (failed.name && replacement.text) {
      content = replaceToken(content, failed.name, replacement.text);
    }
    return { ...file, content };
  });

  const changed = patched.some((file, index) => file.content !== files[index].content);
  if (!changed) return null;

  const issues = assertionsPreserved(files, patched);
  if (issues.length) return { files: patched, issues };

  return { files: patched, issues: [] };
};
