# English AI

Plataforma acadêmica de aprendizado de inglês: aulas curtas, exercícios com
correção explicada, conversação com a Lumi, vocabulário, revisão e progresso.
A aplicação principal foi migrada para **Python 3.12 + Flask + Jinja + SQLAlchemy**.

A identidade de caderno (papel, azul do Aprender, coral do Conversar e marca-texto)
e o conteúdo próprio foram preservados. São 12 aulas, 65 exercícios de aula,
67 palavras, 12 questões de nivelamento e oito assuntos de conversa. O resultado
do nivelamento é uma estimativa pedagógica, sem certificação de proficiência.

## Executar no Windows

Instale Python 3.12 e abra a pasta do repositório. No PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python app.py
```

Abra <http://localhost:5000>. Uma instalação nova de desenvolvimento aplica as
migrações e sincroniza o conteúdo sem criar conta falsa. Cadastre-se, configure
seu perfil e faça o nivelamento (ou escolha começar como Iniciante).

Se a política do PowerShell impedir ativar o ambiente, execute o Python dele
sem mudar a política do sistema:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

No Prompt de Comando, a ativação é `.venv\Scripts\activate.bat`.
O [guia Windows e VS Code](docs/WINDOWS-VSCODE.md) detalha intérprete, tarefas,
configuração, banco existente, testes e diagnóstico.

## Linux e macOS

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
python app.py
```

A aplicação principal não requer Node, npm, build React ou TypeScript.
`python app.py` inicia o servidor local em loopback, porta 5000, debug desligado.
Em outro endereço de desenvolvimento use `python -m flask --app app run --host
0.0.0.0 --port 5000`; implantação pública exige servidor WSGI e HTTPS.

## O que funciona e o que exige configuração

- Conta, sessão, recuperação de senha, perfil, preferências e exclusão.
- Nivelamento adaptativo, aulas, explicações/exemplos, cinco tipos de exercício e correção.
- Progresso persistido, vocabulário estudado e revisão espaçada com motivo.
- Conversação integrada ao backend Python, contexto e feedback ao encerrar.
- Preferências de correção/idioma/tradução e histórico opcional com retenção.

Com o provedor padrão `mock`, o modo é **demonstração identificada**, com roteiros
locais e correção por regras. Não é integração externa nem conversa livre
irrestrita. SQLite persiste a aprendizagem no servidor; o demo anterior em
`localStorage` não é usado pela aplicação principal.

Para Anthropic, configure somente no `.env` do servidor:

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Preencha a chave privada no seu ambiente. Modelo é configurável conforme acesso
da conta. Resposta inválida, timeout, autenticação ou indisponibilidade retorna erro seguro
e preserva o texto para tentar novamente; nenhum turno incompleto é salvo. O chat
identifica resposta real, demonstração e abertura revisada do catálogo.
Não existe fallback automático que substitua uma resposta externa por roteiro. Exercícios fechados sempre usam gabarito local; IA não decide
suas notas. A execução real contra Anthropic requer credencial e validação própria.

Em desenvolvimento sem SMTP, os e-mails de boas-vindas/redefinição viram `.html`
e `.json` em `instance/outbox/`; abra o HTML local para usar o link. **Nenhum
email real é enviado nesse modo.** Envio SMTP exige `SMTP_HOST`, porta/TLS,
credenciais, remetente e `APP_PUBLIC_URL`; veja
[EMAIL-AND-AUTH.md](docs/EMAIL-AND-AUTH.md).

## Configuração e segurança

`.env.example` contém exemplos sem segredos. `.env`, bancos, outbox e ambiente
virtual ficam fora do Git. Variáveis principais:

| Variável | Uso / padrão |
| --- | --- |
| `APP_ENV` | `development`, `testing`, `production` |
| `SECRET_KEY` | Segredo de sessão; produção exige 32+ caracteres |
| `PORT` | Porta local, 5000 |
| `DATABASE_URL` | SQLite em `instance/english-ai.db` por padrão |
| `AUTO_INIT_DB` | Inicialização automática em desenvolvimento; desligue ao importar banco existente |
| `AUTH_TOKEN_TTL_HOURS` | Sessão, 72 horas; nome compatível, sessão atual não é JWT |
| `AI_PROVIDER` | `mock`/`demo` demonstrativo ou `anthropic` |
| `ANTHROPIC_MODEL` | Modelo configurável, `claude-sonnet-4-5` |
| `AI_TIMEOUT_MS`, `AI_MAX_HISTORY_MESSAGES` | 20.000 ms e 12 mensagens |
| `CONVERSATION_RETENTION_DAYS` | 90 dias |
| `PASSWORD_RESET_TTL_MINUTES` | 15 minutos |
| `MAIL_TRANSPORT`, `MAIL_OUTBOX_DIR` | Transporte e caixa local |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP; STARTTLS (587) ou TLS direto (465) |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Credenciais/remetente privados |
| `APP_PUBLIC_URL` | URL dos links, `http://localhost:5000` em dev |
| `RATELIMIT_STORAGE_URI` | `memory://` para desenvolvimento/uma instância |

