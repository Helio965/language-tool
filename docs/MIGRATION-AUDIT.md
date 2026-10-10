# Auditoria técnica e relatório de migração — English AI

## Fontes e estado inicial

Baseline: `067fd0681dcb36e4d0c76fea618d2cf89c9ab39a`, preservado pela tag
`python-migration-baseline-067fd06`. A implementação migra na branch
`codex/python-flask-migration`. O projeto original continua em `apps/`, `packages/`
e `e2e/`; sua documentação técnica está preservada em [legacy/](legacy/README.md).

Foram examinados `apps/web` (telas, componentes, CSS, clientes demo/http e sessão),
`apps/api` (rotas, autenticação, configuração, e-mail e SQLite), `packages/core`
(domínio, conteúdo, IA e serviços), `docs`, `design`, `e2e`, manifests, lockfile,
`.env.example`, README e o esquema SQLite completo. O baseline possui 14 tabelas,
12 aulas, 65 exercícios de aula, 67 palavras, 12 perguntas de nivelamento e oito
assuntos de conversa. O catálogo e suas respostas revisadas são material próprio
do English AI e devem ser preservados.

Os DOCX/PDF acadêmicos citados no prompt mestre não estão disponíveis neste
checkout/anexo. A base acessível é a consolidação F1–F4 em
[MVP-SCOPE.md](MVP-SCOPE.md), os RF01–RF20, RNF01–RNF10, RN01–RN08 e UC01–UC12
já registrados. Isso permite preservar as decisões documentadas; não permite
afirmar uma nova conferência direta dos originais. Se esses arquivos forem
fornecidos, divergências devem ser registradas sem substituir silenciosamente
os requisitos.

## Diagnóstico comprovado e riscos

Uma arquitetura com núcleo compartilhado, React e Express não constitui por si
um defeito. O núcleo TypeScript efetivamente reutiliza regras entre demo e API.
A decisão de substituí-lo por Python atende à solicitação de execução simples
com Flask/Jinja e elimina a necessidade de Node na aplicação principal.

| Gravidade | Evidência no baseline | Consequência / tratamento na migração |
| --- | --- | --- |
| Alta | `core/application/services/reviewService.ts` aceita `correct`/`total` informados pelo cliente em `complete` | Estatística de revisão pode divergir das respostas; calcular resultado no servidor com tentativas vinculadas à passagem |
| Alta | `reviewService.answer` verifica dono da revisão, mas não a pertença do exercício à sessão | Exercício externo pode ser registrado como parte da revisão; validar conjunto de exercícios autorizado |
| Alta | A reprodução no baseline conclui aula com zero respostas | Conclusão pode liberar conteúdo e vocabulário sem atividades; exigir passagem completa e tentativas válidas |
| Alta | Modo Anthropic com fallback é identificado como provedor real na conta/saúde | Pode apresentar roteiro como resposta externa; separar metadata e retornar erro seguro quando o provedor selecionado falhar |
| Alta | Uma conversa com conteúdo apagado ainda aceita envio e recria mensagens no baseline | Preferência/exclusão deixa de corresponder aos dados; recusar escrita em conversa apagada/expirada |
| Média | `conversationService.send` grava duas mensagens e os metadados em operações distintas | Falha entre gravações pode deixar turno parcial; persistir turno e contexto na mesma transação |
| Média | `conversationService.send` carrega contador/contexto antes da chamada externa | Mensagens concorrentes podem competir; validar atualização otimista e proteger repetição |
| Média | Cada `learning.answer` adiciona uma nova tentativa; não há chave de idempotência | Reenvio por falha de rede pode duplicar registro; vincular passagem e chave de operação |
| Média | Conclusão repetida de aula soma minutos; conclusão repetida de revisão agenda novas revisões | Reenvio altera métricas/fila; persistir resultado e tornar conclusão idempotente |
| Média | Marcação automática de palavra aprendida usa total de tentativas, incluindo erros | Três erros podem contar como domínio da palavra; usar sequência de acertos, mantendo total separado |
| Média | Logout remove cookie; token JWT original segue válido até expirar ou mudar a versão da sessão | Cookie copiado não é revogado pelo logout; usar versão de sessão conferida no servidor |
| Baixa | `REQUIREMENTS-TRACEABILITY` contém resultados e caminhos apenas da versão TypeScript | Atualizar rastreabilidade para Python sem apresentar resultados antigos como novos |

**Não é um defeito confirmado:** a nota de aula do baseline já usa primeiras
tentativas persistidas, não `correct`/`total` enviados pelo navegador. A marcação
de conteúdo acima do nível é orientação pedagógica: a documentação não exige
bloquear toda aula avançada. Não se deve inventar um bloqueio obrigatório.

