"""Protect the authored corpus independently of the retired TypeScript runtime."""

import hashlib
import json
from pathlib import Path

from content import catalog


# Verified against an independently executed TypeScript catalog at cleanup
# baseline 9a2d11b75a9c48aec49db195ea7b7454746cc333. Preserve array order, IDs,
# wording and answer keys; object-key order and JSON whitespace are irrelevant.
# Changes to this snapshot require review of the pedagogical content itself.
AUTHORED_CORPUS_SHA256 = (
    "a4e670a45fd5a6ece207354b7396c864a14a62141882cf9c680c1a3d4854e84d"
)


def test_authored_corpus_matches_verified_migration_snapshot():
    data = json.loads(
        Path(catalog.__file__).with_name("catalog.json").read_text(encoding="utf-8")
    )
    canonical = json.dumps(
        data, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    assert hashlib.sha256(canonical).hexdigest() == AUTHORED_CORPUS_SHA256


def test_authored_identifiers_and_pedagogical_references_are_consistent():
    lessons = catalog.lessons()
    words = catalog.vocabulary()
    placement = catalog.placement_questions()
    topics = catalog.topics()
    exercises = [exercise for lesson in lessons for exercise in lesson["exercises"]]
    for entries in (lessons, words, placement, topics, exercises):
        identifiers = [entry["id"] for entry in entries]
        assert all(
            isinstance(identifier, str) and identifier for identifier in identifiers
        )
        assert len(identifiers) == len(set(identifiers))

    lesson_ids = {lesson["id"] for lesson in lessons}
    word_ids = {word["id"] for word in words}
    assert set(catalog.SKILL_LESSON.values()) <= lesson_ids
    assert [lesson["order"] for lesson in lessons] == sorted(
        lesson["order"] for lesson in lessons
    )
    for lesson in lessons:
        assert set(lesson["vocabularyIds"]) <= word_ids
        for exercise in lesson["exercises"]:
            assert exercise["lessonId"] == lesson["id"]
            assert exercise["skillTag"] in catalog.SKILL_LABELS
        practice = catalog.topic(f"lesson:{lesson['id']}")
        assert practice["questions"][0]["low"] == lesson["practice"]["question"]
        questions = [question["low"] for question in practice["questions"]]
        assert len(questions) == len(set(questions))

    for question in placement:
        assert question["stage"] in catalog.PLACEMENT_STAGES
        assert question["answer"] in question["options"]
        assert question["skillTag"] in catalog.SKILL_LABELS
    for word in words:
        exercise = catalog.exercise(f"vocab:{word['id']}")["exercise"]
        assert exercise["acceptedAnswers"] == [word["translation"]]
        assert word["translation"] in exercise["options"]
