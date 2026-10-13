# Auditoria, limpeza e consolidação — English AI

## Escopo e proteção

A limpeza parte da `main` `9a2d11b75a9c48aec49db195ea7b7454746cc333`, que já incorporou os PRs #4, #5 e #6. O CI dessa referência aprovou a [execução 38329372329](https://github.com/Helio965/language-tool/actions/runs/38329372329). A branch desta entrega é `refactor/python-legacy-cleanup`; nenhum merge automático foi realizado.

O baseline local foi executado nesta tarefa: **423 testes aprovados, 0 falhas/erros e 0 ignorados em 192,54 s**. Não se reutilizam números históricos como resultado atual. O histórico foi preservado, inclusive a tag `python-migration-baseline-067fd06`; a tag `python-cleanup-baseline-9a2d11b` aponta para o estado anterior à limpeza. Código antigo é recuperável por `git show <tag>:<caminho>`. Código versionado não substitui backup de banco.

Somente arquivos versionados comprovadamente substituídos foram removidos. Bancos existentes, `.env`, outboxes, dados pessoais, caches/arquivos ignorados não foram apagados nem utilizados nos testes. Os padrões de `.gitignore` continuam protegendo esses arquivos, mesmo quando diretórios locais antigos contêm artefatos ignorados.

## Inventário e método

Os **400 arquivos versionados do baseline** foram lidos/classificados, com tamanho/hash registrados em [CODE-CLEANUP-INVENTORY.csv](CODE-CLEANUP-INVENTORY.csv). Todos os **75 arquivos Python** foram analisados por AST, imports, definições e referências; módulos legados, docs/configs, templates/estilos/assets e seus consumidores tiveram investigação adicional. Binários/fontes/capturas foram identificados por metadata, licenças e referências, sem alegar revisão visual nova de cada captura. A ausência de import direto não foi usada como prova suficiente para excluir callbacks, fixtures, ORM, CLI ou dependências dinâmicas.

Classes: A ativo; B legado substituído; C duplicado; D obsoleto; E incerto; F histórico/recurso relevante; G recurso futuro. Itens incertos e funções sem prova suficiente de desuso foram preservados. Requisitos futuros permanecem nos documentos de escopo/roadmap e nos campos existentes; não são apresentados como implementados.

| Componente | Classe | Evidência | Substituto/ação | Risco tratado |
| --- | --- | --- | --- | --- |
| `apps/api/` (34 arquivos) | B/D; schema F | 40/40 rotas Express possuem método/caminho Flask; auth, hashes, storage, mail e SDK comparados | Remover 33; mover schema para fixture Python | Não perder importação/dados/hashes/migrations |
| `apps/web/` + `e2e/` (109) | B70/C31/D8 | Rotas/telas, módulos CSS, assets e jornadas atuais comparados | Retirar React/Vite/Node Playwright; preservar Jinja/static e ampliar regressões | Interatividade, privacidade, retry, foco e múltiplas abas |
| `packages/core/` (61) | B/D | Corpus completo e regras executados de modo independente | `content/`, `ai/`, `services/` e pytest | IDs, conteúdo e gabaritos preservados |
| Quatro manifests/configs raiz Node | D | CI, VS Code, Flask/CLI/migrações não invocam npm/build | Retirar `package.json`, lock, tsconfig e `.nvmrc` | Aposentar junto com consumidores |
| `docs/legacy/` (16) | C | 15 cópias exatas na tag; INDEX só localizava histórico | Remover cópias, usar links blob/tree da tag | Rastreabilidade e links atualizados |
| Templates/static/fontes/licenças | A/F | 28 CSS modules incorporados; tokens/global/favicon idênticos e fontes licenciadas presentes | Preservar | Design e responsividade |
| Migrations/importador/schema histórico | A/F | Upgrade, retomada, linhas/hashes/scrypt e ordem histórica testados | Preservar quatro migrations e importador; fixture SQL realocada | Sem downgrade/destruição de dados |
| Docs, requisitos, design, roadmap | F/G | Referências atuais e futuras conservadas | Atualizar 20 docs, preservar 28 capturas/decisões | Não apagar requisitos futuros |

O inventário enumera cada caminho do baseline, sua classificação, evidência, substituto, ação e risco. Os três novos módulos de testes e estes dois artefatos de auditoria são recursos ativos de validação/rastreabilidade.

## Equivalência e diferenças anteriores

A comparação executável do corpus confirmou igualdade profunda de **12 aulas, 65 exercícios autorais, 67 palavras, 12 questões de nivelamento, oito temas**, além de 67 exercícios de vocabulário e 12 temas derivados. Fingerprint canônico do conteúdo inteiro: `a4e670a45fd5a6ece207354b7396c864a14a62141882cf9c680c1a3d4854e84d`; whitespace/ordem de chaves não afetam o hash, mas IDs, ordem de listas, textos e respostas afetam. O novo [teste do catálogo](../tests/test_catalog_integrity.py) conserva essa referência independente e verifica integridade dos relacionamentos.

