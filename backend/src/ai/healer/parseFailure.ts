export interface ParsedLocator {
  kind: 'testid' | 'selector' | 'id' | 'name' | 'text' | 'role';
  value: string;
  name?: string;
  raw: string;
}

export const parseFailedLocator = (blob: string): ParsedLocator | null => {
  const text = blob || '';
  const focused = text
    .split('\n')
    .filter((line) => /waiting for|timeout|not found|strict mode|locator\.(click|fill|wait)/i.test(line))
    .join('\n') || text;
  const patterns: Array<{ re: RegExp; kind: ParsedLocator['kind']; value: number; name?: number }> = [
    { re: /getByTestId\(\s*['"]([^'"]+)['"]\s*\)/i, kind: 'testid', value: 1 },
    { re: /data-testid=["']([^"']+)["']/i, kind: 'testid', value: 1 },
    { re: /data-test=["']([^"']+)["']/i, kind: 'testid', value: 1 },
    { re: /getByRole\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*name:\s*[/]?['"]?([^'"/]+)/i, kind: 'role', value: 1, name: 2 },
    { re: /getByRole\(\s*['"]([^'"]+)['"]\s*\)/i, kind: 'role', value: 1 },
    { re: /getByLabel\(\s*[/]?['"]([^'"]+)['"]/i, kind: 'name', value: 1 },
    { re: /getByPlaceholder\(\s*[/]?['"]([^'"]+)['"]/i, kind: 'name', value: 1 },
    { re: /getByText\(\s*[/]?['"]([^'"]+)['"]/i, kind: 'text', value: 1 },
    { re: /locator\(\s*['"]([^'"]+)['"]\s*\)/i, kind: 'selector', value: 1 },
    { re: /waiting for ([#.][\w-]+)/i, kind: 'selector', value: 1 },
  ];

  for (const pattern of patterns) {
    const match = focused.match(pattern.re);
    if (!match) continue;
    const value = match[pattern.value]?.trim();
    if (!value) continue;
    const testIdFromSelector = value.match(/\[data-testid=["']([^"']+)["']\]/i)
      || value.match(/\[data-test=["']([^"']+)["']\]/i);
    if (testIdFromSelector) {
      return { kind: 'testid', value: testIdFromSelector[1], raw: match[0] };
    }
    return {
      kind: pattern.kind,
      value,
      name: pattern.name ? match[pattern.name]?.trim() : undefined,
      raw: match[0],
    };
  }
  return null;
};
