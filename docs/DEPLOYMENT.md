# Implantação — English AI em Python

## Escopo e condições

Esta receita prepara **Linux, Python 3.12, um host SQLite, Gunicorn com um worker
e quatro threads, Redis e um proxy HTTPS**. Gunicorn/Redis e as proteções HTTP
foram validados localmente; domínio público, TLS externo, Anthropic e SMTP reais
precisam de validação pelo operador. Nenhuma hospedagem foi contratada ou publicada.

Use usuário de serviço sem privilégios e diretório privado de dados persistentes.
Não exponha Redis à Internet. Não coloque SQLite em volume efêmero nem compartilhe
um mesmo arquivo de banco entre hosts. Não habilite preload do Gunicorn: cada
processo mantém seu próprio executor de e-mail. O limite compartilhado usa Redis.

## Preparar a versão e o ambiente

No diretório da versão, por exemplo `/srv/english-ai/current`:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pip check
```

Configure as variáveis do processo por meio do gerenciador de segredos/serviço,
usando `.env.production.example` como lista de requisitos. Não copie `.env` de
desenvolvimento para produção. Não registre valores em logs nem no Git.

Obrigatórios: `APP_ENV=production`, `SECRET_KEY` estável com pelo menos 32
caracteres, `APP_PUBLIC_URL` com a origem HTTPS real, `AUTO_INIT_DB=false`,
`AI_PROVIDER=anthropic`, `RATELIMIT_STORAGE_URI` Redis e `DATABASE_URL` absoluto.
Defina chave/modelo Anthropic e parâmetros SMTP antes de liberar o serviço.
`MAIL_TRANSPORT=disabled` permite manutenção, porém bloqueia recuperação de senha
com resposta uniforme 503. Chave de IA ausente mantém a geração indisponível.

`TRUSTED_PROXY_COUNT=1` só deve ser usado quando o proxy descrito abaixo é o único
caminho para Gunicorn. Se o proxy não for confiável, não interprete seus headers.
A configuração recusa valores acima de 1; topologias diferentes exigem revisão.

## Banco e conteúdo

Antes de atualizar um banco existente, faça uma cópia consistente e verifique
uma restauração. Com as variáveis de produção injetadas:

```bash
.venv/bin/python -m flask --app app db upgrade
.venv/bin/python -m flask --app app seed
.venv/bin/python -m flask --app app db current
```

A versão atual é `0003_conversation_idempotency`. Seed insere conteúdo ausente;
não substitui linhas existentes. Não execute downgrade em dados reais como
rollback automático. Se precisar voltar a uma versão incompatível, restaure uma
cópia verificada em um novo caminho e avalie os dados produzidos depois do backup.

## Servidor WSGI e HTTPS

A partir do diretório da versão e com as variáveis injetadas:

```bash
.venv/bin/gunicorn -c gunicorn.conf.py wsgi:application
```

`wsgi.py` exige `APP_ENV=production` no ambiente do processo. Gunicorn escuta em
`127.0.0.1:8000`. O gerenciador de serviço deve iniciar/reiniciar o comando e
monitorar sua saída. O timeout de 150 s acomoda o limite máximo configurável de
IA; ajuste capacidade e timeout com métricas, mantendo o limite de custos.

Exemplo de trecho Nginx para uma origem real, com certificado provisionado pelo
operador (substitua `english.example.com`):

```nginx
server {
    listen 80;
    server_name english.example.com;
    return 301 https://english.example.com$request_uri;
}
server {
    listen 443 ssl;
    server_name english.example.com;
    # ssl_certificate e ssl_certificate_key: caminhos privados reais.
    access_log off;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host english.example.com;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Host "";
        proxy_read_timeout 155s;
        client_max_body_size 16k;
    }
}
```

Configure um servidor padrão que recuse hosts desconhecidos. O proxy deve
**sobrescrever**, e não acrescentar, headers fornecidos pelo cliente. Bloqueie
acesso direto ao upstream. A aplicação valida Host contra `APP_PUBLIC_URL`,
recusa HTTP em produção, emite HSTS em HTTPS e usa cookies Secure/HttpOnly/Strict.
A interpretação automática de headers do Gunicorn está desativada; ProxyFix
interpreta somente cliente e esquema, com um salto confiável.

Os links de redefinição contêm tokens no caminho. Logs de acesso do Gunicorn
estão desativados. Não registre URL completa, corpo, query, cookie ou headers no
proxy, APM ou balanceador; caso precise de métricas, use caminhos normalizados
sem tokens. O trecho de proxy é orientação, sem teste contra um domínio real.

## Verificação antes de liberar acesso

Faça requisições pela origem HTTPS real, observando códigos e conteúdos:

- `/`, `/entrar` e `/cadastro`: páginas corretas, sem erros de recursos.
- `/api/health`: banco disponível e provedor correto; não valida API externa.
- `/api/ready`: IA externa e SMTP configurados; 503 indica requisito pendente.
- Cadastro, perfil, nivelamento opcional, aula/exercício, revisão, vocabulário,
  conversa, histórico, progresso, logout e exclusão: jornadas completas.
- Recuperação: entrega real, link da origem correta, uso único e revogação de sessões.
- Anthropic: resposta válida, custos/latência, contexto, redaction e falhas reais.

Readiness verifica configuração, sem enviar e-mail nem consumir IA. Chave inválida
ou falha do fornecedor pode ocorrer mesmo depois de readiness 200. Antes da
oferta comercial, valide essas operações separadamente com contas de teste.

## Retenção e e-mails

Agende diariamente, com as mesmas variáveis e usuário do serviço:

```bash
cd /srv/english-ai/current
.venv/bin/python -m flask --app app purge-private-data
```

Monitore sucesso/tempo da limpeza sem registrar conteúdo privado. A rotina pode
ser repetida e possui testes de retenção. Configure scheduler do host/plataforma;
nenhum agendamento de produção foi ativado nesta entrega.

E-mails em background usam até duas threads e 32 tarefas pendentes, timeout de
conexão e logs por classe de erro. Saturação/falha de submit não invalida a conta
já criada. A resposta de recuperação não garante entrega. O executor **não é
uma fila durável**: reinícios podem perder tarefas e não há retry persistente.
Implante fila/worker durável com retries, monitoramento e gestão de mensagens
expiradas antes de oferecer recuperação com garantia operacional. Não reenvie
links vencidos. Lembretes continuam desabilitados até existir envio real.

## Backup e restauração verificada

Use diretório de backups privado, fora da pasta servida. A ferramenta utiliza
SQLite online backup (inclui WAL confirmado), valida integridade/FKs, publica
atomicamente, aplica permissão 0600 e recusa qualquer destino existente ou symlink.
Há timeout de 30 s para evitar espera indefinida sob escrita intensa.

```bash
.venv/bin/python scripts/sqlite_backup.py backup /srv/english-ai/instance/english-ai.db /srv/english-ai/backups/snapshot-2026-10-12.db
.venv/bin/python scripts/sqlite_backup.py verify /srv/english-ai/backups/snapshot-2026-10-12.db
.venv/bin/python scripts/sqlite_backup.py restore /srv/english-ai/backups/snapshot-2026-10-12.db /srv/english-ai/restore/verified-new.db
```

Crie os diretórios privados primeiro. Use um nome novo a cada execução. Verifique
uma cópia restaurada abrindo a aplicação com `DATABASE_URL` apontado a esse
caminho; compare contas, progresso, tabelas e versão Alembic. Preserve a origem.
Antes de adotar o banco restaurado, pare somente o serviço sob sua administração,
defina a nova URL e reinicie. Não substitua o arquivo ativo enquanto há conexões.

Agende backups, retenção e testes de restauração de acordo com os objetivos de
perda de dados e recuperação definidos pelo proprietário. Proteja/cifre cópias
em trânsito e armazenamento e mantenha uma cópia externa controlada. Defina o
prazo de backups na política de privacidade; exclusões do banco ativo não
eliminam automaticamente cópias antigas.

## Capacidade e monitoramento

Acompanhe falhas 5xx/429, latência, volume de chamadas/tokens/custos de IA, espaço
em disco, locks SQLite, disponibilidade Redis, falhas/fila de SMTP e idade dos
backups. Defina alertas, atendimento, orçamento e limites por conta antes de
oferta pública. Os limites atuais são por IP; não há cobrança nem quota financeira
por cliente. Testes locais não são benchmark, pentest ou teste de carga.

Para vários hosts/workers ou aumento de escrita, avalie PostgreSQL, driver,
migrações/dados/rollback e testes de concorrência. A alteração de banco não foi
realizada: SQLite e os dados históricos permanecem compatíveis.

## Pacote de implantação

Inclua código Python de runtime, `templates/`, `static/`, `content/`, `migrations/`,
`requirements.txt`, `wsgi.py` e `gunicorn.conf.py`; scripts de manutenção pertencem
à operação. Não publique `tests/`, docs/design/editor, dependências de teste,
`.git`, `.env`, bancos/outbox/backups ou a implementação legada como assets.
