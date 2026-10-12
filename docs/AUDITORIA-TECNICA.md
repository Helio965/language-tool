# Auditoria técnica e refatoração — English AI

Data: 12/10/2026. Repositório: `Helio965/language-tool`.
Base verificada: `b77e724c85e7ca9c86f2669af998f26ec5ceda82`, branch remota `main`.
Branch de trabalho: `refactor/commercial-readiness`.

Os textos colados definiram o pedido; a auditoria anexa foi tratada como referência
histórica, com seus achados conferidos no checkout. Não foram usados seus
resultados estáticos como substitutos dos testes atuais.

## A. Resumo executivo

O baseline continha 377 arquivos rastreados, incluindo 56 Python, 107 TypeScript,
55 TSX, 10 JavaScript e 35 CSS. A implementação Flask estava funcional: **158
testes passaram em 105,11 s**, sem alterações prévias do usuário.

A revisão separa a implementação anterior, melhora textos e transparência,
desabilita lembretes sem envio, fecha configurações inseguras de produção,
melhora falhas de e-mail/logging e acrescenta implantação e backup verificáveis.
A arquitetura e os dados educacionais são preservados. O resultado permanece
um ambiente de testes validado, com pendências externas explícitas.

## B. Arquivos separados e proteção do histórico

`apps/`, `packages/`, `e2e/`, `package.json`, `package-lock.json`,
`tsconfig.base.json` e `.nvmrc` pertenciam ao TypeScript e foram retirados da
branch Python. A varredura de imports, templates, assets, scripts e migrações
não encontrou dependência de runtime. **Dois testes Python dependiam do esquema
SQL antigo**: ele foi preservado byte a byte em `tests/fixtures/legacy_schema.sql`
e suas referências foram atualizadas. Os 16 testes de migração/estado legado
passaram após a separação.

A tag anotada `legacy-typescript` preserva o baseline completo. Um bundle local
fora do checkout, com histórico completo, foi criado e verificado antes das
remoções. O histórico Git permanece recuperável; não houve reset ou force push.
Documentos históricos e screenshots de design foram mantidos como acervo, sem
serem assets necessários ao runtime. A cópia do catálogo e suas fontes/CSS/JS,
modelos e migrações permanecem na aplicação.

## C. Principais arquivos modificados

| Grupo | Finalidade |
| --- | --- |
| `templates/landing.html`, base/auth/profile/legal/data_policy | Marca, prévias, textos objetivos e transparência jurídica/privacidade |
| `static/css/ui.css`, `static/js/common.js` | CSS da etiqueta removido; foco Escape do menu corrigido |
| `templates/configuracoes/preferences.html`, `static/js/account.js`, `services/perfil.py` | Lembretes desabilitados sem sobrescrever dados antigos |
| `services/aprendizagem.py`, `static/js/learning.js` | Origem de explicações/exemplos identificada mesmo no layout imersivo |
| `config.py`, `app.py`, `ai/provider.py` | Validação final de produção, HTTP/Host/proxy/cookies/HSTS e IA sem mock |
| `services/email.py`, `services/autenticacao.py`, `static/js/auth.js` | Fila limitada, falhas seguras e solicitação sem promessa de entrega |
| `migrations/env.py` | Migrações preservam loggers/handlers do processo |
| requirements, WSGI/Gunicorn, scripts/CI | Runtime separado de testes; implantação e backup seguros |
| testes e documentação | Regressões, evidências, operação, riscos e critérios comerciais |

## D. Auditoria funcional e visual

As cinco etiquetas “Exemplo ilustrativo” foram removidas com seu CSS exclusivo.
Os cartões, cores, exercícios, chat e números de prévia permanecem. Todos os
cinco grupos referenciam uma única indicação acessível de exemplos e resultados
demonstrativos. Contagens de aulas/exercícios/temas vêm do catálogo; o total de
aulas foi corrigido para “aulas no catálogo”. A promessa de gratuidade não
fundamentada foi substituída por “Começar a aprender”. O fluxo descreve o
nivelamento opcional, e referências acadêmicas foram substituídas por produto.

