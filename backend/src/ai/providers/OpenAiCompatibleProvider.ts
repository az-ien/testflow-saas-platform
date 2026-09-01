import axios from 'axios';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';
import { parseJson } from '../json';
import { AiCompletionRequest, AiProvider } from '../types';

export class OpenAiCompatibleProvider implements AiProvider {
  name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.openai.com/v1',
    private readonly model = 'gpt-4o-mini'
  ) {}

  async complete(request: AiCompletionRequest): Promise<string> {
    try {
      const { data } = await axios.post(
        `${this.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          model: this.model,
          temperature: request.temperature ?? 0.2,
          response_format: request.json ? { type: 'json_object' } : undefined,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120_000,
        }
      );
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new AppError('AI provider returned an empty response', 502);
      return content;
    } catch (err: any) {
      logger.error('OpenAI-compatible provider failed', { error: err.message });
      throw new AppError(`AI provider error: ${err.response?.data?.error?.message || err.message}`, 502);
    }
  }

  async completeJson<T>(request: AiCompletionRequest): Promise<T> {
    const raw = await this.complete({ ...request, json: true });
    return parseJson<T>(raw);
  }
}
