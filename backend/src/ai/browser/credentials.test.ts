import { extractExploreCredentials, hasExploreCredentials } from './credentials';

describe('extractExploreCredentials', () => {
  it('reads generic TEST_* keys and ignores empty values', () => {
    expect(
      extractExploreCredentials({
        TEST_USERNAME: 'qa-user',
        TEST_PASSWORD: 'qa-pass',
      })
    ).toEqual({ username: 'qa-user', password: 'qa-pass' });
  });

  it('does not special-case SauceDemo keys', () => {
    expect(
      extractExploreCredentials({
        STANDARD_USER: 'standard_user',
        SECRET_SAUCE: 'secret_sauce',
      })
    ).toEqual({ username: undefined, password: undefined });
  });

  it('reports whether both username and password are present', () => {
    expect(hasExploreCredentials({ username: 'a' })).toBe(false);
    expect(hasExploreCredentials({ username: 'a', password: 'b' })).toBe(true);
  });
});
