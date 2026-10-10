# Rastreabilidade — English AI em Python

Os identificadores e a numeração acadêmica foram preservados. Fontes disponíveis:
consolidação da Análise (F1), Especificação de Casos de Uso (F2), fluxograma (F3)
e tarefas Pessoa 2 (F4) em [MVP-SCOPE.md](MVP-SCOPE.md). Os DOCX/PDF originais
não foram reenviados nesta tarefa. [A rastreabilidade anterior está preservada](legacy/REQUIREMENTS-TRACEABILITY.md).

**Legenda:** implementado = caminho de código existente, com validação registrada
no relatório; parcial = falta explícita; fora do MVP = decisão acadêmica mantida.
Existência de código não substitui evidência de execução. A versão e os resultados
executados estão em [MIGRATION-AUDIT.md](MIGRATION-AUDIT.md). Credenciais externas,
Windows, aparelhos reais e plataformas não executadas mantêm limites próprios.

## Requisitos funcionais (RF01–RF20)

| ID | Requisito original | Implementação Python | Verificação / limite |
| --- | --- | --- | --- |
| RF01 | Cadastro | `services/autenticacao.py`, `blueprints/auth.py`, `templates/auth` | Cadastro, duplicação, campos/senha/aceite; boas-vindas local |
| RF02 | Autenticação segura | scrypt compatível, Flask-Login, versão sessão, CSRF/limites; recuperação uso único | Login, logout, expiração, sessão antiga, CSRF, token/TTL/reuso |
| RF03 | Perfil | `models/usuario.py`, `services/perfil.py`, `templates/perfil` | Persistir/editar perfil e retomar etapa pendente |
| RF04 | Objetivo | perfil com básicos/conversação/trabalho/viagem/tecnologia | Objetivo/interesses informam recomendações |
| RF05 | Nivelamento | `services/nivelamento.py`, `content/catalog.json`, `templates/aprender/placement.html` | Três etapas, 12 questões, resultado estimado, pular/refazer |
| RF06 | Modo Aprender | `services/aprendizagem.py`, `templates/aprender` | Iniciar/retomar aula e navegar seus passos |
| RF07 | Gramática | 12 aulas preservadas em `content/` | Consistência, ordem, conteúdo PT/EN |
| RF08 | Vocabulário por nível | 67 palavras preservadas; `services/vocabulario.py` | Tradução/exemplos/nível e consulta |
| RF09 | Exercícios | 65 atividades de aula em cinco tipos | Entradas inválidas, gabaritos e produção livre distinta |
| RF10 | Correção | `services/exercicios.py`, `ai/correction.py` | Fechados determinísticos; feedback, reenvio/idempotência |
| RF11 | Explicação adequada ao nível | `ai/personality.py`, `ai/correction.py`, explicação PT/EN catálogo | Idioma/detalhe e formato Sua frase/Forma recomendada/Explicação |
| RF12 | Conversação | `services/conversacao.py`, `ai/provider.py`, `ai/conversation.py`, templates/chat | Turnos/contexto e persistência; integração real depende de chave |
| RF13 | Personalidade da IA | `ai/personality.py` e prompts | Lumi preservada, paciente, educativa e transparente |
| RF14 | Correção durante conversa conforme preferência | política Python leve/equilibrada/detalhada | Exibir/adiar correções, naturalidade, resumo |
| RF15 | Histórico privado | conversas salvas/temporárias, retenção, exclusão | Desligar histórico, encerrar, expirar e apagar conteúdo |
| RF16 | Progresso | `services/progresso.py`, tentativas/passagens e `models/progresso.py` | Resultado calculado no servidor e recarga do banco |
| RF17 | Vocabulário estudado | `services/vocabulario.py`, `user_vocabulary` | Aula registra palavras; status e revisão espaçada |
| RF18 | Revisão | `services/revisao.py`, `models/progresso.py`, templates/review | Motivo, atividades permitidas, nota do servidor, intervalo |
| RF19 | Preferências | `services/perfil.py`, `templates/configuracoes/preferences.html` | **Parcial:** escolhas salvas, lembretes sem envio |
| RF20 | Exclusão de dados | DELETE conta com senha, cascatas, apagar conversas | Dono, senha, conta/tokens/conversas/tentativas removidos |

