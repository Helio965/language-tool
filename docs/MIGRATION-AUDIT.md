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
| Média | `conversationService.send` grava duas mensagens e os metadados em operações distintas | Falha entre gravações pode deixar turno parcial; persistir turno e contexto na mesma transação |
| Média | `conversationService.send` carrega contador/contexto antes da chamada externa | Mensagens concorrentes podem competir; serializar turnos e proteger repetição |
| Média | Cada `learning.answer` adiciona uma nova tentativa; não há chave de idempotência | Reenvio por falha de rede pode duplicar registro; vincular passagem e chave de operação |
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

Os resultados da suíte Python, da migração de dados e do navegador serão
registrados aqui somente após execução. IA real, entrega SMTP, execução Windows
e disponibilidade no GitHub exigem evidências próprias; implementação do
adaptador ou configuração documentada não equivalem a essa verificação.
