"""Conservative grammar checks: never infer a speaker's intended meaning."""

import re

SEVERITY_WEIGHT = {"meaning": 3, "grammar": 2, "naturalness": 1}
THIRD_PERSON = dict(
    zip(
        "go do have want like love work study live play watch eat drink need make read speak know think use take teach cook drive sleep get come say try enjoy travel write listen feel wake walk run".split(),
        "goes does has wants likes loves works studies lives plays watches eats drinks needs makes reads speaks knows thinks uses takes teaches cooks drives sleeps gets comes says tries enjoys travels writes listens feels wakes walks runs".split(),
    )
)
BASE_FROM_THIRD = {third: base for base, third in THIRD_PERSON.items()}
PAST_TO_BASE = dict(
    zip(
        "went saw ate had made took came bought got wrote spoke drank gave knew met left felt ran slept said thought found told worked played watched studied liked lived visited called cooked traveled travelled finished started wanted needed talked walked listened cleaned opened tried used loved stayed helped asked enjoyed danced moved arrived practiced changed decided stopped planned".split(),
        "go see eat have make take come buy get write speak drink give know meet leave feel run sleep say think find tell work play watch study like live visit call cook travel travel finish start want need talk walk listen clean open try use love stay help ask enjoy dance move arrive practice change decide stop plan".split(),
    )
)
ING_FORM = dict(
    zip(
        "play read watch cook travel study work dance swim run sing draw write walk listen ride drive paint".split(),
        "playing reading watching cooking traveling studying working dancing swimming running singing drawing writing walking listening riding driving painting".split(),
    )
)
APOS = "['’]"
PAST_MARKERS = re.compile(
    r"\b(yesterday|last (?:night|week|weekend|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|ago)\b",
    re.I,
)
BLOCKING = re.compile(
    r"\b(does|did|do|can|could|will|would|should|must|might|may|let|make|made|help|saw|see|watch|heard|hear|to|if|doesn['’]t|didn['’]t|don['’]t|won['’]t|can['’]t)\s*$",
    re.I,
)
LINKING = re.compile(
    r"\b(am|is|are|was|were|do|does|did|will|would|can|could|should|feel|felt|look|looked|seem|seemed|get|got|make|makes|made)\s*$",
    re.I,
)


def be_for(subject):
    subject = subject.lower()
    if subject == "i":
        return "am"
    if subject in ("you", "we", "they"):
        return "are"
    return "is"


def _third(match, text):
    if BLOCKING.search(text[: match.start()]) or PAST_MARKERS.search(text):
        return None
    return f"{match[1]} {match[2] or ''}{THIRD_PERSON[match[3].lower()]}"


def _age(match, text):
    if re.match(
        r"\s+(of|experience|left|ago|in|at|to|until)\b", text[match.end() :], re.I
    ):
        return None
    return f"{match[1]} {be_for(match[1])} {match[2]} years old"


def _missing_be(match, text):
    if LINKING.search(text[: match.start()]):
        return None
    return f"{match[1]} {be_for(match[1])} {match[2] or ''}{match[3]}"


def _missing_it(match, text):
    if text.strip().endswith("?"):
        return None
    return f"{match[1]}It {match[2].lower()} {match[3]} {match[4]}"


def _like(match, text):
    if text[match.end() :].startswith("-"):
        return None
    if re.search(r"(would|['’]d)\s*$", text[: match.start()], re.I):
        return f"{match[1]} to {match[2]}"
    return f"{match[1]} {ING_FORM[match[2].lower()]}"


def _rule(
    rule_id,
    skill,
    pattern,
    replacement,
    pt,
    en,
    severity="grammar",
    tip=None,
    flags=re.I,
):
    return (
        rule_id,
        skill,
        re.compile(pattern, flags),
        replacement,
        {"pt": pt, "en": en},
        severity,
        tip,
    )


