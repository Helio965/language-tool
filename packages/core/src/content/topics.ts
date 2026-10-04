import type { ConversationTopic } from '../domain/content';

/**
 * Assuntos do Modo Conversação (UC09 — "permitir conversas sobre diferentes assuntos").
 * As perguntas roteirizadas são usadas pelo modo demonstração; com um provedor real,
 * elas servem como sugestão de rumo para a IA.
 */
export const CONVERSATION_TOPICS: readonly ConversationTopic[] = [
  {
    id: 'free',
    title: 'Conversa livre',
    titleEn: 'Free talk',
    description: 'Fale sobre o que quiser. A conversa segue o seu ritmo.',
    icon: 'message-circle',
    areas: ['everyday'],
    recommendedFrom: 'beginner',
    questions: [
      { id: 'free-1', low: 'How are you today?', high: "How's your day going so far?", lowPt: 'Como você está hoje?' },
      { id: 'free-2', low: 'What do you like to do?', high: 'What do you usually do to relax?', lowPt: 'O que você gosta de fazer?' },
      { id: 'free-3', low: 'What is your favorite food?', high: "What's a dish you could eat every single day?", lowPt: 'Qual é a sua comida favorita?', asks: ['food'] },
      { id: 'free-4', low: 'Do you like music?', high: 'What kind of music have you been listening to lately?', lowPt: 'Você gosta de música?' },
      { id: 'free-5', low: 'Why do you study English?', high: 'What would you like to do once your English is more fluent?', lowPt: 'Por que você estuda inglês?' },
    ],
  },
  {
    id: 'introductions',
    title: 'Apresentações',
    titleEn: 'Introductions',
    description: 'Diga quem você é, de onde vem e o que faz.',
    icon: 'hand',
    areas: ['everyday'],
    recommendedFrom: 'beginner',
    questions: [
      { id: 'intro-1', low: 'Where are you from?', high: 'Where are you from, and what do you like most about it?', lowPt: 'De onde você é?', asks: ['from', 'city'] },
      { id: 'intro-2', low: 'How old are you?', high: 'How long have you lived there?', lowPt: 'Quantos anos você tem?', asks: ['age'] },
      { id: 'intro-3', low: 'What do you do? Are you a student?', high: 'What do you do for a living, or what are you studying?', lowPt: 'O que você faz? Você é estudante?', asks: ['job'] },
      { id: 'intro-4', low: 'Do you have brothers or sisters?', high: 'Tell me a bit about your family.', lowPt: 'Você tem irmãos ou irmãs?' },
      { id: 'intro-5', low: 'What do you like to do on weekends?', high: 'What does a perfect weekend look like for you?', lowPt: 'O que você gosta de fazer nos fins de semana?' },
    ],
  },
  {
    id: 'daily-routine',
    title: 'Rotina',
    titleEn: 'Daily routine',
    description: 'Horários, hábitos e o seu dia a dia.',
    icon: 'sun',
    areas: ['everyday'],
    recommendedFrom: 'beginner',
    questions: [
      { id: 'routine-1', low: 'What time do you wake up?', high: 'Are you a morning person or a night owl?', lowPt: 'Que horas você acorda?' },
      { id: 'routine-2', low: 'What do you eat for breakfast?', high: 'What does your morning routine look like?', lowPt: 'O que você come no café da manhã?' },
      { id: 'routine-3', low: 'How do you go to work or school?', high: 'How long does it take you to get to work or school?', lowPt: 'Como você vai ao trabalho ou à escola?' },
      { id: 'routine-4', low: 'What do you do in the evening?', high: 'How do you usually unwind after a long day?', lowPt: 'O que você faz à noite?' },
    ],
  },
  {
    id: 'food',
    title: 'Comida e restaurantes',
    titleEn: 'Food & restaurants',
    description: 'Pratos favoritos, pedidos e receitas.',
    icon: 'utensils',
    areas: ['food', 'travel'],
    recommendedFrom: 'beginner',
    questions: [
      { id: 'food-1', low: 'What is your favorite food?', high: "What's your all-time favorite dish?", lowPt: 'Qual é a sua comida favorita?', asks: ['food'] },
      { id: 'food-2', low: 'Do you like to cook?', high: "Do you enjoy cooking, or do you prefer eating out?", lowPt: 'Você gosta de cozinhar?' },
      { id: 'food-3', low: 'What do you usually order at a restaurant?', high: 'What do you usually order when you go out to eat?', lowPt: 'O que você geralmente pede em um restaurante?' },
      { id: 'food-4', low: 'Is there a food you don\'t like?', high: "Is there any food you just can't stand?", lowPt: 'Tem alguma comida de que você não gosta?' },
    ],
  },
  {
    id: 'travel',
    title: 'Viagem',
    titleEn: 'Travel',
    description: 'Lugares, planos e situações de viagem.',
    icon: 'plane',
    areas: ['travel'],
    recommendedFrom: 'basic',
    questions: [
      { id: 'travel-1', low: 'Do you like to travel?', high: "What's the best trip you've ever taken?", lowPt: 'Você gosta de viajar?' },
      { id: 'travel-2', low: 'Where do you want to go?', high: "If you could go anywhere next year, where would you go?", lowPt: 'Para onde você quer ir?' },
      { id: 'travel-3', low: 'Do you like the beach or the mountains?', high: 'Do you prefer relaxing trips or adventurous ones?', lowPt: 'Você prefere praia ou montanha?' },
      { id: 'travel-4', low: 'What do you pack in your bag?', high: "What's something you always forget to pack?", lowPt: 'O que você leva na mala?' },
    ],
  },
  {
    id: 'work',
    title: 'Trabalho e carreira',
    titleEn: 'Work & career',
    description: 'Seu trabalho, reuniões e objetivos profissionais.',
    icon: 'briefcase',
    areas: ['business'],
    recommendedFrom: 'basic',
    questions: [
      { id: 'work-1', low: 'What is your job?', high: 'What do you do, and what do you enjoy most about it?', lowPt: 'Qual é o seu trabalho?', asks: ['job'] },
      { id: 'work-2', low: 'Do you like your job?', high: "What's the most challenging part of your job?", lowPt: 'Você gosta do seu trabalho?' },
      { id: 'work-3', low: 'Do you work from home?', high: 'Do you prefer working from home or at the office? Why?', lowPt: 'Você trabalha de casa?' },
      { id: 'work-4', low: 'What is your dream job?', high: 'Where do you see your career in five years?', lowPt: 'Qual é o trabalho dos seus sonhos?' },
    ],
  },
  {
    id: 'technology',
    title: 'Tecnologia',
    titleEn: 'Technology',
    description: 'Apps, programação e o mundo digital.',
    icon: 'cpu',
    areas: ['technology'],
    recommendedFrom: 'basic',
    questions: [
      { id: 'tech-1', low: 'What apps do you use every day?', high: 'Which apps could you not live without?', lowPt: 'Quais aplicativos você usa todos os dias?' },
      { id: 'tech-2', low: 'Do you like technology?', high: 'What new technology are you most curious about?', lowPt: 'Você gosta de tecnologia?' },
      { id: 'tech-3', low: 'Do you work with computers?', high: 'How does technology show up in your work or studies?', lowPt: 'Você trabalha com computadores?' },
      { id: 'tech-4', low: 'Do you use AI tools?', high: 'How do you think AI will change the way people learn?', lowPt: 'Você usa ferramentas de IA?' },
    ],
  },
  {
    id: 'hobbies',
    title: 'Hobbies e lazer',
    titleEn: 'Hobbies & free time',
    description: 'Filmes, séries, esportes e passatempos.',
    icon: 'music',
    areas: ['entertainment', 'sports'],
    recommendedFrom: 'beginner',
    questions: [
      { id: 'hobbies-1', low: 'What do you do in your free time?', high: 'What do you love doing in your free time?', lowPt: 'O que você faz no seu tempo livre?' },
      { id: 'hobbies-2', low: 'Do you like movies or series?', high: "What's a series you'd recommend to a friend?", lowPt: 'Você gosta de filmes ou séries?' },
      { id: 'hobbies-3', low: 'Do you play any sports?', high: 'Is there a sport or activity you\'d like to try?', lowPt: 'Você pratica algum esporte?' },
      { id: 'hobbies-4', low: 'Do you read books?', high: "What's the last book or podcast you really enjoyed?", lowPt: 'Você lê livros?' },
    ],
  },
];

/** Prefixo dos assuntos gerados a partir de uma aula ("Praticar isso"). */
export const LESSON_PRACTICE_PREFIX = 'lesson:';
