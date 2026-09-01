import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../../config/logger';

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Optional stdio JSON-RPC client for Playwright MCP.
 * Isolated browser exploration in production uses PlaywrightExplorer.
 * This client is the integration point for `npx @playwright/mcp` (or `playwright run-test-mcp-server`).
 */
export class PlaywrightMcpClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;

  get enabled(): boolean {
    return process.env.PLAYWRIGHT_MCP_ENABLED === 'true';
  }

  async start(): Promise<void> {
    if (!this.enabled) return;
    const command = process.env.PLAYWRIGHT_MCP_COMMAND || 'npx';
    const args = (process.env.PLAYWRIGHT_MCP_ARGS || '@playwright/mcp').split(' ').filter(Boolean);
    this.proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stderr.on('data', (buf) => logger.debug(`Playwright MCP: ${buf.toString()}`));
    logger.info('Playwright MCP process started', { command, args });
  }

  async call(tool: McpToolCall): Promise<unknown> {
    if (!this.proc) {
      throw new Error('Playwright MCP is not running');
    }
    const payload = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'tools/call',
      params: { name: tool.name, arguments: tool.arguments },
    };
    return new Promise((resolve, reject) => {
      const onData = (buf: Buffer) => {
        try {
          const parsed = JSON.parse(buf.toString());
          this.proc?.stdout.off('data', onData);
          if (parsed.error) reject(new Error(parsed.error.message || 'MCP error'));
          else resolve(parsed.result);
        } catch (err) {
          reject(err);
        }
      };
      this.proc!.stdout.on('data', onData);
      this.proc!.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    this.proc.kill('SIGTERM');
    this.proc = null;
  }
}

export default PlaywrightMcpClient;