RULES = [
    _rule(
        "third_person_s",
        "simple_present",
        rf"\b(he|she|it|my (?:mother|mom|father|dad|sister|brother|friend|boss|wife|husband|son|daughter|teacher|cat|dog))\s+((?:always|usually|often|sometimes|never)\s+)?({'|'.join(THIRD_PERSON)})\b",
        _third,
        'Com "he", "she" e "it", normalmente adicionamos "-s" ao verbo no presente simples.',
        'With "he", "she" and "it", we usually add "-s" to the verb in the simple present.',
        tip={
            "pt": "go → goes, have → has, study → studies.",
            "en": "go → goes, have → has, study → studies.",
        },
    ),
    _rule(
        "age_with_have",
        "to_be",
        r"\b(I|you|he|she|we|they|my \w+)\s+(?:have|has)\s+(\d{1,3}|[a-z]+(?:-[a-z]+)?)\s+years?(?:\s+old)?\b",
        _age,
        'Para dizer a idade, usamos o verbo "to be": I am 25 years old.',
        'For age, use the verb "to be": I am 25 years old.',
        tip={
            "pt": 'Também é natural dizer "I’m 25".',
            "en": 'You can also say "I’m 25".',
        },
    ),
    _rule(
        "how_many_years",
        "to_be",
        r"\bhow many years (?:do|does) (you|he|she|they) have\b",
        lambda m, _: f"how old {be_for(m[1])} {m[1]}",
        'Para perguntar a idade, usamos "How old are you?".',
        'To ask about age, say "How old are you?".',
    ),
    _rule(
        "have_hunger",
        "to_be",
        r"\b(I|you|he|she|we|they)\s+(?:have|has)\s+(hungry|thirsty|sleepy)\b",
        lambda m, _: f"{m[1]} {be_for(m[1])} {m[2]}",
        'Com os adjetivos hungry, thirsty e sleepy, use "to be": I am hungry.',
        'Use "to be" with hungry, thirsty and sleepy: I am hungry.',
    ),
    _rule(
        "missing_to_be",
        "to_be",
        r"\b(I|he|she|we|they)\s+((?:very|so|really|too)\s+)?(happy|tired|hungry|thirsty|sad|busy|ready|sick|bored|excited|nervous|fine|late|sleepy|angry)\b",
        _missing_be,
        'Para descrever como alguém está, usamos "to be": I am tired, she is happy.',
        'To describe a state, use "to be": I am tired, she is happy.',
    ),
    _rule(
        "missing_it_subject",
        "to_be",
        r"(^|[.!]\s+)(is|was)\s+(very|so|really|too)\s+(\w+)",
        _missing_it,
        "Esta declaração precisa de sujeito: It is very good.",
        "This statement needs a subject: It is very good.",
    ),
    _rule(
        "dont_third_person",
        "questions_negatives",
        rf"\b(he|she|it)\s+don{APOS}t\b",
        lambda m, _: f"{m[1]} doesn't",
        'Com he, she e it, use "doesn’t" na negativa do presente.',
        'With he, she and it, use "doesn’t" in the present negative.',
    ),
    _rule(
        "does_with_s",
        "questions_negatives",
        rf"\b(does(?:n{APOS}t)?|does not)\s+((?:he|she|it)\s+)?({'|'.join(BASE_FROM_THIRD)})\b",
        lambda m, _: f"{m[1]} {m[2] or ''}{BASE_FROM_THIRD[m[3].lower()]}",
        "Depois de does ou doesn’t, use a forma básica do verbo: Does she work?",
        "After does or doesn’t, use the base verb: Does she work?",
    ),
    _rule(
        "did_with_past",
        "simple_past",
        rf"\b(did(?:n{APOS}t| not)?)\s+((?:I|you|he|she|it|we|they)\s+)?({'|'.join(PAST_TO_BASE)})\b",
        lambda m, _: f"{m[1]} {m[2] or ''}{PAST_TO_BASE[m[3].lower()]}",
        "Depois de did ou didn’t, use a forma básica: I didn’t go.",
        "After did or didn’t, use the base verb: I didn’t go.",
    ),
    _rule(
        "am_agree",
        "word_choice",
        rf"\b(I|we|they)(?:\s+am|\s+are|{APOS}m|{APOS}re)\s+(agree|disagree)\b",
        lambda m, _: f"{m[1]} {m[2]}",
        "Agree já é um verbo: I agree. Não precisa de am.",
        "Agree is already a verb: I agree, without am.",
    ),
    _rule(
        "people_is",
        "to_be",
        r"\bpeople\s+(is|was)\b",
        lambda m, _: "people were" if m[1].lower() == "was" else "people are",
        "People é plural: people are / people were.",
        "People is plural: people are / people were.",
    ),
    _rule(
        "in_weekday",
        "prepositions",
        r"\bin\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(s?)\b",
        lambda m, _: f"on {m[1].capitalize()}{m[2]}",
        "Com dias da semana usamos on: on Monday.",
        "Use on with days of the week: on Monday.",
    ),
    _rule(
        "at_the_morning",
        "prepositions",
        r"\bat\s+the\s+(morning|afternoon|evening)\b",
        lambda m, _: f"in the {m[1].lower()}",
        "Use in the com partes do dia: in the morning. A exceção é at night.",
        "Use in the with parts of the day: in the morning. The exception is at night.",
    ),
    _rule(
        "go_to_home",
        "prepositions",
        r"\b(go|goes|went|going|come|comes|came|coming|get|got|arrive|arrived)\s+to\s+home\b",
        lambda m, _: f"{m[1]} home",
        "Depois de verbos de movimento, home não precisa de to: go home.",
        "After movement verbs, home does not need to: go home.",
    ),
    _rule(
        "like_base_verb",
        "word_choice",
        rf"\b(like|likes|love|loves|hate|hates|enjoy|enjoys)\s+({'|'.join(ING_FORM)})\b",
        _like,
        "Depois de like, love e hate, use -ing ou to + verbo; depois de enjoy, use -ing.",
        "After like, love and hate, use -ing or to + verb; after enjoy, use -ing.",
    ),
    _rule(
        "there_have",
        "word_choice",
        r"\b(in (?:my|the|our) \w+),?\s+(?:have|has)\s+(a lot|an|a|many|some|lots|\d+)\b",
        lambda m, _: (
            f"{m[1]}, there {'is' if m[2].lower() in ('a', 'an') else 'are'} {m[2]}"
        ),
        "Para falar da existência de algo, use there is / there are.",
        "For existence, use there is / there are.",
    ),
    _rule(
        "explain_me",
        "word_choice",
        r"\bexplain\s+me(\s+(?:this|that|it))?\b",
        lambda m, _: f"explain{m[1]} to me" if m[1] else "explain to me",
        "Em inglês, dizemos explain to me ou explain it to me.",
        "Say explain to me or explain it to me.",
    ),
    _rule(
        "double_comparative",
        "word_choice",
        r"\bmore\s+(better|worse|bigger|smaller|easier|harder|faster|cheaper|older|younger)\b",
        lambda m, _: m[1],
        "Essas formas já são comparativos: better, bigger, easier. Não acrescente more.",
        "These forms are already comparative: better, bigger, easier. Do not add more.",
    ),
    _rule(
        "uncountable_plural",
        "word_choice",
        r"\b(informations|advices|furnitures|homeworks)\b",
        lambda m, _: m[1][:-1],
        "Information, advice, furniture e homework são incontáveis no uso comum.",
        "Information, advice, furniture and homework are uncountable in ordinary use.",
    ),
    _rule(
        "depend_of",
        "prepositions",
        r"\b(depend|depends|depending)\s+of\b",
        lambda m, _: f"{m[1]} on",
        "Use depend on: It depends on the weather.",
        "Use depend on: It depends on the weather.",
    ),
    _rule(
        "make_question",
        "word_choice",
        r"\b(make|makes|made)\s+(a\s+)?(question|questions)\b",
        lambda m, _: (
            f"{ {'make': 'ask', 'makes': 'asks', 'made': 'asked'}[m[1].lower()] } {m[2] or ''}{m[3]}"
        ),
        "Para fazer uma pergunta a alguém, use ask a question.",
        "To put a question to someone, use ask a question.",
    ),
    _rule(
        "years_without_old",
        "numbers",
        r"\b(am|is|are|I['’]m|she['’]s|he['’]s)\s+(\d{1,3})\s+years\b(?!\s+(old|of|younger|older|ago|behind|ahead))",
        lambda m, _: f"{m[1]} {m[2]} years old",
        "Ao expressar idade com years, complete com old; ou diga apenas I’m 25.",
        "For age with years, add old; or simply say I’m 25.",
        severity="naturalness",
    ),
    _rule(
        "lowercase_i",
        "writing_mechanics",
        r"(^|[\s,.!?(])i(?=[\s'’,.!?)]|$)",
        lambda m, _: f"{m[1]}I",
        "O pronome I é sempre escrito com letra maiúscula.",
        "The pronoun I is always capitalized.",
        severity="naturalness",
        flags=0,
    ),
]


