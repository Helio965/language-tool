import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIProviderRequest } from '@english-ai/core';

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  timeoutMs: number;
}

/** Recusa de segurança do modelo — tratada como falha para acionar o fallback da aplicação. */
export class AIRefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`AI request declined${category ? ` (${category})` : ''}`);
    this.name = 'AIRefusalError';
  }
}

/**
 * Adaptador para a API de Mensagens da Anthropic (SDK oficial).
 * - O pensamento adaptativo é sempre ativo nos modelos atuais; o esforço é controlado por `effort`
 *   (padrão "low", adequado a respostas curtas de tutoria).
 * - Parâmetros de amostragem (temperature etc.) não são enviados: não são aceitos nos modelos atuais.
 * - `max_tokens` deixa espaço para o raciocínio interno; o prompt pede respostas curtas.
 * - Fallback de recusa no servidor ("default") habilitado; se ainda assim houver recusa,
 *   a aplicação recorre ao modo demonstração (FallbackAIService).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs, maxRetries: 1 });
  }

  async complete(request: AIProviderRequest): Promise<string> {
    const response = await this.client.beta.messages.create({
      model: this.options.model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      messages: request.messages,
      output_config: {
        effort: this.options.effort,
        ...(request.jsonSchema ? { format: { type: 'json_schema' as const, schema: request.jsonSchema } } : {}),
      },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') {
      throw new AIRefusalError(response.stop_details?.category ?? null);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('AI response truncated (max_tokens)');
    }
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!text) throw new Error('Empty AI response');
    return text;
  }
}
