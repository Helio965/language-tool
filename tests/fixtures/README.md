# Esquema SQLite legado

`legacy_schema.sql` é uma cópia byte a byte de `apps/api/src/db/schema.sql` na
tag `legacy-typescript`, commit `b77e724c85e7ca9c86f2669af998f26ec5ceda82`.

Os testes de migração e recuperação de contas utilizam esse esquema histórico
para construir bancos temporários e provar a compatibilidade da aplicação
Python. Ele não é o esquema de implantação; o banco atual é versionado pelas
migrações Alembic em `migrations/`.

Não atualize esta fixture para acompanhar os modelos atuais: isso eliminaria a
cobertura da importação de dados antigos.
