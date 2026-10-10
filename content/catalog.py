"""Conteúdo autoral preservado do catálogo TypeScript; nenhuma compilação no runtime."""

import json
import re
from copy import deepcopy
from pathlib import Path

_DATA = json.loads(Path(__file__).with_name("catalog.json").read_text(encoding="utf-8"))
LEVELS = ["beginner", "basic", "intermediate", "advanced"]
LEVEL_LABELS = dict(zip(LEVELS, ["Iniciante", "Básico", "Intermediário", "Avançado"]))
LEVEL_DESCRIPTIONS = {
    "beginner": "Primeiros passos: cumprimentos, apresentações, verbo to be e frases simples.",
    "basic": "Rotina e situações práticas: presente, passado, futuro, perguntas e preposições.",
    "intermediate": "Comunicação com mais autonomia: experiências, opiniões e textos mais longos.",
    "advanced": "Foco em naturalidade, vocabulário mais rico e nuances do idioma.",
}
SKILL_LABELS = dict(
    zip(
        [
            "greetings",
            "alphabet",
            "to_be",
            "numbers",
            "vocabulary",
            "articles",
            "simple_present",
            "questions_negatives",
            "prepositions",
            "simple_past",
            "future",
            "present_perfect",
            "phrasal_verbs",
            "word_choice",
            "writing_mechanics",
            "reading",
        ],
        [
            "Greetings — cumprimentos",
            "Alphabet — alfabeto",
            "Verb to be",
            "Numbers — números",
            "Vocabulary — vocabulário",
            "Articles — a / an",
            "Simple Present",
            "Questions & negatives",
            "Prepositions — in / on / at",
            "Simple Past",
            "Future — will / going to",
            "Present Perfect",
            "Phrasal verbs",
            "Word choice — escolha de palavras",
            "Writing — escrita",
            "Reading — leitura",
        ],
    )
)
SKILL_LESSON = dict(
    zip(
        [
            "greetings",
            "alphabet",
            "to_be",
            "numbers",
            "vocabulary",
            "articles",
            "simple_present",
            "questions_negatives",
            "prepositions",
            "simple_past",
            "future",
            "present_perfect",
            "phrasal_verbs",
        ],
        [
            "greetings",
            "alphabet",
            "verb-to-be",
            "numbers-age",
            "colors-objects",
            "colors-objects",
            "simple-present",
            "questions-negatives",
            "prepositions",
            "simple-past",
            "future",
            "present-perfect",
            "phrasal-verbs",
        ],
    )
)
GOAL_LABELS = {
    "basics": "Aprender o básico",
    "conversation": "Conversar",
    "work": "Usar no trabalho",
    "travel": "Viajar",
    "technology": "Inglês para tecnologia",
}
PLACEMENT_STAGES = LEVELS[:3]
PLACEMENT_PASS_THRESHOLD = 3
LESSON_PRACTICE_PREFIX = "lesson:"
VOCABULARY_EXERCISE_PREFIX = "vocab:"
_FOLLOW_UP = {
    "greetings": "introductions",
    "alphabet": "introductions",
    "verb-to-be": "introductions",
    "numbers-age": "introductions",
    "colors-objects": "free",
    "simple-present": "daily-routine",
    "questions-negatives": "food",
    "prepositions": "daily-routine",
    "simple-past": "hobbies",
    "future": "travel",
    "present-perfect": "travel",
    "phrasal-verbs": "work",
}


def lessons():
    return deepcopy(_DATA["lessons"])


def lesson(identifier):
    return next((item for item in lessons() if item["id"] == identifier), None)


def vocabulary():
    return deepcopy(_DATA["vocabulary"])


def vocabulary_entry(identifier):
    return next((item for item in vocabulary() if item["id"] == identifier), None)


def placement_questions():
    return deepcopy(_DATA["placementQuestions"])


def topics():
    return deepcopy(_DATA["topics"])


def topic(identifier):
    if not identifier.startswith(LESSON_PRACTICE_PREFIX):
        return next((item for item in topics() if item["id"] == identifier), None)
    item = lesson(identifier[len(LESSON_PRACTICE_PREFIX) :])
    if not item:
        return None
    follow = topic(_FOLLOW_UP.get(item["id"], "free"))
    asked_words = set(re.findall(r"[a-z']+", item["practice"]["question"].lower()))
    questions = [
        question
        for question in (follow or {}).get("questions", [])
        if not all(
            word in asked_words
            for word in re.findall(r"[a-z']+", question["low"].lower())
        )
    ]
    return {
        "id": identifier,
        "title": f"Praticar: {item['title']}",
        "titleEn": f"Practice: {item['topic']}",
        "description": f'Conversa curta para usar o que você estudou em "{item["title"]}".',
        "icon": "graduation-cap",
        "areas": ["education"],
        "recommendedFrom": item["level"],
        "questions": [
            {
                "id": f"{item['id']}-practice",
                "low": item["practice"]["question"],
                "high": item["practice"]["question"],
                "lowPt": item["practice"]["opener"]["pt"],
            },
            *questions,
        ],
    }


def exercise(identifier):
    for item in lessons():
        for entry in item["exercises"]:
            if entry["id"] == identifier:
                return {"exercise": entry, "lesson": item}
    if identifier.startswith(VOCABULARY_EXERCISE_PREFIX):
        entry = vocabulary_entry(identifier[len(VOCABULARY_EXERCISE_PREFIX) :])
        if not entry:
            return None
        candidates = [
            word
            for word in vocabulary()
            if word["id"] != entry["id"]
            and word["partOfSpeech"] == entry["partOfSpeech"]
        ]
        candidates.sort(
            key=lambda word: (abs(len(word["word"]) - len(entry["word"])), word["id"])
        )
        options = [
            entry["translation"],
            *[word["translation"] for word in candidates[:3]],
        ]
        shift = len(entry["id"]) % len(options)
        options = options[shift:] + options[:shift]
        example = entry["examples"][0] if entry["examples"] else None
        return {
            "exercise": {
                "id": identifier,
                "lessonId": None,
                "type": "multiple_choice",
                "instruction": "Escolha a tradução correta.",
                "prompt": f'O que significa "{entry["word"]}"?',
                "options": options,
                "acceptedAnswers": [entry["translation"]],
                "explanation": {
                    "pt": f'"{entry["word"]}" significa {entry["translation"]}.'
                    + (
                        f" Exemplo: {example['en']} ({example['pt']})"
                        if example
                        else ""
                    ),
                    "en": f'"{entry["word"]}": {entry["meaning"]}.'
                    + (f" Example: {example['en']}" if example else ""),
                },
                "skillTag": "vocabulary",
            },
            "lesson": None,
        }
    return None


def to_public_exercise(item):
    return {
        key: deepcopy(value)
        for key, value in item.items()
        if key not in {"acceptedAnswers", "explanation", "requirements"}
    }


def to_public_placement_question(item):
    return {key: deepcopy(value) for key, value in item.items() if key != "answer"}
