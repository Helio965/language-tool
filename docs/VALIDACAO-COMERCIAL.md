# Evidências de validação — 12/10/2026

## Suíte executada

Comando final, a partir da raiz:

```bash
CHROMIUM_EXECUTABLE=/usr/bin/chromium .venv/bin/python -m pytest -q --junitxml=/tmp/commercial-final.xml
```

| Grupo | Passaram | Falhas/erros/skips |
| --- | ---: | ---: |
| Python, API, SQLite, configuração, e-mail e backup | 180 | 0 |
| Chromium: jornadas, erros/retry, layouts e novos contratos | 23 | 0 |
| Total da execução final | 203 | 0 |

Exit status 0, tempo 184.92 s. O baseline foi 158 testes em 105,11 s.
A regressão de IA/produção passou com 82 testes após o ajuste de logging.
Falhas iniciais de seletores e uma asserção de texto da recuperação foram
corrigidas e reexecutadas; a execução final acima não contém falhas ou skips.

## Outros resultados executados

- 16 testes de migração/estado legado passaram após a separação do TypeScript.
  A fixture SQL histórica permaneceu byte a byte igual ao baseline.
- Instalação repetida de requirements-dev.txt e pip check concluíram sem conflitos.
- Ambiente virtual limpo de produção instalado só por requirements.txt: imports
  Flask/SQLAlchemy/Redis/Gunicorn funcionaram; pytest/Playwright não estavam presentes.
- Gunicorn real com SQLite temporário e Redis 7.4 em container local verificou
  health, readiness 503 para IA sem chave, domínio restrito, HTTPS, cookie
  Secure/HttpOnly/Strict, header HSTS, X-Forwarded-Host ignorado, CSRF real,
  recuperação indisponível 503 e limite compartilhado de 200/min (requisição 201: 429).
  O mesmo smoke foi repetido no ambiente limpo de produção. O container é
  recurso temporário de validação; não é infraestrutura de produção.
- Desenvolvimento iniciou e reiniciou em porta alternativa 5001, pois 5000 já
  estava ocupada. /, /entrar, /cadastro, /api/health e /api/auth/session responderam
  com conteúdo esperado. Nenhum processo desconhecido foi encerrado.
- Backup online e restauração real em arquivo novo passaram, inclusive WAL,
  preservação do original, permissões privadas e recusa de destino existente/symlink.
- Sintaxe Python, dez módulos JS, 16 templates Jinja e JSON atuais foram verificados.
  git diff --check e links relativos dos documentos novos passaram.
- pip-audit consultou 47 dependências fixadas: nenhuma vulnerabilidade conhecida
  encontrada, sem pacotes ignorados. Isso depende das bases de advisories consultadas.
- detect-secrets: candidatos em mensagens/campos de senha e fixtures sintéticas
  foram revisados; nenhum material de credencial real foi identificado. Não é
  uma garantia de ausência de segredos nem um scan completo do histórico Git.

## Navegação e acessibilidade

[responsive.json](validation/responsive.json) registra 85 capturas em 17 páginas,
nas cinco resoluções exigidas, sem overflow horizontal ou erro JavaScript.
[accessibility.json](validation/accessibility.json) registra axe-core 4.11.0 em
34 combinações de página/viewport (390 e 1366): **zero violações automáticas**
nas regras WCAG 2 A/AA e 2.1 AA executadas.

A ferramenta marcou verificações de contraste como incompletas em landing,
cadastro, login, recuperação, início, conversação, edição do perfil e nivelamento
nas duas larguras; preferências em mobile também exige revisão manual de contraste.
Não se interpreta isso como aprovação integral de acessibilidade. Teclado/foco
foram exercitados no menu; formulários e jornadas tiveram interações reais.
Leitores de tela, zoom/contraste completos, aparelhos físicos e outros navegadores
precisam de validação própria.

Capturas representativas, com dados de contas temporárias de teste:

- [Landing antes (1440px)](validation/landing-before.png) e
  [landing atual (1366px)](validation/landing-desktop.png): comparação de
  conteúdo/identidade; não é uma comparação pixel a pixel, pois as larguras diferem.
- [Painel desktop](validation/home-desktop.png).
- [Preferências mobile](validation/preferences-mobile.png).
- [Termos/privacidade mobile](validation/legal-mobile.png).

## Não executados / limites

Chamadas pagas Anthropic, entrega SMTP real, HTTPS/domínio público e infraestrutura
externa não foram executados por falta de configuração/credenciais. Não houve
implantação comercial, scheduler público, pentest, teste de carga, validação
jurídica ou testes em Windows/Safari/Firefox/aparelhos reais. A CI foi preparada;
o resultado remoto só pode ser afirmado após uma execução efetiva no GitHub.

Os documentos [AUDITORIA-TECNICA.md](AUDITORIA-TECNICA.md) e
[PREPARACAO-COMERCIAL.md](PREPARACAO-COMERCIAL.md) registram os riscos restantes.