## Requisitos não funcionais (RNF01–RNF10)

| ID | Requisito | Implementação / evidência | Limitação expressa |
| --- | --- | --- | --- |
| RNF01 | Usabilidade e foco mobile | Jinja/macros, texto simples, um fluxo por contexto | Sem teste com usuários reais |
| RNF02 | Responsividade | Identidade/CSS mobile-first, navegação adaptada | Somente larguras/navegador executados podem ser declarados verificados |
| RNF03 | Desempenho | HTML sem bundle React, conteúdo local, histórico/timeout limitados | Sem teste de carga ou latência do provedor real |
| RNF04 | Segurança | Hash, sessão/versionamento, CSRF global, dono, limites, CSP/escape, token hash | Não equivale a auditoria externa; limites em memória por instância |
| RNF05 | Privacidade/transparência | Consentimento, página dados, saneamento, histórico opcional, exclusão | Texto informativo sem revisão jurídica |
| RNF06 | Escalabilidade | ORM e dependências substituíveis, ambientes configuráveis | SQLite validado localmente; PostgreSQL/distribuição futura |
| RNF07 | Disponibilidade | Tratamento falha/timeout/JSON inválido com erro seguro; modo demo explícito | Sem fallback automático; erro externo preserva rascunho, sem SLA do provedor |
| RNF08 | Manutenibilidade | Factory, Blueprints, serviços, modelos, testes pytest, docs | Resultados/quantidades registrados depois de executar |
| RNF09 | Acessibilidade | Semântica, rótulos, foco, mensagens de estado, movimento reduzido | Sem auditoria formal completa ou leitor de tela real |
| RNF10 | Compatibilidade | HTML/CSS/JS padrão; Python 3.12 | Windows documentado; navegador/OS não executado não é validado |

## Regras de negócio (RN01–RN08)

| ID | Regra | Implementação |
| --- | --- | --- |
| RN01 | Dois modos Aprender e Conversar | Rotas/templates distintos e política de modo no prompt |
| RN02 | Progressão de dificuldade | Catálogo ordenado por nível; promoção por desempenho e aulas |
| RN03 | Adequação ao nível | Recomendações, marcação acima do nível, política de idioma/resposta |
| RN04 | Não interromper constantemente | Correção leve/equilibrada/detalhada; adiamento e resumo |
| RN05 | Explicação por nível | PT/EN e apoio em `ai/personality.py`/catálogo |
| RN06 | Personalização por perfil/desempenho | Objetivo/interesses, próxima aula, dificuldades/revisões |
| RN07 | Controle dos dados e conversas | Preferência, retenção, apagar história/conta; sem dados da conta anterior |
| RN08 | Conteúdo próprio | Aulas/palavras/questões/temas preservados do English AI; fontes com licença local |

Progressão não é certificação nem bloqueio automático de todo material acima do
nível. Novos requisitos técnicos (transação, chave de idempotência, metadata da
resposta) implementam consistência/transparência; não alteram o escopo acadêmico.

## Casos de uso (F2 — UC01–UC12)

