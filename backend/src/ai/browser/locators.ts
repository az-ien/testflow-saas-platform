import { ElementLocator, InteractiveElement } from '../types';
import { Page, Locator } from 'playwright';

const quoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const preferredSelector = (el: Pick<InteractiveElement, 'testId' | 'id' | 'name' | 'placeholder' | 'type' | 'tag' | 'text'>): string | undefined => {
  if (el.testId) {
    return `[data-testid="${quoted(el.testId)}"], [data-test="${quoted(el.testId)}"]`;
  }
  if (el.id) return `#${quoted(el.id)}`;
  if (el.name) return `${el.tag || 'input'}[name="${quoted(el.name)}"]`;
  if (el.placeholder) return `[placeholder="${quoted(el.placeholder)}"]`;
  if (el.type === 'password') return 'input[type="password"]';
  if (el.text && ['button', 'a'].includes(el.tag)) {
    return `${el.tag}:has-text("${quoted(el.text.slice(0, 40))}")`;
  }
  return undefined;
};

export const toLocator = (el: InteractiveElement): ElementLocator => ({
  testId: el.testId,
  role: el.role,
  name: el.name,
  css: el.selector || preferredSelector(el),
  text: el.text,
  placeholder: el.placeholder,
  type: el.type,
  id: el.id,
});

export const isPasswordField = (el: InteractiveElement | ElementLocator): boolean =>
  el.type === 'password' || /password/i.test(`${(el as InteractiveElement).name || ''} ${(el as InteractiveElement).placeholder || ''} ${(el as InteractiveElement).testId || ''} ${(el as InteractiveElement).id || ''}`);

export const resolvePlaywrightLocator = (page: Page, locator: ElementLocator): Locator => {
  if (locator.testId) {
    return page.getByTestId(locator.testId).or(page.locator(`[data-test="${quoted(locator.testId)}"]`));
  }
  if (locator.css) {
    return page.locator(locator.css).first();
  }
  if (locator.id) {
    return page.locator(`#${locator.id}`);
  }
  if (locator.placeholder) {
    return page.getByPlaceholder(locator.placeholder);
  }
  if (locator.role && locator.name) {
    return page.getByRole(locator.role as never, { name: locator.name });
  }
  if (locator.name) {
    return page.locator(`[name="${quoted(locator.name)}"]`).first();
  }
  if (locator.text) {
    return page.getByText(locator.text, { exact: false }).first();
  }
  throw new Error('Locator has no resolvable attributes');
};