Termos continuam provisórios, com identificação/contato/revisão jurídica pendentes.
Promessas absolutas sobre remoção de dados pessoais foram substituídas pela
explicação de filtros parciais. Avisos de demonstração/IA ausente permanecem.
Menu móvel comunica a página atual; Escape só retoma o foco quando o menu estava
aberto. Controle indisponível não envia PATCH nem apaga a preferência anterior.

Foram geradas 51 capturas de baseline e 85 depois dos ajustes, em 17 páginas nas
resoluções 1920×1080, 1366×768, 768×1024, 390×844 e 360×800. A verificação de
layout não encontrou overflow horizontal nem erros JavaScript. Houve inspeção
visual de landing, painel, aula, preferências e termos em capturas reais.

| Página/fluxo | Rotas e cobertura |
| --- | --- |
| Pública / como funciona / IA | `/`, âncoras, cartões e navegação móvel |
| Cadastro/login/recuperação/reset | `/cadastro`, `/entrar`, `/recuperar-senha`, `/redefinir-senha/<token>`; jornadas/token/outbox |
| Perfil inicial e edição | `/configuracao`, `/perfil/editar`; campos e persistência |
| Nivelamento | `/nivelamento`, `/perfil/nivelamento`; estimativa e opção de pular |
| Painel/aprender/aula | `/inicio`, `/aprender`, `/aprender/aula/<id>`; retomada, exemplos, exercícios e correção |
| Revisão/vocabulário/progresso | `/revisao`, `/revisao/<id>`, `/vocabulario`, `/progresso`; estado vazio, atividade e reload |
| Conversa/IA/feedback | `/conversar`, `/conversar/<id>`; provedor, origem, retry, histórico, contexto e resultado |
| Preferências/segurança/privacidade | `/preferencias`, `/privacidade`; login/cookies/CSRF, histórico e exclusão confirmada |
| Termos/política | `/termos-e-privacidade`, texto compartilhado com privacidade |

Segurança e IA são áreas/fluxos nas páginas existentes, sem telas independentes
inventadas. Capturas de todos os estados interativos não foram feitas: exercícios,
feedback, reset e exclusão são cobertos pelas jornadas de navegador. Aparelhos
reais, Safari/Firefox, leitores de tela e qualidade pedagógica humana permanecem
validações próprias.

### Classificação da busca global

| Categoria | Ocorrências / decisão |
| --- | --- |
| Remover com segurança | Cinco badges e CSS sem outra referência |
| Substituir | Texto acadêmico público, promessa gratuita, catálogo por nível, confirmação de envio |
| Corrigir limitação | Lembretes ativos sem envio, defaults de produção, fila ilimitada, logging desativado |
| Manter por transparência | Demo/mock identificado, erros de provedor, catálogo limitado, estimativa sem certificação e documento legal provisório |
| Somente desenvolvimento | Provedor mock, outbox, fixtures, senhas de teste, documentos/design históricos |

Não se apagaram mocks necessários a testes, limitações verdadeiras ou conteúdo
educacional. Não há redesign, recurso de pagamento ou troca de framework/banco.

## E. Funcionalidades corrigidas

Lembretes são desabilitados na interface e alterações são recusadas com 409,
preservando valor antigo e salvando outras preferências normalmente. Explicações
extras identificam origem. Falha/saturação do executor de e-mail não transforma
cadastro já confirmado em erro 500. Recuperação com transporte desabilitado
retorna 503 antes de consultar a conta ou gerar token, com resposta igual para
endereços existentes e ausentes. Recebimento de solicitação não promete entrega.

## F. Inteligência artificial