| UC | Caso de uso | Tela / serviço | Alternativas e limites |
| --- | --- | --- | --- |
| UC01 | Criar conta | `/cadastro`, autenticação | Entrada inválida, senha/termos, conta existente com atalho login |
| UC02 | Fazer login | `/entrar`, recuperação/redefinição | Credenciais genéricas; senha esquecida; sessão pendente/expirada |
| UC03 | Configurar perfil | `/configuracao`, `/perfil/editar`, perfil | Objetivo, nível percebido, experiência e interesses persistidos |
| UC04 | Realizar nivelamento | `/nivelamento`, `/perfil/nivelamento` | Pular, refazer, resultado como estimativa |
| UC05 | Iniciar aula | `/aprender/aula/<id>`, aprendizagem | Explicação/exemplos, retomada, outra explicação/exemplo |
| UC06 | Realizar exercício | Aula / sessão de revisão, exercícios | Vazio/malformado, erro de gravação, repetição e reenvio distintos |
| UC07 | Consultar correção | Feedback de exercício/chat | Formato pedagógico e idioma ajustado |
| UC08 | Revisar conteúdo | `/revisao`, `/revisao/<id>`, revisão | Dono/conjunto permitido, resultado e próxima data no servidor |
| UC09 | Conversar com IA | `/conversar`, `/conversar/<id>` | Contexto, preferências, falha provedor, histórico, feedback final |
| UC10 | Consultar vocabulário | `/vocabulario`, vocabulário | **Parcial:** tradução/exemplo/nível/status; sem pronúncia/áudio no MVP |
| UC11 | Consultar progresso | `/progresso` e atalho Perfil | Estado vazio, recarga com dados, indicadores reais |
| UC12 | Configurar preferências | `/preferencias` | **Parcial:** idioma/correção/histórico/meta; sem envio de lembretes |

Numeração da Análise F1 mantida por mapeamento: F1-UC01→UC01;
F1-UC02→UC04; F1-UC03→UC05+UC06; F1-UC04→UC09; F1-UC05→UC11.
Fluxo de novo usuário: cadastro → configuração → nivelamento → início;
Aprender/conversa → resumo/progresso → revisão.

## Evidência automatizada ligada aos identificadores

Os nomes abaixo apontam para testes da aplicação Python sobre SQLite real
temporário. Parâmetros de um mesmo teste podem gerar vários casos. A tabela
identifica o que a suíte verifica; sua aprovação e a quantidade executada são
registradas no relatório de auditoria. Transporte Anthropic controlado e mailer
falso verificam contratos/falhas, sem comprovar respostas ou entregas externas.