Riscos que requerem testes durante a implementação: dados antigos e formatos de
hash de senha; migração interrompida; expiração e uso único de redefinição;
atomicidade de gravação; repetição legítima versus reenvio; conta A/B em abas;
contexto e preferências da IA; retenção de histórico; contraste, foco e largura
pequena. Cada correção só é declarada validada após sua verificação correspondente.

## Funcionalidades existentes e lacunas anteriores

Operacionais no baseline: cadastro/login, configuração, nivelamento adaptativo,
aulas/exercícios, correções, vocabulário, revisão, progresso, conversas, perfil,
preferências, exclusão, boas-vindas e redefinição de senha. A validação anterior
no mesmo commit registrou 276 testes unitários/integração e 16 E2E aprovados;
esses números pertencem ao legado.

O modo **demo** anterior executa o núcleo no navegador e usa `localStorage`,
PBKDF2 e roteiros próprios. O modo **http** usa Express, SQLite, cookie e scrypt.
O adaptador Anthropic existe, porém não houve chamada real comprovada sem chave.
E-mails locais simulam entrega; não são envio SMTP real.

Lacunas já documentadas: lembretes salvos sem envio; pronúncia/voz fora do MVP;
administração sem telas; ausência de arquivo Figma; IA e SMTP externos sem teste
real; escala horizontal, auditoria com leitor de tela e Safari/Firefox não
comprovados. A migração não transforma esses itens em promessas de produção.

## Referência NEXO examinada

O clone `Helio965/Nexo-Faturamento-Inteligente` foi usado somente para leitura.
O código apresenta Flask App Factory, Blueprints, configuração central,
extensões inicializadas na factory, SQLAlchemy 2, Flask-Login, Flask-WTF,
Flask-Limiter, Jinja/static e Alembic. Há também Socket.IO, ETL, relatórios de
varejo, uploads e suporte, que não são requisitos do English AI.

Padrões aproveitáveis: separar criação do app, configuração, modelos e rotas;
reusar templates; ativar FK SQLite por conexão; enviar e-mail após commit com
falha segura; tratar IA opcional com resposta local identificada; manter
migrações versionadas e testes isolados.

O NEXO não é uma fonte de código a copiar. Sua recuperação usa token assinado
sem estado, registra link completo e deriva URL do Host; não invalida todas as
sessões na redefinição. Seu `BOOT_ID` também é específico de um processo. Esses
padrões não devem ser transportados. A documentação de referência contém
inconsistências de escopo (`.xls`, quantidade de modelos): a inspeção do código
prevalece sobre alegações de README. Nenhum arquivo do NEXO foi modificado.

## Entrega e evidências da versão Python

A organização, a transição e a recuperação estão em
[PYTHON-MIGRATION.md](PYTHON-MIGRATION.md). A rastreabilidade por requisito está em
[REQUIREMENTS-TRACEABILITY.md](REQUIREMENTS-TRACEABILITY.md).

### Módulos entregues

| Área | Implementação final | Preservação / correção |
| --- | --- | --- |
| Aplicação e HTTP | `app.py`, `config.py`, `extensions.py`, `blueprints/` | Factory, Jinja e contratos JSON; ambientes e erros seguros; execução principal sem Node |
| Conta e dados | `services/autenticacao.py`, `services/perfil.py`, `models/usuario.py` | Cadastro, login, perfil, preferências, reset uso único e exclusão; scrypt compatível e versão de sessão |
| Aprender | `services/nivelamento.py`, `aprendizagem.py`, `exercicios.py` | Nivelamento estimado, aulas/explicações, cinco tipos de exercício, nota no servidor e retomada |
| Vocabulário, revisão e progresso | `services/vocabulario.py`, `revisao.py`, `progresso.py` | Fila/motivo e conjunto autorizado; domínio por acertos; resultados e reagendamento idempotentes |
| Conversação e IA | `ai/`, `services/conversacao.py` | Lumi/contexto/política, SDK oficial configurável, metadata por resposta, turno atômico e histórico opcional |
| E-mail | `services/email.py` | Boas-vindas/reset após commit; outbox identificada e SMTP TLS configurável, falhas sem quebrar conta |
| Interface | `templates/`, `static/` | Papel, azul/coral, fontes e fluxos preservados; JS apenas para apresentação/requisições; ações ligadas ao backend |
| Banco e manutenção | `models/`, `migrations/`, `database/` | 14 tabelas, evolução aditiva, cópia SQLite, seed sem sobrescrita e limpeza de dados vencidos |
| Verificação e desenvolvimento | `tests/`, `.vscode/`, documentação atual | pytest/Playwright, tarefas/depuração e instalação Windows; requisitos rastreados |

