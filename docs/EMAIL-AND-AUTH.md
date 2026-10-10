# Autenticação, recuperação e e-mail — Python

Origem: RF01–RF03, RF20, RNF04/RNF05, RN07 e UC01–UC03/UC12.
[O documento TypeScript está preservado](legacy/EMAIL-AND-AUTH.md).
Implementação atual: `services/autenticacao.py`, `services/perfil.py`,
`services/email.py`, `blueprints/auth.py` e `models/usuario.py`.

## Cadastro, login e sessão

Cadastro pede nome, e-mail, senha/confirmação e aceite dos termos. A senha usa a
mesma política na criação e redefinição: pelo menos oito caracteres, letras e
números, confirmação igual, limite de 128 caracteres. E-mail é normalizado para
minúsculas; duplicação é impedida no serviço e por UNIQUE no banco. UC01-A2
exige informar conta existente; o limite de tentativas reduz enumeração.

Scrypt usa salt aleatório de 16 bytes e os parâmetros N=16384, r=8, p=1, chave
derivada de 64 bytes. O formato `scrypt$N$r$p$salt$hash` é compatível com o hash
SQLite anterior do Node. A comparação usa `hmac.compare_digest`; formato e
parâmetros inválidos são rejeitados. Nenhuma senha é armazenada em texto.
PBKDF2 do antigo demo existia no navegador; seus dados não entram automaticamente
no banco Python.

No login, credenciais erradas usam mensagem genérica e uma derivação fictícia
quando o e-mail não existe para reduzir diferença de tempo. Flask-Login mantém
a identidade em cookie assinado, httpOnly, SameSite=Strict e Secure em produção.
`SECRET_KEY` só fica no servidor. Em desenvolvimento sem segredo estável, o
processo gera um valor temporário; reiniciar exige novo login.

O cookie contém identificador e **versão da sessão**, conferida no banco a cada
requisição. Redefinir senha incrementa a versão e invalida todos os cookies
anteriores. Logout também incrementa a versão: **encerra todas as sessões dessa
conta**, inclusive outros dispositivos. Isso corrige a limitação de revogação
registrada no legado. Excluir conta remove os dados relacionados e a sessão.

`/api/auth/session` retorna conta ou `null` para visitantes. Páginas privadas
encaminham ao login/etapa pendente; APIs privadas respondem 401. `X-Session-User`
é conferido nas chamadas privadas para impedir que uma aba com conta antiga
receba dados da conta do novo cookie. Dados privados usam `Cache-Control: no-store`.

## CSRF e limites

Flask-WTF exige token em toda requisição mutável. A página fornece o token e
`GET /api/csrf` permite obtê-lo; a API recebe `X-CSRFToken`. Um `X-Requested-With`
sozinho não é suficiente. Login/cadastro/sair também estão protegidos.
A mudança de identidade limpa a sessão anterior; o cliente precisa renovar CSRF.

| Limite | Padrão |
| --- | --- |
| Requisições gerais | 200 por minuto/IP |
| Grupo autenticação | 20 por 15 minutos/IP |
| Pedido de recuperação | 10 por 15 minutos/IP |
| Nova mensagem da mesma conta | intervalos/limites do serviço de IA e Blueprint |
| Novo link de redefinição | intervalo mínimo de 60 segundos por conta |

O armazenamento padrão do limitador é memória; limites entre múltiplas
instâncias exigem armazenamento compartilhado configurado e dependência própria.

## Recuperação e redefinição

```text
/recuperar-senha → e-mail → resposta genérica 202
→ conta existente: token+e-mail após commit
→ /redefinir-senha/<token> → validar → senha nova + confirmação
→ consumir token e atualizar hash/versão atomicamente → entrar novamente
```

O token é gerado por `secrets.token_urlsafe(32)` (256 bits). Só seu SHA-256 fica
em `password_reset_tokens`, com `expires_at`, `used_at` e `created_at`. A validade
padrão é 15 minutos, configurável entre 5 e 120. Novo pedido aceito invalida os
anteriores. Pedido dentro do intervalo mínimo não gera outro e-mail.

A verificação diferencia válido, inválido, vencido e usado; a confirmação
condiciona a atualização a token não consumido e ainda válido. Token consumido
e atualização de senha/versão pertencem à mesma transação. Reenvio do link não
redefine novamente. A rota abre mesmo com sessão ativa; se esta era da mesma
conta, ela termina. Outra conta ativa não deve ser desconectada por esse link.