| Identificadores | Arquivo e testes de referência | O que essa evidência demonstra |
| --- | --- | --- |
| RF01, RF02; RNF04; UC01, UC02 | [test_auth.py](../tests/test_auth.py): `test_register_login_duplicate_and_validation`, `test_scrypt_node_format_and_malformed_hashes`, `test_reset_single_use_revokes_all_devices_and_old_password`, `test_reset_expiration_boundary_and_old_link_replacement` | Cadastro/login e validação; hash legado; redefinição, TTL/uso único e invalidação |
| RF03, RF04, RF19; RN06; UC03, UC12 | [test_auth.py](../tests/test_auth.py): `test_profile_preferences_strict_inputs`; [test_learning.py](../tests/test_learning.py): `test_new_user_journey_and_server_progress`; [test_ai.py](../tests/test_ai.py): `test_prompts_do_not_include_unapproved_fields` | Perfil, objetivos, preferências, jornada e contexto mínimo; lembretes permanecem apenas salvos |
| RF05; RN03; UC04 | [test_learning.py](../tests/test_learning.py): `test_placement_rejects_future_stage_malformed_and_retroactive_changes`, `test_placement_completion_retry_does_not_duplicate_attempts`, `test_parallel_placement_completion_deduplicates_persisted_attempts` | Etapas adaptativas, validação, conclusão persistida e proteção contra reenvio |
| RF06, RF07, RF08, RF09; RN01, RN08; UC05, UC10 | [test_learning.py](../tests/test_learning.py): `test_catalog_preserves_original_content`, `test_lesson_requires_placement_and_all_exercises`, `test_answer_retry_and_start_retry_preserve_first_attempt_and_resume` | Conteúdo preservado, acesso conforme etapas e retomada; pronúncia/áudio não são testados como recurso |
| RF10, RF11; RN05; UC06, UC07 | [test_learning.py](../tests/test_learning.py): `test_deterministic_grading`, `test_closed_exercises_never_need_external_ai`, `test_open_write_grammar_is_graded_even_with_light_preferences`, `test_open_assessment_provider_failure_has_no_false_saved_success`; [test_ai.py](../tests/test_ai.py): `test_preserved_grammar_examples` | Gabaritos fechados, diferença entre resposta objetiva/produção livre e falha sem sucesso falso |
| RF12, RF13, RF14; RN04; UC09 | [test_ai.py](../tests/test_ai.py): `test_policy_preserves_natural_conversation`, `test_demo_keeps_context_recasts_and_announces_mode`, `test_conversation_journey_privacy_feedback_and_repeated_errors`, `test_provider_cannot_force_ambiguous_meaning_rewrites` | Personalidade/contexto, intensidade de correção, naturalidade e feedback; qualidade pedagógica externa exige revisão própria |
| RF15, RF20; RNF05; RN07 | [test_ai.py](../tests/test_ai.py): `test_privacy_disabled_then_end_deletes_content_but_keeps_metrics`, `test_expired_and_deleted_content_cannot_be_resurrected`, `test_other_account_and_unauthenticated_access_are_blocked`; [test_auth.py](../tests/test_auth.py): `test_delete_account_requires_password_and_cascades` | Histórico opcional, retenção, dono, exclusão e cascatas; não é revisão jurídica |
| RF16; RN02; UC11 | [test_learning.py](../tests/test_learning.py): `test_new_user_journey_and_server_progress`, `test_level_promotion_requires_all_lessons_and_threshold`, `test_progress_uses_configured_timezone_and_streak`, `test_lesson_completion_idempotent_and_replay_explicit` | Resultado recuperado do banco, progressão, tempo/atividade e conclusão idempotente |
| RF17, RF18; UC08 | [test_learning.py](../tests/test_learning.py): `test_review_rejects_unrelated_exercise_empty_completion_and_forged_counts`, `test_reviews_owned_by_account`, `test_failed_word_reviews_never_become_learned_and_retry_is_once`, `test_vocabulary_requires_three_successful_sessions_after_a_failure` | Conjunto autorizado, notas calculadas no servidor, dono, revisão e domínio baseado em acertos |
| RNF04; jornada 6 | [test_security.py](../tests/test_security.py): `test_signed_csrf_token_required`, `test_account_binding_cannot_leak_new_cookie_account`, `test_logout_revokes_copied_cookie`, `test_private_response_headers_and_cookie`, `test_untrusted_body_and_size_are_rejected`, `test_login_abuse_is_limited` | CSRF, isolamento, revogação, limites e entradas malformadas; não é auditoria externa de segurança |
| RNF03, RNF07 | [test_ai.py](../tests/test_ai.py): `test_live_service_bounds_and_redacts_history_facts_and_output`, `test_official_sdk_errors_are_classified_without_leaking_bodies`, `test_official_sdk_timeout_is_classified`, `test_invalid_provider_responses_fail_without_demo_fallback` | Limites de contexto, timeout/erro seguro e transparência; não mede carga, SLA ou latência real |
| RNF06, RNF08 | [test_migrations.py](../tests/test_migrations.py): `test_new_database_has_all_fourteen_tables_and_constraints`, `test_legacy_copy_preserves_source_hashes_profiles_and_dates`, `test_import_cli_and_startup_preserve_every_original_column_and_row`, `test_incompatible_legacy_schema_rejected_before_changes`, `test_partial_second_upgrade_can_resume` | Factory/banco isolado, importação/seed sem sobrescrita, esquema, compatibilidade e recuperação no SQLite; não comprova PostgreSQL nem múltiplas instâncias |
| RNF01, RNF02, RNF09, RNF10; UC01–UC05 | [browser/test_journeys.py](../tests/browser/test_journeys.py): `test_new_user_actual_placement_then_first_lesson`, `test_private_navigation_blocks_anonymous_user`, `test_responsive_landing_and_account_pages` | Navegação por controles reais e larguras 320/820/1440px no Chromium; não comprova usabilidade com pessoas, WCAG completa, Windows ou outros navegadores |

