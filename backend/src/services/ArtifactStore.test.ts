import fs from 'fs';
import os from 'os';
import path from 'path';
import { listArtifacts, readOwnedArtifact } from './ArtifactStore';
import { ForbiddenError } from '../middleware/errorHandler';

describe('ArtifactStore isolation', () => {
  const root = path.join(os.tmpdir(), 'testflow-artifact-tests');
  const previous = process.env.ARTIFACT_DIR;

  beforeEach(() => {
    process.env.ARTIFACT_DIR = root;
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.join(root, 'user-a', 'proj-a'), { recursive: true });
    fs.writeFileSync(path.join(root, 'user-a', 'proj-a', 'shot.png'), 'png');
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.ARTIFACT_DIR;
    else process.env.ARTIFACT_DIR = previous;
  });

  it('lists only files under the owned prefix', () => {
    expect(listArtifacts('user-a', 'proj-a').map((item) => item.path)).toEqual(['shot.png']);
  });

  it('rejects path traversal', () => {
    expect(() => readOwnedArtifact('user-a', 'proj-a', '../proj-b/secret.txt')).toThrow(ForbiddenError);
  });
});
