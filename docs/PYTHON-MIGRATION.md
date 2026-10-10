# Migração incremental para Python

## Ponto de restauração e política

Versão inicial: `067fd0681dcb36e4d0c76fea618d2cf89c9ab39a`.
Tag de restauração: `python-migration-baseline-067fd06`.
Branch de trabalho: `codex/python-flask-migration`.

Não se aplica migração destrutiva na `main`. O código TypeScript permanece
disponível durante e após as validações para comparação e restauração.
Os commits devem separar estratégia, banco, autenticação, aprendizagem, IA,
interface e validação/documentação. A aplicação Python roda pela raiz, sem
comando npm; o legado tem dependências e comandos próprios.

## Correspondência de responsabilidades

| Implementação anterior | Implementação Python |
| --- | --- |
| `apps/api/src/server.ts`, `http/app.ts` | `app.py` com `create_app` e servidor local |
| `apps/api/src/config/env.ts` | `config.py` com ambientes e validação |
| `apps/api/src/db`, repositório SQLite | `extensions.py`, `models/`, `database/`, `migrations/` |
| `core/application/services/*` | `services/` — regras, validação e transações |
| `core/content/*` | catálogo preservado em `content/catalog.json` / `content/catalog.py` |
| `core/ai/*`, `api/ai/*` | `ai/` — provedor, prompts, política e demonstração |
| `apps/api/src/http/routes/*` | `blueprints/` — rotas por contexto |
| `apps/web/src/features`, layouts, componentes | `templates/` com Jinja e macros |
| `apps/web/src/styles`, fontes | `static/css`, `static/fonts` |
| React/query/session browser | requisições HTML/JSON com sessão Flask; `static/js` só para interação |
| testes core/API/web | `tests/` com pytest e SQLite real temporário |
| E2E Node Playwright | testes Python de navegador quando disponíveis |

O protocolo principal continua oferecendo páginas em português e contratos JSON
sob `/api`. Compatibilidade de nomes de rota/JSON deve ser verificada; não se
presume que cookies JWT Express ou o banco `localStorage` do demo sejam sessões
Flask. Contas persistidas no SQLite devem manter identificadores e hashes.

## Dados e migração segura

O banco original contém **14 tabelas**: `users`, `password_reset_tokens`,
`learning_profiles`, `preferences`, `lessons`, `exercises`, `vocabulary`,
`lesson_vocabulary`, `exercise_attempts`, `user_vocabulary`, `progress`, `reviews`,
`conversations`, `messages`. Nenhuma delas é descartada para simplificar arquivos.

O modelo preserva nomes/PK/FK e dados existentes. Campos adicionais suportam
passagens de aprendizagem, idempotência, resultados persistidos e identificação
da origem da resposta de IA. Alembic versiona essa evolução. Senhas scrypt do
Node devem ser verificáveis no Python sem pedir troca global; o demo PBKDF2 do navegador fica fora da importação SQLite, sem alegar suporte
a essa migração automática. Senhas não são exportadas em texto.

Contas antigas sem a linha individual de perfil/preferências recebem os padrões
ausentes ao entrar, preservando valores já existentes e seguindo para a etapa
pendente. Isso acrescenta relações faltantes; não altera o identificador/hash da
conta. Mensagens antigas com a mesma data mantêm sua ordem de inserção SQLite.

Antes de migrar banco existente:

1. Pare o servidor que escreve nesse arquivo.
2. Faça backup com a API SQLite (inclui dados em WAL), para um arquivo separado.
3. Execute `PRAGMA integrity_check` e `PRAGMA foreign_key_check` na cópia.
4. Registre contagem e hash canônico das linhas das 14 tabelas, com ordenação
   por chave primária e serialização determinística; não publique dados privados.
5. Aplique a migração na cópia com o comando documentado no README.
6. Compare colunas originais, hashes, PK/FK e contagens. Novas colunas têm valores
   próprios; não devem alterar o conteúdo antigo. Verifique login com hash legado.
   O seed acrescenta somente IDs/associações ausentes e não sobrescreve linhas
   existentes. Se o banco contém conteúdo personalizado, esse cache é preservado;
   o catálogo de `content/` continua sendo a fonte pedagógica em execução. A
   migração não implementa um editor nem execução de conteúdo personalizado.
   Em um catálogo incompleto, registre separadamente as inserções esperadas e
   compare o hash das linhas originais pelo conjunto de PKs anterior.
7. Somente use a cópia migrada após testes. Preserve o original e o manifesto.

Não se deve copiar só o arquivo `.db` enquanto um servidor mantém WAL aberto.
Não execute `create_all`, `init-db` destrutivo, seed que substitua linhas ou
`alembic stamp` às cegas sobre banco incompatível.

## Retorno à implementação anterior

Para testar uma restauração, preserve primeiro a branch e os commits de trabalho.
Em checkout isolado autorizado ou após salvar alterações, selecione a tag de
baseline e siga [legacy/README.md](legacy/README.md). Não use `reset --hard` para
descartar trabalho não salvo. A tag identifica o código; o backup identifica os
dados. Restaure a cópia SQLite íntegra e configure o caminho esperado pela API
legada. Novas sessões Flask não são cookies JWT antigos: o login deve ser refeito.

Se a migração interromper, pare os escritores e confira integridade, revisão
Alembic e colunas presentes antes de retomar. Uma falha não autoriza reinicializar
o banco. Use o backup preservado se o arquivo não puder ser recuperado. Dados
gravados depois da migração precisam de exportação/reconciliação antes do retorno;
restaurar backup antigo perde essas gravações, portanto a reversão operacional
exige essa conferência. As revisões recusam downgrade destrutivo; a recuperação é importar o backup
original validado para um destino novo. Campos aditivos já aplicados são
reconhecidos ao retomar `db upgrade`; confira o estado antes de repetir.

As revisões finais são `0001_legacy_schema` (criação/adoção),
`0002_integrity_metadata` (passagens/resultados/metadata) e
`0003_conversation_idempotency` (recuperação de envio do chat após perda da
resposta HTTP). A terceira revisão acrescenta campos/índice à tabela de
mensagens, sem tabela nova nem mudança das colunas originais.

## Limites de compatibilidade e revisão

- O demo anterior ficava só naquele navegador: a migração SQLite não importa
  automaticamente esse `localStorage` nem suas sessões.
- Conteúdo acima do nível continua sinalizado, sem inventar bloqueio de
  progressão não exigido nos materiais.
- Lembretes, voz, áudio, painel administrativo, Figma e infraestrutura PostgreSQL
  real permanecem conforme o escopo acadêmico/roadmap.
- Anthropic e SMTP só têm verificação real quando suas credenciais estiverem
  configuradas e a chamada/entrega tiverem sido executadas.
- Branch e commits devem ser publicados com Pull Request; merge da `main`
  depende de autorização. As etapas/commits realizados estão no
  [relatório de auditoria](MIGRATION-AUDIT.md); a URL do PR será registrada
  após sua criação.
