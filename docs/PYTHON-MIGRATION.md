# Migração incremental para Python

## Ponto de restauração e política

Versão inicial: `067fd0681dcb36e4d0c76fea618d2cf89c9ab39a`.
Tag de restauração: `python-migration-baseline-067fd06`.
Branch original da migração: `codex/python-flask-migration`, incorporada pelo
[PR #4](https://github.com/Helio965/language-tool/pull/4). As auditorias
[PR #5](https://github.com/Helio965/language-tool/pull/5) e
[PR #6](https://github.com/Helio965/language-tool/pull/6) também estão na `main`.

As migrações de dados são aditivas. A aplicação Python roda pela raiz, sem
comando npm. A consolidação remove o código TypeScript e as cópias documentais
redundantes do checkout atual; os originais continuam na
[tag de migração](https://github.com/Helio965/language-tool/tree/python-migration-baseline-067fd06).
A tag `python-cleanup-baseline-9a2d11b` preserva a versão Python com as correções
de segurança imediatamente anterior à limpeza. O inventário e a validação dessa
etapa ficam em [CODE-CLEANUP-AUDIT.md](CODE-CLEANUP-AUDIT.md).

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
| E2E Node Playwright | `tests/browser/`, Playwright Python com aplicação Flask real |

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
Consulte o [README original na tag](https://github.com/Helio965/language-tool/blob/python-migration-baseline-067fd06/README.md)
ou crie um checkout isolado, sem alterar a branch de trabalho:

```bash
git worktree add --detach ../english-ai-baseline python-migration-baseline-067fd06
```

Os comandos Node históricos são executados a partir desse checkout. Os links
dos documentos preservados na tag usam sua localização original e as capturas
permanecem em `design/screenshots/`. Não use `reset --hard` para descartar trabalho
não salvo. A tag identifica o código; o backup identifica os
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

As revisões atuais são `0001_legacy_schema` (criação/adoção),
`0002_integrity_metadata` (passagens/resultados/metadata) e
`0003_conversation_idempotency` (recuperação de envio do chat após perda da
resposta HTTP), além de `0004_conversation_claim` (reserva curta por conversa
antes de chamar a IA). A terceira revisão acrescenta campos/índice à tabela de
mensagens; a quarta acrescenta `pending_request_nonce` e
`pending_request_expires_at`, campos privados de reserva. Não há tabela nova
nem mudança das colunas originais. As quatro revisões existentes são preservadas
na limpeza.

## Limites de compatibilidade e revisão

- O demo anterior ficava só naquele navegador: a migração SQLite não importa
  automaticamente esse `localStorage` nem suas sessões.
- Conteúdo acima do nível continua sinalizado, sem inventar bloqueio de
  progressão não exigido nos materiais.
- Lembretes, voz, áudio, painel administrativo, Figma e infraestrutura PostgreSQL
  real permanecem conforme o escopo acadêmico/roadmap.
- Anthropic e SMTP só têm verificação real quando suas credenciais estiverem
  configuradas e a chamada/entrega tiverem sido executadas.
- As etapas, commits e resultados da migração incorporada pelo
  [PR #4](https://github.com/Helio965/language-tool/pull/4) estão no
  [relatório histórico de auditoria](MIGRATION-AUDIT.md). As correções de
  segurança posteriores também foram incorporadas; sua evidência está em
  [docs/security](security/ADVANCED_SECURITY_AUDIT.md).
