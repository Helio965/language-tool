# Localização das referências preservadas

A implementação TypeScript completa foi separada da distribuição Python em
12/10/2026. Está preservada na tag `legacy-typescript`, commit
`b77e724c85e7ca9c86f2669af998f26ec5ceda82`. Consulte essa referência para usar os
caminhos e comandos históricos abaixo. Os testes de importação Python mantêm
uma cópia imutável do esquema antigo em `tests/fixtures/legacy_schema.sql`.

Os documentos desta pasta são cópias da documentação TypeScript anterior à
migração. Seus textos e links relativos foram preservados no contexto original;
alguns links pressupõem os arquivos na raiz ou em `docs/`/`design/`, como estavam
na tag `python-migration-baseline-067fd06`.

Para a aplicação atual use o [README principal](../../README.md) e o
[relatório de migração](../MIGRATION-AUDIT.md). Para comparar o baseline, consulte
essa tag no GitHub ou com `git show`, sem descartar alterações locais.

As imagens referenciadas pelos documentos em `legacy/design/` continuam em
[`design/screenshots/`](../../design/screenshots/). São capturas da interface
TypeScript anterior, não resultados de testes da aplicação Python.

Comandos do README histórico são executados a partir da raiz do checkout do
baseline. Node/npm pertencem a essa versão; a execução principal atual usa
`python app.py`.