O catálogo autoral mantém 12 aulas, 65 exercícios, 67 palavras, 12 questões e
oito temas. O legado permanece disponível para comparação. Não se criaram
serviços administrativos, voz/pronúncia automática, editor de conteúdo, Figma
ou certificação.

### Correções de consistência

Os resultados de aula/revisão são calculados sobre tentativas da passagem e
persistidos junto à conclusão. Conclusões vazias e exercícios fora da revisão
são recusados; chaves de idempotência e restrições evitam duplicação de reenvios.
Uma repetição intencional cria nova passagem. Erros não contam como domínio de
vocabulário; a sequência de acertos é separada do número de revisões.

No chat, respostas têm origem armazenada (`demo`, `live` ou `authored`). A
abertura autoral da aula não é chamada externa, e mudar a configuração do
provedor não altera a origem das mensagens já salvas. Falha de IA retorna erro
seguro sem fallback automático. Persistência do par de mensagens/contexto usa
uma transação; concorrência, exclusão e expiração não podem ressuscitar conteúdo.
Sem conteúdo disponível, o resumo não apresenta avaliação pedagógica inventada.

Perda da resposta HTTP depois do commit usa uma chave de envio reutilizada no
frontend. O backend devolve a dupla já gravada sem novo turno, nova chamada de
IA ou incremento do contador. Texto diferente com a mesma chave é recusado;
nova chave permite repetir uma frase intencionalmente. Solicitações realmente
simultâneas podem chamar o provedor antes da disputa otimista: só uma dupla é
gravada, mas não se garante cobrança única na concorrência. Exclusão/expiração
remove também o resultado privado usado na recuperação do envio.

Logout e redefinição invalidam cookies anteriores por versão de sessão. Os
dados pessoais têm dono e CSRF; a recuperação usa somente o hash de token com
TTL/uso único. A documentação distingue outbox de envio SMTP externo.

### Banco, evolução e retorno

`0001_legacy_schema` cria o esquema original ou adota um banco validado,
acrescentando `users.session_version` quando ausente. `0002_integrity_metadata`
adiciona passagem, chave/feedback de tentativa, associação com revisão,
resultados persistidos, sequência de acertos e metadata de IA.
`0003_conversation_idempotency` acrescenta chave/fingerprint/resultado do envio
às mensagens e índice único por conversa/chave/papel. Índices novos
protegem idempotência e revisão pendente única. São 14 tabelas de domínio mais
`alembic_version`; não há descarte/rebuild das tabelas antigas.

`import-legacy` recusa destino existente, copia com backup SQLite, valida
integridade/relacionamentos/JSON e evolui a cópia. O seed insere somente conteúdo
ausente, preservando os campos de todas as linhas originais; testes incluem
cache de conteúdo personalizado, contas, progresso, mensagens e hash scrypt.
O catálogo de `content/` é a fonte pedagógica em execução; preservar conteúdo
personalizado no banco não cria suporte à edição desse conteúdo.

O original não é sobrescrito. Migração incompleta requer inspeção de revisão e
colunas antes de retomar. Downgrade destrutivo é recusado; restauração usa o
backup original validado em destino novo e exige reconciliar gravações feitas
depois da migração. Sessões Flask/JWT não são intercambiáveis. Dados do demo
antigo em `localStorage` não são importados pelo procedimento SQLite.

### IA e integrações externas

`AI_PROVIDER=mock`/`demo` usa regras/roteiros locais identificados. Conversação,
escrita livre e novas explicações/exemplos podem usar o SDK Python da Anthropic
com `AI_PROVIDER=anthropic`, chave privada no servidor e modelo acessível à conta.
Exercícios fechados continuam usando gabaritos locais, sem chamada de IA.

O adaptador valida saída estruturada, contexto, trechos e limites; autenticação,
rate limit, timeout, rede e JSON inválido têm falha segura. Testes com transporte
controlado comprovam o contrato do SDK e o tratamento de erros, sem comprovar
qualidade, disponibilidade ou latência da API real. Outbox/SMTP falso também não
comprovam entrega externa. Configuração está em `.env.example`, README e nos
guias de IA/e-mail, sem credenciais no frontend ou no Git.

### Resultados executados

