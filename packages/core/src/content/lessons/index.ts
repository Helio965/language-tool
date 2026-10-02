import type { Lesson } from '../../domain/content';
import { basicLessons } from './basic';
import { beginnerLessons } from './beginner';
import { upperLessons } from './upper';

/** Trilha completa, ordenada por progressão de dificuldade (RN02). */
export const LESSONS: readonly Lesson[] = [...beginnerLessons, ...basicLessons, ...upperLessons].sort(
  (a, b) => a.order - b.order,
);
