/**
 * Porta para provedores de modelos de linguagem. Implementações concretas (que precisam
 * de chave de API) ficam no back-end — a chave nunca chega ao navegador.
 */
export interface AIProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProviderRequest {
  system: string;
  messages: AIProviderMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface AIProvider {
  readonly name: string;
  complete(request: AIProviderRequest): Promise<string>;
}

/** Extrai o primeiro objeto JSON de uma resposta textual do modelo. */
export function parseJsonObject<T>(raw: string): T {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI response did not contain JSON');
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
