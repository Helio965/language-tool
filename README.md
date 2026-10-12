# English AI

Plataforma de aprendizagem de inglês com aulas, exercícios, prática escrita com
Lumi, vocabulário, revisão e acompanhamento de progresso. A aplicação utiliza
**Python 3.12, Flask, Jinja, SQLAlchemy e SQLite**. HTML, CSS, JavaScript e fontes
são servidos diretamente pelo Flask; não há compilação Node ou React.

O catálogo preserva 12 aulas, 65 exercícios de aula, 67 palavras, 12 questões de
nivelamento e oito assuntos de conversa. O nível é uma estimativa pedagógica,
sem certificação oficial. A prática demonstrativa é identificada no aplicativo.

## Instalação e desenvolvimento

Linux/macOS, a partir da raiz do repositório:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
[ -f .env ] || cp .env.example .env
.venv/bin/python app.py
```

Windows, PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe app.py
```

Acesse a porta local 5000 no seu navegador. O servidor de desenvolvimento usa
loopback e debug desligado. Cadastre-se, configure seu perfil e faça o
nivelamento ou escolha começar como Iniciante. Nenhuma conta de exemplo é
criada. O [guia Windows/VS Code](docs/WINDOWS-VSCODE.md) detalha a execução local.

`requirements.txt` contém somente dependências de execução;
`requirements-dev.txt` acrescenta pytest e Playwright com versões fixadas.
Gunicorn é usado em produção Linux e não é instalado no Windows. Alterações de
versões devem ser deliberadas; os arquivos `.in` registram requisitos diretos.

## Configuração

`.env.example` é a configuração de desenvolvimento. Preserve seu `.env` e
bancos existentes; eles são ignorados pelo Git. Não publique chaves, senhas,
bancos, outbox ou backups.

| Variável | Uso |
| --- | --- |
| `APP_ENV` | `development`, `testing` ou `production` |
| `SECRET_KEY` | Segredo estável de sessão, obrigatório com 32+ caracteres em produção |
| `PORT` | Porta do servidor local, padrão 5000 |
| `DATABASE_URL` | SQLite em `instance/english-ai.db` em desenvolvimento |
| `AUTO_INIT_DB` | Migrações/seed automáticos em desenvolvimento; false em produção/importação |
| `AUTH_TOKEN_TTL_HOURS` | Validade da sessão, padrão 72 horas |
| `AI_PROVIDER` | `mock`/`demo` em desenvolvimento; `anthropic` em produção |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Credencial do servidor e modelo acessível à conta |
| `AI_TIMEOUT_MS`, `AI_MAX_HISTORY_MESSAGES` | Limites de tempo e contexto, padrões 20000 ms e 12 mensagens |
| `CONVERSATION_RETENTION_DAYS` | Prazo do histórico salvo, padrão 90 dias |
| `MAIL_TRANSPORT` | `outbox` em desenvolvimento, `smtp` ou `disabled` em produção |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP com STARTTLS ou TLS direto |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Autenticação e remetente do servidor |
| `APP_PUBLIC_URL` | Origem pública dos links; HTTPS obrigatório em produção |
| `PASSWORD_RESET_TTL_MINUTES` | Expiração de links de recuperação, padrão 15 minutos |
| `RATELIMIT_STORAGE_URI` | `memory://` em desenvolvimento; Redis compartilhado em produção |
| `TRUSTED_PROXY_COUNT` | 0 direto; 1 somente atrás do proxy HTTPS documentado |

O exemplo [.env.production.example](.env.production.example) declara os campos
necessários sem credenciais. Segredo gerado, mock/demo, e-mail local, debug,
CSRF desativado, limites desativados, URL HTTP e migração automática são
recusados em produção. A configuração final também é validada quando fornecida
por `create_app(config)`.

## IA e e-mail

O modo demonstrativo produz roteiros e correções locais, sem chamadas externas.
A interface identifica sua origem, inclusive em explicações e exemplos de aulas.
Para usar Anthropic, configure `AI_PROVIDER=anthropic`, uma chave privada e o
modelo disponível. A chave ausente mantém o serviço explicitamente
indisponível, sem substituir respostas por demonstração. Falhas de autenticação,
timeout, rede ou resposta inválida preservam o texto e não salvam turnos
incompletos. Exercícios fechados usam o gabarito local.

