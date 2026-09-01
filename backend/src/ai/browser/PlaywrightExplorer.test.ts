import http from 'http';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { PlaywrightExplorer } from './PlaywrightExplorer';
import { toEvidenceRecords } from '../../mcp/playwright/EvidenceCollector';

const loginPage = `<!doctype html>
<html>
  <head><title>Catalog Login</title></head>
  <body>
    <h1>Catalog Login</h1>
    <form method="POST" action="/login">
      <label>Username <input data-testid="username" name="username" placeholder="Username" /></label>
      <label>Password <input data-testid="password" name="password" type="password" placeholder="Password" /></label>
      <button data-testid="login-button" type="submit">Login</button>
    </form>
    <a href="/about">About</a>
    <button data-testid="delete-account">Delete account</button>
  </body>
</html>`;

const aboutPage = `<!doctype html>
<html>
  <head><title>About</title></head>
  <body>
    <h1>About the catalog</h1>
    <p>Public information only.</p>
    <a href="/">Home</a>
  </body>
</html>`;

const catalogPage = `<!doctype html>
<html>
  <head><title>Catalog</title></head>
  <body>
    <h1>Product catalog</h1>
    <button data-testid="add-to-cart-widget" type="button">Add to cart</button>
    <a href="/product/1">Widget</a>
    <a href="/logout">Logout</a>
  </body>
</html>`;

const productPage = `<!doctype html>
<html>
  <head><title>Widget</title></head>
  <body>
    <h1>Widget</h1>
    <p>A generic inventory item.</p>
    <button data-testid="add-to-cart-widget" type="button">Add to cart</button>
    <a href="/catalog">Back to catalog</a>
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
    if (url.pathname === '/about') {
      res.end(aboutPage);
      return;
    }
    if (url.pathname === '/catalog' || url.pathname === '/product/1') {
      if (cookies.session !== 'ok') {
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      res.end(url.pathname === '/catalog' ? catalogPage : productPage);
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

describe('PlaywrightExplorer interactive exploration', () => {
  jest.setTimeout(60000);

  it('does not invent authenticated pages when credentials are missing', async () => {
    const fixture = await startFixture();
    try {
      const explorer = new PlaywrightExplorer();
      const result = await explorer.explore({
        startUrl: fixture.url,
        projectId: 'proj',
        userId: 'user',
        correlationId: 'no-creds',
        maxPages: 4,
        artifactDir: path.join(os.tmpdir(), 'testflow-explore-tests'),
      });

      expect(result.error).toBeUndefined();
      expect(result.loginAttempted).toBe(false);
      expect(result.authenticated).toBe(false);
      expect(result.pages.some((page) => /catalog login/i.test(page.title))).toBe(true);
      expect(result.pages.some((page) => page.interactiveElements.some((el) => el.testId === 'username'))).toBe(true);
      expect(result.pages.some((page) => /product catalog/i.test(page.title))).toBe(false);
      expect(result.observations.some((line) => /credentials were not provided/i.test(line))).toBe(true);
      expect(result.actionLog?.some((action) => action.type === 'goto' && action.result === 'ok')).toBe(true);
      expect(result.actionLog?.some((action) => action.type === 'fill')).toBe(false);
    } finally {
      await fixture.close();
    }
  });

  it('logs in with provided credentials, records actions, and captures post-login evidence', async () => {
    const fixture = await startFixture();
    try {
      const explorer = new PlaywrightExplorer();
      const result = await explorer.explore({
        startUrl: fixture.url,
        projectId: 'proj',
        userId: 'user',
        correlationId: 'with-creds',
        maxPages: 5,
        credentials: { username: 'tester', password: 'pass123' },
        artifactDir: path.join(os.tmpdir(), 'testflow-explore-tests'),
      });

      expect(result.error).toBeUndefined();
      expect(result.loginAttempted).toBe(true);
      expect(result.authenticated).toBe(true);
      expect(result.pages.some((page) => /product catalog|widget/i.test(page.title))).toBe(true);
      expect(
        result.pages.some((page) => page.interactiveElements.some((el) => el.testId === 'add-to-cart-widget'))
      ).toBe(true);
      expect(result.actionLog?.some((action) => action.type === 'fill' && action.valueRedacted)).toBe(true);
      expect(result.actionLog?.some((action) => action.type === 'click' && action.result === 'ok')).toBe(true);
      expect(JSON.stringify(result.actionLog)).not.toContain('pass123');

      const evidence = toEvidenceRecords(result);
      expect(evidence.some((row) => row.kind === 'action')).toBe(true);
      expect(evidence.some((row) => row.kind === 'dom')).toBe(true);
      expect(evidence.some((row) => row.kind === 'screenshot')).toBe(true);
    } finally {
      await fixture.close();
    }
  });
});