Há scrypt compatível com contas antigas, cookie httpOnly/Strict (Secure em
produção), CSRF global, limites, validação, checagem do dono, escape de conteúdo
HTML e cabeçalhos restritivos. Redefinir senha e logout invalidam sessões
anteriores da conta; logout encerra também outros dispositivos. Os links de
senha têm uso único, validade curta e só seu hash é guardado no banco.

Por padrão, produção não inicializa o banco automaticamente: configure segredo/URL/HTTPS,
execute migrações e seed antes do servidor. PostgreSQL e escala distribuída são
evoluções; este desenvolvimento valida SQLite.

## Banco existente, migrações e manutenção

O esquema preserva as 14 tabelas de domínio e acrescenta campos de passagem,
idempotência/resultados e origem da resposta de IA. Para banco novo:

```bash
python -m flask --app app db upgrade
python -m flask --app app seed
```

**Não sobrescreva um banco existente.** O importador faz uma cópia SQLite
consistente e preserva a origem; o destino precisa ser novo e
`AUTO_INIT_DB=false` durante a importação. Com os valores configurados no `.env`:

```bash
python -m flask --app app import-legacy CAMINHO_DO_BANCO_ANTIGO
```

Confirme integridade, contagens e hashes das colunas antigas antes de adotar a
cópia; contas mantêm identificador/hash scrypt. O seed insere apenas conteúdo
ausente e preserva linhas existentes. O catálogo versionado em `content/` é a
fonte pedagógica em execução; personalizações no cache do banco antigo são
preservadas como dados, sem constituir um editor de conteúdo personalizado.
Não se importam automaticamente
contas locais do navegador. O procedimento Windows completo, backup e rollback
estão em [WINDOWS-VSCODE.md](docs/WINDOWS-VSCODE.md) e
[PYTHON-MIGRATION.md](docs/PYTHON-MIGRATION.md).

Para aplicar retenção e limpar dados privados vencidos:

```bash
python -m flask --app app purge-private-data
```

Agende a limpeza e backups quando implantar o serviço. Histórico desligado
remove conteúdo ao encerrar a conversa; exclusão de conta exige senha e elimina
suas relações por cascata.

## Testes e evidências

```bash
python -m pytest -m "not browser" -q
python -m playwright install chromium
python -m pytest -m browser -q
```

O primeiro comando testa serviços/API com SQLite temporário, sem IA paga nem SMTP
externo. O segundo instala navegador para os testes de interface. Os resultados
executados e eventuais bloqueios ficam em
[MIGRATION-AUDIT.md](docs/MIGRATION-AUDIT.md); os 276 testes + 16 E2E anteriores
pertencem ao baseline TypeScript, não são números da suíte Python.

Se o ambiente já possui Chromium, a suíte pode usar `CHROMIUM_EXECUTABLE`
conforme o guia. Não desative verificação TLS/checksum para instalar dependências.
IA/SMTP reais, Windows, Safari/Firefox e aparelhos reais só serão considerados
validados quando executados nos respectivos ambientes.

## Organização, documentação e legado

`app.py` cria o app; `config.py` valida ambientes; `extensions.py` centraliza
extensões. `blueprints/` recebe HTTP, `services/` aplica regras/transações,
`models/` mapeia tabelas, `ai/` encapsula provedor/políticas, `content/` preserva
catálogo, `templates/`/`static/` apresentam a interface, `tests/` verifica jornadas.

| Documento | Conteúdo |
| --- | --- |
| [MIGRATION-AUDIT](docs/MIGRATION-AUDIT.md) | Diagnóstico, evidências, validações e limites |
| [PYTHON-MIGRATION](docs/PYTHON-MIGRATION.md) | Estratégia, contratos, migração de dados e recuperação |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Organização e responsabilidades |
| [DATABASE-MODEL](docs/DATABASE-MODEL.md) | 14 tabelas, DER, índices e campos aditivos |
| [REQUIREMENTS-TRACEABILITY](docs/REQUIREMENTS-TRACEABILITY.md) | RF01–20, RNF01–10, RN01–08 e UC01–12 |
| [WINDOWS-VSCODE](docs/WINDOWS-VSCODE.md) | Instalação e execução Python no Windows/VS Code |
| [MVP-SCOPE](docs/MVP-SCOPE.md), [USER-FLOWS](docs/USER-FLOWS.md), [IA-BEHAVIOR](docs/IA-BEHAVIOR.md) | Decisões acadêmicas, jornadas e comportamento pedagógico |
| [Design](design/DESIGN-SYSTEM.md) | Identidade e especificações visuais preservadas |
| [README legado](docs/legacy/README.md) | Execução anterior React/Express, preservada para comparação; [localização dos links históricos](docs/legacy/INDEX.md) |

O original continua em `apps/`, `packages/` e `e2e/`, com lockfile npm próprio.
A tag `python-migration-baseline-067fd06` identifica o ponto de restauração; a
branch `codex/python-flask-migration` recebe commits incrementais para revisão.
Não há merge automático da `main`.

Lacunas mantidas do MVP: lembretes salvos sem envio, sem voz/pronúncia automática,
administração, arquivo Figma ou certificação. Privacidade é texto informativo;
uso público exige revisão jurídica/operacional. DOCX/PDF acadêmicos originais
não foram reenviados: as consolidações disponíveis e suas decisões foram
preservadas, com essa limitação registrada.
