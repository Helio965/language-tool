# RELATÓRIO DE AUDITORIA DE SEGURANÇA

## 1. Informações gerais

| Item | Informação |
| --- | --- |
| Projeto | English AI / `Helio965/language-tool` |
| Data | 12/10/2026, referência de calendário `America/Sao_Paulo` |
| Base da auditoria | `main`, commit `b77e724`, após o merge do PR de migração Python #4 |
| Branch de trabalho | `security/sql-injection-audit` |
| Pull Request | [PR #5](https://github.com/Helio965/language-tool/pull/5), aberto para revisão; sem merge automático |
| Aplicação principal | Python 3.12.14, Flask 3.1.3, Jinja, HTML/CSS/JavaScript; Flask-Login 0.6.3, Flask-WTF 1.3.0 e Flask-Limiter 4.1.1 |
| Persistência principal | SQLite, SQLAlchemy 2.0.54 e Alembic 1.20.0; 14 tabelas de domínio, além da tabela de controle Alembic |
| Código legado preservado | TypeScript, React, Express, Node 22 e `better-sqlite3`; análise estática separada, sem execução de ataques nesse backend |
| Ambiente ativo | Processo local de testes Flask, SQLite temporário por teste, contas e conteúdo de auditoria artificiais |
| Escopo autorizado | Revisão de entradas e consultas; SQLi controlada; autenticação, isolamento de contas, validação e erros; correções relacionadas e regressões |

Commits de preparação e correção: `cefad25` (fronteira isolada), `bf09da1`
(validação), `e89d665` (criação privada e importação exclusiva) e `65894a4`
(regressões automatizadas). As alterações da auditoria seguem separadas do
merge de migração usado como baseline.

O projeto utiliza banco SQL. As tabelas de domínio são `users`,
`password_reset_tokens`, `learning_profiles`, `preferences`, `lessons`,
`exercises`, `vocabulary`, `lesson_vocabulary`, `exercise_attempts`,
`user_vocabulary`, `progress`, `reviews`, `conversations` e `messages`.
Não foi identificado Supabase, Firebase ou outro armazenamento não relacional
como banco principal. A configuração aceita uma URL de banco e contém ajustes
para PostgreSQL, mas os testes ativos deste relatório utilizam exclusivamente
SQLite. Isso não comprova compatibilidade nem segurança em outros SGBDs.

A sessão principal usa cookie Flask assinado e Flask-Login, com identificação
`user_id:session_version` verificada no banco. Senhas usam scrypt; tokens de
recuperação são armazenados como hash SHA-256, com expiração e consumo único.
O relatório não publica cookies, tokens, hashes de senha, valores de segredos,
dumps de banco ou dados de pessoas reais.

## 2. Metodologia

1. Verificação do estado Git e preservação da aplicação e do legado. O ponto
   de partida foi a `main` já migrada; a auditoria usa branch própria.
2. Inventário de dependências, configuração, modelos, blueprints, serviços,
   consultas ORM, SQL bruto, migrações, seed e repositórios do legado.
3. Rastreamento de entradas HTTP até validação, identificação da conta,
   autorização, consulta e persistência. Atenção a interpolação de valores,
   identificadores SQL e operações sobre recursos de outra conta.
4. Criação da fronteira de testes em `tests/security/conftest.py` antes dos
   testes ativos. `load_config` é substituída por configuração explícita;
   `.env`, URLs e credenciais herdadas não são carregadas. A pasta `instance`
   e o banco ficam dentro do `tmp_path` de cada teste. Nenhum banco real é
   copiado para preparar essa suíte.
5. IA configurada como `mock`, e-mail desativado e `socket.connect` bloqueado.
   A fixture verifica SQLite, localização temporária e integrações desativadas,
   além de falhar se houver tentativa de conexão de rede.
6. Exercício dos handlers HTTP e do banco reais por Flask test client, com
   sessões independentes A/B e CSRF assinado válido nas mutações. A limitação
   de requisições é desativada somente na fixture para permitir casos finitos
   e reproduzíveis; não foram realizados força bruta ou testes de sobrecarga.
7. Observação dos templates SQL e dos parâmetros com
   `before_cursor_execute`. Asserções verificam que entradas permanecem nos
   parâmetros, não aparecem no template e não produzem registros indevidos.
   Essa captura fica em memória e não gera arquivo com valores sensíveis.
8. Reprodução mínima de falhas, aplicação de correções e repetição das
   regressões. A suíte existente também é executada para verificar os fluxos
   legítimos preservados.

Os testes usam conceitos de prevenção de injeção e controle de acesso do OWASP
Top 10. Esta revisão não é uma certificação OWASP nem um pentest irrestrito.
Não foram utilizados sqlmap, extração de dados, comandos destrutivos,
persistência, movimentação lateral, evasão, força bruta ou serviços externos.
Não houve auditoria de infraestrutura implantada ou verificação de CVEs de
todas as dependências.

## 3. Superfícies analisadas

Todos os caminhos desta tabela são relativos ao prefixo `/api`.

| Superfície | Entradas e endpoints examinados | Caminho até a persistência e controles observados |
| --- | --- | --- |
| Cadastro | `POST /auth/register`: nome, e-mail, senha, confirmação, termos e campos extras | `blueprints/auth.py` → `body()` → `autenticacao.register`; e-mail parametrizado, hash scrypt local, papel `user` definido no servidor; inserção atômica de usuário/perfil/preferências |
| Login e sessão | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `GET /me` | `autenticacao.login` consulta e-mail com ORM; senha não é operando SQL; cookie assinado e versão de sessão consultada; `login_required` nas rotas privadas |
| Recuperação e exclusão | `POST /auth/password-reset`, `/verify`, `/confirm`; `DELETE /me` | Validação e consulta do hash do token; consumo condicionado ao estado válido; exclusão exige senha e usuário da sessão; nenhuma integração externa durante a auditoria |
| Perfil e preferências | `PUT /me/profile`, `GET/PATCH /me/preferences` | `services/perfil.py`; tipos/enums/limites e campos permitidos; chave de usuário vem da sessão, não de `userId` enviado no JSON |
| Nivelamento | `POST /placement/start`, `/answers`, `/skip` | `services/nivelamento.py`; estado e respostas vinculados à conta; consultas e atualizações ORM |
| Aulas e exercícios | `GET /lessons`, `GET /lessons/<id>`, `POST .../start`, `.../exercises/<id>/answer`, `.../complete`, `.../explain`, `.../example` | IDs resolvidos no catálogo; passagem/tentativas vinculadas ao usuário; resposta e chave de idempotência persistidas como parâmetros; nota derivada no servidor |
| Progresso e início | `GET /progress`, `GET /home` | `services/progresso.py`; estatísticas calculadas sobre registros da conta autenticada |
| Vocabulário | `GET /vocabulary`, `GET /vocabulary/<id>`, `PUT .../status` | Catálogo e estado por usuário; enum de status; consultas ORM com chave composta |
| Revisões | `GET /reviews`, `POST /reviews/<id>/session`, `.../answers`, `.../complete` | `revisao.require_owned` filtra ID e usuário; conjunto de exercícios autorizado e resultado calculado pelo servidor |
| Conversação | `GET/POST/DELETE /conversations`, `GET/DELETE /conversations/<id>`, `POST .../messages`, `.../end` | `services/conversacao.py`; filtro de dono no backend, conteúdo como parâmetro, proteção de repetição e persistência transacional |
| URL, query string e headers | IDs de recursos, `userId`, `sort`, filtros não suportados e `Idempotency-Key` | Identificação da conta pela sessão; parâmetros de busca/ordenação não suportados são ignorados; chave de repetição é dado, não SQL |
| Saúde e erros | `GET /health`, corpos JSON e handlers de erro | `SELECT 1` fixo; respostas de falha genéricas, rollback e log apenas da classe de exceção |
| Configuração, manutenção e migração | `config.py`, `extensions.py`, `database/seed.py`, `models/migration.py`, revisões Alembic e comandos CLI | Configuração de banco/segredos é administrativa; catálogo e nomes SQL internos fixos; sem endpoint público para SQL ou para escolher tabelas/colunas |
| Frontend | Templates Jinja e módulos em `static/js`; React preservado em `apps/web` | Transporte JSON/CSRF e separação da sessão; nenhum acesso SQL direto do navegador; filtros visuais não autorizam dados no servidor |

As consultas de serviços Python usam `select`, `update`, `delete`, comparações
ORM e parâmetros do SQLAlchemy. Há SQL bruto, mas sua presença não constitui
SQLi por si só: `SELECT 1`, PRAGMAs fixos, DDL Alembic e filtros de índices são
estáticos. `models/migration.py:validate_legacy_connection` interpola nomes
oriundos do esquema interno e de `JSON_COLUMNS`, não de uma requisição HTTP.
`services/conversacao.py:_messages` usa `literal_column("messages.rowid")`
fixo para desempate no SQLite; outros bancos usam a coluna de ID. Ordenações
dos serviços usam colunas definidas no código. Não foi encontrado caminho HTTP
que escolha livremente um identificador SQL nesses pontos.

No legado, foram examinadas 33 operações CRUD com SQL preparado em
`apps/api/src/repositories/sqliteStore.ts` e quatro statements de seed em
`apps/api/src/db/seed.ts`, além da configuração de schema. Os valores são
ligados por parâmetros nomeados. Esse resultado é de revisão estática; não
equivale à execução dos testes Python contra o backend Express.

## 4. Vulnerabilidades identificadas

Não foi confirmada vulnerabilidade de SQL Injection. Os problemas abaixo
foram observados durante verificações relacionadas de validação e proteção
local de arquivos. Eles não são classificados como SQLi.

| ID | Vulnerabilidade | Gravidade | Evidência | Status |
| --- | --- | --- | --- | --- |
| SEC-VAL-001 | Status de vocabulário sem verificação de tipo podia gerar erro interno | BAIXO | `status: []` e `status: {}` retornavam HTTP 500 em vez de erro de validação | Corrigido; regressões de tipos |
| SEC-JSON-002 | Números não finitos e Unicode inválido podiam alcançar operações que não os suportam | BAIXO | Conclusão de aula com `NaN` e senha com surrogate isolado retornavam HTTP 500 | Corrigido; validação JSON central e validação de tempo no domínio |
| SEC-FS-003 | Criação de novos arquivos SQLite e diretórios dependia de permissões padrão do processo | BAIXO | Com `umask 022`, banco sintético era criado como `0644` e `instance` como `0755` | Corrigido para novas criações ordinárias verificadas; permissões de implantação/existentes requerem revisão do operador |
| SEC-FS-004 | Importação podia sobrescrever ou remover um destino criado concorrentemente após a verificação inicial | MÉDIO | `import_legacy` substituiu marcador de outro destino sintético criado entre verificação e conexão; limpeza de falha também não distinguia destino não criado pela operação | Corrigido por criação exclusiva e controle de posse do destino; regressões de importação |

### SEC-VAL-001 — Tipo do status de vocabulário

- **Classificação:** falha confirmada de validação.
- **Arquivo/função:** `services/vocabulario.py:set_status`.
- **Entrada e causa:** usuário autenticado enviava array ou objeto em `status`
  a `PUT /api/vocabulary/red/status`; teste de pertencimento em um conjunto
  tentava usar um objeto não hashable e levantava `TypeError`.
- **Impacto comprovado:** falha daquela requisição, HTTP 500; sem alteração
  de status, contorno de autorização ou modificação da lógica SQL observados.
  Não foi demonstrada indisponibilidade geral da aplicação.
- **Correção e evidência:** exigir `str` antes de verificar o enum; casos com
  array, objeto, `null`, booleano, número e status desconhecido retornam 400,
  sem criar estado de vocabulário indevido.

### SEC-JSON-002 — Valores incompatíveis com operações posteriores

- **Classificação:** falha confirmada de validação, com endurecimento adicional
  do limite JSON.
- **Arquivos/funções:** `services/common.py:body` e
  `services/aprendizagem.py:study_seconds`; antes da correção, as exceções
  apareciam em conversão de tempo e codificação UTF-8 da senha.
- **Entrada e causa:** o decoder aceitava números não finitos e escapes de
  surrogate isolado. Após respostas legítimas da aula, `timeSpentSeconds: NaN`
  chegava à conversão numérica; cadastro com senha contendo surrogate isolado
  chegava ao hash que exige UTF-8 válido. Ambos geravam HTTP 500.
- **Impacto comprovado:** rejeição inadequada das requisições; não foi
  confirmado vazamento de SQL, senha ou dados de outra conta.
- **Correção e evidência:** `body()` verifica iterativamente chaves e valores,
  rejeita números não finitos, texto sem codificação UTF-8 válida e profundidade
  superior a 64, e trata `RecursionError` do parser com erro 400. O domínio
  também exige tempo finito. Números legítimos, acentos, emoji e apóstrofos
  continuam aceitos. A profundidade é proteção preventiva adicional; não é
  apresentada como exploração de sobrecarga realizada no baseline.

### SEC-FS-003 — Permissões de novas criações SQLite

- **Classificação:** problema de configuração/padrão de criação confirmado
  em arquivos sintéticos; exposição efetiva de dados reais não demonstrada.
- **Arquivos/funções:** `app.py:create_app`, `sqlite_private_creation` e
  `models/migration.py:initialize_database`, `import_legacy`.
- **Condição:** umask permissiva e acesso de outro usuário local aos diretórios
  ancestrais poderiam permitir leitura do banco `0644`. SQLite não tem contas
  SQL com `GRANT`; a proteção depende de usuário do processo, permissões e ACLs
  do sistema operacional.
- **Evidência mínima:** criação temporária sob `umask 022` mostrou os modos
  `0644`/`0755` antes da correção. O diretório temporário ancestral já era
  privado, portanto o teste não comprova que outra pessoa conseguiu ler dados.
- **Correção e limite:** novos arquivos SQLite ordinários são precriados com
  exclusividade (`O_EXCL`) e modo `0600` antes da conexão SQLAlchemy. Novos
  diretórios finais e `instance` usam `0700`. Arquivos/diretórios existentes
  não são sobrescritos nem recebem `chmod` automático. A correção não assegura
  permissões de todos os ancestrais, ACLs, backups ou URIs SQLite especiais.

### SEC-FS-004 — Corrida na importação de banco legado

- **Classificação:** falha confirmada de integridade de arquivos em operação
  local de manutenção; não é SQL Injection nem endpoint remoto.
- **Arquivo/função:** `models/migration.py:import_legacy`, chamado pelo CLI
  `import-legacy`.
- **Entrada e causa:** a verificação `destination.exists()` era separada da
  criação por `sqlite3.connect`. Outro processo podia criar esse destino no
  intervalo; o backup então sobrescrevia o banco recém-criado. Na rota de
  erro, a limpeza removia o destino existente sem verificar se a execução o
  havia criado.
- **Condições e gravidade:** exige execução local do comando de importação e
  criação concorrente no mesmo caminho. Gravidade MÉDIA pelo risco de perda
  de integridade/disponibilidade do destino, sem evidência de ataque HTTP,
  execução SQL arbitrária ou acesso a dados reais.
- **Evidência mínima:** teste isolado simulou a criação de outro SQLite com
  marcador artificial após a verificação inicial; o baseline sobrescreveu o
  marcador. Nenhum banco de usuário foi usado. A regressão de falha também
  verifica que um destino não adquirido pela execução é preservado.
- **Correção e comprovação:** adquirir o destino com `O_CREAT | O_EXCL`, modo
  `0600`, antes do backup. Um destino concorrente provoca `FileExistsError`
  sem alteração; limpeza só é habilitada após a criação exclusiva pela
  operação. Os três testes de `test_import_atomicity.py` verificam disputa de
  destino, falha de origem sem exclusão de arquivo alheio e modo privado antes
  da primeira conexão de backup, com hash da origem preservado.

## 5. Testes executados

| Teste controlado | Resultado esperado | Resultado obtido e evidência | Limitações |
| --- | --- | --- | --- |
| Fronteira de auditoria | Só banco temporário, sem configuração externa ou rede; CSRF ativo | 2 testes passaram em `test_audit_boundary.py`; contas A/B distintas e mutação sem CSRF retorna 400 | Flask test client não testa TLS, proxy ou rede de uma implantação |
| Login e reset: booleano verdadeiro/falso, comentário, UNION e SELECT empilhado | Valores não alteram a consulta, não autenticam e não criam token para conta inexistente | 401 no login, 202 genérico no reset, conta nula; valores observados como bindings, IDs de usuários preservados; `test_login_and_reset_email_payloads_are_bound_not_executed` | Apenas contas sintéticas; nenhum token é extraído |
| Nome com apóstrofo e nome semelhante a SQL | Cadastro e login legítimos preservam o texto literal | Nome persistido literalmente, um usuário criado e login correspondente bem-sucedido; `test_registration_preserves_literal_names_without_breaking_authentication` | Aceitar apóstrofo não indica SQLi; não se proíbe texto por parecer SQL |
| E-mail semelhante a SQL registrado como conta própria | Autenticar somente essa conta e somente com sua senha | Senha incorreta rejeitada; senha correta autentica o novo ID literal; contas A/B preservadas | O validador aceita essa forma de e-mail; isso não o transforma em expressão SQL |
| Senha semelhante a SQL | Não contornar scrypt nem entrar na consulta | 401; senha ausente dos templates e bindings; `test_sql_like_password_cannot_bypass_the_known_accounts_hash` | Não houve brute force ou recuperação de hash |
| IDs com booleanos, UNION e SELECT empilhado | Não selecionar nem modificar outra conta | 48 combinações de payload/endpoint retornam 404; recursos B e contagens preservados; sete operações consultam ID como binding e cinco resolvem catálogo antes do SQL | São 48 requisições internas a quatro casos parametrizados, não 48 testes pytest adicionais |
| Resposta e chave de idempotência armazenadas e relidas | SQLi de segunda ordem não ocorrer; repetição não duplicar tentativa | Resposta/chave literais, uma tentativa, replay idêntico e progresso/revisões relidos; estado da outra conta vazio | Cobre os caminhos exercitados de replay e leitura, não qualquer futuro consumidor desses dados |
| Mensagem armazenada, repetida, relida e conversa encerrada | Texto não virar SQL em operações posteriores | Texto literal; três mensagens com replay sem duplicação; outra conta não lista nem abre a conversa; encerramento preserva contagem esperada | IA mock; prompt injection e fornecedor externo fora desta verificação |
| Query strings de usuário/filtro/ordenação não suportados | Não escolher usuário, coluna ou SQL | Respostas iguais às originais e valores ausentes de templates/bindings; `test_unsupported_query_filters_and_sorting_do_not_reach_sql` | Não há busca/ordenação SQL pública configurável nesses endpoints |
| Expressão de atraso com sentinel SQLite | Entrada não executar função SQL | Controle positivo `SELECT audit_delay()` executa uma vez; payloads no e-mail e ID executam zero vezes; 401/404 e bindings confirmados | Sentinel não dorme. Não é medição de latência nem prova sobre `SLEEP`, `pg_sleep`, outros SGBDs ou outras superfícies |
| Isolamento A/B de conversas e revisões | Todos os métodos recusam ID real de outra conta | GET/envio/encerramento/exclusão de conversa e sessão/resposta/conclusão de revisão retornam 404; estado do dono preservado | IDOR testada adicionalmente à SQLi; não demonstra segurança de todo recurso futuro |
| Conta anônima e mass assignment | Sem recursos privados ou privilégios controlados pelo cliente | 401 para recursos protegidos; campos `userId`, `role`, nível e dados privilegiados não transferem propriedade ou privilégios | Papel administrativo não tem interface de SQL livre examinada |
| CSRF, cookie, conta da página e logout | Não aceitar sessão adulterada, CSRF de outra sessão ou troca de identidade por header; revogar cookie copiado | `test_session_boundary.py`: CSRF de outra sessão retorna 400, header de outro usuário/semelhante a SQL retorna 401, cookie com assinatura alterada retorna 401, logout revoga cópia e preserva a outra conta; reset existente/ausente tem mesma resposta 202 | Verifica assinatura, vínculo e revogação; resposta de reset igual não é prova de ausência de canal temporal de enumeração |
| Tipos de perfil, preferências, reset, tópico e texto | 400 sem gravação indevida | Casos malformados retornam validação; envio de chat mantém zero turnos de usuário | Não é fuzzing exaustivo de todas as combinações |
| Erro de banco induzido em teste | 500 genérico sem SQL, stack ou segredo | `OperationalError` sintético; resposta sem SQL/coluna/traceback/classe e log sem parâmetros/sentinel; `test_database_exception_response_and_logs_do_not_disclose_details` | Falha simulada verificável; não foi causada uma falha em banco real |
| JSON não finito, Unicode inválido e profundidade | 400, preferências inalteradas; dados válidos aceitos | 10 casos passaram em `test_json_boundary.py`, incluindo profundidades 65 e 1100 abaixo de 16 KiB | Casos finitos; não houve teste de carga nem esgotamento de recursos |
| SQLite novo, existente e URI | Privacidade nas criações ordinárias, preservação do existente e sem arquivos literais indevidos | Novos arquivo/diretório `0600`/`0700`; existente mantém inode, permissões e versão de sessão; quatro testes adicionais confirmam conexão direta, memória comum/nativa e URI somente leitura sem criação de arquivo | Modos POSIX no ambiente Linux; ACLs Windows e implantação não auditadas |
| Importação e destino concorrente | Não sobrescrever/excluir destino não adquirido; novo arquivo privado desde o primeiro backup | Baseline reproduziu sobrescrita de marcador sintético; três regressões de `test_import_atomicity.py` passaram e verificam preservação, recusa, modo antes do backup e hash da origem | Corrida simulada deterministicamente em arquivos temporários; operação CLI local, não exploração remota |

A suíte SQLi de `tests/security/test_sql_injection.py` contém 16 testes pytest.
Os payloads incluem aspas simples, comentários, expressões booleanas opostas,
UNION e statements empilhados apenas de leitura (`SELECT` com constantes).
Nenhum payload solicita exclusão, mudança de schema, extração de registros
reais ou consulta custosa. Entradas malformadas com strings, arrays, objetos e
escapes Unicode foram examinadas separadamente. Não se deve extrapolar isso
para todas as codificações, encodings ou famílias de injeção existentes.

SQLite não oferece por padrão as funções de atraso de PostgreSQL/MySQL.
Por isso o teste temporal solicitado é limitado à verificação instrumental
de não execução da expressão no SQLite; uma conclusão sobre blind SQLi
temporal em outro banco permanece fora do escopo.

## 6. Correções aplicadas

- `services/vocabulario.py`: verificar tipo textual antes do enum em
  `set_status`, convertendo entradas malformadas em erro de validação.
- `services/aprendizagem.py`: exigir tempo finito em `study_seconds`, inclusive
  para chamadas diretas do serviço. A nota, o conjunto de exercícios e as
  demais regras pedagógicas não foram alterados.
- `services/common.py`: validar o objeto JSON antes de hash, bind SQL ou
  outra codificação; rejeitar números não finitos e Unicode inválido;
  limitar profundidade a 64 e tratar recursão do parser.
- `app.py`: criar `instance` privado quando novo e aplicar precriação
  exclusiva `0600` aos novos arquivos SQLite ordinários na conexão do Engine.
  SQLite em memória e URI nativa mantêm sua semântica.
- `models/migration.py`: usar modo `0700` ao criar o diretório final de
  inicialização de banco ordinário, sem interpretar URI SQLite como arquivo
  literal e sem alterar permissões de arquivos existentes. Na importação,
  reservar o destino atomicamente com `O_EXCL` e `0600` antes do backup e
  distinguir o destino criado pela operação na limpeza de falhas.
- `tests/security/`: fixture isolada e regressões de SQLi, propriedade,
  validação, erros, preservação de dados e criação de arquivos.

Não foi necessário substituir consultas vulneráveis por prepared statements:
nenhuma consulta HTTP com SQLi foi identificada, e os bindings ORM existentes
foram preservados. Validação adicional complementa a parametrização; não a
substitui. Nenhuma dependência foi adicionada para estas correções.

## 7. Testes de regressão

Antes das correções, quatro reproduções de entrada malformada falharam na
aplicação: dois status de vocabulário (`[]` e `{}`), tempo `NaN` após respostas
legítimas de aula e senha com surrogate isolado. O comportamento observado
era HTTP 500, enquanto o esperado era HTTP 400. Não houve SQLi nesses casos.
O teste de permissões também identificou os modos padrão `0644`/`0755` sob
`umask 022`; não se contabiliza isso como exploração de leitura real.
Separadamente, a reprodução da corrida de importação confirmou sobrescrita
de um destino concorrente sintético antes da correção, sem alterar a origem.

Resultados já executados após as correções:

| Conjunto | Resultado verificado |
| --- | --- |
| Fronteira isolada | 2 passaram |
| SQLi e bindings | 16 passaram |
| Autorização, tipos, erros e permissões | 32 passaram |
| Limite JSON | 10 passaram |
| Conexão SQLite direta, memória e URI | 4 passaram |
| Importação exclusiva e preservação da origem | 3 passaram |
| Fronteira de sessão, CSRF e revogação | 5 passaram |
| Total dos novos testes de auditoria | **72 passaram** |
| Suíte completa, incluindo os 158 testes anteriores | **230 passaram: 215 sem navegador e 15 no Chromium, sem falhas ou skips, em 130,94 s** |

A execução completa ocorreu depois das correções e da formatação. Os 158
testes anteriores foram executados novamente nesta branch; a contagem não
reaproveita uma aprovação histórica do PR de migração. O log final local é
`/tmp/language-tool-security-audit-final.log`; não contém dumps de banco nem
captura de parâmetros SQL.

A comparação com `b77e724` confirma que `apps/`, `packages/`, `e2e/` e os
arquivos de dependências não foram alterados. As mudanças funcionais ficam em
cinco arquivos Python listados na seção 6; UI e regras pedagógicas permanecem
preservadas.

Comando executado para a suíte completa:

```bash
CHROMIUM_EXECUTABLE=/usr/bin/chromium .venv/bin/python -m pytest -q
```

Para repetir a auditoria isolada com as dependências já instaladas:

```bash
.venv/bin/python -m pytest tests/security -q
```

Os testes Flask exercitam cadastro, login, perfil, preferências, aulas,
progresso, vocabulário, revisões e conversa legítimos junto com as regressões.
Os testes de navegador usam Chromium local e dados artificiais; não foi
adicionada uma bateria de ataque a navegador de produção.
A captura SQL não deve ser convertida em dump ou log de parâmetros de uma
instância real. As fixtures de auditoria fazem parte do controle de escopo,
não devem ser removidas para apontar esses testes a um banco de produção.

## 8. Vulnerabilidades pendentes

Não permanece SQL Injection confirmada pendente na aplicação Python dentro
das superfícies exercitadas. Permanecem decisões operacionais e limitações:

| Item | Classificação e evidência | Próxima ação |
| --- | --- | --- |
| Permissões de bancos/diretórios já existentes | Configuração não auditada: a correção preserva permissões preexistentes por decisão explícita; regressão confirma essa preservação | Operador revisar dono, modos, ancestrais, ACLs e backups antes de implantação, sem divulgar dados |
| SQLite URI e outros SGBDs | Fora da garantia da precriação ordinária e dos testes ativos de outros bancos | Validar a configuração concreta em homologação; conceder apenas privilégios necessários se usar SGBD com contas |
| Infraestrutura pública | TLS, proxy, rede, credenciais implantadas e armazenamento real fora do escopo | Auditoria de implantação separada com autorização e dados artificiais |
| Dependências | Inventariadas, sem análise completa de advisories/CVEs nesta auditoria | Manter atualização e verificação de dependências no processo de entrega |

O backend Express preservado tem riscos separados, examinados por leitura
estática nesta auditoria. As falhas de logout, recriação de mensagens e
estatísticas também constam do diagnóstico de migração. Não houve nova
exploração ativa do legado neste trabalho; esses riscos não são SQLi:

| ID | Código legado e risco | Estado neste trabalho |
| --- | --- | --- |
| LEG-01 | `apps/api/src/http/routes/authRoutes.ts`: logout só remove cookie; JWT copiado continua aceito até expirar ou mudar `session_version` | Não corrigido no legado; Python revoga a versão de sessão |
| LEG-02 | `packages/core/src/application/services/conversationService.ts:send`: ausência do bloqueio equivalente a conteúdo já apagado permite recriação de mensagens | Não corrigido no legado; Python aplica bloqueio de conversa apagada/expirada |
| LEG-03 | `apps/api/src/http/app.ts`: `trust proxy = 1` depende da topologia; acesso direto ao Express pode aceitar IP encaminhado que altere rate limiting | Risco condicional de configuração, sem tentativa ativa de bypass; não se conclui que a implantação esteja exposta |
| LEG-04 | `packages/core/src/application/services/reviewService.ts:complete`: estatísticas `correct`/`total` são fornecidas pelo cliente | Não corrigido no legado; Python calcula resultado das tentativas autorizadas |

Essas limitações tornam relevante retirar o backend legado da implantação
ativa ou auditá-lo em tarefa própria caso ainda seja usado. Os controles da
versão Python não corrigem automaticamente arquivos TypeScript preservados.

## 9. Avaliação final

**C. Nenhuma SQL Injection identificada nos testes realizados.**

O sistema usa SQLite e as consultas HTTP examinadas preservam valores como
parâmetros. Nos testes com contas artificiais, entradas booleanas, UNION,
comentários e SELECT empilhado não contornaram login, não alteraram templates
SQL e não acessaram recursos de outra conta. Respostas e mensagens armazenadas
continuaram dados em replays e leituras posteriores. O controle instrumental
SQLite não executou a expressão fornecida por entrada.

Foram identificadas e corrigidas três falhas BAIXAS de validação/permissões e
uma falha MÉDIA de integridade na importação local. Elas não são evidência de
SQLi. A ausência de SQLi observada não declara o sistema totalmente seguro:
o resultado é limitado à versão, aos caminhos, ao banco e aos casos executados
neste relatório.
Serviços externos, dados reais, outros SGBDs, infraestrutura implantada,
ataques de força bruta, exploração destrutiva e técnicas não exercitadas
permanecem fora do escopo.

## 10. Recomendações futuras

1. Executar `tests/security` em cada alteração de persistência/autorização e
   manter a suíte de fluxos legítimos. Integrar ao CI com a mesma fronteira
   temporária e sem segredos de produção.
2. Preservar bindings ORM/prepared statements; permitir novos nomes de
   coluna/ordenação apenas por mapeamento explícito de identificadores
   definidos no código. Proibir entrada HTTP em `text`/SQL interpolado.
3. Revisar permissões do banco existente, diretórios, ACLs e backups com o
   usuário de serviço da implantação. SQLite deve ficar fora de diretórios
   públicos/estáticos e acessível apenas ao processo e aos operadores
   necessários. Executar importações em diretório controlado por esse usuário.
4. Validar separadamente qualquer mudança para PostgreSQL/MySQL, inclusive
   privilégios mínimos, migrações e técnicas temporais específicas, sempre
   com dados artificiais e limites de execução.
5. Antes de publicar, revisar HTTPS, cookies seguros, segredo persistente,
   políticas de rede, retenção e topologia de proxy. Não transportar a fixture
   com rate limiting desativado para configuração de produção.
6. Manter logs sem SQL/valores/credenciais, com identificadores de correlação
   não sensíveis para diagnóstico; adicionar observação de falhas sem revelar
   conteúdo privado.
7. Desativar a exposição do backend legado ou tratar seus riscos em revisão
   independente caso continue necessário. Manter as conclusões do legado
   separadas das da aplicação Python.
8. Atualizar dependências com verificação de advisories e regressões; ampliar
   o corpus de entradas quando surgirem novas buscas, filtros ou endpoints.
