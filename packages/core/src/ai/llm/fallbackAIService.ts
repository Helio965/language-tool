import type { AIService } from '../types';

export type FallbackListener = (method: keyof AIService, error: unknown) => void;

/**
 * Envolve o provedor principal e recorre ao modo demonstração quando ele falha
 * (indisponibilidade, timeout, resposta inválida). Mantém o sistema utilizável (RNF07).
 */
export class FallbackAIService implements AIService {
  constructor(
    private readonly primary: AIService,
    private readonly fallback: AIService,
    private readonly onFallback: FallbackListener = () => {},
  ) {}

  get providerName(): string {
    return this.primary.providerName;
  }

  private async run<K extends Exclude<keyof AIService, 'providerName'>>(
    method: K,
    ...args: Parameters<AIService[K]>
  ): Promise<Awaited<ReturnType<AIService[K]>>> {
    type Method = (...a: Parameters<AIService[K]>) => ReturnType<AIService[K]>;
    try {
      return await (this.primary[method] as unknown as Method).apply(this.primary, args);
    } catch (error) {
      this.onFallback(method, error);
      return await (this.fallback[method] as unknown as Method).apply(this.fallback, args);
    }
  }

  startConversation: AIService['startConversation'] = (input) => this.run('startConversation', input);
  conversation: AIService['conversation'] = (input) => this.run('conversation', input);
  explain: AIService['explain'] = (input) => this.run('explain', input);
  anotherExample: AIService['anotherExample'] = (input) => this.run('anotherExample', input);
  correct: AIService['correct'] = (input) => this.run('correct', input);
  generateExercise: AIService['generateExercise'] = (input) => this.run('generateExercise', input);
}
