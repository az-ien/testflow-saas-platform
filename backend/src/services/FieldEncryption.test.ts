import { decryptJson, decryptString, encryptJson, encryptString } from './FieldEncryption';

describe('FieldEncryption', () => {
  const previous = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  });

  it('round-trips a repository token', () => {
    const encrypted = encryptString('ghp_secret_token')!;
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain('ghp_secret_token');
    expect(decryptString(encrypted)).toBe('ghp_secret_token');
  });

  it('round-trips environment variables', () => {
    const encrypted = encryptJson({ TEST_PASSWORD: 'p@ss', APP_URL: 'https://app.test' });
    expect(encrypted.__encrypted).toBeDefined();
    expect(JSON.stringify(encrypted)).not.toContain('p@ss');
    expect(decryptJson(encrypted)).toEqual({ TEST_PASSWORD: 'p@ss', APP_URL: 'https://app.test' });
  });

  it('leaves plaintext alone when already decrypted', () => {
    expect(decryptString('plain')).toBe('plain');
    expect(decryptJson({ FOO: 'bar' })).toEqual({ FOO: 'bar' });
  });
});
