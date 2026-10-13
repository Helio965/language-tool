# Auditoria avançada de segurança — English AI

## 1. Continuação e escopo

Esta rodada continua o [PR #6](https://github.com/Helio965/language-tool/pull/6), na branch `security/llm-bola-rate-hardening`, a partir de `a3ad5f9c7e2e9d9c227be90079ba07277b3d0738`. O PR estava aberto em draft, com 24 commits e 30 arquivos no diff contra `main`. A `main` estava em `eaa489f6393a9f26b1f7a7e5bef27679d26ef0d1`, com a auditoria SQL do PR #5 integrada. Os commits anteriores foram preservados; não foi realizado merge.

O proprietário autorizou revisão, correções e publicação do próprio código. As validações ativas usaram aplicação local, SQLite temporário, contas fictícias e IA simulada. Não foram utilizados banco ou contas reais, chamadas pagas, SMTP real ou testes contra produção. Servidores locais preexistentes e o banco persistente do checkout não foram utilizados nesta auditoria.

O escopo cobre prompts, validação da resposta LLM, consumo, autorização, privacidade das conversas, exclusão em cascata, sessões, recuperação, cabeçalhos e configuração efetiva. O histórico SQL permanece em [SQL_INJECTION_AUDIT.md](SQL_INJECTION_AUDIT.md). A arquitetura Flask/SQLAlchemy, as funções educacionais, o design e os contratos existentes foram preservados.

| Estado verificado ao retomar | Evidência |
| --- | --- |
| Head inicial do PR | [`a3ad5f9`](https://github.com/Helio965/language-tool/commit/a3ad5f9c7e2e9d9c227be90079ba07277b3d0738) |
| CI desse head | [Execução 38322877275](https://github.com/Helio965/language-tool/actions/runs/38322877275): backend falhou; Chromium aprovado |
| Falhas anotadas | Seis casos de `tests.security.test_ai_redis_quotas`; logs detalhados exigiam autenticação e não foram obtidos |
| Baseline local do mesmo head | 368 aprovados, zero falhas, erros ou skips, em 157,26 s; Redis oficial 7.2.12 e Chromium da imagem |
| CI da entrega | Conferir o SHA e o resultado nos [checks do PR #6](https://github.com/Helio965/language-tool/pull/6/checks). Aprovação local não substitui CI do commit publicado |

A incompatibilidade do fixture Redis com symlinks de binários multicall foi reproduzida localmente e é compatível com o padrão das seis falhas. Não foi inspecionado o layout do executável no runner anterior; a causa específica daquele CI depende da confirmação na nova execução.

## 2. Método e arquivos analisados

A revisão combinou leitura dos controles sensíveis, inventário sintático com `ast.parse`, simulações antes/depois e regressões existentes. O inventário contém **75 arquivos Python: 45 de aplicação/persistência e 30 de testes/fixtures**, incluindo os dois módulos novos. Todos foram analisados sintaticamente. Essa contagem não significa revisão manual integral de cada linha nem certificação de segurança por AST.

| Grupo | Quantidade | Caminhos |
| --- | ---: | --- |
| Inicialização | 3 | [app.py](../../app.py), [config.py](../../config.py), [extensions.py](../../extensions.py) |
| IA | 6 | [ai/](../../ai): inicializador, `conversation`, `correction`, `personality`, `prompts`, `provider` |
| Rotas | 5 | [blueprints/](../../blueprints): inicializador, `aprendizagem`, `auth`, `conversacao`, `pages` |
| Conteúdo e seed | 4 | [content/](../../content), [database/](../../database) |
| Modelos | 9 | [models/](../../models): inicializador e oito módulos de modelo/migração |
| Migrações | 5 | [migrations/](../../migrations): `env.py` e versões 0001–0004 |
| Serviços | 13 | [services/](../../services): inicializador e doze módulos de serviço |
| Testes principais | 10 | [tests/](../../tests): fixture e nove módulos |
| Testes de segurança | 17 | [tests/security/](../../tests/security): fixture e dezesseis módulos |
| Chromium | 3 | [tests/browser/](../../tests/browser) |
| **Total** | **75** | Arquivos versionados e os dois novos testes desta entrega |

Também foram examinados o workflow [python-security.yml](../../.github/workflows/python-security.yml), dependências e documentação de prompts/Windows. A contagem de 75 refere-se somente ao inventário Python acima.

O fixture [tests/security/conftest.py](../../tests/security/conftest.py) substitui a leitura de configuração e o diretório de instância: não herda `.env`, SQLite persistente, chave Anthropic ou SMTP. Os casos usam contas sintéticas, CSRF assinado, SDK interceptado por `httpx.MockTransport` e barreira de conexão de rede. Redis recebe exceção apenas para a porta loopback do processo temporário iniciado pelo próprio teste; nenhum Redis preexistente é utilizado. Chromium inicia sua própria aplicação em porta aleatória.

| Controle | Classificação após a revisão | Evidência e limite |
| --- | --- | --- |
| Dados do aluno fora de `system` | Implementado e validado | Cinco operações com SDK simulado; dados em mensagens não privilegiadas |
| Limites e esquema da resposta LLM | Necessitava correção; corrigido e validado | Comprimento bruto, Unicode, campos, enums, duplicatas, profundidade e JSON inválido |
| Bloqueio de eco literal | Implementado e ampliado | Prosa de raiz e correções aninhadas; spans/fatos legítimos preservados |
| Resistência de modelo real a jailbreak | Não validada | Simulação estrutural não mede obediência de modelo real |
| Cotas por conta e globais | Implementado e validado | Redis temporário, contas, factories, threads e processos |
| Limites finais de produção | Necessitava correção; corrigido e validado | Overrides numéricos e segredo temporário rejeitados antes das extensões |
| BOLA/IDOR e sessão como identidade | Implementado e validado | Contas A/B, IDs alheios/ausentes, APIs privadas e sessão adulterada/revogada |
| Exclusão em cascata | Implementado e validado | Dez tabelas privadas removidas; conta B, catálogo e rollback preservados |
| Exclusão enquanto a IA responde | Necessitava correção; corrigido e validado | `401` controlado, sem recriar conta, preferências ou mensagens |
| Prazo de privacidade durante resposta | Necessitava correção; corrigido e validado | Prazo mais curto mantido no banco, inclusive após reativar histórico |
| Claims, nonce e idempotência | Implementado e revalidado | Replay sem nova chamada; resposta antiga não altera reserva substituta |
| Sessões/CSRF/reset/logs/cabeçalhos | Implementado e revalidado | Cookie, uso único, revogação, HSTS condicionado a HTTPS, referência e logs locais |
| Redis/TLS/proxy/WSGI implantados | Não validado na infraestrutura | Somente configuração e ambiente local examinados |

## 3. Novos achados desta rodada

**Confirmado** indica comportamento reproduzido com dados sintéticos. **Condicional** depende de configuração privilegiada do servidor. **Melhoria** reforça uma defesa sem comprovar exploração. A incompatibilidade de teste é problema de CI, não vulnerabilidade da aplicação.

| ID | Classificação e gravidade | Reprodução e impacto observado | Correção e regressão |
| --- | --- | --- | --- |
| CONT-LLM-01 | Segurança: validação de saída; confirmado, baixa | `len(value.strip())` permitia texto bruto de 3.002 caracteres em campo com `maxLength=1200`. O teto global de JSON de 24.000 já limitava o impacto; não houve vazamento ou prova de esgotamento de recursos | Máximo usa comprimento bruto; mínimo verifica conteúdo não vazio. Resposta inválida retorna `503` sem persistir turno, contexto ou contador |
| CONT-PRIV-02 | Segurança: retenção de dados; confirmado, baixa | Desativar histórico durante a espera da IA era seguido de commit com prazo ORM antigo, estendendo o novo prazo de privacidade em 10 segundos na reprodução | `CASE` compara prazo atual dentro do `UPDATE` protegido por proprietário/nonce/contador/lease. Conserva o prazo mais curto, inclusive após reativar histórico |
| CONT-CHAT-03 | Robustez após exclusão; confirmado, baixa | Exclusão durante abertura/envio removia preferências; desreferência de `None` produzia HTTP `500`. Cascata já impedia ressurreição ou acesso entre contas | Reconsulta preferências/dono: conta excluída recebe `401`, filho ausente com dono existente recebe `409`. Não cria defaults; outra conta permanece idêntica |
| CONT-CONFIG-04 | Configuração de consumo; condicional, média | Overrides finais aceitavam 100.000 tokens, milhão de requests/minuto, timeout zero, negativos, booleanos ou tipos incompatíveis, embora o carregamento de ambiente tivesse limites | Mesmos sete limites inteiros aplicados à configuração efetiva de produção, antes das extensões; valores válidos aceitos sem conexão externa |
| CONT-CONFIG-05 | Persistência de sessão; condicional, baixa | Factory carregada em desenvolvimento e promovida por override podia usar segredo aleatório por processo em produção, invalidando sessões entre workers/reinícios | Segredo gerado recebe marcador compatível com `str`; produção exige chave explícita estável. Chaves explícitas `str`/`bytes` e assinatura em desenvolvimento continuam aceitas |
| CONT-DEF-06 | Eco de instruções; melhoria preventiva | `issues[].replacement/explanation_pt/explanation_en` não passavam pelo filtro literal. Não houve modelo real, segredo no prompt ou comprovação de jailbreak | Filtro inclui prosa gerada aninhada; spans/fatos do aluno continuam permitidos. Não detecta paráfrases |
| CONT-CI-07 | Fixture de CI; incompatibilidade confirmada, sem gravidade de segurança | `resolve()` trocava o nome invocado de symlink `redis-server` por `redis-check-rdb`; Redis multicall executava o verificador em vez do servidor | Caminho absoluto sem resolver symlink, verificação do arquivo e servidor local. Regressão com alias real confirma `PING` |

São **7 problemas tratados: 2 fragilidades de segurança confirmadas, 1 defeito de robustez confirmado, 2 riscos condicionais, 1 melhoria preventiva e 1 incompatibilidade de CI**. Não foi confirmado novo BOLA, SQL Injection, bypass de sessão, vazamento entre contas ou defeito de cascata.

### Histórico preservado

O [relatório anterior em a3ad5f9](https://github.com/Helio965/language-tool/blob/a3ad5f9c7e2e9d9c227be90079ba07277b3d0738/docs/security/ADVANCED_SECURITY_AUDIT.md) registrava quatro achados confirmados, três condicionais e três melhorias. Já estavam corrigidos no início desta rodada e não entram nos sete problemas novos:

| Registros anteriores | Controles preservados e revalidados |
| --- | --- |
| ADV-RATE-01 / ADV-CHAT-02 | Admissão paga na fronteira do provider; claims antes da IA impedem chamada simultânea duplicada |
| ADV-LLM-03 / ADV-LOG-04 | Unicode inválido rejeitado; token de recuperação omitido do log local Werkzeug |
| ADV-LLM-05 / ADV-LLM-06 / ADV-CONFIG-07 | Logs verbosos SDK filtrados, destino oficial Anthropic, configuração efetiva de produção e Redis compartilhado |
| ADV-DEF-08 / ADV-DEF-09 / ADV-DEF-10 | Filtro de eco, HSTS/no-referrer e `max_retries=0` |

## 4. Arquivos modificados

**8 arquivos nesta rodada: 3 de aplicação, 4 de testes e este relatório.** Não foram alterados dependências, lockfiles, workflow, rotas, schema, UI ou migrações.

| Arquivo | Resultado |
| --- | --- |
| [ai/provider.py](../../ai/provider.py) | Comprimento bruto e filtro literal em prosa aninhada |
| [config.py](../../config.py) | Limites finais de IA e segredo temporário recusado em produção |
| [services/conversacao.py](../../services/conversacao.py) | Prazo atômico e conta/preferências ausentes após espera |
| [tests/security/test_advanced_llm.py](../../tests/security/test_advanced_llm.py) | 18 novos casos de saída e persistência |
| [tests/security/test_effective_ai_configuration.py](../../tests/security/test_effective_ai_configuration.py) | 25 novos casos de configuração e assinatura |
| [tests/security/test_chat_privacy_races.py](../../tests/security/test_chat_privacy_races.py) | 11 novos casos de privacidade, exclusão, replay e nonce |
| [tests/security/test_ai_redis_quotas.py](../../tests/security/test_ai_redis_quotas.py) | Correção do fixture e 1 novo caso de alias multicall |
| [docs/security/ADVANCED_SECURITY_AUDIT.md](ADVANCED_SECURITY_AUDIT.md) | Evidências, contagens e limites desta continuação |

## 5. Validação

A baseline preservada aprovou 368 casos. Foram acrescentados **55 casos**, sem remover ou ignorar os anteriores. Reproduções focadas antes das correções demonstraram os comportamentos descritos; rodadas posteriores de IA (114), chat/estado (110) e cotas/configuração/Redis (69) aprovaram os grupos pertinentes. São rodadas sobrepostas, não somadas ao total.

Uma composição parcial de módulos de IA apresentou quatro erros de fixture `audit_app` por ordem de carregamento do conftest. Os módulos foram validados com seu fixture carregado e na suíte completa. Essa tentativa não foi contabilizada como aprovada; a infraestrutura de fixtures não foi alterada para esconder a falha.

A execução conjunta final aprovou **423 testes em 173,41 s, zero falhas, erros ou skips**: 408 backend, dos quais 265 em `tests/security`, e 15 Chromium. O XML `/tmp/english-ai-security-final.xml` confirmou essas contagens. Partição por módulo, sem duplicar casos:

| Categoria | Aprovados | Falhas/erros | Módulos |
| --- | ---: | ---: | --- |
| LLM/contrato e comportamento da IA | 114 | 0 | `test_ai`, `test_advanced_llm` |
| Autorização/contas | 56 | 0 | `test_auth`, `test_access_validation`, `test_advanced_authorization` |
| Sessões/CSRF/reset/logs/HTTP | 34 | 0 | `test_security`, `test_session_boundary`, `test_advanced_sessions` |
| Cotas/configuração/Redis | 69 | 0 | `test_ai_quotas`, `test_ai_redis_quotas`, `test_effective_ai_configuration` |
| Concorrência/idempotência/privacidade | 43 | 0 | `test_chat_idempotency`, `test_chat_claims`, `test_chat_privacy_races` |
| Regressões gerais/backend | 92 | 0 | SQLi, JSON, importação, SQLite, fronteira, migrações, aprendizagem, legado, manutenção, UI e casos mistos iniciais |
| Chromium | 15 | 0 | Três módulos de `tests/browser` |
| **Total** | **423** | **0** | **Sem skips** |

Comando da validação completa nesta nuvem:

```bash
APP_ENV=testing AI_PROVIDER=mock ANTHROPIC_API_KEY= \
  SMTP_HOST= SMTP_USER= SMTP_PASSWORD= MAIL_TRANSPORT=disabled \
  DATABASE_URL=sqlite:///:memory: AUTO_INIT_DB=false \
  CHROMIUM_EXECUTABLE=/usr/bin/chromium \
  REDIS_SERVER_EXECUTABLE=/tmp/english-ai-redis-runtime/source/src/redis-server \
  .venv/bin/python -m pytest -q --junitxml=/tmp/english-ai-security-final.xml
```

Para executar somente grupos, mantenha as mesmas variáveis e acrescente `tests/security` ou `-m "not browser"`. As fixtures continuam responsáveis pela aplicação, dados e processos temporários. Redis é obrigatório: ausência do executável falha o teste, sem skip silencioso.

Redis **7.2.12** foi compilado da fonte oficial no commit [`9913c926510755fa0d241658f550338a02258edb`](https://github.com/redis/redis/commit/9913c926510755fa0d241658f550338a02258edb). Cada teste inicia processo em `127.0.0.1`, porta aleatória e diretório temporário, sem persistência, e encerra apenas esse processo. Os casos existentes mantêm prova com 16 threads e quatro processos `spawn`. Na indisponibilidade, o middleware HTTP geral pode retornar `500` seguro antes da rota; a fronteira paga retorna `503`, ambos sem chamada ao provider. Não se afirma que toda falha Redis responde `503`.

`pip check`, análise sintática e `git diff --check` complementam os testes. XMLs e logs em `/tmp` são evidências locais, não versionados. Windows nativo não foi executado; os caminhos Linux acima pertencem à nuvem, sem alterar o funcionamento Windows da aplicação.

## 6. Riscos e validações restantes

| Limite | Prova disponível e ação de produção |
| --- | --- |
| Prompt injection/jailbreak | Fronteiras, esquema e eco literal simulados não garantem obediência real ou bloqueio de paráfrases. Manter segredos fora dos prompts; validar modelo em homologação autorizada |
| Custo financeiro | Teto de saída e cotas por tentativa. Caracteres/requests não definem gasto exato; configurar orçamento e alertas no provedor |
| Reservas parciais | Três contadores atômicos reservados sequencialmente; recusa posterior pode manter reservas anteriores. Sem transação conjunta ou reembolso automático |
| Crash/timeout/retry | Nonce protege o banco; cobrança externa pode ocorrer antes de falha local e repetir no retry. Timeout SDK é de I/O, não SLA total; sincronizar relógios |
| Redis implantado | Prova local não valida TLS, ACLs, namespace comum, disponibilidade ou configuração de todos os workers |
| Sessão e proxy | Chave estável e cookies verificados localmente; conferir persistência real do segredo, HTTPS externo e reconhecimento correto do esquema |
| Logs externos | Redação local não cobre Gunicorn, proxy, CDN, APM ou agregadores; impedir tokens, query, corpos e headers privados nesses sistemas |
| Recuperação real | Hash, validade, concorrência e revogação aprovados; SMTP, domínio, entrega e permissões não testados |
| Plataforma e banco | SQLite/Linux temporários; Windows nativo, outros SGBDs, CVEs, backups, retenção e permissões de infraestrutura não auditados |
| Legado e processos existentes | Nenhum teste ativo em serviço não identificado ou banco persistente. Verificar implantação Express legada e serviços reais separadamente |
| CI e metadados do PR | Git/publicação e checks separados dos testes locais. A API GitHub está bloqueada na rede ativa; `api.github.com` foi adicionado ao rascunho, sem aplicar a rede atual |

## 7. Entrega

| Campo | Resultado desta rodada |
| --- | --- |
| Projeto/repositório | English AI — [Helio965/language-tool](https://github.com/Helio965/language-tool) |
| PR | [#6](https://github.com/Helio965/language-tool/pull/6), mesma branch, sem merge |
| Arquivos analisados | 75 Python no inventário sintático; leitura sensível e limites na seção 2 |
| Arquivos modificados | 8; relação na seção 4 |
| Problemas identificados e tratados | 7 registros novos |
| Vulnerabilidades/fragilidades confirmadas | 2 de baixa gravidade; 1 defeito adicional de robustez confirmado |
| Outros registros | 2 condicionais, 1 melhoria preventiva e 1 incompatibilidade de fixture |
| Testes executados/aprovados | 423/423; 55 novos |
| Falhas/erros/skips | 0/0/0 |
| Status | Pronto para revisão local; conferir CI do SHA publicado. Integrações reais e infraestrutura não validadas |

Os achados confirmados desta rodada foram corrigidos. As limitações acima permanecem; não há declaração de segurança total. A publicação atualiza o próprio PR #6 e mantém `main` intacta. O rascunho da nuvem salva instalação e validação reutilizáveis; sua publicação exige revisão nas configurações, e restauração em tarefa nova não foi comprovada.
