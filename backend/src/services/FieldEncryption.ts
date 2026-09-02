import crypto from 'crypto';

const PREFIX = 'enc:v1:';

const keyBuffer = (): Buffer | null => {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
};

export const encryptionEnabled = (): boolean => Boolean(keyBuffer());

export const encryptString = (plain?: string | null): string | null => {
  if (plain == null || plain === '') return plain ?? null;
  if (plain.startsWith(PREFIX)) return plain;
  const key = keyBuffer();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptString = (value?: string | null): string | null => {
  if (value == null || value === '') return value ?? null;
  if (!value.startsWith(PREFIX)) return value;
  const key = keyBuffer();
  if (!key) return value;
  const [, packed] = value.split('enc:v1:');
  const [ivB64, tagB64, dataB64] = packed.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
};

export const encryptJson = (value: Record<string, string> | null | undefined): Record<string, string> => {
  if (!value || !Object.keys(value).length) return value || {};
  if (value.__encrypted) return value;
  const encoded = encryptString(JSON.stringify(value));
  if (!encoded || !encoded.startsWith(PREFIX)) return value;
  return { __encrypted: encoded };
};

export const decryptJson = (value: Record<string, string> | null | undefined): Record<string, string> => {
  if (!value) return {};
  if (value.__encrypted) {
    const raw = decryptString(value.__encrypted);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return value;
};
