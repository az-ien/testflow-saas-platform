import { getAiProvider } from './index';
import { HeuristicProvider } from './HeuristicProvider';

describe('AI provider selection', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('falls back to the heuristic provider when no keys are configured', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_PROVIDER = '';
    const provider = getAiProvider();
    expect(provider).toBeInstanceOf(HeuristicProvider);
  });
});
