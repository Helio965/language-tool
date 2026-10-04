import { describe, expect, it, vi } from 'vitest';
import {
  buildSystemPrompt,
  createStaticCatalog,
  emptyConversationContext,
  FallbackAIService,
  LLMAIService,
  MockAIService,
  toGrammarIssues,
  type AIProvider,
  type LearnerContext,
} from '../src';

const catalog = createStaticCatalog();
const learner: LearnerContext = {
  firstName: 'Alex',
  level: 'basic',
  goal: 'conversation',
  interestAreas: ['technology'],
  explanationLanguage: 'pt',
  correctionIntensity: 'balanced',
  replyLength: 'balanced',
  showTranslations: true,
  difficulties: ['simple_present'],
};
const topic = catalog.topic('introductions')!;

describe('modo demonstração da IA', () => {
  const ai = new MockAIService(catalog);

  it('inicia a conversa cumprimentando pelo nome e fazendo uma pergunta', async () => {
    const opening = await ai.startConversation({ learner, topic });
    expect(opening.reply).toContain('Alex');
    expect(opening.reply).toContain('Where are you from?');
    expect(opening.translation).toContain('De onde você é?');
  });

  it('mantém o contexto: lembra fatos e não repete perguntas', async () => {
    const opening = await ai.startConversation({ learner, topic });
    const turn = await ai.conversation({ learner, topic, context: opening.context, history: [], userMessage: "I'm from Recife and I love the beach." });
    expect(turn.context.facts.from).toBe('Recife');
    expect(turn.context.askedQuestionIds).toEqual(['intro-1', 'intro-2']);
    expect(turn.reply).toContain('How old are you?');
  });

  it('continua a conversa e reformula o erro naturalmente (recast) em vez de interromper', async () => {
    const turn = await ai.conversation({ learner, topic, context: emptyConversationContext(), history: [], userMessage: 'I have 25 years.' });
    expect(turn.issues.map((issue) => issue.ruleId)).toContain('age_with_have');
    expect(turn.reply).toContain('you are 25 years old');
  });

  it('no recast, retoma só a frase com erro (não ecoa saudações)', async () => {
    const turn = await ai.conversation({
      learner,
      topic,
      context: emptyConversationContext(),
      history: [],
      userMessage: 'Hi! My name is Bia and I have 25 years.',
    });
    expect(turn.reply).toMatch(/^Oh, so you are 25 years old\./);
    expect(turn.reply).not.toContain('so Hi');
    expect(turn.reply).toContain('Bia');
  });

  it('acolhe mensagens em português e incentiva o inglês', async () => {
    const turn = await ai.conversation({ learner, topic, context: emptyConversationContext(), history: [], userMessage: 'Eu não sei falar isso em inglês' });
    expect(turn.reply).toMatch(/try it in English/);
    expect(turn.issues).toEqual([]);
  });

  it('é honesta sobre ser uma IA', async () => {
    const turn = await ai.conversation({ learner, topic, context: emptyConversationContext(), history: [], userMessage: 'How old are you?' });
    expect(turn.reply).toContain("I'm an AI");
  });

  it('oferece explicação alternativa e novo exemplo da aula', async () => {
    const lesson = catalog.lesson('simple-present')!;
    const first = await ai.explain({ learner, lesson, style: 'another_way', attempt: 0 });
    const second = await ai.explain({ learner, lesson, style: 'another_way', attempt: 1 });
    expect(first).not.toBe(second);
    const example = await ai.anotherExample({ learner, lesson, attempt: 0 });
    expect(example.en.length).toBeGreaterThan(5);
  });
});

describe('prompts para provedor real', () => {
  it('monta o system prompt em camadas, sem dados pessoais além do primeiro nome', () => {
    const prompt = buildSystemPrompt('conversation', learner);
    expect(prompt).toContain('Lumi');
    expect(prompt).toContain('NATURALIDADE > CORREÇÃO EXCESSIVA');
    expect(prompt).toContain('Básico');
    expect(prompt).toContain('Equilibrada');
    expect(prompt).toContain('Alex');
    expect(prompt).not.toMatch(/@|senha:|password:/i);
  });

  it('diferencia o comportamento entre os modos', () => {
    expect(buildSystemPrompt('learn', learner)).toContain('Modo atual: APRENDER');
    expect(buildSystemPrompt('conversation', learner)).toContain('Modo atual: CONVERSAÇÃO');
  });
});

describe('serviço de IA com provedor real', () => {
  const provider = (response: string | Error): AIProvider => ({
    name: 'fake',
    complete: vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  });

  it('usa a resposta do modelo e descarta correções de trechos inexistentes', async () => {
    const ai = new LLMAIService(
      provider(
        JSON.stringify({
          reply: 'Nice! What do you do?',
          translation: 'Legal! O que você faz?',
          facts: { city: 'Recife' },
          issues: [
            { span: 'She go', replacement: 'She goes', severity: 'grammar', skill: 'simple_present', explanation_pt: 'x', explanation_en: 'y' },
            { span: 'texto inventado', replacement: 'z', severity: 'grammar' },
          ],
        }),
      ),
      catalog,
    );
    const turn = await ai.conversation({ learner, topic, context: emptyConversationContext(), history: [], userMessage: 'She go to work.' });
    expect(turn.reply).toBe('Nice! What do you do?');
    expect(turn.context.facts.city).toBe('Recife');
    expect(turn.issues).toHaveLength(1);
  });

  it('valida campos desconhecidos vindos do modelo', () => {
    const issues = toGrammarIssues([{ span: 'go', replacement: 'goes', severity: 'catastrophic', skill: 'hacking' }], 'I go');
    expect(issues[0]).toMatchObject({ severity: 'grammar', skillTag: 'word_choice' });
  });

  it('recorre ao modo demonstração quando o provedor falha', async () => {
    const onFallback = vi.fn();
    const ai = new FallbackAIService(new LLMAIService(provider(new Error('timeout')), catalog), new MockAIService(catalog), onFallback);
    const opening = await ai.startConversation({ learner, topic });
    expect(opening.reply).toContain('Alex');
    expect(onFallback).toHaveBeenCalledWith('startConversation', expect.any(Error));
    expect(ai.providerName).toBe('fake');
  });

  it('recorre ao modo demonstração quando o modelo responde algo que não é JSON', async () => {
    const ai = new FallbackAIService(new LLMAIService(provider('sorry, I cannot'), catalog), new MockAIService(catalog));
    const turn = await ai.conversation({ learner, topic, context: emptyConversationContext(), history: [], userMessage: 'Hello!' });
    expect(turn.reply.length).toBeGreaterThan(0);
  });
});
