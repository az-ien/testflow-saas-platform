/**
 * Postgres API checks. Skipped unless RUN_API_INTEGRATION=true and a database is reachable.
 */
const enabled = process.env.RUN_API_INTEGRATION === 'true';

const maybe = enabled ? describe : describe.skip;

maybe('API integration', () => {
  it('requires a live PostgreSQL URL when enabled', () => {
    expect(process.env.DB_HOST || process.env.DATABASE_URL).toBeTruthy();
  });
});