def resolve_overlaps(issues):
    kept = []
    for issue in sorted(
        issues,
        key=lambda item: (
            -len(item["original"]),
            -SEVERITY_WEIGHT[item["severity"]],
            item["start"],
        ),
    ):
        start, end = issue["start"], issue["start"] + len(issue["original"])
        if start >= 0 and not any(
            start < other["start"] + len(other["original"]) and other["start"] < end
            for other in kept
        ):
            kept.append(issue)
    return sorted(kept, key=lambda item: item["start"])


def check_grammar(text):
    issues = []
    for rule_id, skill, pattern, replace, explanation, severity, tip in RULES:
        for match in pattern.finditer(text):
            replacement = replace(match, text)
            if replacement is None:
                continue
            replacement = re.sub(r"\s+", " ", replacement)
            first = match[0].lstrip()[:1]
            if first.isupper():
                leading = len(replacement) - len(replacement.lstrip())
                replacement = (
                    replacement[:leading]
                    + replacement[leading : leading + 1].upper()
                    + replacement[leading + 1 :]
                )
            replacement = re.sub(r"(^|\s)i(?=\s|['’]|$)", r"\1I", replacement)
            if replacement != match[0]:
                issue = {
                    "ruleId": rule_id,
                    "skillTag": skill,
                    "severity": severity,
                    "start": match.start(),
                    "original": match[0],
                    "replacement": replacement,
                    "explanation": explanation,
                }
                if tip:
                    issue["tip"] = tip
                issues.append(issue)
    return resolve_overlaps(issues)


