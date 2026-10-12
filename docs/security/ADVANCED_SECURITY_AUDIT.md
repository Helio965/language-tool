# Auditoria avançada de segurança — English AI

## 1. Visão geral e escopo

Esta auditoria continua o [PR #6](https://github.com/Helio965/language-tool/pull/6), na branch `security/llm-bola-rate-hardening`. O proprietário autorizou revisão, correções e publicação do próprio código. As validações ativas ficaram restritas a ambientes locais, contas fictícias, SQLite temporário e IA simulada. Não foram utilizados bancos/contas reais, credenciais válidas, chamadas pagas, e-mail real ou testes contra produção. Nenhum merge na `main` foi autorizado ou realizado.

O escopo inclui Flask, SQLAlchemy, integração Anthropic, prompts, consumo, autorização, sessões, recuperação, exclusão de conta, concorrência e cabeçalhos. A auditoria de SQL Injection permanece registrada em [SQL_INJECTION_AUDIT.md](SQL_INJECTION_AUDIT.md); suas correções não foram recriadas.

| Referência verificada antes desta continuação | Estado |
| --- | --- |
| `main` | [`eaa489f6393a9f26b1f7a7e5bef27679d26ef0d1`](https://github.com/Helio965/language-tool/commit/eaa489f6393a9f26b1f7a7e5bef27679d26ef0d1), com a auditoria anterior integrada |
| PR #6 | Aberto; head inicial [`c30a67563d13f47553e8f32bb7c9722ef374fa6c`](https://github.com/Helio965/language-tool/commit/c30a67563d13f47553e8f32bb7c9722ef374fa6c) |
| Histórico existente | 20 commits e 13 arquivos modificados; preservados nesta continuação |
| CI do head inicial | [Execução 38317881202](https://github.com/Helio965/language-tool/actions/runs/38317881202), resultado `success`; não valida os novos commits |
| Head e CI finais | Código/migração testados em `6a9f419f0dc83c265e55f57a8bed5c32b4debbbb`; o SHA da entrega e o resultado do CI após publicação ficam na [descrição e checks do PR #6](https://github.com/Helio965/language-tool/pull/6/checks). Contagem local não é resultado de CI. |

Nesta rodada foram reproduzidos consumo de cota anterior à decisão de executar IA, chamadas concorrentes duplicadas, Unicode inválido do provedor causando erro interno e token de recuperação no log padrão do Werkzeug. Configurações inseguras possíveis e melhorias foram separadas desses achados. Não foi confirmado novo bypass de autorização, SQL Injection, sessão ou exclusão em cascata.

## 2. Metodologia e controles examinados

A revisão começou pelo estado do PR, histórico e CI, seguida da leitura dos caminhos de autenticação, validação, consultas e integração. Hipóteses foram confrontadas com simulações controladas e regressões. Foram registrados condição necessária, efeito observável, correção e limites da prova; uma hipótese sem evidência não foi convertida em vulnerabilidade.

Os arquivos analisados incluem:

- Inicialização: [app.py](../../app.py), [config.py](../../config.py) e [extensions.py](../../extensions.py).
- IA: [provider](../../ai/provider.py), [prompts](../../ai/prompts.py), [conversation](../../ai/conversation.py), [correction](../../ai/correction.py) e [personality](../../ai/personality.py).
- Rotas: [auth](../../blueprints/auth.py), [aprendizagem](../../blueprints/aprendizagem.py) e [conversacao](../../blueprints/conversacao.py).
- Serviços: [autenticacao](../../services/autenticacao.py), [common](../../services/common.py), [aprendizagem](../../services/aprendizagem.py), [conversacao](../../services/conversacao.py), [perfil](../../services/perfil.py), [revisao](../../services/revisao.py), [vocabulario](../../services/vocabulario.py), [progresso](../../services/progresso.py), [exercicios](../../services/exercicios.py), [nivelamento](../../services/nivelamento.py), [email](../../services/email.py) e [request_logging](../../services/request_logging.py).
- Persistência/regressões: [models](../../models), [migrations](../../migrations), [database/seed.py](../../database/seed.py), [tests/security](../../tests/security), [test_ai](../../tests/test_ai.py), [test_chat_idempotency](../../tests/test_chat_idempotency.py), [test_migrations](../../tests/test_migrations.py), testes existentes de autenticação/aprendizagem e [tests/browser](../../tests/browser).

O inventário contabilizado contém **66 arquivos Python: 38 de código/persistência e 28 de testes/fixtures**. A contagem corresponde aos arquivos percorridos na análise estrutural AST, à leitura dos controles sensíveis e às regressões; não afirma revisão manual integral de cada linha. A análise estrutural orienta a leitura e não substitui a verificação de autorização/SQL. As duas construções de SQL com interpolação localizadas em `models/migration.py` usam nomes enumerados em dicionários constantes do código para inspecionar o esquema; não recebem identificadores da requisição.

| Grupo do inventário | Quantidade | Arquivos Python, além dos caminhos individuais acima |
| --- | --- | --- |
| Inicialização, IA, rotas, serviços e seed | 24 | 3 arquivos de inicialização, 5 de IA, 3 rotas, 12 serviços e `database/seed.py`, relacionados acima |
| `models/` | 9 | `__init__.py`, `aprendizagem.py`, `base.py`, `conversacao.py`, `exercicio.py`, `migration.py`, `progresso.py`, `usuario.py`, `vocabulario.py` |
| `migrations/` | 5 | `env.py`; `versions/0001_legacy_schema.py`, `0002_integrity_metadata.py`, `0003_conversation_idempotency.py`, `0004_conversation_claim.py` |
| `tests/`, nível principal | 10 | `conftest.py`, `test_ai.py`, `test_auth.py`, `test_chat_idempotency.py`, `test_learning.py`, `test_legacy_state.py`, `test_maintenance.py`, `test_migrations.py`, `test_security.py`, `test_ui_contracts.py` |
| `tests/security/` | 15 | `conftest.py`, `test_access_validation.py`, `test_advanced_authorization.py`, `test_advanced_llm.py`, `test_advanced_sessions.py`, `test_ai_quotas.py`, `test_ai_redis_quotas.py`, `test_audit_boundary.py`, `test_chat_claims.py`, `test_import_atomicity.py`, `test_json_boundary.py`, `test_llm_bola_rate_hardening.py`, `test_session_boundary.py`, `test_sql_injection.py`, `test_sqlite_creation.py` |
| `tests/browser/` | 3 | `test_chat_retry.py`, `test_journeys.py`, `test_ui_recovery.py` |

O fixture [tests/security/conftest.py](../../tests/security/conftest.py) substitui a leitura de configuração para impedir o uso de `.env`, banco, credenciais de IA ou SMTP herdados. Cria SQLite em `tmp_path`, conta sintética, e-mail desativado e CSRF assinado. Testes de IA negam conexões de rede e interceptam o SDK oficial com `httpx.MockTransport`. A rodada inicial de fronteira aprovou **9 testes** antes das simulações. Testes de Redis local registram separadamente uma exceção estritamente local à barreira de rede; não autorizam acesso a uma implantação externa.

| Controle | Classificação na revisão | Evidência e limite |
| --- | --- | --- |
| Dados não confiáveis fora de `system` | Implementado e validado novamente | Cinco operações, enums e papéis permitidos inspecionados no SDK simulado |
| Validação de resposta LLM | Necessitava correção; corrigido e retestado | JSON, campos, enums, limites, profundidade, duplicatas, números não finitos e Unicode |
| Resistência de modelo real a jailbreak | Não validada | Nenhuma chamada real; testes estruturais não medem obediência probabilística |
| Cota anterior à chamada paga | Necessitava correção; corrigido e retestado | Reserva na fronteira LLM, depois de validação, cache e configuração |
| Cota global compartilhada | Implementada; configuração reforçada | Escopo comum entre contas/rotas e backend compartilhado; prova Redis local na seção 5 |
| Geração simultânea na mesma conversa | Necessitava correção; corrigido e retestado | Claim no banco, nonce e contador de chamadas em duas threads |
| Autorização por sessão/proprietário | Implementada e validada novamente | Contas A/B, IDs alheios/ausentes e APIs privadas sem sessão válida |
| Exclusão e cascata | Implementadas e validadas novamente | Dez tabelas privadas de A removidas; B e quatro tabelas do catálogo preservadas; rollback/integridade |
| Sessões, cookies e CSRF | Implementados e validados novamente | Cookie copiado, sessão adulterada/revogada, expiração e CSRF anterior ao login |
| Recuperação de senha | Implementada e validada novamente | Hash, dono derivado do token, uso único concorrente, revogação e limite compartilhado |
| Privacidade de logs locais | Necessitava correção; corrigido e retestado | Captura em memória do Werkzeug e filtros de request/response SDK |
| Cabeçalhos HTTP | Implementados; melhorias retestadas | HTTP/HTTPS sintéticos, respostas privadas/erro e HSTS condicionado a HTTPS |
| Configuração efetiva de produção | Reforçada e retestada | Overrides inseguros recusados antes das integrações, inclusive em modo demo |
| TLS, proxy, Redis/logs implantados | Não validados | Conferência manual dos servidores e de todos os workers necessária |
| CVEs, outros SGBDs e Express legado | Fora deste escopo | Sem alegação sobre superfícies não examinadas |

## 3. Achados e evidências

As gravidades consideram impacto observado e condições necessárias. **Confirmado** significa comportamento reproduzido com dados sintéticos. **Condicional** depende de configuração e não implica exploração real. **Melhoria** reforça controles ou reduz erro operacional, sem entrar na contagem de vulnerabilidades confirmadas.

| ID | Tipo/classificação | Gravidade | Evidência | Correção | Status |
| --- | --- | --- | --- | --- | --- |
| ADV-RATE-01 | Disponibilidade/contabilização — confirmado | Média | Cota paga era aplicada antes de cache, abertura autoral, assunto inexistente e operações locais; demo encontrava a janela de IA de 10/min | Reservar somente tentativa externa admitida, mantendo limites HTTP gerais | Corrigido e retestado com provider contador |
| ADV-CHAT-02 | Consumo duplicado — confirmado | Média | Duas threads com mesma chave: **2 chamadas ao provider**, mas **1 par** persistido | Claim curto antes da IA, nonce no commit e replay após persistência | Corrigido e retestado: **1 chamada**, `409` em voo e replay idêntico |
| ADV-LLM-03 | Validação de resposta — confirmado | Baixa | Surrogate UTF-16 isolado no JSON do provider chegava à persistência e causava HTTP 500 | Validar UTF-8 em todos os campos textuais antes de persistir | Corrigido e retestado: 503 seguro, sem meio turno |
| ADV-LOG-04 | Token em log local — confirmado | Média | Handler padrão do Werkzeug reproduziu em memória o token sintético no log de `/redefinir-senha/<token>` | Handler/filtro removem token, query e autoridade sem alterar o roteamento | Corrigido e retestado localmente; proxy/WSGI externo não validado |
| ADV-LLM-05 | Dados privados em debug SDK — condicional | Média | Com debug habilitado no host/SDK, o logger registrava conteúdo sintético do aluno | Filtrar logs verbosos de request/response e manter warnings | Implementado e retestado; configuração de produção não constatada |
| ADV-LLM-06 | Destino implícito SDK — condicional | Média | `ANTHROPIC_BASE_URL` alterava a URL do cliente na simulação; nenhuma conexão foi feita | Fixar `https://api.anthropic.com` no cliente gerenciado | Implementado e retestado; nenhum vazamento de credencial real confirmado |
| ADV-CONFIG-07 | Overrides de produção — condicional | Média | Overrides finais podiam contornar verificações feitas apenas no carregamento inicial | Validar segredo, debug, cookies, CSRF, rate limiting e e-mail após overrides; Anthropic exige Redis compartilhado sem fallback local | Implementado e retestado; consolidação na seção 5 |
| ADV-DEF-08 | Filtro de eco — melhoria | Informativa | Span legítimo coincidente era rejeitado; trechos literais da persona não estavam todos no conjunto | Examinar somente prosa gerada e centralizar trechos constantes | Retestado; não detecta paráfrases |
| ADV-DEF-09 | HTTPS e referência — melhoria | Informativa | HSTS precisava distinguir HTTPS de HTTP; páginas de reset contêm token na URL | HSTS somente produção/HTTPS, sem subdomínios/preload; `no-referrer` em autenticação/reset | Retestado localmente; proxy pendente |
| ADV-DEF-10 | Retry automático — melhoria de custo | Informativa | Retry SDK pode gerar nova tentativa sob uma admissão e prolongar a chamada | `max_retries=0`, erro seguro e retry explícito admitido novamente | Retestado: 429 interceptado, uma tentativa e nenhum sleep |

A hipótese de consumo da cota paga por usuários anônimos foi **refutada**: autenticação precede a operação admitida. A ausência do driver Redis na instalação foi corrigida com `Flask-Limiter[redis]`; construção do storage sem conexão comprova a dependência, não conectividade/TLS de produção.

Não foi confirmado novo BOLA/IDOR, bypass de login, SQL Injection, alteração de B pelo payload de A ou falha de cascata nos caminhos examinados. IDs alheios/ausentes retornam respostas equivalentes onde cabível. IDs de usuário no JSON não substituem a sessão. Essa conclusão se limita aos caminhos e estados cobertos.

## 4. Correções e preservação do sistema

**LLM.** [ai/provider.py](../../ai/provider.py) rejeita Unicode inválido, mantém validação estrita e preserva erros seguros de cota `429/503`. A chave sintética é verificada no header, sem entrar em prompts. Nome, perfil, fatos, histórico, assunto e texto permanecem dados em mensagens de usuário, sem promoção para `system`/`developer`. O SDK gerenciado usa destino oficial, não repete tentativas automaticamente e protege logs verbosos. [ai/prompts.py](../../ai/prompts.py) centraliza o filtro de eco literal; esse controle não elimina prompt injection.

**Consumo.** [extensions.py](../../extensions.py) reserva por conta/minuto, conta/dia e global/dia, com escopos estáveis. A admissão em [ai/provider.py](../../ai/provider.py) ocorre imediatamente antes da tentativa externa, depois de validação local, orçamento de contexto e confirmação de configuração. Decorators de orçamento pago foram removidos de [aprendizagem](../../blueprints/aprendizagem.py) e [conversacao](../../blueprints/conversacao.py); autenticação, CSRF e limites HTTP gerais continuam ativos. Cache/replay, exercícios fechados, revisão local, catálogo, demo, abertura autoral e erros locais não geram reserva paga. Tentativas externas com falha conservam reserva porque seu custo é incerto; falha do storage impede a chamada com erro seguro.

Padrões configuráveis: mensagem de até 600 caracteres, contexto de mensagens de 8.000 caracteres, até 12 mensagens de histórico, saída de até 1.024 tokens, 10 tentativas por conta/minuto, 100 por conta/dia e 1.000 globais/dia. Caracteres e requests não equivalem a custo monetário ou contagem exata de tokens de entrada. As três reservas são sequenciais, não uma transação conjunta: uma recusa posterior pode manter reservas anteriores consumidas por decisão conservadora.

**Concorrência.** [services/conversacao.py](../../services/conversacao.py) reserva em `Session` independente e confirma o commit antes da IA. Não mantém lock global de escrita SQLite durante a espera; outra conversa conclui enquanto a primeira espera. O commit final exige proprietário, nonce, contagem esperada, lease válida e conversa não encerrada/excluída/expirada. A liberação só atua no nonce próprio. Fim, exclusão e expiração limpam a reserva. Um `UPDATE` explícito corrige a race em que o objeto ORM foi lido antes do commit separado da reserva, evitando deixar metadados privados após limpeza.

A migração [0004_conversation_claim.py](../../migrations/versions/0004_conversation_claim.py), após `0003_conversation_idempotency`, acrescenta apenas `pending_request_nonce` e `pending_request_expires_at`, privados e nullable. Retoma aplicação parcial e recusa downgrade destrutivo. Preserva as **14 tabelas funcionais**, mais `alembic_version`. Lease: timeout configurado de 1–120 segundos mais 30 segundos, total de 31–150 segundos. Clientes sem chave continuam suportados; concorrência agora pode retornar `409 CONVERSATION_BUSY`, e repetição já persistida recupera o resultado original.

**Configuração/logs/HTTP.** [services/request_logging.py](../../services/request_logging.py) protege Werkzeug da factory e handler de desenvolvimento de [app.py](../../app.py), sem alterar URLs de roteamento. [config.py](../../config.py) verifica a configuração final antes das extensões. Produção exige segredo adequado, debug desativado, cookies `Secure`/`HttpOnly`/`SameSite=Strict`, CSRF, rate limiting e ausência de outbox local. Anthropic exige Redis compartilhado, sem fallback de memória nem ignorar falhas. Driver Redis incluído nas [dependências](../../requirements.in) e [versões fixadas](../../requirements.txt). HSTS depende de HTTPS efetivo; páginas de autenticação/reset usam `no-referrer`. A configuração Alembic preserva os loggers existentes para não desativar as proteções de log durante a inicialização.

Autenticação, banco, stack, design e funções educacionais foram preservados. Os 20 commits preexistentes do PR permanecem no histórico. Relação final de alterações desta continuação:

31 arquivos nesta continuação, 30 no diff final do PR contra main. `blueprints/aprendizagem.py` e `blueprints/conversacao.py` voltaram ao conteúdo de main ao remover os decorators pagos; `blueprints/auth.py` já estava alterado antes desta rodada e continua no PR. Os 20 commits anteriores são preservados; três commits novos agrupam integração/consumo/logs, concorrência/migração e documentação.

| Arquivo modificado nesta continuação | Link |
| --- | --- |
| `.env.example` | [.env.example](../../.env.example) |
| `.github/workflows/python-security.yml` | [.github/workflows/python-security.yml](../../.github/workflows/python-security.yml) |
| `README.md` | [README.md](../../README.md) |
| `ai/prompts.py` | [ai/prompts.py](../../ai/prompts.py) |
| `ai/provider.py` | [ai/provider.py](../../ai/provider.py) |
| `app.py` | [app.py](../../app.py) |
| `blueprints/aprendizagem.py` | [blueprints/aprendizagem.py](../../blueprints/aprendizagem.py) |
| `blueprints/conversacao.py` | [blueprints/conversacao.py](../../blueprints/conversacao.py) |
| `config.py` | [config.py](../../config.py) |
| `docs/AI-PROMPT-STRATEGY.md` | [docs/AI-PROMPT-STRATEGY.md](../../docs/AI-PROMPT-STRATEGY.md) |
| `docs/WINDOWS-VSCODE.md` | [docs/WINDOWS-VSCODE.md](../../docs/WINDOWS-VSCODE.md) |
| `docs/security/ADVANCED_SECURITY_AUDIT.md` | [docs/security/ADVANCED_SECURITY_AUDIT.md](../../docs/security/ADVANCED_SECURITY_AUDIT.md) |
| `docs/security/LLM_BOLA_RATE_HARDENING.md` | [docs/security/LLM_BOLA_RATE_HARDENING.md](../../docs/security/LLM_BOLA_RATE_HARDENING.md) |
| `extensions.py` | [extensions.py](../../extensions.py) |
| `migrations/env.py` | [migrations/env.py](../../migrations/env.py) |
| `migrations/versions/0004_conversation_claim.py` | [migrations/versions/0004_conversation_claim.py](../../migrations/versions/0004_conversation_claim.py) |
| `models/conversacao.py` | [models/conversacao.py](../../models/conversacao.py) |
| `requirements.in` | [requirements.in](../../requirements.in) |
| `requirements.txt` | [requirements.txt](../../requirements.txt) |
| `services/conversacao.py` | [services/conversacao.py](../../services/conversacao.py) |
| `services/request_logging.py` | [services/request_logging.py](../../services/request_logging.py) |
| `tests/security/conftest.py` | [tests/security/conftest.py](../../tests/security/conftest.py) |
| `tests/security/test_advanced_authorization.py` | [tests/security/test_advanced_authorization.py](../../tests/security/test_advanced_authorization.py) |
| `tests/security/test_advanced_llm.py` | [tests/security/test_advanced_llm.py](../../tests/security/test_advanced_llm.py) |
| `tests/security/test_advanced_sessions.py` | [tests/security/test_advanced_sessions.py](../../tests/security/test_advanced_sessions.py) |
| `tests/security/test_ai_quotas.py` | [tests/security/test_ai_quotas.py](../../tests/security/test_ai_quotas.py) |
| `tests/security/test_ai_redis_quotas.py` | [tests/security/test_ai_redis_quotas.py](../../tests/security/test_ai_redis_quotas.py) |
| `tests/security/test_chat_claims.py` | [tests/security/test_chat_claims.py](../../tests/security/test_chat_claims.py) |
| `tests/security/test_llm_bola_rate_hardening.py` | [tests/security/test_llm_bola_rate_hardening.py](../../tests/security/test_llm_bola_rate_hardening.py) |
| `tests/test_chat_idempotency.py` | [tests/test_chat_idempotency.py](../../tests/test_chat_idempotency.py) |
| `tests/test_migrations.py` | [tests/test_migrations.py](../../tests/test_migrations.py) |

## 5. Testes executados e resultados

Requests capturados pelo SDK oficial com `httpx.MockTransport` comprovam o contrato do aplicativo/SDK, não resistência de um modelo real. Todos os dados são sintéticos e não houve API paga. Rodadas focadas abaixo podem se sobrepor: **não somar esses números** como testes únicos da suíte.

| Área | Evidência | Resultado disponível |
| --- | --- | --- |
| Fronteira inicial | Configuração sem dotenv, SQLite temporário, contas e CSRF | **9 aprovados** na rodada inicial |
| SDK/LLM | [test_advanced_llm.py](../../tests/security/test_advanced_llm.py): cinco operações, dados privados/papéis, payloads multilíngues, limites, JSON/Unicode, erros, debug/destino e retries | **38 casos novos**; com [test_ai.py](../../tests/test_ai.py): **96 aprovados** |
| Claim/idempotência | [test_chat_claims.py](../../tests/security/test_chat_claims.py), [test_chat_idempotency.py](../../tests/test_chat_idempotency.py): contador 2→1, busy/replay, nonce/lease, privacidade, falhas e outra conversa | **18 casos novos**; com AI/chat/migrações: **97 aprovados** |
| Banco | [test_migrations.py](../../tests/test_migrations.py) e migração parcial de 0004 | Head 0004, retomada, hashes/linhas legadas preservados, 14 tabelas funcionais |
| Cotas/configuração | [test_ai_quotas.py](../../tests/security/test_ai_quotas.py): operações pagas/locais, cache, autenticação, janelas, falhas e overrides; regressões anteriores em [test_llm_bola_rate_hardening.py](../../tests/security/test_llm_bola_rate_hardening.py) | **37 casos novos aprovados**, incluindo dez overrides básicos de produção e guardas de Redis/fallback |
| Redis real isolado | [test_ai_redis_quotas.py](../../tests/security/test_ai_redis_quotas.py): compartilhamento entre factories/contas/rotas/IPs, expiração, concorrência e indisponibilidade | **6 aprovados em Redis 7.2.12**; 16 threads: 4 chamadas/12 recusas; quatro processos `spawn`, 20 requests: 5 chamadas/15 recusas |
| Autorização/cascata | [test_advanced_authorization.py](../../tests/security/test_advanced_authorization.py): A/B completas, sete métodos com IDs alheios/ausentes, 32 APIs privadas em três estados de sessão, dez tabelas, catálogo e rollback | **13 casos novos aprovados** |
| Sessões/reset/logs/HTTP | [test_advanced_sessions.py](../../tests/security/test_advanced_sessions.py): CSRF, cookie copiado, reset concorrente/limites, HTTPS, referência e log privado preservado após inicialização Alembic | **19 casos novos aprovados**; rodada conjunta com autorização: **32 aprovados** |
| Suítes completas/Chromium | [tests/security](../../tests/security), backend existente e [tests/browser](../../tests/browser) | 368 aprovados, 0 falhas/erros e 0 ignorados em 165,77 s; 353 backend, incluindo 210 em `tests/security`, e 15 Chromium. 131 casos novos nesta continuação. |

Partição da rodada completa por arquivo, sem duplicar casos entre categorias:

| Categoria | Aprovados | Módulos da partição |
| --- | ---: | --- |
| LLM/contrato e comportamento da IA | 96 | `test_ai`, `test_advanced_llm` |
| Autorização/contas | 56 | `test_auth`, `test_access_validation`, `test_advanced_authorization` |
| Sessões/CSRF/reset/logs/HTTP | 34 | `test_security`, `test_session_boundary`, `test_advanced_sessions` |
| Cotas/configuração/Redis | 43 | `test_ai_quotas`, `test_ai_redis_quotas` |
| Concorrência/idempotência | 32 | `test_chat_idempotency`, `test_chat_claims` |
| Regressões gerais/backend | 92 | SQLi, JSON, importação, criação SQLite, fronteira, migrações, aprendizagem, legado, manutenção, contrato de UI e sete casos mistos do PR inicial |
| Chromium | 15 | Três módulos de `tests/browser` |
| **Total** | **368** | **Sem falhas, erros ou skips** |

A rodada completa executou `APP_ENV=testing AI_PROVIDER=mock ANTHROPIC_API_KEY= MAIL_TRANSPORT=disabled python -m pytest -q --junitxml=/tmp/english-ai-advanced-full.xml`, com `CHROMIUM_EXECUTABLE` e `REDIS_SERVER_EXECUTABLE` definidos pela ativação da nuvem. O XML confirmou 368 casos; logs e XML são saídas locais dessa execução, não arquivos versionados. Não se somam rodadas focadas ao total.

Comandos para repetir a validação com dependências e checkout correspondentes:

```bash
.venv/bin/python -m pytest tests/security -q
.venv/bin/python -m pytest -m "not browser" -q
CHROMIUM_EXECUTABLE=/usr/bin/chromium .venv/bin/python -m pytest -q
```

Os seis testes Redis iniciam seu próprio servidor em porta aleatória de `127.0.0.1`, diretório temporário e sem persistência. A barreira de rede permite apenas o endereço desse processo; os workers criados com `spawn` mantêm a mesma restrição. Nenhum Redis preexistente é utilizado e o processo é encerrado ao final. A expiração de uma janela por minuto conserva as cotas diárias. Na indisponibilidade, o middleware HTTP geral retorna **500 seguro** antes da rota; se a fronteira paga for alcançada independentemente, retorna **503 seguro**. Em ambos os caminhos há **zero chamadas ao provider**, sem expor URI ou credenciais. Não se afirma que todas as falhas de storage retornam 503.

Nesta execução foi usado Redis **7.2.12**, compilado da fonte oficial fixada no commit [`9913c926510755fa0d241658f550338a02258edb`](https://github.com/redis/redis/commit/9913c926510755fa0d241658f550338a02258edb). Para repetir, disponibilizar um binário confiável `redis-server` no `PATH` ou apontar `REDIS_SERVER_EXECUTABLE`; ausência do executável obrigatório falha o teste, sem skip silencioso. Com o binário preparado neste ambiente:

```bash
REDIS_SERVER_EXECUTABLE=/tmp/english-ai-redis-runtime/source/src/redis-server \
  .venv/bin/python -m pytest tests/security/test_ai_redis_quotas.py -q
```

Isso valida o backend real de contadores locais e sua atomicidade por janela, não TLS, ACLs ou disponibilidade de produção.

Windows usa `python` da venv ativada e Chromium configurado conforme o ambiente; essa plataforma não foi executada nesta rodada.

## 6. Pendências, limitações e recomendações de produção

| Risco/validação restante | Prova disponível | Conferência necessária |
| --- | --- | --- |
| Prompt injection/jailbreak | Fronteiras e esquema simulados | Sem segredos nos prompts; comportamento real só em homologação autorizada. Filtro literal não cobre paráfrases nem garante obediência |
| Consumo financeiro | Cotas de tentativas e teto de saída | Configurar limites financeiros e alertas no provedor; requests/caracteres não definem teto monetário exato |
| Crash/lease/cobrança externa | Nonce impede resposta velha de persistir ou apagar nova reserva | Expiração/crash ou sucesso IA seguido de falha DB podem causar nova cobrança no retry. Sem execução única externa; relógios de workers devem estar alinhados |
| Duração da chamada | Retry automático desligado; timeout configurado | Timeout SDK é de I/O, não SLA de duração total; chamada sem resposta recebida pode ter sido processada |
| Reservas parciais | Cada contador atômico, três cotas sequenciais | Uma recusa/falha pode consumir parcialmente o orçamento; não presumir reembolso ou atomicidade conjunta |
| Redis implantado | Driver/configuração e prova local da seção 5 | Mesmo backend/namespace em todos os workers; conferir autenticação, TLS/`rediss://`, disponibilidade e ausência de fallback. Nenhum Redis externo acessado |
| Proxy/HTTPS/cookies | HTTP/HTTPS sintéticos | Conferir domínio, HTTPS externo e esquema reconhecido no Flask; confiança de proxy conforme topologia, sem headers arbitrários. HSTS sem subdomínios/preload |
| Logs além do Werkzeug | Redação local testada em memória | Gunicorn/WSGI, proxy, CDN, APM e agregadores devem omitir tokens, query, headers privados e corpos. Filtros locais não cobrem esses sistemas |
| E-mail de recuperação | Hash, validade, uso único e revogação locais | Validar SMTP, domínio dos links, entrega e permissões em homologação; nenhum e-mail real enviado |
| Banco/plataforma | SQLite/Linux e migrações temporárias | Revisar permissões existentes, backups/retenção; Windows nativo, outros SGBDs, CVEs e infraestrutura não auditados |
| Processos e legado | Nenhum teste ativo em processo cujo banco não foi atestado temporário | Inventariar servidores reais/portas/proxy e conferir se Express legado permanece em uso. Uma porta local aberta não demonstra serviço identificado nem exposição à Internet |

Não permanece achado confirmado sem correção no código dentro do conjunto revalidado desta rodada. Configuração, infraestrutura, comportamento probabilístico de modelos e cobranças externas permanecem sujeitos às limitações descritas. Não há declaração de segurança total.

## 7. Entrega e status final

| Campo | Resultado |
| --- | --- |
| Projeto | English AI |
| Repositório | [Helio965/language-tool](https://github.com/Helio965/language-tool) |
| Pull request | [#6](https://github.com/Helio965/language-tool/pull/6), sem merge automático |
| Arquivos analisados | **66 arquivos Python**; inventário, método de contagem e limites na seção 2 |
| Arquivos modificados | 31 nesta continuação; 30 no diff final do PR contra main; relação na seção 4 |
| Problemas identificados | 4 achados confirmados, separados de 3 riscos condicionais de configuração e 3 melhorias |
| Vulnerabilidades confirmadas | 4 problemas de segurança reproduzidos; nenhum novo SQLi/BOLA/bypass de sessão confirmado |
| Correções implementadas | 10 registros tratados: 4 achados confirmados, 3 riscos condicionais e 3 melhorias; seção 4 |
| Testes executados | 368 casos únicos na rodada completa |
| Testes aprovados | 368 |
| Testes com falha | 0; erros 0 |
| Testes ignorados | 0 |
| Commit final e CI | Código/migração testados em `6a9f419f0dc83c265e55f57a8bed5c32b4debbbb`; o SHA da entrega e o resultado do CI após publicação ficam na [descrição e checks do PR #6](https://github.com/Helio965/language-tool/pull/6/checks). Contagem local não é resultado de CI. |
| Riscos pendentes | IA/SMTP reais, orçamento financeiro, Redis/TLS/WSGI/proxy implantados, crash/lease/cobrança externa e Windows; seção 6 |
| Status final | Pronto para revisão do código; integrações reais e infraestrutura permanecem não validadas, conforme seção 6 |

A aprovação local acima é uma medição concluída. O CI deve aprovar o SHA publicado; seu resultado e link de execução são registrados na descrição do PR para evitar atribuir a um commit novo o resultado do head inicial.
