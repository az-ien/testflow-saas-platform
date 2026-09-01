import { logger } from '../../config/logger';
import { AiProvider } from '../types';
import { AnthropicProvider } from './AnthropicProvider';
import { HeuristicProvider } from './HeuristicProvider';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';

export const getAiProvider = (): AiProvider => {
  const configured = (process.env.AI_PROVIDER || '').toLowerCase();

  if (configured === 'heuristic') {
    return new HeuristicProvider();
  }

  if ((configured === 'anthropic' || !configured) && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY,
      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    );
  }

  if ((configured === 'openai' || configured === 'openai_compatible' || !configured) && process.env.OPENAI_API_KEY) {
    return new OpenAiCompatibleProvider(
      process.env.OPENAI_API_KEY,
      process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      process.env.OPENAI_MODEL || 'gpt-4o-mini'
    );
  }

  logger.warn('No LLM API key configured; using heuristic AI provider');
  return new HeuristicProvider();
};

export { AnthropicProvider, HeuristicProvider, OpenAiCompatibleProvider };