Filtros reconhecem alguns padrões de dados pessoais; não garantem anonimização
completa. Não compartilhe informações sensíveis no conteúdo de aprendizagem.

Sem SMTP no desenvolvimento, os e-mails ficam em `instance/outbox/`, em HTML e
JSON privados. Nenhum e-mail real é enviado. Produção exige configuração SMTP
com TLS e remetente válido; com `MAIL_TRANSPORT=disabled`, a recuperação retorna
indisponibilidade para qualquer endereço, sem revelar contas. A resposta de
solicitação descreve recebimento, sem garantir entrega. O envio em background é
limitado e de melhor esforço: fila durável, retries operacionais e comprovação
de entrega continuam requisitos antes de uma operação comercial confiável.

Lembretes de estudo estão desabilitados porque não existe rotina de envio;
preferências antigas permanecem guardadas. Não há pagamento, voz, certificação
ou administração acrescentados nesta revisão.

## Banco, importação e manutenção

O SQLite preserva 14 tabelas de domínio. Migrações Alembic e seed são
idempotentes e preservam linhas existentes. Para preparação explícita:

```bash
.venv/bin/python -m flask --app app db upgrade
.venv/bin/python -m flask --app app seed
.venv/bin/python -m flask --app app db current
```

Para importar um banco antigo, defina um **destino novo** em `DATABASE_URL` e
`AUTO_INIT_DB=false` antes de executar:

```bash
.venv/bin/python -m flask --app app import-legacy CAMINHO_DO_BANCO_ANTIGO
```

Não sobrescreva um banco. O importador preserva a origem e verifica integridade,
relações e colunas históricas. Senhas scrypt existentes continuam válidas; o
estado antigo do navegador não é importado como uma conta do servidor.

A rotina `python -m flask --app app purge-private-data` aplica retenção de
conversas e remove tokens vencidos. Deve ser agendada pelo operador. Backup e
restauração segura estão em [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Testes

```bash
.venv/bin/python -m pip check
.venv/bin/python -m pytest -m "not browser" -q
.venv/bin/python -m playwright install chromium
.venv/bin/python -m pytest -m browser -q
```

Se Chromium já estiver instalado, use
`CHROMIUM_EXECUTABLE=/usr/bin/chromium` no comando de navegador. Os testes usam
SQLite/outbox temporários e transportes de IA controlados, sem custo de IA nem
SMTP externo. Os testes de navegador iniciam seu próprio Flask. O workflow
[Python validation](.github/workflows/python.yml) executa a suíte no GitHub.

`/api/health` consulta o banco e mostra o modo de IA.
`/api/ready` retorna 503 se a IA externa ou SMTP não estiverem configurados.
Esses endpoints não fazem chamadas pagas nem comprovam validade da chave ou
entrega externa: as integrações precisam de testes reais próprios.

## Implantação e estado comercial

Use [DEPLOYMENT.md](docs/DEPLOYMENT.md) para Gunicorn, proxy HTTPS, Redis,
migrações, limpeza, backups e rollback. `python app.py` é destinado ao
desenvolvimento. A operação documentada inicialmente usa SQLite em um único
host; múltiplas instâncias exigem análise de capacidade e estratégia de banco.

O [relatório técnico](docs/AUDITORIA-TECNICA.md) registra os achados, correções e
evidências. [PREPARACAO-COMERCIAL.md](docs/PREPARACAO-COMERCIAL.md) diferencia o
ambiente validado das pendências externas e jurídicas. A aparência e os testes
locais não constituem validação de uma implantação comercial.

## Organização e legado

`app.py` cria a aplicação; `config.py` valida ambientes; `blueprints/` atende HTTP;
`services/` aplica regras; `models/`, `database/` e `migrations/` preservam dados;
`ai/` encapsula provedores; `content/` guarda o catálogo; `templates/` e `static/`
compõem a interface; `tests/` verifica jornadas.

O código TypeScript completo foi separado da distribuição Python e preservado
na tag **`legacy-typescript`**, commit
`b77e724c85e7ca9c86f2669af998f26ec5ceda82`. Isso inclui `apps/`, `packages/`,
`e2e/` e seus manifests/lockfiles. O esquema SQL histórico usado pelos testes
permanece, byte a byte, em `tests/fixtures/legacy_schema.sql`.
Documentos em `docs/legacy/`, especificações históricas e screenshots anteriores
são acervo de desenvolvimento, sem dependência em produção.
