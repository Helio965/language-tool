"""E-mail transacional fora da requisição, com TLS e logs sem conteúdo privado."""

import json
import os
import secrets
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path
from threading import Lock
from urllib.parse import quote, urlsplit


def render_email(kind, user, app_url, token=None, ttl=15):
    first = user.name.strip().split()[0] if user.name.strip() else ""
    if kind == "welcome":
        title = f"Boas-vindas, {first}!" if first else "Boas-vindas!"
        subject = "Boas-vindas ao English AI"
        url = app_url + "/entrar"
        description = "Sua conta no English AI foi criada. Conte seu objetivo, faça o nivelamento e comece a estudar."
        button = "Começar a estudar"
        notice = "Por segurança, nunca enviamos sua senha por e-mail."
    else:
        title = "Redefinir sua senha"
        subject = "Redefinição de senha — English AI"
        url = app_url + "/redefinir-senha/" + quote(token, safe="")
        description = (
            f"Olá, {first}. Recebemos um pedido para redefinir sua senha no English AI."
        )
        button = "Redefinir senha"
        notice = f"Este link vale por {ttl} minutos e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail."
    footer = "Este é um e-mail automático do English AI. Nunca pedimos nem enviamos senhas por e-mail. English AI · Projeto acadêmico."
    html = f'''<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>English AI</title>
<body style="margin:0;background:#f7f3ec;font-family:Arial,sans-serif;color:#1a1f3a"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px"><table role="presentation" style="width:100%;max-width:600px"><tr><td style="padding:28px;background:#fffdf9;border:1px solid #e4dccd;border-radius:18px">
<h1 style="font-family:Georgia,serif">{escape(title)}</h1><p style="line-height:1.6">{escape(description)}</p><table role="presentation"><tr><td style="background:#2f45c6;border-radius:12px;padding:14px"><a href="{escape(url, quote=True)}" style="color:white;text-decoration:none">{escape(button)}</a></td></tr></table><p style="padding:16px;background:#fdf0d8">{escape(notice)}</p><p>Se o botão não funcionar, copie este endereço: <a href="{escape(url, quote=True)}">{escape(url)}</a></p><p style="font-size:12px">{escape(footer)}</p></td></tr></table></td></tr></table></body></html>'''
    return {
        "to": user.email,
        "kind": kind,
        "subject": subject,
        "html": html,
        "text": f"{title}\n\n{description}\n\n{button}: {url}\n\n{notice}\n\n{footer}",
    }


class EmailService:
    def __init__(self, app):
        self.config = dict(app.config)
        self.logger = app.logger
        self.transport = self.config.get("MAIL_TRANSPORT", "disabled")
        self.app_url = self.config["APP_PUBLIC_URL"].rstrip("/")
        self.messages = []
        self._pool = ThreadPoolExecutor(
            max_workers=2, thread_name_prefix="english-ai-email"
        )
        self._pending = set()
        self._lock = Lock()

    def send_welcome(self, user):
        self.dispatch(render_email("welcome", user, self.app_url))

    def send_password_reset(self, user, token, expires_in_minutes):
        self.dispatch(
            render_email(
                "password_reset", user, self.app_url, token, expires_in_minutes
            )
        )

    def dispatch(self, message):
        if self.transport == "disabled":
            self.logger.info("email.skipped kind=%s", message["kind"])
            return
        if self.transport == "memory":
            self.messages.append(message)
            return
        task = self._pool.submit(self._send_safely, message)
        with self._lock:
            self._pending.add(task)
        task.add_done_callback(self._discard)

    def _discard(self, task):
        with self._lock:
            self._pending.discard(task)

    def _send_safely(self, message):
        try:
            if self.transport == "outbox":
                directory = Path(self.config["MAIL_OUTBOX_DIR"])
                directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                timestamp = datetime.now(timezone.utc).isoformat(
                    timespec="milliseconds"
                )
                basename = (
                    timestamp.replace(":", "-").replace(".", "-")
                    + "-"
                    + message["kind"]
                    + "-"
                    + secrets.token_hex(3)
                )
                record = {
                    "createdAt": timestamp,
                    "from": self.config["MAIL_FROM"],
                    **message,
                }
                for suffix, content in (
                    ("json", json.dumps(record, ensure_ascii=False, indent=2)),
                    ("html", message["html"]),
                ):
                    fd = os.open(
                        directory / f"{basename}.{suffix}",
                        os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                        0o600,
                    )
                    with os.fdopen(fd, "w", encoding="utf-8") as stream:
                        stream.write(content)
            else:
                email = EmailMessage()
                email["From"] = self.config["MAIL_FROM"]
                email["To"] = message["to"]
                email["Subject"] = message["subject"]
                email.set_content(message["text"])
                email.add_alternative(message["html"], subtype="html")
                context = ssl.create_default_context()
                connection = (
                    smtplib.SMTP_SSL(
                        self.config["SMTP_HOST"],
                        self.config["SMTP_PORT"],
                        timeout=10,
                        context=context,
                    )
                    if self.config["SMTP_SECURE"]
                    else smtplib.SMTP(
                        self.config["SMTP_HOST"], self.config["SMTP_PORT"], timeout=10
                    )
                )
                with connection:
                    if not self.config["SMTP_SECURE"]:
                        connection.starttls(context=context)
                    if self.config.get("SMTP_USER"):
                        connection.login(
                            self.config["SMTP_USER"], self.config["SMTP_PASSWORD"]
                        )
                    connection.send_message(email)
            self.logger.info(
                "email.sent kind=%s transport=%s", message["kind"], self.transport
            )
        except Exception as error:
            self.logger.error(
                "email.failed kind=%s transport=%s code=%s",
                message["kind"],
                self.transport,
                type(error).__name__,
            )

    def idle(self):
        while True:
            with self._lock:
                pending = list(self._pending)
            if not pending:
                return
            wait(pending, timeout=25)


def init_email(app):
    config = app.config
    transport = config.get("MAIL_TRANSPORT", "disabled")
    if transport not in {"smtp", "outbox", "disabled", "memory"}:
        raise ValueError("MAIL_TRANSPORT inválido.")
    production = config.get("APP_ENV") == "production"
    if transport == "memory" and not config.get("TESTING"):
        raise ValueError("O transporte memory é exclusivo dos testes.")
    if production and transport == "outbox":
        raise ValueError("A caixa de saída local é exclusiva do desenvolvimento.")
    if bool(config.get("SMTP_USER")) != bool(config.get("SMTP_PASSWORD")):
        raise ValueError("Configure SMTP_USER e SMTP_PASSWORD juntos.")
    parsed = urlsplit(config.get("APP_PUBLIC_URL", ""))
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("APP_PUBLIC_URL precisa ser uma URL pública válida.")
    if transport == "smtp":
        if not config.get("SMTP_HOST"):
            raise ValueError("SMTP_HOST é obrigatório para envio SMTP.")
        if production and (
            parsed.scheme != "https"
            or "localhost" == parsed.hostname
            or "english-ai.local" in config["MAIL_FROM"]
        ):
            raise ValueError(
                "SMTP em produção exige APP_PUBLIC_URL https e MAIL_FROM do domínio configurado."
            )
    service = EmailService(app)
    app.extensions["email_service"] = service
    return service
