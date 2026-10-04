/**
 * Regras de correção para erros frequentes de falantes de português.
 * São determinísticas: funcionam no modo demonstração e também servem de rede de segurança
 * quando um provedor real de IA está configurado.
 */
import type { GrammarRule } from './types';

const APOS = "['’]";

const THIRD_PERSON: Record<string, string> = {
  go: 'goes', do: 'does', have: 'has', want: 'wants', like: 'likes', love: 'loves', work: 'works',
  study: 'studies', live: 'lives', play: 'plays', watch: 'watches', eat: 'eats', drink: 'drinks',
  need: 'needs', make: 'makes', read: 'reads', speak: 'speaks', know: 'knows', think: 'thinks',
  use: 'uses', take: 'takes', teach: 'teaches', cook: 'cooks', drive: 'drives', sleep: 'sleeps',
  get: 'gets', come: 'comes', say: 'says', try: 'tries', enjoy: 'enjoys', travel: 'travels',
  write: 'writes', listen: 'listens', feel: 'feels', wake: 'wakes', walk: 'walks', run: 'runs',
};
const BASE_FROM_THIRD: Record<string, string> = Object.fromEntries(
  Object.entries(THIRD_PERSON).map(([base, third]) => [third, base]),
);

const PAST_TO_BASE: Record<string, string> = {
  went: 'go', saw: 'see', ate: 'eat', had: 'have', made: 'make', took: 'take', came: 'come',
  bought: 'buy', got: 'get', wrote: 'write', spoke: 'speak', drank: 'drink', gave: 'give',
  knew: 'know', met: 'meet', left: 'leave', felt: 'feel', ran: 'run', slept: 'sleep', said: 'say',
  thought: 'think', found: 'find', told: 'tell', worked: 'work', played: 'play', watched: 'watch',
  studied: 'study', liked: 'like', lived: 'live', visited: 'visit', called: 'call', cooked: 'cook',
  traveled: 'travel', travelled: 'travel', finished: 'finish', started: 'start', wanted: 'want',
  needed: 'need', talked: 'talk', walked: 'walk', listened: 'listen', cleaned: 'clean',
  opened: 'open', tried: 'try', used: 'use', loved: 'love', stayed: 'stay', helped: 'help',
  asked: 'ask', enjoyed: 'enjoy', danced: 'dance', moved: 'move', arrived: 'arrive',
  practiced: 'practice', changed: 'change', decided: 'decide', stopped: 'stop', planned: 'plan',
};

const ING_FORM: Record<string, string> = {
  play: 'playing', read: 'reading', watch: 'watching', cook: 'cooking', travel: 'traveling',
  study: 'studying', work: 'working', dance: 'dancing', swim: 'swimming', run: 'running',
  sing: 'singing', draw: 'drawing', write: 'writing', walk: 'walking', listen: 'listening',
  ride: 'riding', drive: 'driving', paint: 'painting',
};

const ADJECTIVES_WITH_BE = 'happy|tired|hungry|thirsty|sad|busy|ready|sick|bored|excited|nervous|fine|late|sleepy|angry';
const LINKING_BEFORE_SUBJECT = /\b(am|is|are|was|were|do|does|did|will|would|can|could|should|feel|felt|look|looked|seem|seemed|get|got|make|makes|made)\s*$/i;

/** Forma do verbo to be adequada ao sujeito. */
export function beFor(subject: string): string {
  const s = subject.toLowerCase();
  if (s === 'i') return 'am';
  if (s === 'you' || s === 'we' || s === 'they') return 'are';
  if (/^(my|your|his|her|our|their|the)\s+\w+s$/.test(s) && !/(ss|us)$/.test(s)) return 'are';
  return 'is';
}

