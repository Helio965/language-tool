# Executar no Windows e no Visual Studio Code

A aplicação principal exige Python 3.12; Node/npm não são pré-requisitos.
Este procedimento é reproduzível, mas executar os testes no Linux cloud não
constitui validação em um computador Windows real.

## Instalação e primeiro início

1. Instale Python 3.12 com o launcher `py` e o VS Code com as extensões Python e
   Python Debugger, recomendadas em `.vscode/extensions.json`.
2. Abra a pasta `language-tool` no VS Code (a que contém `app.py`).
3. Abra Terminal → Novo Terminal e use PowerShell:

```powershell
py -3.12 --version
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
python app.py
```

O comando de cópia preserva um `.env` existente. Use `python --version` no ambiente
para confirmar o intérprete. Se o launcher não existe, use `python` quando ele
aponta para Python 3.12.

O servidor usa <http://localhost:5000>, debug desligado. Banco novo de
desenvolvimento é criado/migrado em `instance/english-ai.db`; o seed sincroniza
as aulas/palavras/atividades. Crie sua conta; não há credencial de usuário falsa
necessária para desenvolver. `Ctrl+C` encerra o servidor.

Se PowerShell bloquear a ativação por política local, use os executáveis
explicitamente, sem alterar a política global:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

No CMD:

```bat
py -3.12 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if not exist .env copy .env.example .env
python app.py
```

## VS Code: intérprete, executar e depurar

Na paleta (`Ctrl+Shift+P`), escolha **Python: Select Interpreter** e selecione
`.venv\Scripts\python.exe`. Abra um novo terminal após selecionar o ambiente.
Use `python app.py` para executar; para depurar, selecione a configuração Python
incluída em `.vscode/launch.json` e pressione F5. A depuração do editor não
habilita o console interativo público do Werkzeug.

Tarefas em `.vscode/tasks.json` permitem instalar dependências, aplicar migrações,
seed e rodar testes com o Python selecionado. As tarefas devem ser executadas
na raiz. Migração de banco existente exige preparação própria, descrita abaixo;
não use tarefa de inicialização para substituir dados.

A aplicação usa um único endereço; não é necessário iniciar Vite/Express.
Arquivos Jinja estão em `templates/`, estilos em `static/css`, scripts em
`static/js`, regras em `services/` e ORM em `models/`.

## Variáveis de ambiente

Edite `.env` localmente; ele é ignorado pelo Git. Desenvolvimento mínimo:

```dotenv
APP_ENV=development
PORT=5000
AI_PROVIDER=mock
MAIL_TRANSPORT=outbox
APP_PUBLIC_URL=http://localhost:5000
```

Sem `DATABASE_URL`, o app usa o arquivo em `instance/`. Se quiser fixar caminho:

```dotenv
DATABASE_URL=sqlite:///C:/projetos/language-tool/instance/english-ai.db
```

Use barras `/` em URLs SQLite no Windows. `sqlite:///` precede o caminho e não é
caminho de arquivo puro. Prefira caminho absoluto quando mudar de diretório.
Não inclua senha na URL SQLite.

Defina `SECRET_KEY` estável se quiser preservar a sessão entre reinícios. Para
gerar um valor privado localmente:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copie o resultado apenas para seu `.env`/gerenciador de segredos e mantenha fora
de commits, prints públicos e mensagens. Produção exige segredo com pelo menos
32 caracteres, `APP_ENV=production`, HTTPS, migrações explícitas e servidor WSGI.
`python app.py` é o comando local de desenvolvimento.

Anthropic requer `AI_PROVIDER=anthropic`, chave privada `ANTHROPIC_API_KEY` e
modelo disponível para sua conta (`ANTHROPIC_MODEL`). O modo `mock`/`demo` é rotulado como demonstração. Se escolher Anthropic sem
chave ou houver erro externo, a aplicação informa falha segura e mantém o texto
para tentar novamente; não substitui automaticamente por uma resposta roteirizada.

## Recuperação de senha em desenvolvimento

Sem SMTP, use `MAIL_TRANSPORT=outbox`. Cadastro/pedido de senha produz arquivos
em `instance/outbox/`. Aguarde o envio local, abra o `.html` mais recente e use
o botão do e-mail. O token vale 15 minutos e é de uso único. Os arquivos são
simulação de entrega; não são e-mails enviados por um servidor real.

