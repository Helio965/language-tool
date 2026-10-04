import { FallbackAIService, LLMAIService, MockAIService, type AIService, type ContentCatalog } from '@english-ai/core';
import type { AppConfig } from '../config/env';
import type { Logger } from '../logger';
import { AnthropicProvider } from './anthropicProvider';

/**
 * Escolhe o serviço de IA conforme a configuração.
 * Sem chave configurada, o sistema continua funcionando no modo demonstração.
 * Para adicionar outro provedor: implemente AIProvider e registre-o aqui.
 */
export function createAIService(config: AppConfig, catalog: ContentCatalog, logger: Logger): AIService {
  const mock = new MockAIService(catalog);
  if (config.AI_PROVIDER === 'anthropic' && config.ANTHROPIC_API_KEY) {
    const provider = new AnthropicProvider({
      apiKey: config.ANTHROPIC_API_KEY,
      model: config.ANTHROPIC_MODEL,
      effort: config.AI_EFFORT,
      timeoutMs: config.AI_TIMEOUT_MS,
    });
    return new FallbackAIService(new LLMAIService(provider, catalog), mock, (method, error) =>
      logger.warn('ai.fallback', { method, reason: error instanceof Error ? error.name : 'unknown' }),
    );
  }
  return mock;
}
