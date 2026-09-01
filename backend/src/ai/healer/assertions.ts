import { GeneratedFile } from '../types';

const EXPECT_CALL = /\bexpect\s*\(/g;
const ASSERTION_METHOD =
  /\.(toBeVisible|toHaveText|toContainText|toHaveURL|toHaveTitle|toHaveValue|toBeEnabled|toBeDisabled|toHaveCount|toHaveAttribute|not\.toHaveTitle)\s*\(/g;
const FORBIDDEN_WEAKENING = /\btest\.(fixme|skip)\s*\(|\.skip\s*\(/;
const WAIT_FOR_TIMEOUT = /waitForTimeout\s*\(/;

export const countMatches = (content: string, pattern: RegExp): number => {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return (content.match(global) || []).length;
};

export const fileBlob = (files: GeneratedFile[]): string =>
  files.map((file) => file.content || '').join('\n');

export const assertionCounts = (files: GeneratedFile[]): { expect: number; methods: number } => {
  const blob = fileBlob(files);
  return {
    expect: countMatches(blob, EXPECT_CALL),
    methods: countMatches(blob, ASSERTION_METHOD),
  };
};

export const assertionsPreserved = (before: GeneratedFile[], after: GeneratedFile[]): string[] => {
  const issues: string[] = [];
  const previous = assertionCounts(before);
  const next = assertionCounts(after);
  if (next.expect < previous.expect) {
    issues.push(`Removed expect() calls (${previous.expect} → ${next.expect})`);
  }
  if (next.methods < previous.methods) {
    issues.push(`Removed assertion methods (${previous.methods} → ${next.methods})`);
  }
  const afterBlob = fileBlob(after);
  const beforeBlob = fileBlob(before);
  if (FORBIDDEN_WEAKENING.test(afterBlob) && !FORBIDDEN_WEAKENING.test(beforeBlob)) {
    issues.push('Proposed skip/fixme would hide the failure');
  }
  if (WAIT_FOR_TIMEOUT.test(afterBlob) && !WAIT_FOR_TIMEOUT.test(beforeBlob)) {
    issues.push('Proposed waitForTimeout is not allowed');
  }
  return issues;
};
