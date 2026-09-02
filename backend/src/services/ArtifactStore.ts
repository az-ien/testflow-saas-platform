import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import { artifactRoot } from '../ai/generator/workspace';
import { logger } from '../config/logger';

const resolveOwnedPath = (userId: string, projectId: string, relativePath = ''): string => {
  const root = path.resolve(artifactRoot(), userId, projectId);
  const resolved = path.resolve(root, relativePath);
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(prefix)) {
    throw new ForbiddenError('Artifact path is outside the project prefix');
  }
  return resolved;
};

export const listArtifacts = (userId: string, projectId: string, relativePath = ''): { path: string; size: number }[] => {
  const dir = resolveOwnedPath(userId, projectId, relativePath);
  if (!fs.existsSync(dir)) return [];
  const stat = fs.statSync(dir);
  if (stat.isFile()) return [{ path: relativePath, size: stat.size }];
  const entries: { path: string; size: number }[] = [];
  const walk = (current: string, prefix: string) => {
    for (const name of fs.readdirSync(current)) {
      const full = path.join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const info = fs.statSync(full);
      if (info.isDirectory()) walk(full, rel);
      else entries.push({ path: rel, size: info.size });
    }
  };
  walk(dir, relativePath);
  return entries;
};

export const readOwnedArtifact = (userId: string, projectId: string, relativePath: string): { absPath: string; contentType: string } => {
  const absPath = resolveOwnedPath(userId, projectId, relativePath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    throw new NotFoundError('Artifact');
  }
  const ext = path.extname(absPath).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webm': 'video/webm',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.log': 'text/plain',
  };
  return { absPath, contentType: types[ext] || 'application/octet-stream' };
};

const hmac = (key: Buffer | string, data: string) =>
  crypto.createHmac('sha256', key).update(data, 'utf8').digest();

export const uploadDirectoryToS3 = async (localDir: string, keyPrefix: string): Promise<string | null> => {
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  if (!bucket || !accessKey || !secretKey || accessKey === 'xxxxx') return null;
  if (!fs.existsSync(localDir)) return null;

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(localDir);

  for (const file of files) {
    const relative = path.relative(localDir, file).replace(/\\/g, '/');
    const key = `${keyPrefix.replace(/\/$/, '')}/${relative}`;
    const body = fs.readFileSync(file);
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const canonical = ['PUT', `/${key}`, '', `host:${host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`, '', 'host;x-amz-content-sha256;x-amz-date', payloadHash].join('\n');
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, crypto.createHash('sha256').update(canonical).digest('hex')].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    await axios.put(`https://${host}/${key}`, body, {
      headers: {
        Host: host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
      },
      timeout: 30000,
      maxBodyLength: Infinity,
    });
  }

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${keyPrefix}`;
  logger.info('Uploaded artifacts to S3', { prefix: keyPrefix, files: files.length });
  return url;
};
