import type { PartOfSpeech, VocabularyEntry } from '../domain/content';
import type { Level } from '../domain/levels';

function entry(
  id: string,
  word: string,
  translation: string,
  meaning: string,
  partOfSpeech: PartOfSpeech,
  level: Level,
  topic: string,
  example: [en: string, pt: string],
): VocabularyEntry {
  return { id, word, translation, meaning, partOfSpeech, level, topic, examples: [{ en: example[0], pt: example[1] }] };
}

/** Vocabulário do MVP (RF08): palavras das aulas e dos assuntos de conversa, por nível. */
export const VOCABULARY: readonly VocabularyEntry[] = [
  // Cumprimentos
  entry('hello', 'hello', 'olá', 'a greeting you can use in any situation', 'expression', 'beginner', 'Greetings', ['Hello! How are you?', 'Olá! Como vai?']),
  entry('good-morning', 'good morning', 'bom dia', 'a greeting used before noon', 'expression', 'beginner', 'Greetings', ['Good morning, Ms. Silva!', 'Bom dia, Sra. Silva!']),
  entry('good-evening', 'good evening', 'boa noite (ao chegar)', 'a greeting used when you arrive in the evening', 'expression', 'beginner', 'Greetings', ['Good evening, welcome to the show.', 'Boa noite, bem-vindos ao show.']),
  entry('nice-to-meet-you', 'nice to meet you', 'prazer em conhecer você', 'what you say when you meet someone for the first time', 'expression', 'beginner', 'Greetings', ["I'm Paulo. Nice to meet you!", 'Eu sou o Paulo. Prazer!']),
  entry('see-you-later', 'see you later', 'até mais', 'a friendly way to say goodbye', 'expression', 'beginner', 'Greetings', ['Bye! See you later.', 'Tchau! Até mais.']),
  // Alfabeto
  entry('spell', 'spell', 'soletrar', 'to say the letters of a word in order', 'verb', 'beginner', 'Alphabet', ['How do you spell your last name?', 'Como se soletra o seu sobrenome?']),
  entry('letter', 'letter', 'letra; carta', 'a symbol used in writing, like A or B', 'noun', 'beginner', 'Alphabet', ['"Z" is the last letter of the alphabet.', '"Z" é a última letra do alfabeto.']),
  // Pessoas e estados
  entry('student', 'student', 'estudante', 'a person who studies at a school or university', 'noun', 'beginner', 'People', ["I'm a student at a public university.", 'Sou estudante de uma universidade pública.']),
  entry('teacher', 'teacher', 'professor(a)', 'a person who teaches', 'noun', 'beginner', 'People', ['My teacher is very patient.', 'Minha professora é muito paciente.']),
  entry('friend', 'friend', 'amigo(a)', 'a person you know well and like', 'noun', 'beginner', 'People', ['She is my best friend.', 'Ela é minha melhor amiga.']),
  entry('happy', 'happy', 'feliz', 'feeling good and pleased', 'adjective', 'beginner', 'Feelings', ["I'm happy to see you!", 'Estou feliz em ver você!']),
  entry('tired', 'tired', 'cansado(a)', 'needing rest or sleep', 'adjective', 'beginner', 'Feelings', ["I'm tired after work.", 'Estou cansado depois do trabalho.']),
  // Números
  entry('number', 'number', 'número', 'a word or symbol for an amount, like 3 or seven', 'noun', 'beginner', 'Numbers', ["What's your favorite number?", 'Qual é o seu número favorito?']),
  entry('fifteen', 'fifteen', 'quinze', 'the number 15', 'number', 'beginner', 'Numbers', ['The bus comes in fifteen minutes.', 'O ônibus chega em quinze minutos.']),
  entry('thirty', 'thirty', 'trinta', 'the number 30', 'number', 'beginner', 'Numbers', ['My mother is thirty-eight.', 'Minha mãe tem trinta e oito anos.']),
  entry('years-old', 'years old', 'anos (de idade)', 'used after a number to say someone\'s age', 'expression', 'beginner', 'Numbers', ["I'm twenty-two years old.", 'Eu tenho vinte e dois anos.']),
  // Cores e objetos
  entry('red', 'red', 'vermelho', 'the color of blood or strawberries', 'adjective', 'beginner', 'Colors', ['I love your red shoes.', 'Adoro seus sapatos vermelhos.']),
  entry('blue', 'blue', 'azul', 'the color of the sky on a clear day', 'adjective', 'beginner', 'Colors', ['The sky is blue today.', 'O céu está azul hoje.']),
  entry('green', 'green', 'verde', 'the color of grass and leaves', 'adjective', 'beginner', 'Colors', ['He has a green bike.', 'Ele tem uma bicicleta verde.']),
  entry('yellow', 'yellow', 'amarelo', 'the color of the sun and bananas', 'adjective', 'beginner', 'Colors', ['Taxis in New York are yellow.', 'Os táxis de Nova York são amarelos.']),
  entry('black', 'black', 'preto', 'the darkest color', 'adjective', 'beginner', 'Colors', ['I drink black coffee.', 'Eu tomo café preto.']),
  entry('white', 'white', 'branco', 'the color of snow and milk', 'adjective', 'beginner', 'Colors', ['The walls are white.', 'As paredes são brancas.']),
  entry('umbrella', 'umbrella', 'guarda-chuva', 'an object that protects you from the rain', 'noun', 'beginner', 'Objects', ["Take an umbrella. It's raining!", 'Leve um guarda-chuva. Está chovendo!']),
  entry('phone', 'phone', 'celular; telefone', 'a device you use to call or text people', 'noun', 'beginner', 'Objects', ["I can't find my phone.", 'Não consigo achar meu celular.']),
  entry('bag', 'bag', 'bolsa; mochila; sacola', 'something you use to carry things', 'noun', 'beginner', 'Objects', ['My bag is very heavy.', 'Minha mochila está muito pesada.']),
  entry('key', 'key', 'chave', 'a small metal object that opens a lock', 'noun', 'beginner', 'Objects', ['Where are my car keys?', 'Onde estão as chaves do meu carro?']),
  // Rotina
  entry('every-day', 'every day', 'todos os dias', 'on each day, without exception', 'expression', 'basic', 'Routine', ['I walk my dog every day.', 'Eu passeio com meu cachorro todos os dias.']),
  entry('usually', 'usually', 'geralmente', 'in most cases; normally', 'adverb', 'basic', 'Routine', ['I usually have lunch at noon.', 'Eu geralmente almoço ao meio-dia.']),
  entry('always', 'always', 'sempre', 'every time; at all times', 'adverb', 'basic', 'Routine', ['She always arrives early.', 'Ela sempre chega cedo.']),
  entry('never', 'never', 'nunca', 'at no time', 'adverb', 'basic', 'Routine', ['I never eat breakfast.', 'Eu nunca tomo café da manhã.']),
  entry('wake-up', 'wake up', 'acordar', 'to stop sleeping', 'verb', 'basic', 'Routine', ['I wake up at six on weekdays.', 'Eu acordo às seis nos dias de semana.']),
  entry('breakfast', 'breakfast', 'café da manhã', 'the first meal of the day', 'noun', 'basic', 'Routine', ['We have breakfast together.', 'Nós tomamos café da manhã juntos.']),
  entry('work', 'work', 'trabalhar; trabalho', 'to do a job; the job you do', 'verb', 'basic', 'Routine', ['He works in a hospital.', 'Ele trabalha em um hospital.']),
  entry('speak', 'speak', 'falar (um idioma)', 'to use your voice to say words; to know a language', 'verb', 'basic', 'Communication', ['Do you speak English?', 'Você fala inglês?']),
  entry('like', 'like', 'gostar', 'to enjoy something or think it is nice', 'verb', 'basic', 'Communication', ["I don't like rainy days.", 'Eu não gosto de dias chuvosos.']),
  entry('drive', 'drive', 'dirigir', 'to control a car or other vehicle', 'verb', 'basic', 'Transport', ["She doesn't drive to work.", 'Ela não vai de carro para o trabalho.']),
  // Tempo e lugar
  entry('weekend', 'weekend', 'fim de semana', 'Saturday and Sunday', 'noun', 'basic', 'Time', ['What are you doing this weekend?', 'O que você vai fazer neste fim de semana?']),
  entry('morning', 'morning', 'manhã', 'the early part of the day', 'noun', 'basic', 'Time', ['I study in the morning.', 'Eu estudo de manhã.']),
  entry('night', 'night', 'noite', 'the time when it is dark', 'noun', 'basic', 'Time', ['I read at night.', 'Eu leio à noite.']),
  entry('kitchen', 'kitchen', 'cozinha', 'the room where you cook', 'noun', 'basic', 'Home', ['The kitchen is next to the living room.', 'A cozinha fica ao lado da sala.']),
  entry('table', 'table', 'mesa', 'a piece of furniture with a flat top', 'noun', 'basic', 'Home', ['Put the plates on the table.', 'Coloque os pratos na mesa.']),
  entry('yesterday', 'yesterday', 'ontem', 'the day before today', 'adverb', 'basic', 'Time', ['I saw her yesterday.', 'Eu a vi ontem.']),
  entry('last-weekend', 'last weekend', 'no último fim de semana', 'the weekend before this one', 'expression', 'basic', 'Time', ['We went to a concert last weekend.', 'Fomos a um show no último fim de semana.']),
  entry('tomorrow', 'tomorrow', 'amanhã', 'the day after today', 'adverb', 'basic', 'Time', ["I'll call you tomorrow.", 'Eu te ligo amanhã.']),
  entry('next-week', 'next week', 'semana que vem', 'the week after this one', 'expression', 'basic', 'Time', ["I'm going to start next week.", 'Vou começar semana que vem.']),
  entry('visit', 'visit', 'visitar', 'to go and see a person or place', 'verb', 'basic', 'Activities', ['We visited a museum.', 'Nós visitamos um museu.']),
  entry('buy', 'buy', 'comprar', 'to get something by paying money', 'verb', 'basic', 'Activities', ['I bought a new jacket.', 'Comprei uma jaqueta nova.']),
  entry('plan', 'plan', 'plano; planejar', 'something you have decided to do', 'noun', 'basic', 'Activities', ['Do you have any plans for Friday?', 'Você tem planos para sexta?']),
  entry('travel', 'travel', 'viajar', 'to go from one place to another, often far away', 'verb', 'basic', 'Travel', ['I want to travel to Chile.', 'Quero viajar para o Chile.']),
  // Conversa: comida, viagem, trabalho, tecnologia
  entry('restaurant', 'restaurant', 'restaurante', 'a place where you buy and eat meals', 'noun', 'basic', 'Food', ["Let's try that new restaurant.", 'Vamos experimentar aquele restaurante novo.']),
  entry('delicious', 'delicious', 'delicioso', 'having a very good taste', 'adjective', 'basic', 'Food', ['This cake is delicious!', 'Este bolo está delicioso!']),
  entry('order', 'order', 'pedir (em restaurante)', 'to ask for food or drinks in a restaurant', 'verb', 'basic', 'Food', ["I'd like to order a salad, please.", 'Eu gostaria de pedir uma salada, por favor.']),
  entry('airport', 'airport', 'aeroporto', 'a place where planes take off and land', 'noun', 'basic', 'Travel', ['I need to be at the airport at 6.', 'Preciso estar no aeroporto às 6.']),
  entry('ticket', 'ticket', 'passagem; ingresso', 'a piece of paper or code that lets you travel or enter', 'noun', 'basic', 'Travel', ['I bought the tickets online.', 'Comprei as passagens pela internet.']),
  entry('meeting', 'meeting', 'reunião', 'when people come together to discuss something', 'noun', 'intermediate', 'Work', ['The meeting starts at 10.', 'A reunião começa às 10.']),
  entry('deadline', 'deadline', 'prazo', 'the time by which something must be done', 'noun', 'intermediate', 'Work', ['The deadline is next Friday.', 'O prazo é na próxima sexta.']),
  entry('coworker', 'coworker', 'colega de trabalho', 'a person you work with', 'noun', 'intermediate', 'Work', ['My coworkers are really helpful.', 'Meus colegas de trabalho são muito prestativos.']),
  entry('laptop', 'laptop', 'notebook', 'a small computer you can carry', 'noun', 'basic', 'Technology', ['My laptop battery is low.', 'A bateria do meu notebook está fraca.']),
  entry('update', 'update', 'atualização; atualizar', 'a newer version of software, or to make it newer', 'noun', 'intermediate', 'Technology', ['Install the update tonight.', 'Instale a atualização hoje à noite.']),
  entry('developer', 'developer', 'desenvolvedor(a)', 'a person who creates software', 'noun', 'intermediate', 'Technology', ['She works as a developer.', 'Ela trabalha como desenvolvedora.']),
  // Intermediário e avançado
  entry('ever', 'ever', 'alguma vez; já', 'at any time (used in questions about experiences)', 'adverb', 'intermediate', 'Experiences', ['Have you ever been to Peru?', 'Você já foi ao Peru?']),
  entry('already', 'already', 'já', 'before now or sooner than expected', 'adverb', 'intermediate', 'Experiences', ["I've already finished.", 'Eu já terminei.']),
  entry('experience', 'experience', 'experiência', 'something that happened to you', 'noun', 'intermediate', 'Experiences', ['Living abroad was a great experience.', 'Morar fora foi uma ótima experiência.']),
  entry('figure-out', 'figure out', 'entender; resolver', 'to understand or solve something', 'verb', 'advanced', 'Phrasal verbs', ["I can't figure out how this works.", 'Não consigo entender como isso funciona.']),
  entry('run-into', 'run into', 'encontrar por acaso', 'to meet someone by chance', 'verb', 'advanced', 'Phrasal verbs', ['I ran into Marcos at the gym.', 'Encontrei o Marcos por acaso na academia.']),
  entry('call-off', 'call off', 'cancelar', 'to cancel an event or plan', 'verb', 'advanced', 'Phrasal verbs', ['They called off the trip.', 'Eles cancelaram a viagem.']),
  entry('turn-off', 'turn off', 'desligar', 'to stop a machine or light from working', 'verb', 'advanced', 'Phrasal verbs', ['Please turn off your phones.', 'Por favor, desliguem os celulares.']),
];