Atomicidade e concorrência têm testes específicos em `test_auth.py`,
`test_learning.py` e `test_ai.py`: falhas no commit não podem deixar identidade,
resultado, agendamento ou turno parcial; envios/conclusões concorrentes usam
conexões SQLite distintas. Estes requisitos de consistência são decisões técnicas
que preservam as jornadas acadêmicas, sem acrescentar funcionalidades ao MVP.

Regressões adicionais de migração são verificadas em
[test_legacy_state.py](../tests/test_legacy_state.py):
`test_old_equal_timestamp_history_keeps_insertion_order_and_provider_context`,
`test_imported_account_missing_children_logs_in_and_keeps_existing_values` e
`test_cleanup_and_returning_later_do_not_inflate_study_time`. A manutenção está
em [test_maintenance.py](../tests/test_maintenance.py), com
`test_purge_private_data_removes_expired_content_and_old_reset_tokens`.
Transparência da origem/configuração e retenção aparece em
[test_ui_contracts.py](../tests/test_ui_contracts.py); os erros e mudanças rápidas
de preferência usam o navegador real em
[browser/test_ui_recovery.py](../tests/browser/test_ui_recovery.py).

O reenvio de chat após perda da resposta HTTP usa
[test_chat_idempotency.py](../tests/test_chat_idempotency.py):
`test_lost_reply_retry_returns_original_pair_without_provider_or_counter_increment`,
`test_reused_key_rejects_changed_content_even_when_both_addresses_are_redacted`,
`test_simultaneous_same_key_commits_one_pair_and_both_callers_recover_it` e
`test_completed_saved_conversation_can_replay_but_deleted_content_cannot`.
A jornada de rede interrompida usa
[browser/test_chat_retry.py](../tests/browser/test_chat_retry.py):
`test_chat_retries_lost_committed_reply_with_same_key_then_allows_repeated_text`.
A concorrência garante uma dupla persistida; não garante apenas uma chamada ou
cobrança externa quando os pedidos chegam simultaneamente.

## Pessoa 2, artefatos e fronteiras do MVP

A especificação de design (`design/`) e o comportamento da IA
([IA-BEHAVIOR.md](IA-BEHAVIOR.md)) permanecem artefatos acadêmicos. A interface
navegável agora usa templates/static integrados ao Python. **Arquivo Figma não
foi criado**; o [FIGMA-GUIDE.md](../design/FIGMA-GUIDE.md) continua guia para a equipe.
As capturas antigas em `design/screenshots` documentam a referência visual, não
são evidência de novas jornadas Python.

Preservados: DER/arquitetura, UX, fluxos, personas, conteúdo e divergências D1–D11.
Lembretes enviados, painel administrativo, voz, pronúncia automática, rankings,
marketplace, vídeo e certificação permanecem ausentes/futuros conforme escopo.

## Jornadas e aceitação da migração

| Jornada | Fluxo executável | Teste de referência |
| --- | --- | --- |
| 1 Novo usuário | Cadastro → perfil → nivelamento → primeira aula | `test_new_user_actual_placement_then_first_lesson` (navegador) |
| 2 Aprendizagem | Login → aula → exercício → correção → progresso persistido | `test_complete_lesson_resumes_saved_answer_and_keeps_score_after_reload` (navegador) e `test_new_user_journey_and_server_progress` (API) |
| 3 Conversação | Login → tema → mensagem → resposta identificada → contexto | `test_demo_conversation_feedback_privacy_clear_and_password_confirmed_deletion` (navegador), `test_conversation_journey_privacy_feedback_and_repeated_errors` (API) |
| 4 Revisão | Dificuldade → fila → atividades → resultado e nova data | `test_low_score_lesson_creates_server_review_and_saves_completed_review` (navegador), testes de pontuação/idempotência em `test_learning.py` |
| 5 Privacidade | Preferências → histórico → exclusão solicitada | Jornada de conversa/privacidade no navegador; histórico desativado/cascatas em `test_ai.py`/`test_auth.py` |
| 6 Segurança | Sem sessão/dono incorreto → bloqueio; CSRF/XSS/SQL injection tratados | `test_private_navigation_blocks_anonymous_user` (navegador), `test_security.py` e testes de dono em serviços |