Também foram comparados 347 resultados de exercícios fechados, 126 estados de nivelamento, 21 exemplos gramaticais compartilhados, 48 decisões de correção, 20 requisitos de escrita e 28 valores de adaptação. Campos internos que não pertenciam ao DTO antigo foram distinguidos do contrato público.

Não se alega equivalência literal de comportamentos já alterados antes desta limpeza: Python tem 23 regras conservadoras, enquanto TS tinha 25; inferências ambíguas como bored/boring e pretend/intend foram retiradas intencionalmente. O demo Python é roteirizado e mais restrito; o protótipo offline com Alex/localStorage já estava fora do runtime Python. Anthropic falha explicitamente em vez de mascarar erro com fallback; notas/revisões usam tentativas autorizadas do servidor. JWT antigo exige relogin, mantendo compatibilidade de hashes scrypt. Essas diferenças são anteriores à limpeza e permanecem documentadas; não são perda causada por exclusão desta branch.

Agendamento periódico de retenção exige executar `flask --app app purge-private-data` pela infraestrutura, além da limpeza ao acessar. Não foi restaurado um timer Node dentro do servidor Flask.

## Correções necessárias

1. **Fixture de migração.** `apps/api/src/db/schema.sql` foi movido, sem alterar bytes, para [tests/fixtures/legacy-node-schema.sql](../tests/fixtures/legacy-node-schema.sql). Duas referências Python foram atualizadas. SHA256 antes/depois: `f1371544e09e218f7134d1aa29fae4844304638bfc1762e8d14ce73c4a4b9181`. Os 16 testes de migração/estado legado passaram após a realocação.
2. **Fuso sem base do sistema.** `ZoneInfo('America/Sao_Paulo')` falhava com `PYTHONTZPATH=''`. Adicionado apenas `tzdata==2026.5`; as 46 versões anteriores permanecem iguais. [Regressão de fallback](../tests/security/test_timezone_configuration.py) usa subprocesso/rede bloqueada e passou após reproduzir `ZoneInfoNotFoundError`. Isso não constitui teste nativo Windows.
3. **Retry do exercício.** Após HTTP503 e retry bem-sucedido, a mensagem anterior continuava visível. [learning.js](../static/js/learning.js) limpa o erro ao iniciar nova tentativa; a regressão comprova sucesso e persistência única.
4. **Foco da âncora inicial.** Ao abrir `/#seguranca`, o navegador devolvia foco ao body após o foco programático. [common.js](../static/js/common.js) aplica o foco inicial após load, conservando cliques/estilos.
5. **Imports e docs.** Removidos 18 imports comprovadamente sem uso; oito bindings de fixtures pytest foram preservados como reexports explícitos. Nenhuma função/modelo/controle de segurança foi removido por ausência de referências estáticas. Docs descrevem PRs já integrados, reserva 0004, Redis efetivo, nomes Python e links recuperáveis do histórico.

## Dependências e segurança

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Declarações Node diretas | 41 | 0 |
| Nomes Node diretos distintos | 38 (37 terceiros + core local) | 0 |
| Dependências Python diretas | 11 | 12 |
| Pins Python | 46 | 47 |
| Versões anteriores atualizadas | — | 0 |
| Node/npm externo exigido pela aplicação Python | 0 | 0 |

Todos os pins anteriores pertencem ao grafo necessário, incluindo SDK condicional, Redis selecionado por URI, Alembic/Mako, CSRF/WTForms e ferramentas de validação. Não foram removidos pacotes por falta de import direto. Playwright Python conserva seu driver Node interno distribuído no wheel; a aplicação e o desenvolvimento Python não exigem instalação externa de Node/npm nem manifests legados.

**pip-audit 2.9.0**, serviço PyPI, executado antes (46 pins) e depois (47): exit 0, zero pacotes ignorados, **zero advisories conhecidos encontrados**. `pip check` passou. Não se afirma segurança absoluta: essa consulta não inclui sistema operacional, servidor Redis, Chromium, Node transitivo removido ou infraestrutura.

## Comparativo e validação

| Indicador | Antes (baseline executado) | Depois (branch limpa executada) |
| --- | ---: | ---: |
| Arquivos versionados | 400 | 182 |
| TypeScript (`.ts`/`.tsx`) | 162 | 0 |
| Python (`.py`) | 75 | 78 |
| Declarações Node diretas | 41 | 0 |
| Dependências Python diretas | 11 | 12 |
| Node/npm externo exigido pelo runtime Python | 0 | 0 |
| Testes Python aprovados | 423 | 430 |
| Testes com falha/erro/ignorados | 0/0/0 | 0/0/0 |

