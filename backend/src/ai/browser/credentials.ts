export interface ExploreCredentials {
  username?: string;
  password?: string;
}

const USERNAME_KEYS = [
  'TEST_USERNAME',
  'TEST_USER',
  'APP_USERNAME',
  'APP_USER',
  'E2E_USERNAME',
  'E2E_USER',
  'LOGIN_USERNAME',
  'LOGIN_USER',
  'PLAYWRIGHT_USERNAME',
];

const PASSWORD_KEYS = [
  'TEST_PASSWORD',
  'APP_PASSWORD',
  'E2E_PASSWORD',
  'LOGIN_PASSWORD',
  'PLAYWRIGHT_PASSWORD',
];

const firstValue = (env: Record<string, string>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
};

/**
 * Read exploration/login credentials from a project's environment variables.
 * SauceDemo-specific keys are intentionally not special-cased.
 */
export const extractExploreCredentials = (
  env?: Record<string, string> | null
): ExploreCredentials => {
  if (!env) return {};
  return {
    username: firstValue(env, USERNAME_KEYS),
    password: firstValue(env, PASSWORD_KEYS),
  };
};

export const hasExploreCredentials = (credentials?: ExploreCredentials | null): boolean =>
  Boolean(credentials?.username && credentials?.password);