O navegador também executa `test_vocabulary_save_learn_filter_and_reload` e
`test_password_reset_outbox_link_single_use_and_old_session_revoked`. Estes
testes estão em [browser/test_journeys.py](../tests/browser/test_journeys.py) e
usam a aplicação Flask real, CSRF assinado, SQLite temporário e outbox local.
O teste de conversação usa demonstração identificada; não é prova de API externa.

Também requeridos: instalação pelo README, banco novo e cópia antiga com hashes
preservados, startup/página pública, mobile, execução principal sem Node,
documentação coerente e branch/PR no GitHub. Esses critérios não são marcados
concluídos apenas porque o servidor inicia. O relatório registra a execução e
qualquer critério ainda sem evidência, incluindo integrações externas/GitHub.

Os 20 critérios do prompt de migração são condições técnicas de entrega; não
substituem os identificadores dos documentos acadêmicos:

| Nº | Critério de aceitação | Evidência / condição |
| --- | --- | --- |
| 1 | Instalar pelo README | Dependências fixadas, venv/Python 3.12 e instalação cloud registrada na auditoria; Windows documentado, sem execução nativa |
| 2 | Iniciar aplicação | `python app.py`, factory e verificações HTTP registradas na auditoria |
| 3 | Carregar página inicial | `/` real no Chromium e verificação HTTP |
| 4 | Cadastro e login | `test_auth.py`, jornada de navegador |
| 5 | Configurar perfil | `test_profile_preferences_strict_inputs`, novo usuário no navegador |
| 6 | Nivelamento | Validação/conclusão em `test_learning.py` e nivelamento real no navegador |
| 7 | Aulas no Modo Aprender | Catálogo e início/retomada em `test_learning.py`, primeira aula no navegador |
| 8 | Responder/corrigir exercícios | Gabaritos/regras/produção livre em `test_learning.py`; frontend integrado à API |
| 9 | Progresso persistido | `test_new_user_journey_and_server_progress`, resultados do banco e recarga |
| 10 | Vocabulário e revisão | Sessão autorizada, status/acertos, intervalo e notas em `test_learning.py` |
| 11 | Conversação no backend Python | Jornada/API persistida em `test_ai.py`; origem identificada e política de contexto |
| 12 | IA quando configurada | SDK/contrato/falhas testados com transporte controlado; **chamada Anthropic real pendente de chave/acesso ao modelo** |
| 13 | Respeitar privacidade | Histórico opcional, expiração/exclusão, saneamento e dono em `test_ai.py`/`test_auth.py`/`test_security.py` |
| 14 | Jornadas aprovadas | Resultado da execução final registrado na auditoria; API/serviços usam SQLite real, browser usa Flask real |
| 15 | Interface móvel | Chromium em 320/820/1440px, páginas privadas; aparelhos reais e outros navegadores não executados |
| 16 | Executar sem Node | `app.py`, dependências Python e interface Jinja/static; TypeScript preservado como legado |
| 17 | Responsabilidades modulares | Factory, quatro Blueprints, serviços, ORM e camada IA em `ARCHITECTURE.md` |
| 18 | Rastrear requisitos e testes | Matrizes RF/RNF/RN/UC e índice de testes deste documento |
| 19 | Documentação atualizada | README, arquitetura, DER, dados/rollback, IA, UX e Windows/VS Code; originais preservados em `legacy/` |
| 20 | Revisão no GitHub | Branch e commits em `MIGRATION-AUDIT.md`; URL do PR registrada após publicação, sem merge automático |

Sem a chamada externa, o critério 12 permanece com verificação de integração
controlada e limitação expressa. SMTP real, Windows nativo, WCAG completa,
PostgreSQL e aparelhos físicos têm limites próprios e não são declarados
validados por existir código ou instrução de instalação.
