import { logger } from '../../config/logger';
import { AiProvider } from '../types';
import { AnthropicProvider } from './AnthropicProvider';
import { HeuristicProvider } from './HeuristicProvider';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';

export interface AiProviderOverrides {
  provider?: string | null;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
}

export const getAiProvider = (overrides: AiProviderOverrides = {}): AiProvider => {
  const configured = (overrides.provider || process.env.AI_PROVIDER || '').toLowerCase();
  const anthropicKey = overrides.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = overrides.openaiApiKey || process.env.OPENAI_API_KEY;

  if (configured === 'heuristic') {
    return new HeuristicProvider();
  }

  if ((configured === 'anthropic' || !configured) && anthropicKey) {
    return new AnthropicProvider(
      anthropicKey,
      process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    );
  }

  if ((configured === 'openai' || configured === 'openai_compatible' || !configured) && openaiKey) {
    return new OpenAiCompatibleProvider(
      openaiKey,
      process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      process.env.OPENAI_MODEL || 'gpt-4o-mini'
    );
  }

  logger.warn('No LLM API key configured; using heuristic AI provider');
  return new HeuristicProvider();
};

export { AnthropicProvider, HeuristicProvider, OpenAiCompatibleProvider };
