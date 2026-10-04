/**
 * Esquemas de saída estruturada enviados ao provedor real. Garantem respostas em JSON
 * válido; a aplicação ainda valida e saneia cada campo (ver llmAIService.ts).
 */
import { SKILL_TAGS } from '../../domain/skills';

const strictObject = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const ISSUE_SCHEMA = strictObject({
  span: { type: 'string', description: 'Trecho exato copiado da mensagem do usuário' },
  replacement: { type: 'string', description: 'Substituição sugerida para o trecho' },
  severity: { type: 'string', enum: ['meaning', 'grammar', 'naturalness'] },
  skill: { type: 'string', enum: [...SKILL_TAGS] },
  explanation_pt: { type: 'string' },
  explanation_en: { type: 'string' },
});

export const OPENING_SCHEMA = strictObject({
  reply: { type: 'string' },
  translation: { type: 'string', description: 'Tradução em português ou string vazia' },
});

export const CONVERSATION_SCHEMA = strictObject({
  reply: { type: 'string' },
  translation: { type: 'string', description: 'Tradução em português ou string vazia' },
  facts: {
    type: 'array',
    description: 'Fatos que o usuário contou nesta mensagem (ex.: city, job)',
    items: strictObject({ key: { type: 'string' }, value: { type: 'string' } }),
  },
  issues: { type: 'array', items: ISSUE_SCHEMA },
});

export const EXAMPLE_SCHEMA = strictObject({
  en: { type: 'string' },
  pt: { type: 'string' },
  highlight: { type: 'string', description: 'Trecho da frase em inglês a destacar' },
});

export const CORRECTION_SCHEMA = strictObject({
  feedback: { type: 'string' },
  issues: { type: 'array', items: ISSUE_SCHEMA },
});