Instalação limpa executada no Linux cloud com o procedimento do README:
`python3.12 -m venv` em um destino temporário novo e
`python -m pip install -r requirements.txt`. Foram instalados os 45 pacotes
resolvidos; `python -m pip check` não encontrou conflito. O script local de
preparação Python também foi executado novamente com sucesso.

Nesse ambiente virtual novo, `python app.py` iniciou em `127.0.0.1:5000`.
`/`, `/entrar`, `/cadastro`, `/api/health` e `/api/auth/session` responderam 200
com asserções de conteúdo/configuração. A saúde consultou SQLite e mostrou
metadata demonstrativa; não realizou chamada paga. O processo de verificação
foi encerrado ao concluir.

Versões executadas: Python 3.12.14, Flask 3.1.3, SQLAlchemy 2.0.54,
Flask-Migrate 4.1.0, Alembic 1.20.0, Playwright 1.63.0 e Chromium 151.

**Execução final: 158 testes aprovados, zero falhas e zero testes ignorados**, em
109,58 segundos, com o ambiente virtual recém-instalado pelo README. A execução
usou `CHROMIUM_EXECUTABLE=/usr/bin/chromium` e `python -m pytest -q`.

| Grupo | Quantidade | Cobertura executada |
| --- | --- | --- |
| Python/API/serviços/SQLite | 143 | Conta/reset/sessão, CSRF/XSS/SQL injection, aprendizagem/nota/revisão, concorrência/rollback, privacidade/IA, manutenção e importação antiga |
| Navegador Chromium | 15 | 10 casos de jornadas/layout, quatro casos de falha de rede/preferências/transparência e um caso de resposta de chat perdida após commit |
| Total | 158 | Flask real e bancos SQLite temporários; sem Anthropic ou SMTP externos |

As jornadas de navegador incluem cadastro → perfil → nivelamento → aula;
retomada, resposta/correção → resultado → progresso após recarga; nota baixa →
revisão; palavra/status/filtro; conversa/feedback → histórico/desativação →
exclusão com senha; e link de redefinição da outbox com uso único e revogação de
sessão. Larguras 320/820/1440px foram verificadas no Chromium; aparelhos físicos
e navegadores diferentes não foram executados.

O importador CLI e o startup foram testados com todas as 14 tabelas populadas,
incluindo conteúdo personalizado: contagens e hashes das colunas originais
foram preservados, a origem ficou intacta e a senha scrypt continuou válida.
Migração parcial, JSON inválido, FK órfã, destino existente e defaults ausentes
têm verificações próprias. CLI real de manutenção: `db current` confirmou
`0003_conversation_idempotency` como head; `seed` e `purge-private-data`
concluíram com sucesso.

Após a formatação, a suíte completa foi executada novamente. Verificação de
nomes indefinidos Python (F821/F822/F823) e `git diff --check` passaram.
`apps/`, `packages/`, `e2e/` e seus manifests/lockfile permaneceram iguais ao
baseline. As cópias dos documentos legados foram comparadas byte a byte com o
baseline; o novo índice apenas explica sua localização. O checkout NEXO
permaneceu limpo.

Problemas conhecidos/limites: Anthropic real e entrega SMTP não foram executados
sem credenciais; Windows nativo, Safari/Firefox, aparelhos físicos, carga,
PostgreSQL e auditoria completa de acessibilidade continuam sem validação
própria. Scripts, adaptador ou guia não comprovam essas operações externas.

### Revisão no GitHub

Branch: `codex/python-flask-migration`; baseline: `067fd06`; tag:
`python-migration-baseline-067fd06`.

| Commit | Etapa |
| --- | --- |
| `5d7ff8a` | Diagnóstico comprovado e estratégia reversível |
| `1f53402` | Factory Flask, configuração e dependências Python reproduzíveis |
| `0255a05` | Persistência, três revisões Alembic, importação segura e autenticação/conta |
| `1980def` | Corpus, nivelamento, aprendizagem, revisão, vocabulário e progresso |
| `6249301` | SDK Anthropic, conversação privada e reenvio idempotente |
| `2044458` | Jinja/static, 15 casos de navegador e configuração VS Code |

Arquivos principais: `app.py`, `config.py`, `extensions.py`, `requirements.*`,
`.env.example`, `blueprints/`, `services/`, `models/`, `migrations/`, `database/`,
`content/`, `ai/`, `templates/`, `static/`, `tests/`, `.vscode/`, README,
`docs/` e `design/`. Documentação/legado têm revisão própria após os módulos.

O acesso GitHub e a permissão de publicação foram confirmados. A URL do Pull
Request será registrada após publicar a branch e criar a revisão.
Não há merge automático da `main`.
