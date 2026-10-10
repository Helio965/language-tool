"""Acrescenta conteúdo ausente sem sobrescrever registros existentes do banco."""

from extensions import db
from models import Exercise, Lesson, LessonVocabulary, Vocabulary
from content import catalog


def seed_content():
    for entry in catalog.vocabulary():
        row = db.session.get(Vocabulary, entry["id"])
        if row is None:
            row = Vocabulary(id=entry["id"])
            db.session.add(row)
            for key in (
                "word",
                "translation",
                "meaning",
                "level",
                "topic",
                "examples",
                "phonetic",
            ):
                setattr(row, key, entry.get(key))
            row.part_of_speech = entry["partOfSpeech"]
    for item in catalog.lessons():
        row = db.session.get(Lesson, item["id"])
        if row is None:
            row = Lesson(id=item["id"])
            db.session.add(row)
            row.level, row.sort_order, row.title, row.topic = (
                item["level"],
                item["order"],
                item["title"],
                item["topic"],
            )
            row.content = {
                key: value for key, value in item.items() if key != "exercises"
            }
            row.estimated_minutes = item["estimatedMinutes"]
        db.session.flush()
        for entry in item["exercises"]:
            exercise = db.session.get(Exercise, entry["id"])
            if exercise is None:
                exercise = Exercise(id=entry["id"])
                db.session.add(exercise)
                exercise.lesson_id, exercise.type, exercise.prompt = (
                    item["id"],
                    entry["type"],
                    entry["prompt"],
                )
                exercise.options, exercise.accepted_answers, exercise.skill_tag = (
                    entry.get("options", []),
                    entry["acceptedAnswers"],
                    entry["skillTag"],
                )
        for word_id in item["vocabularyIds"]:
            if not db.session.get(LessonVocabulary, (item["id"], word_id)):
                db.session.add(
                    LessonVocabulary(lesson_id=item["id"], vocabulary_id=word_id)
                )
    db.session.commit()
    return {
        "lessons": len(catalog.lessons()),
        "exercises": sum(len(item["exercises"]) for item in catalog.lessons()),
        "vocabulary": len(catalog.vocabulary()),
    }
