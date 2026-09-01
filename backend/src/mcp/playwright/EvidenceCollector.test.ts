import { toEvidenceRecords } from './EvidenceCollector';

describe('toEvidenceRecords', () => {
  it('stores action logs and authentication flags without inventing pages', () => {
    const records = toEvidenceRecords({
      startUrl: 'https://app.example.com',
      pages: [
        {
          url: 'https://app.example.com/login',
          title: 'Login',
          snapshot: 'Username Password',
          headings: ['Login'],
          interactiveElements: [{ tag: 'input', type: 'password', testId: 'password' }],
          reachedBy: 'goto',
        },
      ],
      observations: ['Login form observed; credentials were not provided so authenticated pages were not explored.'],
      consoleMessages: [],
      networkErrors: [],
      authenticated: false,
      loginAttempted: false,
      actionLog: [
        { type: 'goto', timestamp: '2026-09-01T00:00:00.000Z', url: 'https://app.example.com/login', result: 'ok' },
        {
          type: 'fill',
          timestamp: '2026-09-01T00:00:01.000Z',
          locator: { testId: 'password', type: 'password' },
          result: 'ok',
          valueRedacted: true,
        },
      ],
    });

    expect(records.find((row) => row.kind === 'observation')?.payload.authenticated).toBe(false);
    expect(records.find((row) => row.kind === 'action')?.payload.actions).toHaveLength(2);
    expect(records.some((row) => row.kind === 'dom')).toBe(true);
  });
});
