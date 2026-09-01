import {
  findLoginForm,
  isDestructiveControl,
  navigationTargets,
  normalizeUrl,
  safeExploreClicks,
} from './explorationPolicy';

describe('explorationPolicy', () => {
  it('detects a login form from password + username + submit controls', () => {
    const form = findLoginForm([
      { tag: 'input', type: 'text', testId: 'username', placeholder: 'Username' },
      { tag: 'input', type: 'password', testId: 'password' },
      { tag: 'button', text: 'Login', testId: 'login-button' },
    ]);
    expect(form?.username?.testId).toBe('username');
    expect(form?.password.testId).toBe('password');
    expect(form?.submit?.testId).toBe('login-button');
  });

  it('returns no login form when a password field is absent', () => {
    expect(
      findLoginForm([
        { tag: 'input', type: 'search', placeholder: 'Search' },
        { tag: 'button', text: 'Search' },
      ])
    ).toBeNull();
  });

  it('does not treat logout or delete as safe explore clicks', () => {
    const logout = { tag: 'a', text: 'Logout', href: '/logout' };
    const del = { tag: 'button', text: 'Delete account', testId: 'delete-account' };
    const add = { tag: 'button', text: 'Add to cart', testId: 'add-to-cart-item' };
    expect(isDestructiveControl(logout)).toBe(true);
    expect(isDestructiveControl(del)).toBe(true);
    expect(safeExploreClicks([logout, del, add]).map((el) => el.testId)).toEqual(['add-to-cart-item']);
  });

  it('keeps same-origin navigation and drops external and mailto links', () => {
    const start = 'https://app.example.com/login';
    const targets = navigationTargets(
      [
        { tag: 'a', href: '/catalog', text: 'Catalog' },
        { tag: 'a', href: 'https://other.example.com', text: 'Other' },
        { tag: 'a', href: 'mailto:ops@example.com', text: 'Email' },
      ],
      start
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].href).toBe('/catalog');
  });

  it('normalizes trailing slashes and hashes', () => {
    expect(normalizeUrl('https://app.example.com/catalog/#top')).toBe('https://app.example.com/catalog');
  });
});
