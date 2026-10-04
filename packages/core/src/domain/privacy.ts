/**
 * Minimização de dados (LGPD): remove dados pessoais óbvios antes de armazenar a mensagem
 * ou enviá-la ao serviço de IA. Não é um filtro perfeito — é uma camada extra de proteção.
 */
const PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: 'e-mail', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'CPF', regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { kind: 'cartão', regex: /\b(?:\d[ -]?){13,16}\b/g },
  { kind: 'telefone', regex: /(?:\+?\d{1,3}[ -]?)?\(?\d{2}\)?[ -]?\d{4,5}[ -]?\d{4}\b/g },
  { kind: 'senha', regex: /\b(password|senha)\s*(is|é|:)\s*\S+/gi },
];

export const REDACTION_PLACEHOLDER = '[dado removido]';

export interface RedactionResult {
  text: string;
  redactedKinds: string[];
}

export function redactSensitiveData(text: string): RedactionResult {
  const redactedKinds = new Set<string>();
  let result = text;
  for (const { kind, regex } of PATTERNS) {
    result = result.replace(regex, () => {
      redactedKinds.add(kind);
      return REDACTION_PLACEHOLDER;
    });
  }
  return { text: result, redactedKinds: [...redactedKinds] };
}

export function privacyNotice(kinds: string[]): string | null {
  if (!kinds.length) return null;
  return `Para proteger sua privacidade, removemos da mensagem: ${kinds.join(', ')}. Não é preciso compartilhar dados pessoais para praticar.`;
}
