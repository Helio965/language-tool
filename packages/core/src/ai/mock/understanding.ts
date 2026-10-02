/**
 * "Compreensão" simples usada pelo modo demonstração: extração de fatos,
 * detecção de português, de perguntas e de linguagem ofensiva.
 * Não pretende ser um modelo de linguagem — apenas mantém a demonstração coerente.
 */
import type { Bilingual } from '../../domain/content';
import { capitalizeFirst } from '../../domain/text';

const JOBS =
  'student|teacher|developer|programmer|engineer|designer|doctor|nurse|lawyer|manager|analyst|salesperson|cook|chef|writer|driver|mechanic|accountant|architect|journalist|artist|musician|photographer|psychologist|dentist|pharmacist|receptionist|consultant|freelancer|entrepreneur|intern|seller|cashier|waiter|waitress|police officer|firefighter|scientist|researcher';

const END = String.raw`(?=[.,!?;]|$|\s+(?:and|but|because|so|with|in|at|on)\b)`;

const FACT_PATTERNS: Array<{ key: string; regex: RegExp }> = [
  { key: 'name', regex: /\b(?:my name is|i['’]?m called|call me)\s+([A-Z][a-zÀ-ÿ]+)/i },
  { key: 'age', regex: /\b(?:i['’]?m|i am|i have)\s+(\d{1,2})(?:\s+years?)?(?:\s+old)?\b/i },
  { key: 'from', regex: new RegExp(String.raw`\b(?:i['’]?m|i am)\s+from\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,28}?)${END}`, 'i') },
  { key: 'city', regex: new RegExp(String.raw`\bi live in\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,28}?)${END}`, 'i') },
  { key: 'job', regex: new RegExp(String.raw`\b(?:i['’]?m|i am|i work as)\s+an?\s+(${JOBS})\b`, 'i') },
  { key: 'likes', regex: new RegExp(String.raw`\bi (?:really )?(?:like|love|enjoy)\s+([a-zÀ-ÿ][a-zÀ-ÿ\s]{1,28}?)${END}`, 'i') },
  { key: 'food', regex: new RegExp(String.raw`\bfavou?rite food is\s+([a-zÀ-ÿ][a-zÀ-ÿ\s]{1,24}?)${END}`, 'i') },
];

export function extractFacts(text: string): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const { key, regex } of FACT_PATTERNS) {
    const value = regex.exec(text)?.[1]?.trim();
    if (value) facts[key] = key === 'name' || key === 'from' || key === 'city' ? capitalizeWords(value) : value.toLowerCase();
  }
  return facts;
}

function capitalizeWords(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => capitalizeFirst(word.toLowerCase()))
    .join(' ');
}

const PT_WORDS = new Set([
  'não', 'nao', 'você', 'voce', 'eu', 'é', 'que', 'como', 'para', 'uma', 'um', 'de', 'do', 'da', 'tenho',
  'está', 'esta', 'obrigado', 'obrigada', 'oi', 'olá', 'ola', 'sim', 'muito', 'meu', 'minha', 'sou', 'gosto',
  'também', 'tambem', 'porque', 'mas', 'isso', 'aqui', 'nós', 'fazer', 'falar', 'inglês', 'ingles', 'sei',
]);
const EN_WORDS = new Set([
  'the', 'is', 'i', 'you', 'a', 'to', 'and', 'my', 'it', 'are', 'do', 'in', 'of', 'like', 'have', 'am',
  'what', 'yes', 'no', 'me', 'we', 'they', 'this', 'that', 'with', 'for', 'go', 'from', 'work',
]);

export function looksPortuguese(text: string): boolean {
  const tokens = text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
  let pt = 0;
  let en = 0;
  for (const token of tokens) {
    if (PT_WORDS.has(token)) pt++;
    if (EN_WORDS.has(token)) en++;
  }
  return pt >= 2 && pt > en;
}

const OFFENSIVE = /\b(idiot|stupid|shut up|i hate you|dumb|idiota|burra|burro|cala a boca)\b/i;

export function isOffensive(text: string): boolean {
  return OFFENSIVE.test(text);
}

export function isQuestion(text: string): boolean {
  return text.trim().endsWith('?');
}

interface QuestionAnswer {
  pattern: RegExp;
  answer: (assistant: string) => Bilingual;
}

/** Respostas da assistente para perguntas do usuário — sempre honestas sobre ser uma IA. */
const QUESTION_ANSWERS: QuestionAnswer[] = [
  {
    pattern: /\bhow are you\b|\bhow['’]?s it going\b|\bhow are things\b/i,
    answer: () => ({ en: "I'm great, thanks for asking!", pt: 'Estou ótima, obrigada por perguntar!' }),
  },
  {
    pattern: /\bwhat['’]?s your name\b|\bwhat is your name\b|\bwho are you\b/i,
    answer: (assistant) => ({ en: `I'm ${assistant}, your English practice partner.`, pt: `Eu sou ${assistant}, sua parceira de prática de inglês.` }),
  },
  {
    pattern: /\bhow old are you\b/i,
    answer: () => ({ en: "Ha! I'm an AI, so I don't have an age.", pt: 'Haha! Sou uma IA, então não tenho idade.' }),
  },
  {
    pattern: /\bwhere are you from\b|\bwhere do you live\b/i,
    answer: () => ({
      en: "I'm an AI, so I don't live anywhere — but I'm here whenever you want to practice!",
      pt: 'Sou uma IA, então não moro em lugar nenhum — mas estou aqui sempre que você quiser praticar!',
    }),
  },
  {
    pattern: /\b(are you (a )?(human|real|robot|ai))\b/i,
    answer: () => ({
      en: "I'm an AI — not a person. But I'm a pretty patient practice partner!",
      pt: 'Sou uma IA — não uma pessoa. Mas sou uma parceira de prática bem paciente!',
    }),
  },
];

const GENERIC_ANSWER: Bilingual = {
  en: "Good question! I'm an AI, so I don't have personal experiences, but I love hearing about yours.",
  pt: 'Boa pergunta! Sou uma IA, então não tenho experiências pessoais, mas adoro ouvir as suas.',
};

export function answerQuestion(text: string, assistant: string): Bilingual {
  const match = QUESTION_ANSWERS.find(({ pattern }) => pattern.test(text));
  return match ? match.answer(assistant) : GENERIC_ANSWER;
}

/** Pergunta de vocabulário: "What does X mean?" / "How do you say X?" / "O que significa X?". */
export function vocabularyQuery(text: string): string | null {
  const match =
    /\bwhat does ["“]?([a-z\s'-]{2,30}?)["”]? mean\b/i.exec(text) ??
    /\bwhat is the meaning of ["“]?([a-z\s'-]{2,30}?)["”]?\??$/i.exec(text) ??
    /\bo que (?:significa|é) ["“]?([a-z\s'-]{2,30}?)["”]?\??$/i.exec(text);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

/** Troca a perspectiva de 1ª para 2ª pessoa — usada para "reformular" a frase do usuário (recast). */
export function toSecondPerson(sentence: string): string {
  const map: Record<string, string> = {
    i: 'you', "i'm": "you're", 'i’m': "you're", me: 'you', my: 'your', mine: 'yours', myself: 'yourself',
    am: 'are', "i've": "you've", "i'll": "you'll", "i'd": "you'd", we: 'you', our: 'your', us: 'you',
  };
  return sentence
    .replace(/[.!]+$/, '')
    .split(/(\s+)/)
    .map((token) => map[token.toLowerCase()] ?? token)
    .join('');
}
