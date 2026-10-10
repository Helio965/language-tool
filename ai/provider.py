"""Replaceable provider interface, official Anthropic SDK and strict validation."""

import json
import re

from flask import current_app

from ai.conversation import (
    DemoAIService,
    empty_context,
    next_question,
    question_text,
    redact_sensitive_data,
    sanitize_context,
    sanitize_facts,
)
from ai.correction import check_grammar, resolve_overlaps
from ai.personality import policy_for
from ai.prompts import (
    CONVERSATION_SCHEMA,
    CORRECTION_SCHEMA,
    EXAMPLE_SCHEMA,
    EXPLANATION_SCHEMA,
    OPENING_SCHEMA,
    build_system_prompt,
    conversation_task,
)
from services.common import AppError


class ProviderError(AppError):
    """Only safe, classified failures cross the application boundary."""

    def __init__(self, reason="unavailable"):
        messages = {
            "not_configured": "A IA externa não está configurada. Configure o provedor ou selecione o modo demonstração.",
            "authentication": "Não foi possível autenticar o serviço de IA. Verifique a configuração no servidor.",
            "rate_limit": "O serviço de IA atingiu o limite de solicitações. Aguarde e tente novamente.",
            "timeout": "A IA demorou para responder. Sua mensagem não foi salva; tente novamente.",
            "invalid_response": "A IA retornou uma resposta inválida. Sua mensagem não foi salva; tente novamente.",
            "refusal": "A IA não conseguiu responder a esta mensagem. Tente reformular para a prática de inglês.",
            "unavailable": "A IA está indisponível no momento. Sua mensagem não foi salva; tente novamente.",
        }
        super().__init__(
            "AI_UNAVAILABLE" if reason != "rate_limit" else "RATE_LIMITED",
            messages.get(reason, messages["unavailable"]),
            429 if reason == "rate_limit" else 503,
        )
        self.reason = reason


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _validate(value, schema):
    kind = schema["type"]
    if kind == "object":
        if not isinstance(value, dict) or set(value) != set(schema["required"]):
            raise ValueError("Unexpected JSON fields")
        for key, item in value.items():
            _validate(item, schema["properties"][key])
    elif kind == "array":
        if not isinstance(value, list) or len(value) > schema.get("maxItems", 100):
            raise ValueError("Invalid array")
        for item in value:
            _validate(item, schema["items"])
    elif kind == "string":
        if not isinstance(value, str) or not schema.get("minLength", 0) <= len(
            value.strip()
        ) <= schema.get("maxLength", 1200):
            raise ValueError("Invalid text")
        if "enum" in schema and value not in schema["enum"]:
            raise ValueError("Unknown enum")


def validate_response(raw, schema):
    try:
        if not isinstance(raw, str) or len(raw) > 24000:
            raise ValueError("Response too large")
        value = json.loads(
            raw,
            object_pairs_hook=_unique_object,
            parse_constant=lambda _: (_ for _ in ()).throw(
                ValueError("Nonfinite number")
            ),
        )
        _validate(value, schema)
        return value
    except (ValueError, TypeError, RecursionError) as exc:
        raise ProviderError("invalid_response") from exc


def to_grammar_issues(raw, message):
    result = []
    for item in raw[:5]:
        span, replacement = item["span"], item["replacement"]
        start = message.find(span)
        if (
            start < 0
            or span == replacement
            or redact_sensitive_data(replacement)["redactedKinds"]
        ):
            continue
        # These are valid meanings, not deterministic errors. Ask for intent first.
        if (
            re.search(r"\bboring\b", span, re.I)
            and re.search(r"\bbored\b", replacement, re.I)
        ) or (
            re.search(r"\bpretend\b", span, re.I)
            and re.search(r"\b(intend|plan)\b", replacement, re.I)
        ):
            continue
        result.append(
            {
                "ruleId": f"ai:{item['skill']}",
                "skillTag": item["skill"],
                "severity": item["severity"],
                "start": start,
                "original": span,
                "replacement": replacement,
                "explanation": {
                    "pt": redact_sensitive_data(item["explanation_pt"])["text"],
                    "en": redact_sensitive_data(item["explanation_en"])["text"],
                },
            }
        )
    return result


