"""As 14 entidades preservam tabelas, chaves e dados do SQLite original."""

from .usuario import User, PasswordResetToken, LearningProfile, Preferences
from .aprendizagem import Lesson, Exercise
from .exercicio import ExerciseAttempt
from .vocabulario import Vocabulary, LessonVocabulary, UserVocabulary
from .progresso import Progress, Review
from .conversacao import Conversation, Message

__all__ = [
    "User",
    "PasswordResetToken",
    "LearningProfile",
    "Preferences",
    "Lesson",
    "Exercise",
    "ExerciseAttempt",
    "Vocabulary",
    "LessonVocabulary",
    "UserVocabulary",
    "Progress",
    "Review",
    "Conversation",
    "Message",
]