const PAST_MARKERS = /\b(yesterday|last (?:night|week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ago)\b/i;
const BLOCKING_BEFORE_SUBJECT = /\b(does|did|do|can|could|will|would|should|must|might|may|let|make|made|help|saw|see|watch|heard|hear|to|doesn['’]t|didn['’]t|don['’]t|won['’]t|can['’]t|if)\s*$/i;

function words(list: Record<string, string>): string {
  return Object.keys(list).join('|');
}

export const GRAMMAR_RULES: readonly GrammarRule[] = [
  {
    id: 'third_person_s',
    skillTag: 'simple_present',
    severity: 'grammar',
    pattern: new RegExp(
      `\\b(he|she|it|my (?:mother|mom|father|dad|sister|brother|friend|boss|wife|husband|son|daughter|teacher|cat|dog))\\s+((?:always|usually|often|sometimes|never)\\s+)?(${words(THIRD_PERSON)})\\b`,
      'gi',
    ),
    replace: (match, text) => {
      const [, subject = '', adverb = '', verb = ''] = match;
      const before = text.slice(0, match.index);
      if (BLOCKING_BEFORE_SUBJECT.test(before) || PAST_MARKERS.test(text)) return null;
      const third = THIRD_PERSON[verb.toLowerCase()];
      return third ? `${subject} ${adverb}${third}` : null;
    },
    explanation: {
      pt: 'Com "he", "she" e "it", normalmente adicionamos "-s" ao verbo no presente simples.',
      en: 'With "he", "she" and "it", we usually add "-s" to the verb in the simple present.',
    },
    tip: {
      pt: 'Alguns verbos mudam mais: go → goes, have → has, study → studies, watch → watches.',
      en: 'Some verbs change a bit more: go → goes, have → has, study → studies, watch → watches.',
    },
  },
  {
    id: 'age_with_have',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: /\b(I|you|he|she|we|they|my \w+)\s+(?:have|has)\s+(\d{1,3}|[a-z]+(?:-[a-z]+)?)\s+years?(?:\s+old)?\b/gi,
    replace: (match, text) => {
      const [, subject = '', age = ''] = match;
      const following = text.slice(match.index + match[0].length);
      // "I have three years of experience" não é sobre idade.
      if (/^\s+(of|experience|left|ago|in|at|to|until)\b/i.test(following)) return null;
      return `${subject} ${beFor(subject)} ${age} years old`;
    },
    explanation: {
      pt: 'Em inglês, a idade é dita com o verbo "to be": I am 25 years old. Usar "have" para idade é uma tradução literal do português.',
      en: 'In English, we use the verb "to be" for age: I am 25 years old.',
    },
    tip: { pt: 'Também é natural dizer só "I\'m 25".', en: 'It is also natural to say just "I\'m 25".' },
  },
  {
    id: 'how_many_years',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: /\bhow many years (?:do|does) (you|he|she|they) have\b/gi,
    replace: (match) => {
      const subject = match[1] ?? 'you';
      return `how old ${beFor(subject)} ${subject}`;
    },
    explanation: {
      pt: 'Para perguntar a idade, usamos "How old are you?" (e não "How many years do you have?").',
      en: 'To ask about age, say "How old are you?".',
    },
  },
  {
    id: 'have_hunger',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: /\b(I|you|he|she|we|they)\s+(?:have|has)\s+(hunger|hungry|thirst|thirsty|fear|sleepy)\b/gi,
    replace: (match) => {
      const [, subject = '', word = ''] = match;
      const adjective: Record<string, string> = {
        hunger: 'hungry', hungry: 'hungry', thirst: 'thirsty', thirsty: 'thirsty', fear: 'afraid', sleepy: 'sleepy',
      };
      return `${subject} ${beFor(subject)} ${adjective[word.toLowerCase()] ?? word}`;
    },
    explanation: {
      pt: 'Em inglês, fome, sede, medo e sono são estados: usamos o verbo "to be". I am hungry = Estou com fome.',
      en: 'In English, hunger, thirst and fear are states, so we use "to be": I am hungry.',
    },
  },
  {
    id: 'missing_to_be',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: new RegExp(`\\b(I|he|she|we|they)\\s+((?:very|so|really|too)\\s+)?(${ADJECTIVES_WITH_BE})\\b`, 'gi'),
    replace: (match, text) => {
      const [, subject = '', intensifier = '', adjective = ''] = match;
      if (LINKING_BEFORE_SUBJECT.test(text.slice(0, match.index))) return null;
      return `${subject} ${beFor(subject)} ${intensifier}${adjective}`;
    },
    explanation: {
      pt: 'Para descrever como alguém está, precisamos do verbo "to be": I am tired, she is happy.',
      en: 'To describe how someone is, we need the verb "to be": I am tired, she is happy.',
    },
  },
  {
    id: 'missing_it_subject',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: /(^|[.!]\s+)(is|was)\s+(very|so|really|too)\s+(\w+)/gi,
    replace: (match, text) => {
      const [, prefix = '', verb = '', intensifier = '', word = ''] = match;
      if (text.trim().endsWith('?')) return null;
      return `${prefix}It ${verb.toLowerCase()} ${intensifier} ${word}`;
    },
    explanation: {
      pt: 'Em inglês, toda frase precisa de sujeito. "É muito bom" vira "It is very good".',
      en: 'Every English sentence needs a subject: "It is very good".',
    },
  },
  {
    id: 'dont_third_person',
    skillTag: 'questions_negatives',
    severity: 'grammar',
    pattern: new RegExp(`\\b(he|she|it)\\s+don${APOS}t\\b`, 'gi'),
    replace: (match) => `${match[1] ?? ''} doesn't`,
    explanation: {
      pt: 'Com "he", "she" e "it", a negativa no presente usa "doesn\'t": She doesn\'t like coffee.',
      en: "With \"he\", \"she\" and \"it\", the negative uses \"doesn't\".",
    },
  },
  {
    id: 'does_with_s',
    skillTag: 'questions_negatives',
    severity: 'grammar',
    pattern: new RegExp(`\\b(does(?:n${APOS}t)?|does not)\\s+((?:he|she|it)\\s+)?(${words(BASE_FROM_THIRD)})\\b`, 'gi'),
    replace: (match) => {
      const [, auxiliary = '', subject = '', verb = ''] = match;
      const base = BASE_FROM_THIRD[verb.toLowerCase()];
      return base ? `${auxiliary} ${subject}${base}` : null;
    },
    explanation: {
      pt: 'Depois de "does" ou "doesn\'t", o verbo volta para a forma básica: Does she work? / She doesn\'t work.',
      en: "After \"does\" or \"doesn't\", use the base verb: Does she work? / She doesn't work.",
    },
  },
  {
    id: 'did_with_past',
    skillTag: 'simple_past',
    severity: 'grammar',
    pattern: new RegExp(`\\b(did(?:n${APOS}t| not)?)\\s+((?:I|you|he|she|it|we|they)\\s+)?(${words(PAST_TO_BASE)})\\b`, 'gi'),
    replace: (match) => {
      const [, auxiliary = '', subject = '', verb = ''] = match;
      const base = PAST_TO_BASE[verb.toLowerCase()];
      return base ? `${auxiliary} ${subject}${base}` : null;
    },
    explanation: {
      pt: 'Depois de "did" ou "didn\'t", o verbo volta para a forma básica: I didn\'t go (e não "didn\'t went").',
      en: "After \"did\" or \"didn't\", use the base verb: I didn't go (not \"didn't went\").",
    },
  },
  {
    id: 'am_agree',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: new RegExp(`\\b(I|we|they)(?:\\s+am|\\s+are|${APOS}m|${APOS}re)\\s+(agree|disagree)\\b`, 'gi'),
    replace: (match) => `${match[1] ?? 'I'} ${match[2] ?? 'agree'}`,
    explanation: {
      pt: '"Agree" já é um verbo: I agree (concordo). Não usamos "am" antes dele.',
      en: '"Agree" is already a verb: I agree. We don\'t use "am" before it.',
    },
  },
  {
    id: 'people_is',
    skillTag: 'to_be',
    severity: 'grammar',
    pattern: /\bpeople\s+(is|was)\b/gi,
    replace: (match) => `people ${(match[1] ?? '').toLowerCase() === 'was' ? 'were' : 'are'}`,
    explanation: {
      pt: '"People" é plural em inglês: people are / people were.',
      en: '"People" is plural: people are / people were.',
    },
  },
  {
    id: 'in_weekday',
    skillTag: 'prepositions',
    severity: 'grammar',
    pattern: /\bin\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(s?)\b/gi,
    replace: (match) => {
      const day = match[1] ?? '';
      return `on ${day.charAt(0).toUpperCase()}${day.slice(1).toLowerCase()}${match[2] ?? ''}`;
    },
    explanation: {
      pt: 'Com dias da semana usamos "on": on Monday, on Fridays.',
      en: 'We use "on" with days of the week: on Monday.',
    },
  },
  {
    id: 'at_the_morning',
    skillTag: 'prepositions',
    severity: 'grammar',
    pattern: /\bat\s+the\s+(morning|afternoon|evening)\b/gi,
    replace: (match) => `in the ${(match[1] ?? '').toLowerCase()}`,
    explanation: {
      pt: 'Com partes do dia usamos "in the": in the morning, in the afternoon. A exceção é "at night".',
      en: 'Use "in the" with parts of the day: in the morning. The exception is "at night".',
    },
  },
  {
    id: 'go_to_home',
    skillTag: 'prepositions',
    severity: 'grammar',
    pattern: /\b(go|goes|went|going|come|comes|came|coming|get|got|arrive|arrived)\s+to\s+home\b/gi,
    replace: (match) => `${match[1] ?? 'go'} home`,
    explanation: {
      pt: 'Com "home" não usamos "to" depois de verbos de movimento: go home, come home, get home.',
      en: 'We don\'t use "to" before "home" after verbs of movement: go home.',
    },
  },
  {
    id: 'like_base_verb',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: new RegExp(`\\b(like|likes|love|loves|hate|hates|enjoy|enjoys)\\s+(${words(ING_FORM)})\\b`, 'gi'),
    replace: (match, text) => {
      const [, verb = '', activity = ''] = match;
      const following = text.slice(match.index + match[0].length);
      // "I like play" → "I like playing"; evita casos como "I like play-doh" ou "like read more".
      if (/^-/.test(following)) return null;
      // "I'd like play" → "I'd like to play" (desejo), e não "liking".
      if (/(would|['’]d)\s*$/i.test(text.slice(0, match.index))) return `${verb} to ${activity}`;
      const ing = ING_FORM[activity.toLowerCase()];
      return ing ? `${verb} ${ing}` : null;
    },
    explanation: {
      pt: 'Depois de like, love, hate e enjoy, use o verbo com "-ing" (ou "to" + verbo): I like playing / I like to play.',
      en: 'After like, love, hate and enjoy, use the -ing form (or "to" + verb): I like playing.',
    },
  },
  {
    id: 'there_have',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: /\b(in (?:my|the|our) \w+),?\s+(?:have|has)\s+(a lot|an|a|many|some|lots|\d+)\b/gi,
    replace: (match) => {
      const [, place = '', quantifier = ''] = match;
      const singular = /^(a|an)$/i.test(quantifier);
      return `${place}, there ${singular ? 'is' : 'are'} ${quantifier}`;
    },
    explanation: {
      pt: 'Para dizer que algo existe em um lugar, usamos "there is / there are" (e não "have"): In my city, there are many parks.',
      en: 'To say something exists in a place, use "there is / there are": In my city, there are many parks.',
    },
  },
  {
    id: 'explain_me',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: /\bexplain\s+me(\s+(?:this|that|it))?\b/gi,
    replace: (match) => (match[1] ? `explain${match[1]} to me` : 'explain to me'),
    explanation: {
      pt: 'Em inglês, explicamos algo "para" alguém: explain to me (ou explain it to me).',
      en: 'We explain something "to" someone: explain to me.',
    },
  },
  {
    id: 'double_comparative',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: /\bmore\s+(better|worse|bigger|smaller|easier|harder|faster|cheaper|older|younger)\b/gi,
    replace: (match) => match[1] ?? '',
    explanation: {
      pt: '"Better", "bigger", "easier"… já são comparativos. Não use "more" junto.',
      en: '"Better", "bigger", "easier"… are already comparatives. Don\'t add "more".',
    },
  },
  {
    id: 'uncountable_plural',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: /\b(informations|advices|furnitures|homeworks)\b/gi,
    replace: (match) => (match[1] ?? '').slice(0, -1),
    explanation: {
      pt: 'Information, advice, furniture e homework são incontáveis em inglês: não vão para o plural.',
      en: 'Information, advice, furniture and homework are uncountable: no plural form.',
    },
  },
  {
    id: 'depend_of',
    skillTag: 'prepositions',
    severity: 'grammar',
    pattern: /\b(depend|depends|depending)\s+of\b/gi,
    replace: (match) => `${match[1] ?? 'depends'} on`,
    explanation: {
      pt: 'Em inglês dizemos "depend on" (e não "depend of"): It depends on the weather.',
      en: 'We say "depend on": It depends on the weather.',
    },
  },
  {
    id: 'make_question',
    skillTag: 'word_choice',
    severity: 'grammar',
    pattern: /\b(make|makes|made)\s+(a\s+)?(question|questions)\b/gi,
    replace: (match) => {
      const verb = (match[1] ?? 'make').toLowerCase();
      const ask = verb === 'made' ? 'asked' : verb === 'makes' ? 'asks' : 'ask';
      return `${ask} ${match[2] ?? ''}${match[3] ?? 'question'}`;
    },
    explanation: {
      pt: 'Em inglês, "fazer uma pergunta" é "ask a question" (e não "make a question").',
      en: 'In English, we "ask" a question.',
    },
  },
  {
    id: 'bored_boring',
    skillTag: 'word_choice',
    severity: 'meaning',
    pattern: new RegExp(`\\b(I(?:\\s+am|${APOS}m)|I\\s+feel)\\s+((?:so|very|really)\\s+)?boring\\b`, 'gi'),
    replace: (match) => `${match[1] ?? "I'm"} ${match[2] ?? ''}bored`,
    explanation: {
      pt: '"I\'m boring" significa "eu sou chato". Para dizer que está entediado, use "I\'m bored".',
      en: "\"I'm boring\" means you are a boring person. To say you feel this way, use \"I'm bored\".",
    },
  },
  {
    id: 'pretend_intend',
    skillTag: 'word_choice',
    severity: 'meaning',
    pattern: /\b(I|we)\s+pretend\s+to\s+(?!be\b)(\w+)/gi,
    replace: (match) => `${match[1] ?? 'I'} intend to ${match[2] ?? ''}`,
    explanation: {
      pt: '"Pretend" significa fingir. Para "pretender" (ter intenção), use "intend to" ou "plan to".',
      en: '"Pretend" means to act as if something is true. For plans, use "intend to" or "plan to".',
    },
  },
  {
    id: 'years_without_old',
    skillTag: 'numbers',
    severity: 'naturalness',
    pattern: /\b(am|is|are|I['’]m|she['’]s|he['’]s)\s+(\d{1,3})\s+years\b(?!\s+old)/gi,
    replace: (match) => `${match[1] ?? 'am'} ${match[2] ?? ''} years old`,
    explanation: {
      pt: 'Com "years", o natural é completar com "old": I\'m 25 years old (ou apenas I\'m 25).',
      en: 'With "years", add "old": I\'m 25 years old (or just I\'m 25).',
    },
  },
  {
    id: 'lowercase_i',
    skillTag: 'writing_mechanics',
    severity: 'naturalness',
    pattern: /(^|[\s,.!?(])i(?=[\s'’,.!?)]|$)/g,
    replace: (match) => `${match[1] ?? ''}I`,
    explanation: {
      pt: 'O pronome "I" (eu) é sempre escrito com letra maiúscula.',
      en: 'The pronoun "I" is always capitalized.',
    },
  },
];