Para envio real, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`/`SMTP_PASSWORD`, `MAIL_FROM` e `APP_PUBLIC_URL`. Porta 587 usa
STARTTLS; 465 usa TLS direto (`SMTP_SECURE=true`). Não desative certificados.
Veja [EMAIL-AND-AUTH.md](EMAIL-AND-AUTH.md) para política, testes e limitações.

## Importar SQLite da aplicação anterior

Preserve o banco antigo e faça uma cópia/backup consistente. O importador não
sobrescreve destino e abre a origem como somente leitura. Use um nome novo,
por exemplo `english-ai-python.db`; não aponte a nova aplicação diretamente
para o único arquivo com suas contas existentes.

Antes de importar, pare o servidor que escreve no banco antigo. Configure
no `.env` (ajuste os caminhos reais):

```dotenv
AUTO_INIT_DB=false
DATABASE_URL=sqlite:///C:/projetos/language-tool/instance/english-ai-python.db
```

O destino precisa **não existir**. Então execute na raiz, com o ambiente ativo:

```powershell
python -m flask --app app import-legacy "C:\projetos\language-tool\apps\api\data\english-ai.db"
```

O comando copia com backup SQLite (inclui WAL), verifica integridade/FKs,
adota o esquema anterior, aplica evoluções Alembic e sincroniza conteúdo.
Se o destino existe, escolha outro arquivo; não o apague automaticamente.
O seed acrescenta somente conteúdo ausente, preservando os campos das linhas
existentes. Conteúdos personalizados do cache antigo permanecem no banco; a
apresentação/correção usa o catálogo autoral versionado em `content/`, sem
oferecer edição de conteúdo personalizado nesta migração.

Compare contagens e hashes canônicos das colunas originais nas 14 tabelas,
identificadores, FKs e login com senha antiga. A validação está documentada em
[PYTHON-MIGRATION.md](PYTHON-MIGRATION.md). Contas usam o hash scrypt anterior;
sessões/cookies são novos, então entre novamente. Contas da antiga demonstração
que existem só em `localStorage` não são importadas.

Depois de conferir a cópia, mantenha `DATABASE_URL` nela e inicie
`python app.py`. `AUTO_INIT_DB=false` pode permanecer para operar apenas com
migrações explícitas. Banco recém-criado sem importação:

```powershell
python -m flask --app app db upgrade
python -m flask --app app seed
python -m flask --app app db current
```

Não use downgrade/reinicialização como tentativa de corrigir falha. Se uma
migração interromper, preserve origem e destino parcial, confira revisão,
colunas, integridade e logs sem dados privados; consulte o procedimento de
recuperação antes de retomar.

## Testes e navegador

```powershell
python -m pytest -m "not browser" -q
python -m playwright install chromium
python -m pytest -m browser -q
```

Os testes usam banco temporário, mailer em memória/outbox e provedor controlado;
chamadas reais a Anthropic/SMTP não são disparadas pela suíte padrão. O relatório
registra separadamente a suíte e qualquer integração externa executada.

Para usar Chromium já instalado, configure no terminal conforme a suíte:

```powershell
$env:CHROMIUM_EXECUTABLE = "C:\caminho\para\chrome.exe"
python -m pytest -m browser -q
```

Versões de referência fixadas em `requirements.txt`: Flask 3.1.3,
SQLAlchemy 2.0.54, Flask-Migrate 4.1.0, Alembic 1.20.0, Flask-Login 0.6.3,
Flask-WTF 1.3.0, Flask-Limiter 4.1.1, SDK Anthropic 0.125.0,
pytest 9.1.1 e Playwright 1.63.0. O cloud usa Python 3.12.14.
`requirements.in` registra dependências diretas; instalação utiliza o arquivo
resolvido com versões fixadas, sem exigir ferramenta uv no Windows.

## Diagnóstico

| Sintoma | Conferir / ação |
| --- | --- |
| `python` abre Microsoft Store ou versão incorreta | Use `py -3.12` e selecione o `.venv` no VS Code |
| Ativação PowerShell bloqueada | Execute `.venv\Scripts\python.exe` diretamente |
| `ModuleNotFoundError` | Rode instalação com o mesmo Python que inicia `app.py` |
| Porta 5000 ocupada | Defina `PORT=5001`; ajuste `APP_PUBLIC_URL` para links locais |
| Login some depois de reiniciar | Defina `SECRET_KEY` estável no `.env` |
| Formulário pede atualizar página | Token CSRF pode ter expirado; recarregue/renove a sessão e tente novamente |
| Conversa mostra demonstração/serviço indisponível | Veja configuração do provedor; isso não prova chamada real |
| Não chegou e-mail | Verifique transporte; outbox não envia. SMTP real exige configuração e acesso ao provedor |
| Importador diz destino existente | Selecione arquivo novo e `AUTO_INIT_DB=false`; preserve dados |
| Banco incompatível/JSON inválido | Não reinicialize; preserve cópia, confira diagnóstico e backup |
| Chromium ausente | Instale via Playwright ou informe executável existente, sem desabilitar TLS |

Retenção pode ser aplicada com `python -m flask --app app purge-private-data`.
Agendamento, backups, WSGI e HTTPS são configuração de implantação.