def _provider_schema(schema):
    # Provider supports the structural schema; lengths remain enforced locally.
    if isinstance(schema, dict):
        return {
            key: _provider_schema(value)
            for key, value in schema.items()
            if key not in {"minLength", "maxLength", "maxItems"}
        }
    if isinstance(schema, list):
        return [_provider_schema(value) for value in schema]
    return schema


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, config, client=None):
        self.model = config["ANTHROPIC_MODEL"]
        self.configured = bool(config.get("ANTHROPIC_API_KEY"))
        self.client = client
        if self.configured and client is None:
            import anthropic

            self.client = anthropic.Anthropic(
                api_key=config["ANTHROPIC_API_KEY"],
                timeout=config.get("AI_TIMEOUT_MS", 20000) / 1000,
                max_retries=1,
            )

    def complete(self, request):
        if not self.configured:
            raise ProviderError("not_configured")
        import anthropic

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=request["system"],
                messages=request["messages"],
                output_config={
                    "format": {
                        "type": "json_schema",
                        "schema": _provider_schema(request["jsonSchema"]),
                    }
                },
            )
        except anthropic.AuthenticationError as exc:
            raise ProviderError("authentication") from exc
        except anthropic.RateLimitError as exc:
            raise ProviderError("rate_limit") from exc
        except anthropic.APITimeoutError as exc:
            raise ProviderError("timeout") from exc
        except (anthropic.APIConnectionError, anthropic.APIStatusError) as exc:
            raise ProviderError("unavailable") from exc
        if response.stop_reason == "refusal":
            raise ProviderError("refusal")
        if response.stop_reason != "end_turn":
            raise ProviderError("invalid_response")
        text = "".join(
            block.text for block in response.content if block.type == "text"
        ).strip()
        if not text:
            raise ProviderError("invalid_response")
        return text


