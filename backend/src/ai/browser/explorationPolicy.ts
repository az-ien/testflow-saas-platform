import { InteractiveElement } from '../types';

const DESTRUCTIVE = /log\s*out|sign\s*out|delete|remove|destroy|reset|unsubscribe|cancel (order|account)|deactivate/i;
const LOGIN_SUBMIT = /log\s*in|sign\s*in|submit|continue/i;
const SAFE_CLICK = /add to cart|add-to-cart|continue|next|view|details|checkout|cart/i;

export const elementLabel = (el: InteractiveElement): string =>
  `${el.testId || ''} ${el.name || ''} ${el.text || ''} ${el.placeholder || ''} ${el.id || ''} ${el.role || ''}`.trim();

export const isDestructiveControl = (el: InteractiveElement): boolean =>
  DESTRUCTIVE.test(elementLabel(el)) || DESTRUCTIVE.test(el.href || '');

export const isLoginSubmit = (el: InteractiveElement): boolean => {
  if (el.tag === 'button' || el.type === 'submit' || el.role === 'button') {
    return LOGIN_SUBMIT.test(elementLabel(el)) || el.type === 'submit';
  }
  return false;
};

export const findUsernameField = (elements: InteractiveElement[]): InteractiveElement | undefined => {
  const candidates = elements.filter((el) => {
    if (el.tag !== 'input' && el.tag !== 'textarea') return false;
    if (isPasswordFieldLike(el)) return false;
    if (el.type && !['text', 'email', 'tel', ''].includes(el.type)) return false;
    return true;
  });
  return (
    candidates.find((el) => /user|email|login|account/i.test(elementLabel(el)) || el.type === 'email') ||
    candidates[0]
  );
};

export const findPasswordField = (elements: InteractiveElement[]): InteractiveElement | undefined =>
  elements.find((el) => isPasswordFieldLike(el));

export const findLoginSubmit = (elements: InteractiveElement[]): InteractiveElement | undefined => {
  const named = elements.find((el) => isLoginSubmit(el) && !isDestructiveControl(el));
  if (named) return named;
  return elements.find((el) => el.type === 'submit' && !isDestructiveControl(el));
};

export interface ObservedLoginForm {
  username?: InteractiveElement;
  password: InteractiveElement;
  submit?: InteractiveElement;
}

export const findLoginForm = (elements: InteractiveElement[]): ObservedLoginForm | null => {
  const password = findPasswordField(elements);
  if (!password) return null;
  return {
    username: findUsernameField(elements),
    password,
    submit: findLoginSubmit(elements),
  };
};

export const sameOrigin = (href: string, startUrl: string): boolean => {
  try {
    const absolute = new URL(href, startUrl);
    const origin = new URL(startUrl);
    return absolute.origin === origin.origin && ['http:', 'https:'].includes(absolute.protocol);
  } catch {
    return false;
  }
};

export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

export const navigationTargets = (elements: InteractiveElement[], startUrl: string): InteractiveElement[] =>
  elements.filter((el) => {
    if (!el.href || isDestructiveControl(el)) return false;
    if (el.href.startsWith('mailto:') || el.href.startsWith('tel:') || el.href.startsWith('javascript:')) return false;
    return sameOrigin(el.href, startUrl);
  });

export const safeExploreClicks = (elements: InteractiveElement[]): InteractiveElement[] =>
  elements.filter((el) => {
    if (el.disabled || isDestructiveControl(el) || isPasswordFieldLike(el)) return false;
    if (el.tag === 'input' && el.type && !['button', 'submit'].includes(el.type)) return false;
    if (el.tag === 'a' && el.href) return false;
    return SAFE_CLICK.test(elementLabel(el));
  });

const isPasswordFieldLike = (el: InteractiveElement): boolean =>
  el.type === 'password' || /password/i.test(elementLabel(el));
