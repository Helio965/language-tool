# Inventário de arquivos e dependências

Inventário da revisão Python. Arquivos locais ignorados (.env, .venv, bancos,
outbox, caches) não fazem parte da distribuição. A implementação TypeScript
completa está na tag legacy-typescript. O mapa distingue runtime, validação,
operação e acervo; vínculos dinâmicos Jinja/JS foram mantidos.

| Caminho | Responsabilidade |
| --- | --- |
| `.editorconfig` | Configuração/entrypoint/dependências/licença |
| `.env.example` | Configuração/entrypoint/dependências/licença |
| `.env.production.example` | Configuração/entrypoint/dependências/licença |
| `.github/workflows/python.yml` | Automação de validação |
| `.gitignore` | Configuração/entrypoint/dependências/licença |
| `.vscode/extensions.json` | Configuração do editor |
| `.vscode/launch.json` | Configuração do editor |
| `.vscode/tasks.json` | Configuração do editor |
| `LICENSE` | Configuração/entrypoint/dependências/licença |
| `README.md` | Configuração/entrypoint/dependências/licença |
| `ai/__init__.py` | Runtime: provedor, prompts e políticas |
| `ai/conversation.py` | Runtime: provedor, prompts e políticas |
| `ai/correction.py` | Runtime: provedor, prompts e políticas |
| `ai/personality.py` | Runtime: provedor, prompts e políticas |
| `ai/prompts.py` | Runtime: provedor, prompts e políticas |
| `ai/provider.py` | Runtime: provedor, prompts e políticas |
| `app.py` | Configuração/entrypoint/dependências/licença |
| `blueprints/__init__.py` | Runtime: HTTP, páginas e autorização |
| `blueprints/aprendizagem.py` | Runtime: HTTP, páginas e autorização |
| `blueprints/auth.py` | Runtime: HTTP, páginas e autorização |
| `blueprints/conversacao.py` | Runtime: HTTP, páginas e autorização |
| `blueprints/pages.py` | Runtime: HTTP, páginas e autorização |
| `config.py` | Configuração/entrypoint/dependências/licença |
| `content/__init__.py` | Runtime: catálogo educacional |
| `content/catalog.json` | Runtime: catálogo educacional |
| `content/catalog.py` | Runtime: catálogo educacional |
| `database/__init__.py` | Runtime: sincronização de conteúdo |
| `database/seed.py` | Runtime: sincronização de conteúdo |
| `design/COMPONENTS.md` | Acervo de design; screenshots legados |
| `design/DESIGN-SYSTEM.md` | Acervo de design; screenshots legados |
| `design/FIGMA-GUIDE.md` | Acervo de design; screenshots legados |
| `design/SCREEN-SPECIFICATIONS.md` | Acervo de design; screenshots legados |
| `design/screenshots/desktop-01-pagina-publica.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/desktop-02-inicio.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/desktop-03-aula.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/desktop-04-conversa.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/desktop-05-progresso.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-01-pagina-publica.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-02-cadastro-validacao.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-03-configuracao-objetivo.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-04-nivelamento-pergunta.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-05-nivelamento-resultado.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-06-inicio.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-07-aula-explicacao.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-08-exercicio-feedback.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-09-correcao-escrita.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-10-aprender.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-11-conversar.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-12-conversa-correcao.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-13-conversa-feedback.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-14-progresso.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-15-revisao.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-16-vocabulario.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-17-perfil.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-18-preferencias.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-19-privacidade.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-20-recuperar-senha.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/mobile-21-redefinir-senha.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/tablet-02-inicio.jpg` | Acervo de design; screenshots legados |
| `design/screenshots/tablet-03-progresso.jpg` | Acervo de design; screenshots legados |
| `docs/AI-PROMPT-STRATEGY.md` | Documentação e evidências |
| `docs/ARCHITECTURE.md` | Documentação e evidências |
| `docs/AUDITORIA-TECNICA.md` | Documentação e evidências |
| `docs/DATABASE-MODEL.md` | Documentação e evidências |
| `docs/DEPLOYMENT.md` | Documentação e evidências |
| `docs/EMAIL-AND-AUTH.md` | Documentação e evidências |
| `docs/IA-BEHAVIOR.md` | Documentação e evidências |
| `docs/INVENTARIO-ARQUIVOS.md` | Documentação e evidências |
| `docs/MIGRATION-AUDIT.md` | Documentação e evidências |
| `docs/MVP-SCOPE.md` | Documentação e evidências |
| `docs/PREPARACAO-COMERCIAL.md` | Documentação e evidências |
| `docs/PYTHON-MIGRATION.md` | Documentação e evidências |
| `docs/REQUIREMENTS-TRACEABILITY.md` | Documentação e evidências |
| `docs/USER-FLOWS.md` | Documentação e evidências |
| `docs/UX-SPECIFICATION.md` | Documentação e evidências |
| `docs/VALIDACAO-COMERCIAL.md` | Documentação e evidências |
| `docs/WINDOWS-VSCODE.md` | Documentação e evidências |
| `docs/legacy/.env.example` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/AI-PROMPT-STRATEGY.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/ARCHITECTURE.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/DATABASE-MODEL.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/EMAIL-AND-AUTH.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/IA-BEHAVIOR.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/INDEX.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/MVP-SCOPE.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/README.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/REQUIREMENTS-TRACEABILITY.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/USER-FLOWS.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/UX-SPECIFICATION.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/design/COMPONENTS.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/design/DESIGN-SYSTEM.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/design/FIGMA-GUIDE.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/legacy/design/SCREEN-SPECIFICATIONS.md` | Acervo histórico TypeScript; consulte a tag |
| `docs/validation/accessibility.json` | Documentação e evidências |
| `docs/validation/home-desktop.png` | Documentação e evidências |
| `docs/validation/landing-before.png` | Documentação e evidências |
| `docs/validation/landing-desktop.png` | Documentação e evidências |
| `docs/validation/legal-mobile.png` | Documentação e evidências |
| `docs/validation/preferences-mobile.png` | Documentação e evidências |
| `docs/validation/responsive.json` | Documentação e evidências |
| `extensions.py` | Configuração/entrypoint/dependências/licença |
| `gunicorn.conf.py` | Configuração/entrypoint/dependências/licença |
| `migrations/alembic.ini` | Runtime/operação: versionamento Alembic |
| `migrations/env.py` | Runtime/operação: versionamento Alembic |
| `migrations/script.py.mako` | Runtime/operação: versionamento Alembic |
| `migrations/versions/0001_legacy_schema.py` | Runtime/operação: versionamento Alembic |
| `migrations/versions/0002_integrity_metadata.py` | Runtime/operação: versionamento Alembic |
| `migrations/versions/0003_conversation_idempotency.py` | Runtime/operação: versionamento Alembic |
| `models/__init__.py` | Runtime: ORM e dados/migração |
| `models/aprendizagem.py` | Runtime: ORM e dados/migração |
| `models/base.py` | Runtime: ORM e dados/migração |
| `models/conversacao.py` | Runtime: ORM e dados/migração |
| `models/exercicio.py` | Runtime: ORM e dados/migração |
| `models/migration.py` | Runtime: ORM e dados/migração |
| `models/progresso.py` | Runtime: ORM e dados/migração |
| `models/usuario.py` | Runtime: ORM e dados/migração |
| `models/vocabulario.py` | Runtime: ORM e dados/migração |
| `pytest.ini` | Configuração/entrypoint/dependências/licença |
| `requirements-dev.in` | Configuração/entrypoint/dependências/licença |
| `requirements-dev.txt` | Configuração/entrypoint/dependências/licença |
| `requirements.in` | Configuração/entrypoint/dependências/licença |
| `requirements.txt` | Configuração/entrypoint/dependências/licença |
| `scripts/sqlite_backup.py` | Operação: backup e restore |
| `services/__init__.py` | Runtime: casos de uso e regras |
| `services/aprendizagem.py` | Runtime: casos de uso e regras |
| `services/autenticacao.py` | Runtime: casos de uso e regras |
| `services/common.py` | Runtime: casos de uso e regras |
| `services/conversacao.py` | Runtime: casos de uso e regras |
| `services/email.py` | Runtime: casos de uso e regras |
| `services/exercicios.py` | Runtime: casos de uso e regras |
| `services/nivelamento.py` | Runtime: casos de uso e regras |
| `services/perfil.py` | Runtime: casos de uso e regras |
| `services/progresso.py` | Runtime: casos de uso e regras |
| `services/revisao.py` | Runtime: casos de uso e regras |
| `services/vocabulario.py` | Runtime: casos de uso e regras |
| `static/css/fonts.css` | Runtime: assets locais e módulos dinâmicos |
| `static/css/global.css` | Runtime: assets locais e módulos dinâmicos |
| `static/css/python.css` | Runtime: assets locais e módulos dinâmicos |
| `static/css/tokens.css` | Runtime: assets locais e módulos dinâmicos |
| `static/css/ui.css` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/atkinson-hyperlegible-next-LICENSE.txt` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/atkinson-hyperlegible-next-latin-ext-wght-normal.woff2` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/fraunces-LICENSE.txt` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/fraunces-latin-ext-full-normal.woff2` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/fraunces-latin-full-normal.woff2` | Runtime: assets locais e módulos dinâmicos |
| `static/fonts/fraunces-vietnamese-full-normal.woff2` | Runtime: assets locais e módulos dinâmicos |
| `static/img/favicon.svg` | Runtime: assets locais e módulos dinâmicos |
| `static/js/account.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/auth.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/common.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/conversation.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/dashboard.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/learning.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/main.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/onboarding.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/placement.js` | Runtime: assets locais e módulos dinâmicos |
| `static/js/vocabulary.js` | Runtime: assets locais e módulos dinâmicos |
| `templates/aprender/lesson.html` | Runtime: Jinja e conteúdo acessível |
| `templates/aprender/placement.html` | Runtime: Jinja e conteúdo acessível |
| `templates/auth/form.html` | Runtime: Jinja e conteúdo acessível |
| `templates/base.html` | Runtime: Jinja e conteúdo acessível |
| `templates/configuracoes/preferences.html` | Runtime: Jinja e conteúdo acessível |
| `templates/configuracoes/privacy.html` | Runtime: Jinja e conteúdo acessível |
| `templates/conversar/chat.html` | Runtime: Jinja e conteúdo acessível |
| `templates/data_policy.html` | Runtime: Jinja e conteúdo acessível |
| `templates/error.html` | Runtime: Jinja e conteúdo acessível |
| `templates/exercicios/review.html` | Runtime: Jinja e conteúdo acessível |
| `templates/feature.html` | Runtime: Jinja e conteúdo acessível |
| `templates/landing.html` | Runtime: Jinja e conteúdo acessível |
| `templates/legal.html` | Runtime: Jinja e conteúdo acessível |
| `templates/macros.html` | Runtime: Jinja e conteúdo acessível |
| `templates/perfil/onboarding.html` | Runtime: Jinja e conteúdo acessível |
| `templates/perfil/profile.html` | Runtime: Jinja e conteúdo acessível |
| `tests/browser/test_chat_retry.py` | Validação: fixtures e regressões |
| `tests/browser/test_commercial_ui.py` | Validação: fixtures e regressões |
| `tests/browser/test_journeys.py` | Validação: fixtures e regressões |
| `tests/browser/test_ui_recovery.py` | Validação: fixtures e regressões |
| `tests/conftest.py` | Validação: fixtures e regressões |
| `tests/fixtures/README.md` | Validação: fixtures e regressões |
| `tests/fixtures/legacy_schema.sql` | Validação: fixtures e regressões |
| `tests/test_ai.py` | Validação: fixtures e regressões |
| `tests/test_auth.py` | Validação: fixtures e regressões |
| `tests/test_backup.py` | Validação: fixtures e regressões |
| `tests/test_chat_idempotency.py` | Validação: fixtures e regressões |
| `tests/test_commercial_ui_contracts.py` | Validação: fixtures e regressões |
| `tests/test_email_delivery.py` | Validação: fixtures e regressões |
| `tests/test_learning.py` | Validação: fixtures e regressões |
| `tests/test_legacy_state.py` | Validação: fixtures e regressões |
| `tests/test_maintenance.py` | Validação: fixtures e regressões |
| `tests/test_migrations.py` | Validação: fixtures e regressões |
| `tests/test_production_config.py` | Validação: fixtures e regressões |
| `tests/test_security.py` | Validação: fixtures e regressões |
| `tests/test_ui_contracts.py` | Validação: fixtures e regressões |
| `wsgi.py` | Configuração/entrypoint/dependências/licença |

## Relações relevantes

- app.py → config/extensions → blueprints → services → models/database/ai/content.
- templates/base.html → ui.css/python.css; ui.css → global.css/fonts.css; global.css → tokens.css.
- main.js importa módulos por page-context; rotas privadas usam os mesmos contratos JSON/CSRF.
- SQLAlchemy/Alembic usam migrations; fixtures antigas só são carregadas pelos testes.
- requirements-dev.txt inclui o lock de runtime e seis pacotes exclusivos de testes.
- A produção não depende de docs/design/editor, testes, Node ou TypeScript.
