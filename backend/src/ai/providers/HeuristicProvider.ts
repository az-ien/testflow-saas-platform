import { logger } from '../../config/logger';
import { parseJson } from '../json';
import { AiCompletionRequest, AiProvider } from '../types';

/**
 * Deterministic fallback used when no LLM API key is configured.
 * It does not invent application behaviour; callers still apply validator rules.
 */
export class HeuristicProvider implements AiProvider {
  name = 'heuristic';

  async complete(request: AiCompletionRequest): Promise<string> {
    logger.info('Heuristic AI provider used (no external LLM configured)');
    if (request.json) {
      return JSON.stringify(this.buildStructured(request.user));
    }
    const structured = this.buildStructured(request.user);
    return String(structured.summary || 'Heuristic analysis complete.');
  }

  async completeJson<T>(request: AiCompletionRequest): Promise<T> {
    try {
      return parseJson<T>(request.user);
    } catch {
      return this.buildStructured(request.user) as T;
    }
  }

  private buildStructured(user: string): Record<string, unknown> {
    const lower = user.toLowerCase();
    if (lower.includes('heal') || lower.includes('failure') || lower.includes('stack')) {
      return {
        rootCause: 'Locator or timing mismatch based on the failure evidence.',
        category: lower.includes('timeout') ? 'timing' : 'locator',
        summary: 'The test likely targeted a control that changed or did not become ready in time.',
        proposedFix: 'Prefer role/label locators and explicit web-first assertions. Do not remove assertions.',
        files: [],
        confidence: 0.45,
        preserveAssertions: true,
      };
    }
    if (lower.includes('validate') || lower.includes('classification')) {
      return { scenarios: [] };
    }
    return {
      summary: 'Heuristic provider cannot invent scenarios without evidence.',
      scenarios: [],
    };
  }
}
