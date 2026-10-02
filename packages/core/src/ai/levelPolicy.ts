/**
 * Adaptação ao nível (RN03, RN05, RF11). Regras configuráveis em um único lugar:
 * a interface, o modo demonstração e os prompts do provedor real leem esta tabela.
 */
import type { Bilingual } from '../domain/content';
import type { ExplanationLanguage } from '../domain/entities';
import type { Level } from '../domain/levels';

export type Language = 'pt' | 'en';
export type LanguageBand = 'low' | 'high';

export interface LevelPolicy {
  level: Level;
  /** Idioma principal das explicações quando a preferência é "automático". */
  explanationLanguage: Language;
  /** Oferecer o outro idioma como apoio ("Ver em português"/"See in English"). */
  offerSupportLanguage: boolean;
  /** Traduções de apoio nas mensagens da IA no Modo Conversação (padrão). */
  conversationTranslations: boolean;
  /** Faixa de linguagem usada nas perguntas da conversa. */
  band: LanguageBand;
  /** Tamanho máximo recomendado das frases da IA (em palavras). */
  maxSentenceWords: number;
  /** Número de frases por resposta da IA na conversa. */
  replySentences: { min: number; max: number };
  vocabulary: string;
  /** Detalhamento padrão das explicações de erro. */
  explanationDetail: 'step_by_step' | 'clear' | 'detailed' | 'concise';
  /** Exibir dica extra junto da explicação, mesmo sem correção detalhada. */
  includeTipByDefault: boolean;
  /** Resumo da regra (exibido em docs e usado nos prompts). */
  summary: string;
}

export const LEVEL_POLICIES: Record<Level, LevelPolicy> = {
  beginner: {
    level: 'beginner',
    explanationLanguage: 'pt',
    offerSupportLanguage: true,
    conversationTranslations: true,
    band: 'low',
    maxSentenceWords: 8,
    replySentences: { min: 1, max: 2 },
    vocabulary: 'palavras muito frequentes e concretas; nada de expressões idiomáticas',
    explanationDetail: 'step_by_step',
    includeTipByDefault: true,
    summary:
      'Explicações predominantemente em português, inglês simples, frases curtas, tradução de apoio e exemplos básicos.',
  },
  basic: {
    level: 'basic',
    explanationLanguage: 'pt',
    offerSupportLanguage: true,
    conversationTranslations: true,
    band: 'low',
    maxSentenceWords: 12,
    replySentences: { min: 1, max: 3 },
    vocabulary: 'vocabulário do cotidiano; expressões comuns com explicação',
    explanationDetail: 'clear',
    includeTipByDefault: false,
    summary:
      'Mais exposição ao inglês, explicações em português quando necessário e exercícios mais contextualizados.',
  },
  intermediate: {
    level: 'intermediate',
    explanationLanguage: 'en',
    offerSupportLanguage: true,
    conversationTranslations: false,
    band: 'high',
    maxSentenceWords: 18,
    replySentences: { min: 2, max: 3 },
    vocabulary: 'vocabulário variado, phrasal verbs comuns, expressões naturais',
    explanationDetail: 'detailed',
    includeTipByDefault: false,
    summary: 'Respostas principalmente em inglês, português como apoio e correções mais detalhadas.',
  },
  advanced: {
    level: 'advanced',
    explanationLanguage: 'en',
    offerSupportLanguage: false,
    conversationTranslations: false,
    band: 'high',
    maxSentenceWords: 25,
    replySentences: { min: 2, max: 4 },
    vocabulary: 'vocabulário rico e idiomático; nuances de registro (formal/informal)',
    explanationDetail: 'concise',
    includeTipByDefault: false,
    summary:
      'Comunicação predominantemente em inglês, foco em naturalidade, vocabulário sofisticado e explicações linguísticas quando necessário.',
  },
};

export function policyFor(level: Level): LevelPolicy {
  return LEVEL_POLICIES[level];
}

/** Resolve o idioma das explicações combinando nível e preferência do usuário (UC12). */
export function resolveExplanationLanguage(level: Level, preference: ExplanationLanguage): Language {
  if (preference === 'pt' || preference === 'en') return preference;
  return LEVEL_POLICIES[level].explanationLanguage;
}

/** Adaptação determinística de conteúdo bilíngue já existente (sem custo de IA). */
export function adaptBilingual(text: Bilingual, language: Language): { primary: string; support: string } {
  return language === 'pt' ? { primary: text.pt, support: text.en } : { primary: text.en, support: text.pt };
}
