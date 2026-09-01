import { unifiedDiff, buildWorkspaceDiff } from './diff';
import { GeneratedFile } from '../types';

describe('unifiedDiff', () => {
  it('marks a missing remote file as added', () => {
    const diff = unifiedDiff('tests/login.spec.ts', null, 'expect(true).toBe(true);');
    expect(diff.change).toBe('added');
    expect(diff.patch).toContain('--- /dev/null');
    expect(diff.patch).toContain('+++ b/tests/login.spec.ts');
    expect(diff.patch).toContain('+expect(true).toBe(true);');
  });

  it('marks identical content as unchanged', () => {
    const content = "test('ok', async () => {});";
    const diff = unifiedDiff('tests/ok.spec.ts', content, content);
    expect(diff.change).toBe('unchanged');
    expect(diff.patch).toBe('');
  });

  it('emits a modified unified patch for changed lines', () => {
    const before = ['export const loc = page.getByTestId("old");', 'await loc.click();'].join('\n');
    const after = ['export const loc = page.getByTestId("new");', 'await loc.click();'].join('\n');
    const diff = unifiedDiff('pages/LoginPage.ts', before, after);
    expect(diff.change).toBe('modified');
    expect(diff.patch).toContain('--- a/pages/LoginPage.ts');
    expect(diff.patch).toContain('-export const loc = page.getByTestId("old");');
    expect(diff.patch).toContain('+export const loc = page.getByTestId("new");');
    expect(diff.patch).toContain(' await loc.click();');
  });
});

describe('buildWorkspaceDiff', () => {
  const files: GeneratedFile[] = [
    { path: 'tests/a.spec.ts', content: 'new file', language: 'typescript', kind: 'test' },
    { path: 'pages/A.ts', content: 'updated', language: 'typescript', kind: 'page_object' },
  ];

  it('compares each generated file against existing remote content', () => {
    const diffs = buildWorkspaceDiff(files, {
      'pages/A.ts': 'original',
    });
    expect(diffs[0].change).toBe('added');
    expect(diffs[1].change).toBe('modified');
    expect(diffs[1].before).toBe('original');
  });
});
