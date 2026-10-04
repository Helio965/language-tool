import { describe, expect, it } from 'vitest';
import { applyIssues, buildCorrection, checkGrammar, decideConversationCorrections, selectLearningCorrections } from '../src';

const fix = (text: string) => applyIssues(text, checkGrammar(text));

describe('verificador gramatical (regras para falantes de português)', () => {
  it('corrige o exemplo do documento: "She go to school every day."', () => {
    expect(fix('She go to school every day.')).toBe('She goes to school every day.');
  });

  it('corrige o exemplo do documento: "I have 25 years."', () => {
    expect(fix('I have 25 years.')).toBe('I am 25 years old.');
  });

  it.each([
    ['Does she likes pizza?', 'Does she like pizza?'],
    ["I didn't went to work.", "I didn't go to work."],
    ['My sister work in a bank.', 'My sister works in a bank.'],
    ['I am agree with you.', 'I agree with you.'],
    ['People is nice here.', 'People are nice here.'],
    ['I go to the gym in monday.', 'I go to the gym on Monday.'],
    ['In my city have many parks.', 'In my city, there are many parks.'],
    ['I like play soccer.', 'I like playing soccer.'],
    ["He don't like it.", "He doesn't like it."],
    ['I went to home early.', 'I went home early.'],
    ['Can you explain me this?', 'Can you explain this to me?'],
    ['How many years do you have?', 'How old are you?'],
    ['i think so', 'I think so'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(fix(input)).toBe(expected);
  });

  it.each(['Am I late?', 'Let it go.', 'Does it work?', 'I have three years of experience.', 'She goes to work.', 'Yesterday she go to school.'])(
    'não acusa falso positivo em "%s"',
    (input) => {
      expect(checkGrammar(input).filter((issue) => issue.severity !== 'naturalness')).toEqual([]);
    },
  );

  it('monta a correção no formato Sua frase / Forma recomendada / Explicação', () => {
    const text = 'She go to school every day.';
    const correction = buildCorrection(text, checkGrammar(text), 'pt', false);
    expect(correction).toMatchObject({
      original: text,
      suggestion: 'She goes to school every day.',
      severity: 'grammar',
      skillTag: 'simple_present',
      tip: null,
    });
    expect(correction?.explanation).toContain('adicionamos "-s"');
  });

  it('explica em inglês quando o idioma resolvido é inglês', () => {
    const text = 'I have 25 years.';
    expect(buildCorrection(text, checkGrammar(text), 'en', true)?.explanation).toContain('verb "to be"');
  });

  it('marca "I\'m boring" como erro que muda o sentido', () => {
    expect(checkGrammar("I'm boring today")[0]?.severity).toBe('meaning');
  });
});

describe('política de correção (naturalidade > correção excessiva)', () => {
  const grammar = checkGrammar('She go to school.');
  const meaning = checkGrammar('I am boring at home.');
  const naturalness = checkGrammar('i like it');

  it('modo leve: só mostra o que prejudica o entendimento', () => {
    const decision = decideConversationCorrections({ issues: [...grammar, ...naturalness], intensity: 'light', level: 'basic', turnsSinceInlineCorrection: 5 });
    expect(decision.inline).toEqual([]);
    expect(decision.deferred.map((issue) => issue.ruleId)).toEqual(['third_person_s']);
    expect(decision.ignored.map((issue) => issue.ruleId)).toEqual(['lowercase_i']);
    const withMeaning = decideConversationCorrections({ issues: meaning, intensity: 'light', level: 'basic', turnsSinceInlineCorrection: 0 });
    expect(withMeaning.inline).toHaveLength(1);
  });

  it('modo equilibrado: não interrompe mensagens seguidas', () => {
    const first = decideConversationCorrections({ issues: grammar, intensity: 'balanced', level: 'basic', turnsSinceInlineCorrection: 2 });
    expect(first.inline).toHaveLength(1);
    const rightAfter = decideConversationCorrections({ issues: grammar, intensity: 'balanced', level: 'basic', turnsSinceInlineCorrection: 0 });
    expect(rightAfter.inline).toHaveLength(0);
    expect(rightAfter.deferred).toHaveLength(1);
  });

  it('modo equilibrado: iniciantes não recebem correções de naturalidade', () => {
    const decision = decideConversationCorrections({ issues: naturalness, intensity: 'balanced', level: 'beginner', turnsSinceInlineCorrection: 5 });
    expect(decision.ignored).toHaveLength(1);
  });

  it('modo detalhado: mostra também naturalidade', () => {
    const decision = decideConversationCorrections({ issues: [...grammar, ...naturalness], intensity: 'detailed', level: 'advanced', turnsSinceInlineCorrection: 0 });
    expect(decision.inline).toHaveLength(2);
  });

  it('Modo Aprender: sempre mostra erros gramaticais', () => {
    expect(selectLearningCorrections([...grammar, ...naturalness], 'light').map((issue) => issue.ruleId)).toEqual(['third_person_s']);
    expect(selectLearningCorrections([...grammar, ...naturalness], 'detailed')).toHaveLength(2);
  });
});
