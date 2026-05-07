import axios from 'axios';
import crypto from 'crypto';
import { logger } from './config/logger';

export class WebhookNotifier {
  constructor(
    private webhookUrl?: string,
    private secret?: string
  ) {}

  async notify(event: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.webhookUrl) return;

    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), ...payload });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TestFlow-Webhook/1.0',
    };

    if (this.secret) {
      const sig = crypto.createHmac('sha256', this.secret).update(body).digest('hex');
      headers['X-TestFlow-Signature'] = `sha256=${sig}`;
    }

    try {
      await axios.post(this.webhookUrl, body, { headers, timeout: 10_000 });
      logger.info(`Webhook delivered: ${event} → ${this.webhookUrl}`);
    } catch (err: any) {
      logger.warn(`Webhook delivery failed (${event}): ${err.message}`);
    }
  }
}
