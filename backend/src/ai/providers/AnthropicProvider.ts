import axios from 'axios';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';
import { parseJson } from '../json';
import { AiCompletionRequest, AiProvider } from '../types';

export class AnthropicProvider implements AiProvider {
  name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-sonnet-4-20250514'
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    try {
      const { data } = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: this.model,
          max_tokens: 4096,
          temperature: request.temperature ?? 0.2,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );
      const content = data?.content?.[0]?.text;
      if (!content) throw new AppError('AI provider returned an empty response', 502);
      return content;
    } catch (err: any) {
      logger.error('Anthropic provider failed', { error: err.message });
      throw new AppError(`AI provider error: ${err.response?.data?.error?.message || err.message}`, 502);
    }
  }

  async completeJson<T>(request: AiCompletionRequest): Promise<T> {
    const raw = await this.complete({
      ...request,
      system: `${request.system}\nReturn only valid JSON.`,
    });
    return parseJson<T>(raw);
  }
}
