/**
 * Conteúdo da página pública. Regra: só apresentar o que o produto realmente faz.
 * Números vêm do próprio conteúdo do core (nada de métricas de marketing, depoimentos ou porcentagens).
 */
import {
  ASSISTANT_PERSONA,
  CONVERSATION_TOPICS,
  GRAMMAR_RULES,
  LESSONS,
  LEVEL_LABELS,
  LEVELS,
  PLACEMENT_QUESTIONS,
  PLACEMENT_STAGES,
  REVIEW_INTERVALS_DAYS,
  VOCABULARY,
} from '@english-ai/core';

export const SECTIONS = [
  { id: 'inicio', label: 'Início' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'aprender', label: 'Aprender' },
  { id: 'conversar', label: 'Conversar' },
  { id: 'ia', label: 'IA' },
  { id: 'progresso', label: 'Progresso' },
  { id: 'seguranca', label: 'Segurança' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'] | 'problema' | 'personalizacao' | 'sobre';

const exerciseCount = LESSONS.reduce((total, lesson) => total + lesson.exercises.length, 0);

/** Fatos do conteúdo atual, calculados a partir do core. */
export const FACTS = {
  assistant: ASSISTANT_PERSONA.name,
  lessons: LESSONS.length,
  exercises: exerciseCount,
  words: VOCABULARY.length,
  topics: CONVERSATION_TOPICS.length,
  topicTitles: CONVERSATION_TOPICS.map((topic) => topic.title),
  grammarRules: GRAMMAR_RULES.length,
  placementQuestions: PLACEMENT_QUESTIONS.length,
  placementStages: PLACEMENT_STAGES.length,
  reviewIntervals: REVIEW_INTERVALS_DAYS.join(', '),
  lessonsByLevel: LEVELS.map((level) => ({
    level,
    label: LEVEL_LABELS[level],
    count: LESSONS.filter((lesson) => lesson.level === level).length,
  })),
  levelPath: LEVELS.map((level) => LEVEL_LABELS[level]).join(' → '),
};

export const PROBLEMS = [
  {
    icon: 'compass',
    title: 'Não saber por onde começar',
    answer: 'O nivelamento estima seu nível e a trilha indica sempre a próxima aula.',
  },
  {
    icon: 'heart',
    title: 'Medo de errar',
    answer: 'Na conversa, a IA responde com naturalidade e corrige sem constranger. Errar faz parte.',
  },
  {
    icon: 'messages',
    title: 'Falta de prática',
    answer: 'O Modo Conversação oferece prática escrita em temas do dia a dia, quando você quiser.',
  },
  {
    icon: 'lightbulb',
    title: 'Explicações complicadas',
    answer: 'Explicações curtas, em português nos níveis iniciais, e um botão para “explicar de outro jeito”.',
  },
  {
    icon: 'layers',
    title: 'Conteúdo espalhado',
    answer: 'Aulas, exercícios, vocabulário e revisão no mesmo lugar, na ordem certa.',
  },
  {
    icon: 'sliders',
    title: 'Pouca personalização',
    answer: 'Seu objetivo, nível, interesses e erros recorrentes orientam recomendações e revisões.',
  },
  {
    icon: 'calendar',
    title: 'Dificuldade de manter a rotina',
    answer: 'Aulas curtas, meta diária e sequência de dias para o estudo caber no seu dia.',
  },
] as const;

export const STEPS = [
  { icon: 'user', title: 'Crie sua conta', text: 'Nome, e-mail e senha. Leva menos de um minuto.' },
  {
    icon: 'target',
    title: 'Defina seus objetivos',
    text: 'Conte por que quer aprender, como descreve seu inglês e quais temas interessam a você.',
  },
  {
    icon: 'gauge',
    title: 'Faça seu nivelamento',
    text: `Até ${FACTS.placementQuestions} perguntas em ${FACTS.placementStages} etapas estimam seu nível. Também dá para começar do zero.`,
  },
  { icon: 'split', title: 'Aprenda ou converse', text: 'Siga a trilha de aulas ou pratique conversando com a IA. Você escolhe o modo.' },
  {
    icon: 'trending',
    title: 'Acompanhe sua evolução',
    text: 'Progresso, revisões e vocabulário mostram o que você já domina e o que vale revisar.',
  },
] as const;

export const LEARN_FEATURES = [
  { title: 'Aulas estruturadas por nível', text: `Trilha ${FACTS.levelPath}, com aulas curtas e objetivas.` },
  { title: 'Explicação que você entende', text: 'Texto direto, com a opção de pedir uma explicação de outro jeito.' },
  { title: 'Exemplos', text: 'Frases de exemplo com tradução, e um novo exemplo quando você pedir.' },
  { title: 'Vocabulário', text: 'As palavras de cada aula ficam no seu Vocabulário, com significado e exemplos.' },
  {
    title: 'Exercícios de 5 tipos',
    text: 'Múltipla escolha, lacuna, seleção de palavra, tradução e escrita livre.',
  },
  { title: 'Correção na hora', text: 'Você vê a forma recomendada e o porquê do erro, não só “certo” ou “errado”.' },
  { title: 'Revisão espaçada', text: `O que você erra volta para revisão em intervalos de ${FACTS.reviewIntervals} dias.` },
] as const;

export const TALK_FEATURES = [
  { title: 'Conversa natural', text: 'A IA responde como uma parceira de prática, com perguntas que mantêm o assunto vivo.' },
  { title: 'Temas variados', text: `${FACTS.topics} temas para começar: ${FACTS.topicTitles.join(', ')}.` },
  { title: 'Contexto', text: 'As respostas consideram as mensagens anteriores da conversa.' },
  { title: 'No seu nível', text: 'Vocabulário, tamanho das respostas e apoio em português se ajustam ao seu nível.' },
  {
    title: 'Correções no seu estilo',
    text: 'Leve, equilibrada ou detalhada: você escolhe quanto quer ser corrigido.',
  },
  { title: 'Resumo ao final', text: 'Pontos para praticar e aulas que ajudam, sem interromper a conversa a cada frase.' },
] as const;

export const AI_CAPABILITIES = [
  { title: 'Explica conteúdos', text: 'Gramática e vocabulário em linguagem simples, com exemplos.' },
  { title: 'Adapta explicações', text: 'Explica de outro jeito quando a primeira explicação não funcionou.' },
  { title: 'Considera seu nível', text: 'Português nos primeiros níveis; mais inglês conforme você avança.' },
  { title: 'Identifica erros', text: 'Encontra o que atrapalha a frase: gramática, sentido ou naturalidade.' },
  { title: 'Explica correções', text: 'Mostra a forma recomendada, o porquê e, quando ajuda, uma dica.' },
  { title: 'Pratica conversação', text: `${FACTS.assistant}, a assistente, conversa em inglês sobre o tema que você escolher.` },
  { title: 'Dá feedback', text: 'Resume o que praticar e cria revisões a partir dos seus erros.' },
] as const;

export const PROGRESS_METRICS = [
  'Aulas concluídas',
  'Exercícios feitos',
  'Taxa de acerto',
  'Palavras estudadas',
  'Tempo de estudo',
  'Sequência de dias',
  'Conteúdos para revisar',
  'Nível estimado',
] as const;

export const PERSONALIZATION = [
  { title: 'Nível', text: 'Explicações, exemplos e conversas no nível estimado pelo nivelamento.' },
  { title: 'Objetivo', text: 'Seu objetivo e seus interesses destacam temas de conversa “para você”.' },
  { title: 'Desempenho', text: 'A próxima aula e a meta de hoje aparecem logo no Início.' },
  { title: 'Erros recorrentes', text: 'Os erros que se repetem viram revisões e aparecem no seu progresso.' },
  { title: 'Vocabulário', text: 'Palavras estudadas voltam para revisão no momento certo.' },
  { title: 'Progresso', text: 'O que você já concluiu define a próxima aula sugerida e o avanço dentro do seu nível.' },
] as const;

export const SECURITY_ITEMS = [
  { icon: 'key', title: 'Senhas protegidas', text: 'Guardadas apenas como hash (scrypt), nunca em texto.' },
  { icon: 'cookie', title: 'Sessão protegida', text: 'A sessão fica em um cookie que o JavaScript da página não consegue ler.' },
  {
    icon: 'mail',
    title: 'Recuperação de senha segura',
    text: 'O link enviado por e-mail vale por pouco tempo, funciona uma única vez e encerra as sessões antigas.',
  },
  {
    icon: 'history',
    title: 'Histórico sob seu controle',
    text: 'Salvar conversas é opcional, e as conversas salvas são apagadas automaticamente depois de um prazo.',
  },
  { icon: 'trash', title: 'Exclusão de dados', text: 'Você pode apagar suas conversas ou excluir a conta com todos os dados.' },
  {
    icon: 'server',
    title: 'Chaves só no servidor',
    text: 'Nenhuma chave de IA ou credencial fica no navegador; a IA recebe apenas o necessário.',
  },
  {
    icon: 'scale',
    title: 'Princípios da LGPD',
    text: 'Coleta mínima, finalidade explicada na tela de privacidade e transparência sobre o uso dos dados.',
  },
] as const;

/** Fora do escopo atual (ver docs/MVP-SCOPE.md) — dito com clareza na seção "Sobre o projeto". */
export const NOT_YET = ['voz e reconhecimento de pronúncia', 'chamadas ao vivo', 'gamificação avançada e ranking', 'certificação oficial'];