class LLMAIService:
    mode = "live"

    def __init__(self, provider, max_history=12, max_context_chars=8000):
        self.provider = provider
        self.provider_name = provider.name
        self.providerName = provider.name
        self.model = getattr(provider, "model", None)
        self.max_history = max(2, min(50, max_history))
        self.max_context_chars = max_context_chars
        self.deterministic = DemoAIService()

    def metadata(self):
        configured = getattr(self.provider, "configured", True)
        return {
            "provider": self.provider_name,
            "mode": self.mode if configured else "unconfigured",
            "model": self.model,
            "notice": "Lumi é uma IA e pode errar."
            if configured
            else "IA externa sem configuração. Nenhuma resposta será simulada como IA real.",
        }

    def _request(self, learner, mode, task, schema, history=None, user_message=None):
        budget = self.max_context_chars - len(user_message or "")
        retained = []
        for message in reversed((history or [])[-self.max_history :]):
            text = redact_sensitive_data(str(message["content"]))["text"][:1200]
            if len(text) > budget:
                break
            if message.get("role") in {"user", "assistant"}:
                retained.append({"role": message["role"], "content": text})
                budget -= len(text)
        messages = list(reversed(retained))
        messages.append(
            {
                "role": "user",
                "content": user_message if user_message is not None else task,
            }
        )
        safe_learner = dict(
            learner,
            firstName=redact_sensitive_data(str(learner.get("firstName", "")))["text"][
                :40
            ],
        )
        system = build_system_prompt(mode, safe_learner)
        if user_message is not None:
            system += "\n\n" + task
        try:
            raw = self.provider.complete(
                {"system": system, "messages": messages, "jsonSchema": schema}
            )
        except ProviderError:
            raise
        except Exception as exc:
            # Adapters must not leak credentials or provider response bodies.
            raise ProviderError("unavailable") from exc
        return validate_response(raw, schema)

    def start_conversation(self, data):
        if data.get("lessonOpener"):
            result = self.deterministic.start_conversation(data)
            result["ai"] = {
                "provider": "catalog",
                "mode": "authored",
                "model": None,
                "notice": "Abertura pedagógica revisada; próximas mensagens usam o provedor configurado.",
            }
            return result
        learner, topic = data["learner"], data["topic"]
        context = empty_context()
        first = next_question(topic, context)
        task = (
            "Inicie a conversa com uma saudação curta pelo primeiro nome e uma pergunta. "
            + conversation_task(
                topic,
                {},
                question_text(first, policy_for(learner["level"])["band"])["en"],
            )
        )
        parsed = self._request(learner, "conversation", task, OPENING_SCHEMA)
        if first:
            context["askedQuestionIds"].append(first["id"])
        return {
            "reply": redact_sensitive_data(parsed["reply"])["text"],
            "translation": redact_sensitive_data(parsed["translation"])["text"] or None
            if learner.get("showTranslations")
            else None,
            "context": context,
            "ai": self.metadata(),
        }

    def conversation(self, data):
        learner, topic = data["learner"], data["topic"]
        text = redact_sensitive_data(data["userMessage"])["text"]
        context = sanitize_context(data["context"])
        next_q = next_question(topic, context)
        task = conversation_task(
            topic,
            context["facts"],
            question_text(next_q, policy_for(learner["level"])["band"])["en"],
        )
        parsed = self._request(
            learner,
            "conversation",
            task,
            CONVERSATION_SCHEMA,
            data.get("history"),
            text,
        )
        context["facts"].update(sanitize_facts(parsed["facts"], text))
        context["turn"] += 1
        # Only record a suggested question when it was actually asked.
        if next_q and (
            next_q["low"].lower() in parsed["reply"].lower()
            or next_q["high"].lower() in parsed["reply"].lower()
        ):
            context["askedQuestionIds"] = (
                context["askedQuestionIds"] + [next_q["id"]]
            )[-50:]
        issues = resolve_overlaps(
            check_grammar(text) + to_grammar_issues(parsed["issues"], text)
        )
        return {
            "reply": redact_sensitive_data(parsed["reply"])["text"],
            "translation": (
                redact_sensitive_data(parsed["translation"])["text"] or None
            )
            if learner.get("showTranslations")
            else None,
            "context": context,
            "issues": issues,
            "ai": self.metadata(),
        }

    def explain(self, data):
        lesson, learner = data["lesson"], data["learner"]
        task = "Explique em até três frases, sem markdown, no idioma solicitado, uma ideia desta aula. "
        task += json.dumps(
            {
                "title": lesson["title"],
                "explanation": lesson["explanation"],
                "style": data.get("style", "another_way"),
            },
            ensure_ascii=False,
        )
        result = self._request(learner, "learn", task, EXPLANATION_SCHEMA)
        return redact_sensitive_data(result["explanation"])["text"]

    def another_example(self, data):
        lesson = data["lesson"]
        task = (
            "Crie um exemplo curto diferente dos revisados, com tradução e highlight copiado da frase. "
            + json.dumps(
                {"title": lesson["title"], "examples": lesson["examples"]},
                ensure_ascii=False,
            )
        )
        result = self._request(data["learner"], "learn", task, EXAMPLE_SCHEMA)
        result = {
            key: redact_sensitive_data(value)["text"] for key, value in result.items()
        }
        if not result["highlight"] or result["highlight"] not in result["en"]:
            result.pop("highlight")
        return result

    def correct(self, data):
        answer = redact_sensitive_data(data["answer"])["text"]
        task = (
            "Analise esta resposta livre de inglês; não altere significados ambíguos. "
            + json.dumps(
                {
                    "instruction": data["exercise"]["instruction"],
                    "prompt": data["exercise"]["prompt"],
                },
                ensure_ascii=False,
            )
        )
        result = self._request(
            data["learner"], "learn", task, CORRECTION_SCHEMA, user_message=answer
        )
        return {
            "issues": resolve_overlaps(
                check_grammar(answer) + to_grammar_issues(result["issues"], answer)
            ),
            "feedback": redact_sensitive_data(result["feedback"])["text"],
            "ai": self.metadata(),
        }

    def generate_exercise(self, data):
        return self.deterministic.generate_exercise(data)


def create_ai_service(config):
    provider = config.get("AI_PROVIDER", "mock")
    if provider in {"mock", "demo"}:
        return DemoAIService()
    if provider == "anthropic":
        return LLMAIService(
            AnthropicProvider(config), config.get("AI_MAX_HISTORY_MESSAGES", 12)
        )
    raise ValueError("Provedor de IA desconhecido.")


def get_ai_service():
    return current_app.extensions["english_ai"]
