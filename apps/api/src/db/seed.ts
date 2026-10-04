import type { DatabaseSync } from 'node:sqlite';
import type { ContentCatalog } from '@english-ai/core';
import { transaction } from './database';

/**
 * Sincroniza o conteúdo pedagógico versionado em código com as tabelas de conteúdo.
 * Idempotente (upsert). Mantém a integridade referencial de progresso e tentativas.
 */
export function seedContent(db: DatabaseSync, catalog: ContentCatalog): void {
  const upsertLesson = db.prepare(`
    INSERT INTO lessons (id, level, sort_order, title, topic, content, estimated_minutes)
    VALUES (@id, @level, @sort_order, @title, @topic, @content, @estimated_minutes)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level, sort_order = excluded.sort_order, title = excluded.title,
      topic = excluded.topic, content = excluded.content, estimated_minutes = excluded.estimated_minutes`);
  const upsertExercise = db.prepare(`
    INSERT INTO exercises (id, lesson_id, type, prompt, options, accepted_answers, skill_tag)
    VALUES (@id, @lesson_id, @type, @prompt, @options, @accepted_answers, @skill_tag)
    ON CONFLICT(id) DO UPDATE SET lesson_id = excluded.lesson_id, type = excluded.type, prompt = excluded.prompt,
      options = excluded.options, accepted_answers = excluded.accepted_answers, skill_tag = excluded.skill_tag`);
  const upsertWord = db.prepare(`
    INSERT INTO vocabulary (id, word, translation, meaning, part_of_speech, level, topic, examples, phonetic)
    VALUES (@id, @word, @translation, @meaning, @part_of_speech, @level, @topic, @examples, @phonetic)
    ON CONFLICT(id) DO UPDATE SET word = excluded.word, translation = excluded.translation, meaning = excluded.meaning,
      part_of_speech = excluded.part_of_speech, level = excluded.level, topic = excluded.topic,
      examples = excluded.examples, phonetic = excluded.phonetic`);
  const linkWord = db.prepare('INSERT OR IGNORE INTO lesson_vocabulary (lesson_id, vocabulary_id) VALUES (@lesson_id, @vocabulary_id)');

  transaction(db, () => {
    for (const entry of catalog.vocabulary()) {
      upsertWord.run({
        id: entry.id,
        word: entry.word,
        translation: entry.translation,
        meaning: entry.meaning,
        part_of_speech: entry.partOfSpeech,
        level: entry.level,
        topic: entry.topic,
        examples: JSON.stringify(entry.examples),
        phonetic: entry.phonetic ?? null,
      });
    }
    for (const lesson of catalog.lessons()) {
      const { exercises, ...content } = lesson;
      upsertLesson.run({
        id: lesson.id,
        level: lesson.level,
        sort_order: lesson.order,
        title: lesson.title,
        topic: lesson.topic,
        content: JSON.stringify(content),
        estimated_minutes: lesson.estimatedMinutes,
      });
      for (const exercise of exercises) {
        upsertExercise.run({
          id: exercise.id,
          lesson_id: lesson.id,
          type: exercise.type,
          prompt: exercise.prompt,
          options: JSON.stringify(exercise.options ?? []),
          accepted_answers: JSON.stringify(exercise.acceptedAnswers),
          skill_tag: exercise.skillTag,
        });
      }
      for (const vocabularyId of lesson.vocabularyIds) linkWord.run({ lesson_id: lesson.id, vocabulary_id: vocabularyId });
    }
  });
}
