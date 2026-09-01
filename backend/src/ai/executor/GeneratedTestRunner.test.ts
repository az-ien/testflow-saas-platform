import http from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { PlaywrightAdapter } from '../adapters/PlaywrightAdapter';
import { GeneratedTestRunner } from './GeneratedTestRunner';

const loginPage = `<!doctype html>
<html>
  <head><title>Catalog Login</title></head>
  <body>
    <h1>Catalog Login</h1>
    <form method="POST" action="/login">
      <label>Username <input data-testid="username" name="username" /></label>
      <label>Password <input data-testid="password" name="password" type="password" /></label>
      <button data-testid="login-button" type="submit">Login</button>
    </form>
  </body>
</html>`;

const catalogPage = `<!doctype html>
<html>
  <head><title>Product catalog</title></head>
  <body>
    <h1>Product catalog</h1>
    <p>Signed in.</p>
  </body>
</html>`;

const startFixture = async (): Promise<{ url: string; close: () => Promise<void> }> => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const cookies = Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim().split('='))
        .filter((pair) => pair[0])
        .map(([key, ...rest]) => [key, rest.join('=')])
    );

    if (req.method === 'POST' && url.pathname === '/login') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        if (params.get('username') === 'tester' && params.get('password') === 'pass123') {
          res.writeHead(302, { Location: '/catalog', 'Set-Cookie': 'session=ok; Path=/' });
        } else {
          res.writeHead(302, { Location: '/' });
        }
        res.end();
      });
      return;
    }

    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (url.pathname === '/catalog') {
      if (cookies.session !== 'ok') {
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      res.end(catalogPage);
      return;
    }
    res.end(loginPage);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
};

describe('GeneratedTestRunner', () => {
  jest.setTimeout(120000);

  it('compiles and passes a generated login spec against a local fixture', async () => {
    const fixture = await startFixture();
    const previousArtifact = process.env.ARTIFACT_DIR;
    process.env.ARTIFACT_DIR = path.join(os.tmpdir(), 'testflow-generated-runner-tests');
    try {
      const files = new PlaywrightAdapter().generate({
        requirementKey: 'REQ-LOGIN',
        requirementTitle: 'Catalog login',
        applicationUrl: fixture.url,
        scenario: {
          scenarioKey: 'REQ-LOGIN-SC01',
          title: 'Login with valid credentials',
          description: 'Sign in',
          steps: [
            { order: 1, action: 'Open the application' },
            { order: 2, action: 'Enter username', target: 'testid:username' },
            { order: 3, action: 'Enter password', target: 'testid:password' },
            { order: 4, action: 'Click login', target: 'testid:login-button' },
            { order: 5, action: 'Verify catalog heading', target: 'text:Product catalog' },
          ],
          expectedResult: 'Product catalog is visible',
          requirementRefs: ['REQ-LOGIN'],
          evidenceRefs: ['testid:username', 'testid:password', 'testid:login-button', 'text:Product catalog'],
          assumptions: [],
          rationale: 'Observed login form',
        },
      });

      const runner = new GeneratedTestRunner();
      const workspace = await runner.materialize({
        userId: 'user-1',
        projectId: 'proj-1',
        generatedTestId: 'gen-login-1',
        files,
      });

      const compile = await runner.compileCheck(workspace);
      if (!compile.ok) {
        throw new Error(`compile failed: ${compile.log}`);
      }

      const result = await runner.execute(workspace, {
        APP_URL: fixture.url,
        BASE_URL: fixture.url,
        TEST_USERNAME: 'tester',
        TEST_PASSWORD: 'pass123',
      });

      expect(result.status).toBe('passed');
      expect(result.summary.failed).toBe(0);
      expect(result.summary.passed).toBeGreaterThan(0);
    } finally {
      if (previousArtifact === undefined) delete process.env.ARTIFACT_DIR;
      else process.env.ARTIFACT_DIR = previousArtifact;
      await fixture.close();
    }
  });
});
