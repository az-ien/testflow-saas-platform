import { GeneratedFile, WorkspaceFileDiff } from '../types';

const splitLines = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized === '') return [];
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

type DiffOp = { type: 'equal' | 'delete' | 'insert'; line: string };

const diffOps = (beforeLines: string[], afterLines: string[]): DiffOp[] => {
  const m = beforeLines.length;
  const n = afterLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = beforeLines[i - 1] === afterLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      ops.push({ type: 'equal', line: beforeLines[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', line: afterLines[j - 1] });
      j -= 1;
    } else {
      ops.push({ type: 'delete', line: beforeLines[i - 1] });
      i -= 1;
    }
  }
  return ops.reverse();
};

export const unifiedDiff = (path: string, before: string | null | undefined, after: string): WorkspaceFileDiff => {
  const beforeText = before ?? null;
  if (beforeText === after) {
    return { path, change: 'unchanged', before: beforeText, after, patch: '' };
  }

  const beforeLines = beforeText == null ? [] : splitLines(beforeText);
  const afterLines = splitLines(after);
  const ops = diffOps(beforeLines, afterLines);
  const change = beforeText == null ? 'added' : 'modified';

  const body: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  for (const op of ops) {
    if (op.type === 'equal') {
      body.push(` ${op.line}`);
      oldCount += 1;
      newCount += 1;
    } else if (op.type === 'delete') {
      body.push(`-${op.line}`);
      oldCount += 1;
    } else {
      body.push(`+${op.line}`);
      newCount += 1;
    }
  }

  const oldStart = beforeText == null || oldCount === 0 ? '0' : '1';
  const newStart = newCount === 0 ? '0' : '1';
  const header = [
    `--- ${beforeText == null ? '/dev/null' : `a/${path}`}`,
    `+++ b/${path}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
  ];

  return {
    path,
    change,
    before: beforeText,
    after,
    patch: [...header, ...body].join('\n'),
  };
};

export const buildWorkspaceDiff = (
  files: GeneratedFile[],
  existingByPath: Record<string, string | null | undefined> = {}
): WorkspaceFileDiff[] =>
  files.map((file) => unifiedDiff(file.path, existingByPath[file.path], file.content));
