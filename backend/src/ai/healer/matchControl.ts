import { InteractiveElement } from '../types';
import { findLoginForm, findLoginSubmit, findPasswordField, findUsernameField } from '../browser/explorationPolicy';
import { matchElements } from '../evidence/matching';
import { ParsedLocator } from './parseFailure';

export const locatorExists = (failed: ParsedLocator, elements: InteractiveElement[]): boolean => {
  const needle = failed.value.toLowerCase();
  return elements.some((el) => {
    const hay = `${el.testId || ''} ${el.id || ''} ${el.name || ''} ${el.text || ''} ${el.selector || ''} ${el.placeholder || ''}`.toLowerCase();
    return hay.includes(needle) || (failed.name ? hay.includes(failed.name.toLowerCase()) : false);
  });
};

export const suggestReplacement = (
  failed: ParsedLocator,
  elements: InteractiveElement[]
): InteractiveElement | undefined => {
  if (locatorExists(failed, elements)) return undefined;

  const label = `${failed.value} ${failed.name || ''}`.toLowerCase();
  if (/password/i.test(label)) {
    const password = findPasswordField(elements);
    if (password && password.testId !== failed.value) return password;
  }
  const looksLikeSubmit = /button|submit|sign.?in|login-button|log.in/i.test(label) || failed.kind === 'role';
  if (/^(user|email|username|login)$/i.test(failed.value) || (/user|email/i.test(label) && !looksLikeSubmit && failed.kind !== 'role')) {
    const username = findUsernameField(elements);
    if (username && username.testId !== failed.value) return username;
  }
  if (looksLikeSubmit) {
    const submit = findLoginSubmit(elements) || findLoginForm(elements)?.submit;
    if (submit && submit.testId !== failed.value && submit.id !== failed.value) return submit;
  }

  return matchElements(failed.value, elements).find(
    (el) => (el.testId || el.id || el.name) && el.testId !== failed.value
  );
};