Os 182 arquivos incluem três novos módulos de teste, o relatório e o inventário; **223 arquivos removidos**, um schema movido (100% dos bytes), cinco arquivos novos. Nenhum teste Python preexistente foi apagado. As sete regressões novas são duas do corpus, uma do fuso e quatro de navegador.

| Linguagem por extensão | Arquivos antes → depois | Bytes antes → depois |
| --- | ---: | ---: |
| TypeScript | 162 → 0 | 877374 → 0 |
| Python | 75 → 78 | 595463 → 608775 |
| JavaScript | 12 → 10 | 79191 → 76885 |
| CSS | 35 → 5 | 220623 → 117417 |
| HTML | 17 → 16 | 52529 → 51960 |
| JSON | 14 → 4 | 306321 → 141593 |
| SQL | 1 → 1 | 8141 → 8141 |
| YAML | 1 → 1 | 2265 → 2265 |

Todas as fontes, licenças, templates, corpus, models, seed e migrations preservados tiveram hashes comparados antes/depois; são idênticos. Somente os dois módulos JavaScript com correções descritas acima mudaram entre os assets ativos. Markdown/CSV e imagens/fontes não entram na tabela de bytes de código acima; seu inventário individual permanece disponível.

| Execução nesta tarefa | Resultado |
| --- | --- |
| Baseline completo, antes | 423 aprovados, 192,54 s |
| Backend após limpeza (`-m "not browser"`) | 411 aprovados, 19 deselected, 91,12 s |
| Chromium após limpeza (`-m browser`) | 19 aprovados, 411 deselected, 118,06 s |
| Suíte completa após limpeza | **430 aprovados**, 0 falhas/erros/skips, 199,63 s |
| Migração/estado legado após mover SQL | 16 aprovados |
| Quatro novas jornadas após correções UI | 4 aprovados |
| Instalação de requisitos e `pip check` | Exit 0; sem conflitos |
| Ruff (F401/F841/F821/F822/F823) e `git diff --check` | Aprovados; fixtures dinâmicas preservadas |
| Links relativos Markdown | Zero quebrados |
| Startup Python com PATH sem node/npm e PYTHONTZPATH vazio | Páginas públicas, SQLite temporário, health e sessão anônima aprovados; processo próprio encerrado |
| Revisão independente do diff ativo | Nenhum bloqueador de auth/privacidade/importação/config/modelo/migration encontrado |

Comandos efetivamente executados:

```bash
python -m pip install -r requirements.txt
python -m pip check
python -m pytest -m "not browser" -q
python -m pytest -m browser -q
python -m pytest -q
# As execuções também geraram JUnit em /tmp/english-ai-cleanup-*.xml.
git diff --check
```

A ativação da nuvem define `CHROMIUM_EXECUTABLE` e `REDIS_SERVER_EXECUTABLE`. O Chromium 151.0.7922.173 existente foi validado e reutilizado, sem executar um download redundante. O CI mantém instalação Playwright/Chromium e Redis próprios; os resultados de seu SHA publicado ficam na descrição/checks do PR. Rodadas focadas/separadas não são somadas ao total único de 430.


Comandos de validação nesta tarefa usam venv Python 3.12, SQLite temporário, contas sintéticas, SDK mock/MockTransport, Redis efêmero em loopback e Chromium. Nenhuma API paga, entrega SMTP real, banco/conta real ou teste invasivo de produção foi utilizado. O navegador da imagem foi reutilizado por `CHROMIUM_EXECUTABLE`; baixar outro Chromium não é necessário quando o executável existente é validado.

## Limitações e publicação

Windows nativo, SMTP/Anthropic reais, outros SGBDs e infraestrutura/proxy/Redis TLS implantados não foram validados. Os testes não certificam jailbreak de modelo real, gasto monetário exato ou desligamento de processos legados fora do repositório. O histórico preserva requisitos e implementação antiga; bancos privados dependem dos próprios backups. Os arquivos ignorados existentes continuam protegidos e não foram removidos.

Nenhuma `.gitattributes` foi criada ou alterada para esconder linguagens. Contagens por extensão/bytes são medições do checkout, não percentuais do GitHub Linguist. O indicador público pode mudar somente após o merge autorizado na `main`; nenhuma porcentagem exata é prometida.

A entrega será publicada em PR da branch de limpeza para `main`, com commits, resultados e inventário. O SHA publicado e a execução do CI correspondente serão registrados na descrição do PR; nenhum merge será automático.

Status local: **pronto para revisão**, com código e testes validados. Três commits organizam remoção/compatibilidade, correções de fuso/UI e consolidação documental; seus SHAs e CI da entrega serão registrados no PR sem alterar a main automaticamente.
