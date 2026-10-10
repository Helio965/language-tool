"""Explicit, limited demonstration mode using the preserved reviewed corpus."""

import copy
import re

from ai.correction import apply_issues, check_grammar
from ai.personality import ASSISTANT_PERSONA, policy_for, with_assistant_name

REDACTION_PLACEHOLDER = "[dado removido]"
REDACTION_PATTERNS = [
    ("e-mail", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("CPF", re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")),
    ("cartão", re.compile(r"\b(?:\d[ -]?){13,16}\b")),
    (
        "telefone",
        re.compile(r"(?:\+?\d{1,3}[ -]?)?\(?\d{2}\)?[ -]?\d{4,5}[ -]?\d{4}\b"),
    ),
    ("senha", re.compile(r"\b(password|senha)\s*(is|é|:)\s*\S+", re.I)),
]
FACT_KEYS = {"name", "age", "from", "city", "job", "likes", "food"}
END = r"(?=[.,!?;]|$|\s+(?:and|but|because|so|with|in|at|on)\b)"
FACT_PATTERNS = [
    (
        "name",
        re.compile(r"\b(?:my name is|i['’]?m called|call me)\s+([A-Za-zÀ-ÿ]+)", re.I),
    ),
    (
        "age",
        re.compile(
            r"\b(?:i['’]?m|i am|i have)\s+(\d{1,2})\s+years?(?:\s+old)?\b", re.I
        ),
    ),
    (
        "from",
        re.compile(
            r"\b(?:i['’]?m|i am)\s+from\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,28}?)" + END, re.I
        ),
    ),
    (
        "city",
        re.compile(r"\bi live in\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,28}?)" + END, re.I),
    ),
    (
        "job",
        re.compile(
            r"\b(?:i['’]?m|i am|i work as)\s+an?\s+(student|teacher|developer|programmer|engineer|designer|doctor|nurse|lawyer|manager|analyst|cook|chef|writer|driver|accountant|artist|musician)\b",
            re.I,
        ),
    ),
    (
        "likes",
        re.compile(
            r"\bi (?:really )?(?:like|love|enjoy)\s+([a-zÀ-ÿ][a-zÀ-ÿ\s]{1,28}?)" + END,
            re.I,
        ),
    ),
    (
        "food",
        re.compile(r"\bfavou?rite food is\s+([a-zÀ-ÿ][a-zÀ-ÿ\s]{1,24}?)" + END, re.I),
    ),
]


def redact_sensitive_data(text):
    kinds = []
    for kind, pattern in REDACTION_PATTERNS:
        text, count = pattern.subn(REDACTION_PLACEHOLDER, text)
        if count:
            kinds.append(kind)
    return {"text": text, "redactedKinds": kinds}


def privacy_notice(kinds):
    return (
        (
            f"Para proteger sua privacidade, removemos da mensagem: {', '.join(kinds)}. "
            "Não é preciso compartilhar dados pessoais para praticar."
        )
        if kinds
        else None
    )


def empty_context():
    return {
        "facts": {},
        "askedQuestionIds": [],
        "turn": 0,
        "turnsSinceInlineCorrection": 2,
    }


def sanitize_facts(raw, source=None):
    pairs = (
        raw.items()
        if isinstance(raw, dict)
        else [
            (item.get("key"), item.get("value"))
            for item in raw
            if isinstance(item, dict)
        ]
        if isinstance(raw, list)
        else []
    )
    facts = {}
    for key, value in pairs:
        if (
            key not in FACT_KEYS
            or not isinstance(value, str)
            or not 0 < len(value.strip()) <= 60
        ):
            continue
        value = value.strip()
        if (
            redact_sensitive_data(value)["redactedKinds"]
            or REDACTION_PLACEHOLDER in value
        ):
            continue
        if source is not None and value.lower() not in source.lower():
            continue
        facts[key] = value.split()[0] if key == "name" else value
    return facts


def sanitize_context(raw):
    raw = raw if isinstance(raw, dict) else {}
    questions = raw.get("askedQuestionIds")

    def counter(key, default):
        value = raw.get(key, default)
        return max(0, min(1000000, value)) if type(value) is int else default

    return {
        "facts": sanitize_facts(raw.get("facts")),
        "askedQuestionIds": [
            value
            for value in (questions if isinstance(questions, list) else [])
            if isinstance(value, str) and len(value) <= 80
        ][-50:],
        "turn": counter("turn", 0),
        "turnsSinceInlineCorrection": counter("turnsSinceInlineCorrection", 2),
    }


def next_question(topic, context):
    return next(
        (
            question
            for question in topic.get("questions", [])
            if question["id"] not in context["askedQuestionIds"]
            and not any(context["facts"].get(key) for key in question.get("asks", []))
        ),
        None,
    )


def question_text(question, band):
    if not question:
        return {
            "en": "Can you tell me a little more?",
            "pt": "Você pode me contar um pouco mais?",
        }
    return {"en": question[band], "pt": question["lowPt"]}


def looks_portuguese(text):
    words = re.findall(r"[a-zà-ÿ']+", text.lower())
    pt = sum(
        word
        in {
            "não",
            "nao",
            "você",
            "voce",
            "eu",
            "é",
            "que",
            "como",
            "para",
            "tenho",
            "sou",
            "gosto",
            "sei",
            "isso",
            "inglês",
            "ingles",
        }
        for word in words
    )
    en = sum(
        word
        in {
            "the",
            "is",
            "i",
            "you",
            "to",
            "and",
            "my",
            "are",
            "do",
            "like",
            "have",
            "am",
            "what",
            "we",
            "they",
            "go",
            "from",
            "work",
        }
        for word in words
    )
    return pt >= 2 and pt > en


def _recast(original, issues):
    corrected = apply_issues(
        original, [issue for issue in issues if issue["severity"] != "naturalness"]
    )
    old = re.split(r"(?<=[.!?])\s+", original)
    new = re.split(r"(?<=[.!?])\s+", corrected)
    for index, sentence in enumerate(new):
        if index >= len(old) or sentence == old[index]:
            continue
        clauses = re.split(r",?\s+(?:and|but)\s+", sentence, flags=re.I)
        original_clauses = re.split(r",?\s+(?:and|but)\s+", old[index], flags=re.I)
        clause = next(
            (
                value
                for idx, value in enumerate(clauses)
                if idx >= len(original_clauses) or value != original_clauses[idx]
            ),
            sentence,
        )
        if len(clause.split()) > 12:
            return None
        mapping = {
            "i": "you",
            "i'm": "you're",
            "i’m": "you're",
            "me": "you",
            "my": "your",
            "am": "are",
            "we": "you",
            "our": "your",
        }
        return re.sub(
            r"\b(?:I['’]m|I|me|my|am|we|our)\b",
            lambda match: mapping[match[0].lower()],
            clause,
            flags=re.I,
        ).rstrip(".! ")
    return None


class DemoAIService:
    provider_name = "mock"
    providerName = "mock"
    mode = "demo"
    model = None

    def metadata(self):
        return {
            "provider": self.provider_name,
            "mode": self.mode,
            "model": None,
            "notice": "Modo demonstração: respostas roteirizadas e regras locais, sem IA externa.",
        }

    def start_conversation(self, data):
        learner, topic = data["learner"], data["topic"]
        context = empty_context()
        first = next_question(topic, context)
        if first:
            context["askedQuestionIds"].append(first["id"])
        if data.get("lessonOpener"):
            text = {
                key: with_assistant_name(value)
                for key, value in data["lessonOpener"].items()
            }
        else:
            question = question_text(first, policy_for(learner["level"])["band"])
            name = learner.get("firstName", "")
            text = {
                "en": f"Hi, {name}! I'm Lumi. {question['en']}",
                "pt": f"Oi, {name}! Eu sou Lumi. {question['pt']}",
            }
        return {
            "reply": text["en"],
            "translation": text["pt"] if learner.get("showTranslations") else None,
            "context": context,
            "ai": self.metadata(),
        }

    def conversation(self, data):
        learner, topic, text = data["learner"], data["topic"], data["userMessage"]
        context = sanitize_context(copy.deepcopy(data["context"]))
        facts = {
            key: match[1].strip()
            for key, pattern in FACT_PATTERNS
            if (match := pattern.search(text))
        }
        context["facts"].update(sanitize_facts(facts, text))
        context["turn"] += 1
        band = policy_for(learner["level"])["band"]
        current = next(
            (
                q
                for q in topic.get("questions", [])
                if q["id"]
                == (
                    context["askedQuestionIds"][-1]
                    if context["askedQuestionIds"]
                    else None
                )
            ),
            None,
        )
        issues = check_grammar(text)
        if looks_portuguese(text):
            reaction = {
                "en": "No problem! Let's try it in English.",
                "pt": "Sem problema! Vamos tentar em inglês.",
            }
            question = question_text(current, band)
            issues = []
        elif re.search(
            r"\b(idiot|stupid|shut up|i hate you|idiota|burra|burro|cala a boca)\b",
            text,
            re.I,
        ):
            reaction = {
                "en": "Let's keep our chat friendly and respectful.",
                "pt": "Vamos manter a conversa gentil e respeitosa.",
            }
            question = question_text(current, band)
            issues = []
        else:
            recast = _recast(text, issues)
            if re.search(
                r"\b(are you (a )?(human|real|robot|ai)|how old are you|who are you)\b",
                text,
                re.I,
            ):
                reaction = {
                    "en": "I'm Lumi in a scripted demo, without an external AI.",
                    "pt": "Sou a Lumi em uma demonstração roteirizada, sem IA externa.",
                }
            elif re.search(r"\b(?:what does|o que significa)\s+", text, re.I):
                from content.catalog import vocabulary

                match = re.search(
                    r"(?:what does|o que significa)\s+[\"“]?([a-z' -]+?)[\"”]?(?:\s+mean|[?.!]|$)",
                    text,
                    re.I,
                )
                term = match[1].strip().lower() if match else ""
                entry = next(
                    (item for item in vocabulary() if item["word"].lower() == term),
                    None,
                )
                reaction = (
                    {
                        "en": f"{entry['word']}: {entry['meaning']}. In Portuguese: {entry['translation']}.",
                        "pt": f"{entry['word']}: {entry['translation']}.",
                    }
                    if entry
                    else {
                        "en": "That word isn't in my demo list yet.",
                        "pt": "Essa palavra ainda não está na lista da demonstração.",
                    }
                )
            elif recast:
                reaction = {
                    "en": f"Oh, so {recast}. Nice!",
                    "pt": "Ah, entendi. Legal!",
                }
            elif facts.get("from") or facts.get("city"):
                place = facts.get("from") or facts["city"]
                reaction = {
                    "en": f"{place}? Thanks for sharing!",
                    "pt": f"{place}? Obrigada por compartilhar!",
                }
            else:
                reaction = {
                    "en": "Thanks for sharing!",
                    "pt": "Obrigada por compartilhar!",
                }
            next_q = next_question(topic, context)
            question = question_text(next_q, band)
            if next_q:
                context["askedQuestionIds"].append(next_q["id"])
        return {
            "reply": f"{reaction['en']} {question['en']}",
            "translation": f"{reaction['pt']} {question['pt']}"
            if learner.get("showTranslations")
            else None,
            "context": context,
            "issues": issues,
            "ai": self.metadata(),
        }

    def explain(self, data):
        lesson = data["lesson"]
        pool = lesson.get("alternativeExplanations") or lesson["explanation"]
        if data.get("style") == "simpler":
            pool = pool[:1]
        return pool[int(data.get("attempt", 0)) % len(pool)][
            data["learner"]["explanationLanguage"]
        ]

    def another_example(self, data):
        pool = data["lesson"].get("extraExamples", []) + data["lesson"]["examples"]
        return copy.deepcopy(pool[int(data.get("attempt", 0)) % len(pool)])

    def correct(self, data):
        issues = check_grammar(data["answer"])
        pt = data["learner"]["explanationLanguage"] == "pt"
        feedback = (
            (
                "Boa tentativa! Veja os ajustes pelas regras locais."
                if issues
                else "Não identifiquei ajustes nas regras locais. A análise da demonstração é limitada."
            )
            if pt
            else (
                "Good try! See the local rule suggestions."
                if issues
                else "No issues found by local rules. Demo analysis is limited."
            )
        )
        return {"issues": issues, "feedback": feedback, "ai": self.metadata()}

    def generate_exercise(self, data):
        from content.catalog import lessons

        return next(
            (
                exercise
                for lesson in lessons()
                for exercise in lesson["exercises"]
                if exercise["skillTag"] == data["skillTag"]
                and exercise["type"] != "write"
                and exercise["id"] not in data.get("excludeIds", [])
            ),
            None,
        )
