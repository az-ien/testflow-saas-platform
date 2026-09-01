import fs from 'fs/promises';
import path from 'path';
import { GeneratedFile } from '../types';

export const artifactRoot = (): string => process.env.ARTIFACT_DIR || '/tmp/testflow-artifacts';

export const generatedWorkspaceDir = (input: {
  userId: string;
  projectId: string;
  generatedTestId: string;
}): string =>
  path.join(
    artifactRoot(),
    input.userId,
    input.projectId,
    'generated-tests',
    input.generatedTestId,
    'workspace'
  );

export const assertSafeRelativePath = (filePath: string): string => {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(filePath)) {
    throw new Error(`Unsafe generated file path: ${filePath}`);
  }
  return normalized;
};

export const writeGeneratedWorkspace = async (
  workspaceDir: string,
  files: GeneratedFile[]
): Promise<string[]> => {
  await fs.mkdir(workspaceDir, { recursive: true });
  const written: string[] = [];

  for (const file of files) {
    const relative = assertSafeRelativePath(file.path);
    const destination = path.join(workspaceDir, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content, 'utf8');
    written.push(relative);
  }

  await fs.writeFile(
    path.join(workspaceDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'testflow-generated-workspace',
        private: true,
        scripts: { test: 'playwright test' },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  await fs.writeFile(
    path.join(workspaceDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          types: ['node'],
        },
        include: ['pages/**/*.ts', 'fixtures/**/*.ts', 'test-data/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return written;
};

export const resolveBackendRoot = (): string => {
  const fromCwd = process.cwd();
  if (require('fs').existsSync(path.join(fromCwd, 'node_modules', '@playwright', 'test'))) {
    return fromCwd;
  }
  return path.resolve(__dirname, '../../..');
};

export const linkWorkspaceNodeModules = async (workspaceDir: string): Promise<void> => {
  const source = path.join(resolveBackendRoot(), 'node_modules');
  const target = path.join(workspaceDir, 'node_modules');
  try {
    await fs.lstat(target);
    return;
  } catch {
    await fs.symlink(source, target, 'dir');
  }
};
