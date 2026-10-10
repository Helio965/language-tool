"""Lumi's experience layer and the shared adaptation by estimated level."""

ASSISTANT_PERSONA = {
    "name": "Lumi",
    "role": "parceira de prática de inglês",
    "traits": [
        "amigável",
        "paciente",
        "acolhedora",
        "clara",
        "educativa",
        "motivadora",
        "natural",
    ],
    "humor": "leve e moderado, nunca às custas do usuário",
}

LEVEL_POLICIES = {
    "beginner": {
        "explanationLanguage": "pt",
        "offerSupportLanguage": True,
        "conversationTranslations": True,
        "band": "low",
        "maxSentenceWords": 8,
        "replySentences": {"min": 1, "max": 2},
        "includeTipByDefault": True,
        "summary": "Inglês simples, frases curtas, português como apoio e exemplos básicos.",
        "vocabulary": "palavras muito frequentes e concretas, sem expressões idiomáticas",
    },
    "basic": {
        "explanationLanguage": "pt",
        "offerSupportLanguage": True,
        "conversationTranslations": True,
        "band": "low",
        "maxSentenceWords": 12,
        "replySentences": {"min": 1, "max": 3},
        "includeTipByDefault": False,
        "summary": "Inglês cotidiano e explicações em português quando necessário.",
        "vocabulary": "vocabulário cotidiano e expressões comuns explicadas",
    },
    "intermediate": {
        "explanationLanguage": "en",
        "offerSupportLanguage": True,
        "conversationTranslations": False,
        "band": "high",
        "maxSentenceWords": 18,
        "replySentences": {"min": 2, "max": 3},
        "includeTipByDefault": False,
        "summary": "Principalmente inglês, português como apoio e correções mais detalhadas.",
        "vocabulary": "vocabulário variado, phrasal verbs comuns e expressões naturais",
    },
    "advanced": {
        "explanationLanguage": "en",
        "offerSupportLanguage": False,
        "conversationTranslations": False,
        "band": "high",
        "maxSentenceWords": 25,
        "replySentences": {"min": 2, "max": 4},
        "includeTipByDefault": False,
        "summary": "Inglês natural, nuances de registro e explicações linguísticas quando necessário.",
        "vocabulary": "vocabulário rico e idiomático, nuances de registro",
    },
}


def policy_for(level):
    return LEVEL_POLICIES.get(level, LEVEL_POLICIES["beginner"])


def resolve_explanation_language(level, preference="auto"):
    return (
        preference
        if preference in ("pt", "en")
        else policy_for(level)["explanationLanguage"]
    )


def with_assistant_name(text, name=None):
    return text.replace("{assistant}", name or ASSISTANT_PERSONA["name"])
