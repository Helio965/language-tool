import type { Lesson } from '../../domain/content';

/**
 * Aulas de amostra dos níveis Intermediário e Avançado. Demonstram a progressão (RN02)
 * sem transformar o MVP em um curso completo.
 */
export const upperLessons: Lesson[] = [
  {
    id: 'present-perfect',
    level: 'intermediate',
    order: 11,
    title: 'Present perfect: experiências',
    topic: 'Present Perfect',
    summary: 'Fale de experiências de vida e de situações que continuam até hoje.',
    estimatedMinutes: 12,
    skillTags: ['present_perfect'],
    objectives: [
      'Falar de experiências com "Have you ever…?"',
      'Usar for e since',
      'Escolher entre present perfect e simple past',
    ],
    explanation: [
      {
        pt: 'O present perfect liga o passado ao presente. Usamos para experiências de vida (sem dizer quando) e para situações que começaram no passado e continuam agora. Estrutura: have/has + particípio.',
        en: 'The present perfect connects the past with the present. We use it for life experiences (without saying when) and for situations that started in the past and continue now. Structure: have/has + past participle.',
      },
      {
        pt: 'Exemplos: Have you ever been to Japan? / I have never tried sushi. / She has lived here since 2019.',
        en: 'Examples: Have you ever been to Japan? / I have never tried sushi. / She has lived here since 2019.',
      },
      {
        pt: 'Use "for" com períodos (for three years) e "since" com o ponto de partida (since 2019).',
        en: 'Use "for" with a period of time (for three years) and "since" with a starting point (since 2019).',
      },
      {
        pt: 'Se você disser QUANDO aconteceu (yesterday, last year, in 2019), use o simple past: I went to Japan in 2019.',
        en: 'If you say WHEN it happened (yesterday, last year, in 2019), use the simple past: I went to Japan in 2019.',
      },
    ],
    alternativeExplanations: [
      {
        pt: 'Pense no present perfect como uma "ponte": o que importa é o resultado ou a experiência AGORA, não o momento exato.',
        en: 'Think of the present perfect as a bridge: what matters is the result or experience NOW, not the exact moment.',
      },
      {
        pt: 'Pergunta-chave: tem um tempo terminado na frase (ontem, em 2019)? Se sim → simple past. Se não, ou se ainda continua → present perfect.',
        en: 'Key question: is there a finished time in the sentence (yesterday, in 2019)? If yes → simple past. If not, or if it continues → present perfect.',
      },
    ],
    table: {
      caption: 'for × since',
      headers: ['for (período)', 'since (ponto de partida)'],
      rows: [
        ['for two years', 'since 2022'],
        ['for a long time', 'since I was a child'],
        ['for three months', 'since Monday'],
      ],
    },
    examples: [
      { en: 'Have you ever been to Canada?', pt: 'Você já foi ao Canadá?', highlight: 'Have you ever been' },
      { en: "I've worked here for five years.", pt: 'Trabalho aqui há cinco anos.', highlight: "I've worked" },
      { en: 'She has never seen snow.', pt: 'Ela nunca viu neve.', highlight: 'has never seen' },
    ],
    extraExamples: [
      { en: "We've known each other since college.", pt: 'Nós nos conhecemos desde a faculdade.', highlight: "We've known" },
      { en: 'Has he finished the report yet?', pt: 'Ele já terminou o relatório?', highlight: 'Has he finished' },
      { en: "I've already had lunch, thanks.", pt: 'Já almocei, obrigado.', highlight: "I've already had" },
    ],
    vocabularyIds: ['ever', 'already', 'experience'],
    exercises: [
      {
        id: 'perfect-1',
        lessonId: 'present-perfect',
        type: 'select_word',
        instruction: 'Select the correct form.',
        prompt: 'I ___ here since 2019.',
        options: ['have lived', 'lived', 'am living', 'live'],
        acceptedAnswers: ['have lived'],
        explanation: {
          pt: 'A situação começou em 2019 e continua até hoje, então usamos o present perfect: I have lived here since 2019.',
          en: 'The situation started in 2019 and continues now, so we use the present perfect.',
        },
        skillTag: 'present_perfect',
      },
      {
        id: 'perfect-2',
        lessonId: 'present-perfect',
        type: 'select_word',
        instruction: 'Select the correct word.',
        prompt: 'She has worked here ___ five years.',
        options: ['for', 'since', 'during', 'ago'],
        acceptedAnswers: ['for'],
        explanation: {
          pt: '"Five years" é um período, então usamos "for".',
          en: '"Five years" is a period of time, so we use "for".',
        },
        skillTag: 'present_perfect',
      },
      {
        id: 'perfect-3',
        lessonId: 'present-perfect',
        type: 'multiple_choice',
        instruction: 'Choose the correct sentence.',
        prompt: 'Which sentence is correct?',
        options: [
          'I went to London last year.',
          'I have gone to London last year.',
          'I have been to London last year.',
          'I go to London last year.',
        ],
        acceptedAnswers: ['I went to London last year.'],
        explanation: {
          pt: '"Last year" é um tempo terminado, então usamos o simple past: I went to London last year.',
          en: '"Last year" is a finished time, so we use the simple past.',
        },
        skillTag: 'present_perfect',
      },
      {
        id: 'perfect-4',
        lessonId: 'present-perfect',
        type: 'fill_blank',
        instruction: 'Complete the question.',
        prompt: '___ you ever tried Indian food?',
        acceptedAnswers: ['Have'],
        explanation: {
          pt: 'Perguntas sobre experiências: Have + you + ever + particípio.',
          en: 'Questions about experiences: Have + you + ever + past participle.',
        },
        skillTag: 'present_perfect',
      },
      {
        id: 'perfect-5',
        lessonId: 'present-perfect',
        type: 'write',
        instruction: 'Escreva sobre uma experiência que você já teve (ou nunca teve).',
        prompt: 'Write about an experience using "I have…" or "I\'ve never…".',
        acceptedAnswers: [],
        requirements: [{ pattern: "\\b(i have|i've)\\b", message: 'Use "I have" ou "I\'ve" na sua frase.' }],
        minWords: 4,
        explanation: {
          pt: 'Para experiências, use have + particípio sem dizer quando: I\'ve visited Chile. I\'ve never eaten sushi.',
          en: "For experiences, use have + past participle without saying when: I've visited Chile.",
        },
        skillTag: 'present_perfect',
      },
    ],
    practice: {
      opener: {
        en: "Let's talk about experiences! I'm {assistant}. Have you ever traveled to another country?",
        pt: 'Vamos falar de experiências! Eu sou {assistant}. Você já viajou para outro país?',
      },
      question: 'Have you ever traveled to another country?',
    },
    takeaways: [
      'have/has + particípio para experiências e situações que continuam.',
      'for + período · since + ponto de partida.',
      'Tempo terminado (yesterday, in 2019) → simple past.',
    ],
  },
  {
    id: 'phrasal-verbs',
    level: 'advanced',
    order: 12,
    title: 'Phrasal verbs do dia a dia',
    topic: 'Everyday phrasal verbs',
    summary: 'Soe mais natural com verbos como figure out, run into e call off.',
    estimatedMinutes: 12,
    skillTags: ['phrasal_verbs'],
    objectives: [
      'Entender o significado de phrasal verbs comuns',
      'Posicionar pronomes em phrasal verbs separáveis',
      'Usar phrasal verbs em conversas',
    ],
    explanation: [
      {
        pt: 'Phrasal verbs combinam um verbo com uma partícula (up, out, on, off…) e muitas vezes têm um sentido que não dá para deduzir: "figure out" = entender ou resolver.',
        en: 'Phrasal verbs combine a verb with a particle (up, out, on, off…) and often have a meaning you can\'t guess from the parts: "figure out" means to understand or solve.',
      },
      {
        pt: 'Alguns são separáveis: "turn off the lights" ou "turn the lights off". Com pronomes, o pronome fica no meio: "turn it off" (nunca "turn off it").',
        en: 'Some are separable: "turn off the lights" or "turn the lights off". With pronouns, the pronoun goes in the middle: "turn it off" (never "turn off it").',
      },
      {
        pt: 'Eles deixam a fala mais natural: "I ran into an old friend" soa mais natural do que "I met an old friend by chance".',
        en: 'They make your English sound more natural: "I ran into an old friend" sounds more natural than "I met an old friend by chance".',
      },
    ],
    alternativeExplanations: [
      {
        pt: 'Trate cada phrasal verb como uma palavra nova, com significado próprio. Aprenda sempre com um exemplo de contexto.',
        en: 'Treat each phrasal verb as a new word with its own meaning. Always learn it with an example.',
      },
      {
        pt: 'A partícula às vezes dá uma pista: "up" costuma indicar completar algo (eat up, use up), "off" indica parar ou cancelar (turn off, call off).',
        en: 'The particle sometimes gives a clue: "up" often means completion (eat up, use up); "off" means stopping or cancelling (turn off, call off).',
      },
    ],
    table: {
      caption: 'Phrasal verbs comuns',
      headers: ['Phrasal verb', 'Significado', 'Exemplo'],
      rows: [
        ['figure out', 'entender / resolver', 'I figured out the problem.'],
        ['run into', 'encontrar por acaso', 'I ran into Ana yesterday.'],
        ['call off', 'cancelar', 'They called off the meeting.'],
        ['turn off', 'desligar', 'Turn it off, please.'],
        ['look forward to', 'aguardar com expectativa', "I'm looking forward to it."],
      ],
    },
    examples: [
      { en: "I can't figure out this bug.", pt: 'Não consigo entender esse bug.', highlight: 'figure out' },
      { en: 'I ran into my old boss at the mall.', pt: 'Encontrei meu antigo chefe por acaso no shopping.', highlight: 'ran into' },
      { en: 'Could you turn it down a little?', pt: 'Você poderia abaixar um pouco?', highlight: 'turn it down' },
    ],
    extraExamples: [
      { en: "Let's set up a meeting for Friday.", pt: 'Vamos marcar uma reunião para sexta.', highlight: 'set up' },
      { en: 'She came up with a great idea.', pt: 'Ela teve uma ótima ideia.', highlight: 'came up with' },
      { en: "Don't give up — you're almost there!", pt: 'Não desista — você está quase lá!', highlight: 'give up' },
    ],
    vocabularyIds: ['figure-out', 'run-into', 'call-off', 'turn-off'],
    exercises: [
      {
        id: 'phrasal-1',
        lessonId: 'phrasal-verbs',
        type: 'multiple_choice',
        instruction: 'Choose the meaning.',
        prompt: 'What does "figure out" mean?',
        options: ['to understand or solve something', 'to draw a figure', 'to go outside', 'to cancel something'],
        acceptedAnswers: ['to understand or solve something'],
        explanation: {
          pt: '"Figure out" significa entender ou resolver algo: I figured out the answer.',
          en: '"Figure out" means to understand or solve something.',
        },
        skillTag: 'phrasal_verbs',
      },
      {
        id: 'phrasal-2',
        lessonId: 'phrasal-verbs',
        type: 'select_word',
        instruction: 'Select the correct word.',
        prompt: 'The TV is too loud. Can you turn ___ down?',
        options: ['it', 'on', 'out', 'up'],
        acceptedAnswers: ['it'],
        explanation: {
          pt: 'Com pronomes, o pronome fica entre o verbo e a partícula: turn it down.',
          en: 'With pronouns, the pronoun goes between the verb and the particle: turn it down.',
        },
        skillTag: 'phrasal_verbs',
      },
      {
        id: 'phrasal-3',
        lessonId: 'phrasal-verbs',
        type: 'select_word',
        instruction: 'Select the correct particle.',
        prompt: 'I ran ___ my old teacher at the supermarket.',
        options: ['into', 'in', 'onto', 'over'],
        acceptedAnswers: ['into'],
        explanation: {
          pt: '"Run into" significa encontrar alguém por acaso.',
          en: '"Run into" means to meet someone by chance.',
        },
        skillTag: 'phrasal_verbs',
      },
      {
        id: 'phrasal-4',
        lessonId: 'phrasal-verbs',
        type: 'fill_blank',
        instruction: 'Complete with the correct particle.',
        prompt: 'We had to call ___ the meeting because the manager was sick.',
        acceptedAnswers: ['off'],
        explanation: {
          pt: '"Call off" significa cancelar.',
          en: '"Call off" means to cancel.',
        },
        skillTag: 'phrasal_verbs',
      },
      {
        id: 'phrasal-5',
        lessonId: 'phrasal-verbs',
        type: 'write',
        instruction: 'Use um phrasal verb em uma frase sobre a sua semana.',
        prompt: 'Use a phrasal verb in a sentence about your week.',
        acceptedAnswers: [],
        requirements: [
          {
            pattern: '\\b\\w+ (up|out|off|on|into|over|back|down|away)\\b',
            message: 'Use um phrasal verb (ex.: figure out, turn off, run into).',
          },
        ],
        minWords: 5,
        explanation: {
          pt: 'Phrasal verbs = verbo + partícula com significado próprio: I figured out…, We called off…, I ran into…',
          en: 'Phrasal verbs = verb + particle with their own meaning: I figured out…, We called off…',
        },
        skillTag: 'phrasal_verbs',
      },
    ],
    practice: {
      opener: {
        en: "Let's put phrasal verbs to work! I'm {assistant}. What's something you've had to figure out recently?",
        pt: 'Vamos usar phrasal verbs! Eu sou {assistant}. O que você teve que resolver (figure out) recentemente?',
      },
      question: "What's something you've had to figure out recently?",
    },
    takeaways: [
      'Phrasal verb = verbo + partícula com sentido próprio.',
      'Pronome no meio: turn it off.',
      'Aprenda sempre com um exemplo de contexto.',
    ],
  },
];