O pedido retorna a mesma resposta para e-mail com ou sem conta. Resposta HTTP,
logs e tela integrada nunca devolvem token/link. O link existe no e-mail ou
na caixa de saída local de desenvolvimento. `APP_PUBLIC_URL` constrói o endereço;
o cabeçalho Host enviado pela requisição não escolhe o domínio do link.

## Serviço e transportes de e-mail

`EmailService` renderiza boas-vindas e redefinição com identidade do English AI,
HTML com tabelas/estilo inline e alternativa de texto. Texto do nome é escapado.
Não há script, imagem remota ou dependência CSS externa no e-mail.

Rotas acionam o serviço **depois do commit**. Envios externos/local-outbox rodam
em um executor com dois workers, sem bloquear o SMTP na requisição. Erro de
transporte registra somente tipo/código e não desfaz cadastro nem revela conta.
`idle()` aguarda tarefas pendentes para verificações/testes.

| Transporte | Uso e comportamento |
| --- | --- |
| `outbox` | Padrão no desenvolvimento sem SMTP. Grava `.html`/`.json` em `instance/outbox`; nenhum e-mail real é entregue |
| `smtp` | SMTP Python (`smtplib`), TLS direto ou STARTTLS obrigatório, timeout e validação de certificados |
| `disabled` | Produção sem SMTP: não envia e registra evento de envio ignorado |
| `memory` | Exclusivo de testes: guarda mensagens em memória, sem rede |

Outbox é recusado em produção. Usuário/senha SMTP devem vir juntos. Log de
conversa SMTP fica desligado. Os logs não têm destinatário, senha, token, link,
conteúdo de e-mail ou mensagem crua do servidor SMTP. Caixa de saída contém
endereços e links temporários, por isso fica fora do Git e com permissões locais
restritas; não deve ser publicada nem servida como diretório público.

## Configuração

Variáveis do `.env` na raiz são privadas; nenhuma é incluída em JavaScript.
Consulte o exemplo sem segredos e [guia Windows/VS Code](WINDOWS-VSCODE.md).

| Variável | Padrão / finalidade |
| --- | --- |
| `SECRET_KEY` | Estável em ambiente compartilhado; obrigatória com 32+ caracteres em produção |
| `AUTH_TOKEN_TTL_HOURS` | 72 horas de sessão; nome mantido por compatibilidade, a sessão nova não é JWT |
| `PASSWORD_RESET_TTL_MINUTES` | 15 minutos |
| `MAIL_TRANSPORT` | SMTP quando `SMTP_HOST` existe; outbox em dev; disabled em produção sem SMTP |
| `MAIL_OUTBOX_DIR` | `instance/outbox` |
| `SMTP_HOST` | Servidor do provedor |
| `SMTP_PORT` | 587 (STARTTLS); 465 para TLS direto |
| `SMTP_SECURE` | `false`: STARTTLS; `true`: TLS direto |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciais servidor; Gmail usa senha de app do provedor |
| `MAIL_FROM` | Remetente configurado; em produção use domínio autorizado pelo provedor |
| `APP_PUBLIC_URL` | `http://localhost:5000` em dev; URL HTTPS do produto em produção |

## Privacidade, verificações e limites

A exclusão exige senha; FKs em cascata removem perfil, preferências, tentativas,
progresso, revisões, vocabulário, conversas/mensagens e tokens de redefinição.
Conversa sem histórico é temporária e tem conteúdo apagado ao encerrar; apagar
histórico/remove dados é ação integrada ao banco, não apenas esconder tela.

Testes devem verificar: duplicação, senha inválida, CSRF, 401/dono, limite,
resposta igual de recuperação, hash em vez de token, expiração/uso único,
invalidar sessões, compatibilidade scrypt, falha SMTP segura e exclusão cascata.
Os resultados executados ficam em [MIGRATION-AUDIT.md](MIGRATION-AUDIT.md).
Transporte falso e outbox não provam entrega SMTP externa.

Limites mantidos: sem confirmação de e-mail no cadastro; executor local sem fila
durável/nova tentativa automática; preferência de lembrete não envia mensagem;
SPF/DKIM/DMARC dependem do domínio/provedor; outbox não possui limpeza automática.
Servidor WSGI/HTTPS, agendamento da CLI de retenção e backup são configuração
operacional antes de disponibilizar a aplicação publicamente.