Desenvolvimento mantém `mock` com metadata demonstrativa. Produção exige
`anthropic`: não aceita mock/demo, inclusive em chamada direta à seleção do
provedor. Credencial ausente significa serviço indisponível, sem resposta
simulada nem turnos incompletos. O adaptador existente preserva validação de
schema, saída, contexto, timeout, redaction parcial e classificações seguras de
falhas. Exercícios fechados seguem gabarito. Contexto, idempotência/rollback e
erros foram cobertos por transportes controlados; não houve chamada real paga.

Timeout, history e taxa por IP limitam uso; quota financeira por conta, orçamento,
qualidade e latência reais dependem do operador e continuam pendentes.

## G. Segurança, banco e operação

Scrypt, CSRF, validação, autorização por dono, escape, cookies e revogação de
sessões já funcionavam e foram preservados. A configuração efetiva, incluindo
overrides da factory, agora recusa segredo temporário/curto, HTTP, demonstração,
debug/test mode, proteções desativadas, limiter em memória e auto-init em produção.
Host vem da origem pública; ProxyFix é opt-in de um salto e não confia em
X-Forwarded-Host. Cookies/HSTS/TLS e Redis real foram exercitados com Gunicorn.

As migrações deixavam loggers existentes desativados. A revisão preserva os
handlers do processo; testes comprovam logs por classe sem conteúdo privado.
Gunicorn não registra URL de acesso com tokens; proxy/APM precisa seguir a mesma
regra documentada. SMTP conserva STARTTLS/TLS com validação de certificado.

SQLite e 14 tabelas permanecem. Backup online captura WAL confirmado, valida
integridade/FKs, usa arquivo privado, publicação atômica e recusa sobrescrever
ou seguir destino symlink. Restauração real em caminho novo foi testada.
Nenhuma conta/banco do usuário foi removida, e o catálogo permanece inalterado.
Redis foi usado somente em container temporário local para validar limites;
serviços/rotinas públicos não foram ativados.

A instalação limpa de produção importa todos os módulos necessários sem pytest
ou Playwright. Versões existentes foram preservadas; Gunicorn e Redis são as
adições justificadas por WSGI e limite compartilhado. `pip-audit` consultou 47
pacotes fixados sem encontrar vulnerabilidades conhecidas. `detect-secrets`
identificou candidatos em mensagens de validação e fixtures/testes; a revisão
não identificou credenciais reais. Isso não equivale a pentest ou atestado de
segurança/compliance, nem à análise integral de segredos no histórico Git.

## H. Validação

Os comandos, contagens finais e evidências de acessibilidade estão registrados
em [VALIDACAO-COMERCIAL.md](VALIDACAO-COMERCIAL.md). As primeiras falhas dos novos
testes de UI foram seletores inadequados para títulos de etapas ocultas e inputs
estilizados; foram ajustados para o elemento acessível/label real. A mudança
intencional do texto de recuperação também exigiu atualizar uma asserção da
jornada existente. Assertions de entrega, uso único e revogação foram preservadas.

## I. GitHub

O trabalho usa `refactor/commercial-readiness`, com commits por responsabilidade,
e tag `legacy-typescript` recuperável. Consulte `git log main..HEAD --oneline` ou
o histórico da branch para as referências finais. Nenhum merge automático ou
force push foi realizado. O resultado do envio remoto consta da entrega final.

## J. Pendências comerciais

Veja [PREPARACAO-COMERCIAL.md](PREPARACAO-COMERCIAL.md): Anthropic/SMTP reais,
fila durável, domínio/TLS, infraestrutura, quotas/custos, carga/monitoramento,
agendamentos e políticas de backups, responsável/contato/documentos jurídicos.
Não houve fabricação de credenciais, preços, empresa ou integração bem-sucedida.

## K. Conclusão

Categoria: **ambiente de testes validado**. Há melhorias concretas e uma receita
WSGI/Redis/SQLite verificada localmente. A oferta comercial permanece condicionada
às integrações e operação reais, confiabilidade de e-mail, decisões de orçamento/
suporte e revisão jurídica. Não se classifica o produto como implantação
comercial validada pela aparência, sintaxe ou resultado de testes locais.