def apply_issues(text, issues):
    for issue in sorted(resolve_overlaps(issues), key=lambda item: -item["start"]):
        start = issue["start"]
        end = start + len(issue["original"])
        if text[start:end] == issue["original"]:
            text = text[:start] + issue["replacement"] + text[end:]
    return text


def build_correction(text, issues, language="pt", include_tip=False):
    issues = resolve_overlaps(issues)
    if not issues:
        return None
    main = max(issues, key=lambda item: SEVERITY_WEIGHT[item["severity"]])
    unique = {item["ruleId"]: item for item in issues}
    tip = (
        next(
            (item["tip"][language] for item in unique.values() if item.get("tip")), None
        )
        if include_tip
        else None
    )
    return {
        "original": text,
        "suggestion": apply_issues(text, issues),
        "changes": [
            {"from": item["original"].strip(), "to": item["replacement"].strip()}
            for item in issues
        ],
        "explanation": "\n".join(
            item["explanation"][language] for item in unique.values()
        ),
        "tip": tip,
        "severity": main["severity"],
        "skillTag": main["skillTag"],
        "ruleId": "+".join(unique),
    }


def decide_conversation_corrections(
    issues, intensity="balanced", level="beginner", turns_since_inline_correction=2
):
    result = {"inline": [], "deferred": [], "ignored": []}
    for issue in issues:
        severity = issue["severity"]
        if intensity == "light":
            target = (
                "inline"
                if severity == "meaning"
                else "deferred"
                if severity == "grammar"
                else "ignored"
            )
        elif intensity == "detailed":
            target = "inline" if len(result["inline"]) < 3 else "deferred"
        elif severity == "meaning":
            target = "inline"
        elif severity == "grammar":
            target = (
                "inline"
                if turns_since_inline_correction >= 2 and not result["inline"]
                else "deferred"
            )
        else:
            target = "ignored" if level == "beginner" else "deferred"
        result[target].append(issue)
    return result


def select_learning_corrections(issues, intensity):
    return [
        item
        for item in issues
        if item["severity"] != "naturalness" or intensity != "light"
    ]
