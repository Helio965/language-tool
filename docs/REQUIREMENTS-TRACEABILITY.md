# Rastreabilidade de requisitos — English AI

> Auditoria final do MVP: cada requisito dos materiais do projeto, onde está implementado, como foi verificado
> e o que ficou parcial ou fora do escopo. Fontes: Análise de requisitos (F1), Especificação de Casos de Uso (F2),
> fluxograma (F3) e tarefas da Pessoa 2 (F4) — ver [MVP-SCOPE.md](./MVP-SCOPE.md).

**Legenda:** ✅ atendido · 🟡 parcial (o que falta está descrito) · ⛔ fora do escopo do MVP / não feito

Caminhos abreviados: `core` = `packages/core/src`, `api` = `apps/api/src`, `web` = `apps/web/src`.
Testes: `core/test` = `packages/core/test`, `api/test` = `apps/api/test`, `web/test` = `apps/web/test`,
`e2e` = testes de ponta a ponta com Playwright (`e2e/demo.spec.ts`, `e2e/http.spec.ts`).

---

## 1. Requisitos funcionais (F1 §9)

| ID | Requisito | Status | Implementação | Verificação |
| --- | --- | --- | --- | --- |
| RF01 | Cadastro de usuário | ✅ | `core/application/services/authService.ts`, `POST /api/auth/register`, tela `/cadastro`; e-mail de boas-vindas em segundo plano (`api/email`) | `services.test` (autenticação), `api.test` (cookie httpOnly), `web/test/auth.test`, `api/passwordReset.test` (boas-vindas, falha de SMTP não desfaz a conta) |
| RF02 | Autenticação segura | ✅ | scrypt + JWT com versão da sessão em cookie httpOnly/SameSite=Strict, rate limit (`api/security`, `api/http`); recuperação de senha com token de uso único guardado como hash ([EMAIL-AND-AUTH.md](./EMAIL-AND-AUTH.md)); ciclo de vida da sessão no front-end (`web/app/session.tsx`, ver [ARCHITECTURE.md §6.1](./ARCHITECTURE.md)) | `api.test`, `security.test`, `auth.test`, `session.test`, `e2e`; recuperação de senha e encerramento de sessões: `core/passwordReset.test`, `api/passwordReset.test`, `web/passwordReset.test`, `e2e` |
| RF03 | Perfil do usuário | ✅ | `LearningProfile` (`core/domain/entities.ts`), `/configuracao`, `/perfil`, `/perfil/editar` | jornada em `services.test` e `api.test` |
| RF04 | Definição de objetivo | ✅ | objetivos em `core/domain/profile.ts` (inclui os 5 exemplos da F1); etapa 1 da configuração | jornada |
| RF05 | Nivelamento | ✅ | `core/domain/placement.ts` (3 etapas adaptativas, 12 perguntas), `/nivelamento` | `rules.test` (nivelamento), jornada |
| RF06 | Modo Aprender | ✅ | trilha `/aprender`, aula `/aprender/aula/:id` | jornada, capturas `mobile-07`/`desktop-03` |
| RF07 | Conteúdo de gramática | ✅ | 12 aulas próprias (5 Iniciante, 5 Básico, 1 Intermediário, 1 Avançado) em `core/content/lessons` | `content.test` |
| RF08 | Vocabulário por nível | ✅ | 67 palavras com nível, tradução, significado, classe e exemplos (`core/content/vocabulary.ts`) | `content.test` |
| RF09 | Exercícios | ✅ | 65 exercícios de 5 tipos (múltipla escolha, lacuna, seleção, tradução, escrita livre) | `content.test` (consistência de cada exercício), `exerciseRunner.test` |
| RF10 | Correção | ✅ | gabarito determinístico (`core/domain/grading.ts`) + regras/IA para escrita livre | `rules.test`, jornada |
| RF11 | Explicação dos erros adequada ao nível | ✅ | `buildCorrection` + `levelPolicy.ts` (idioma e detalhe por nível) | `grammar.test` (formato e idioma) |
| RF12 | Conversação com a IA | ✅ | `conversationService.ts`, `MockAIService`/`LLMAIService`, `/conversar/:id` | `ai.test`, `services.test`, `conversation.test` |
| RF13 | Personalidade da IA | ✅ | `core/ai/persona.ts` (Lumi) + camada base do prompt | `ai.test` (prompt e honestidade sobre ser IA) |
| RF14 | Correção durante conversação conforme o modo escolhido | ✅ | `core/ai/correctionPolicy.ts` (Leve/Equilibrada/Detalhada) | `grammar.test` (política), `services.test` |
| RF15 | Histórico respeitando privacidade | ✅ | tentativas, progresso e conversas; preferência "Salvar histórico"; retenção de 90 dias | `services.test` (RN07, retenção) |
| RF16 | Progresso | ✅ | `core/domain/progress.ts`, `/progresso`, resumo no Início | `rules.test` (progresso), jornada |
| RF17 | Vocabulário estudado | ✅ | `UserVocabulary` com status e revisão espaçada; `/vocabulario` | jornada (`newWords`), `rules.test` (agendamento) |
| RF18 | Revisão | ✅ | `core/domain/review.ts` (erros, nota baixa, espaçada, conversa, palavras); `/revisao` | `rules.test` (revisão), jornada |
| RF19 | Configurações | 🟡 | `/preferencias`: idioma, intensidade, tamanho das respostas, tradução, meta diária, histórico, lembretes | `services.test`, `api.test`. **Falta:** os lembretes são salvos, mas não enviados (sem serviço de notificação no MVP) |
| RF20 | Exclusão de dados | ✅ | `DELETE /api/me` com senha; `ON DELETE CASCADE`; apagar conversas; depois da exclusão o app apaga os dados da memória e vira visitante | `services.test`, `api.test`, `session.test` (TESTE 7), `e2e` |

## 2. Requisitos não funcionais (F1 §10)

| ID | Requisito | Status | Como foi atendido | Limitação |
| --- | --- | --- | --- | --- |
| RNF01 | Usabilidade, foco em celular | ✅ | mobile first, uma ação principal por tela, linguagem simples ([UX-SPECIFICATION.md](./UX-SPECIFICATION.md)) | sem teste com usuários reais (roteiro proposto em UX-SPEC §12) |
| RNF02 | Responsividade | ✅ | 3 layouts (barra inferior, trilho, barra lateral); telas com 2 colunas no desktop | verificado em 390, 820 e 1440px (capturas em `design/screenshots`); sem rolagem horizontal de 320 a 1920px, inclusive nas larguras equivalentes a zoom de 125%, 150% e 200% (verificação manual no Chromium) e em 320px nas telas principais (`e2e`) |
| RNF03 | Desempenho | 🟡 | estado "IA preparando resposta"; histórico limitado a 12 mensagens; esforço `low` e timeout de 20 s no provedor real; correção de exercícios fechados sem IA | sem medição de latência com provedor real nem teste de carga; JavaScript da web em um único pacote (~219 KB gzip, sem divisão por rota) |
| RNF04 | Segurança | ✅ | scrypt, JWT em cookie httpOnly (nunca no `localStorage`), CSRF por cabeçalho, helmet, CORS restrito, rate limit, zod, limite de 16 KB, checagem de dono (404), conta exibida × conta do cookie (`X-Session-User` → 401), cache privado por conta no front-end, token de redefinição de senha só como hash (validade curta, uso único), versão da sessão (troca de senha encerra as sessões), links de e-mail só com `APP_PUBLIC_URL`, credenciais SMTP só no servidor, logs sem dados sensíveis, chaves só no `.env` do servidor | `api.test`, `security.test`, `session.test`, `e2e` (cookie httpOnly/Strict, nenhuma requisição privada depois de sair) |
| RNF05 | Privacidade / transparência | ✅ | página "Privacidade e dados", aceite dos termos, remoção de dados pessoais nas mensagens, contexto mínimo para a IA | texto informativo, não revisado juridicamente |
| RNF06 | Escalabilidade | 🟡 | API sem estado de sessão (JWT), núcleo independente de banco (portas), provedor de IA substituível | SQLite é arquivo único: para várias instâncias é preciso trocar o adaptador (ex.: PostgreSQL) — ver ARCHITECTURE §10 |
| RNF07 | Disponibilidade | ✅ | `FallbackAIService`: falha, timeout, recusa ou JSON inválido do provedor → modo demonstração | `ai.test` (fallback) |
| RNF08 | Manutenibilidade | ✅ | monorepo com `core` (domínio e casos de uso sem framework), `api` e `web`; TypeScript estrito; 276 testes unitários/integração + 16 de ponta a ponta | — |
| RNF09 | Acessibilidade | 🟡 | WCAG 2.1 AA como meta: contraste verificado, foco visível, rótulos, `aria-live`, `lang="en"`, movimento reduzido, link de pular navegação, diálogos com título associado, campos sempre selecionáveis e editáveis, botões que quebram linha em telas estreitas | sem auditoria automatizada (ex.: axe) nem teste com leitor de tela real |
| RNF10 | Compatibilidade | 🟡 | HTML/CSS padrão, sem APIs experimentais no navegador; fallback de hash quando o Web Crypto não está disponível; sincronização entre abas com `BroadcastChannel` quando disponível | testado apenas no Chromium (Playwright, inclusive a suíte `e2e`); Safari/Firefox e aparelhos reais não testados |

## 3. Regras de negócio (F1 §11)

| ID | Regra | Status | Onde |
| --- | --- | --- | --- |
| RN01 | Dois modos: Aprender e Conversar | ✅ | navegação, cores e comportamentos distintos; `modeLayer` do prompt; IA-BEHAVIOR §3–4 |
| RN02 | Progressão de dificuldade | ✅ | aulas ordenadas por nível (`content.test`: "segue uma progressão de dificuldade") |
| RN03 | Adequação ao nível | ✅ | trilha e assuntos marcam conteúdo acima do nível; `levelPolicy.ts` |
| RN04 | Não interromper constantemente na conversa | ✅ | `correctionPolicy.ts` (intervalo mínimo, correções guardadas para o resumo), recast, cartão recolhido |
| RN05 | Explicações conforme o nível | ✅ | idioma e detalhe por nível; "Ver no outro idioma" |
| RN06 | Personalização por perfil e desempenho | ✅ | próxima aula, revisões por erro, assuntos recomendados pelos interesses, dificuldades no prompt |
| RN07 | Controle sobre dados e conversas | ✅ | salvar histórico (sim/não), apagar conversas, excluir conta, retenção automática |
| RN08 | Conteúdo próprio | ✅ | todo o conteúdo pedagógico foi escrito para o projeto (`core/content`); fontes com licença OFL |

## 4. Casos de uso (F2 — numeração canônica)

| UC | Caso de uso | Status | Tela | Fluxos alternativos | Verificação |
| --- | --- | --- | --- | --- | --- |
| UC01 | Criar conta | ✅ | `/cadastro` → `/configuracao` | A1 dados inválidos ✅ · A2 conta existente com opção de login ✅ | `services.test`, `api.test`, `auth.test` |
| UC02 | Fazer login | ✅ | `/entrar` → Início ou etapa pendente | A1 credenciais inválidas (mensagem genérica) ✅ · esqueci a senha (link por e-mail, `/redefinir-senha/:token`) ✅ | `api.test`, `auth.test`, `passwordReset.test` (core, API, web), `e2e` |
| UC03 | Configurar perfil | ✅ | `/configuracao`, `/perfil/editar` | — | jornada |
| UC04 | Realizar nivelamento | ✅ | `/nivelamento`, `/perfil/nivelamento` | resultado como estimativa ✅ · pular ✅ | `rules.test`, jornada |
| UC05 | Iniciar aula | ✅ | `/aprender/aula/:id` (explicação, "Explicar de outro jeito", exemplos) | — | `ai.test`, jornada |
| UC06 | Realizar exercício | ✅ | `ExerciseRunner` | erro ao verificar → tentar de novo ✅ | `exerciseRunner.test`, jornada |
| UC07 | Consultar correção | ✅ | `CorrectionCard` (Sua frase / Forma recomendada / Explicação) | — | `grammar.test` (exemplo "She go to school"), `correctionCard.test` |
| UC08 | Revisar conteúdo | ✅ | `/revisao`, `/revisao/:id` | — | `rules.test`, jornada |
| UC09 | Conversar com IA | ✅ | `/conversar`, `/conversar/:id` | Naturalidade > correção ✅ · "You said / More natural" ✅ | `ai.test`, `services.test`, `conversation.test` |
| UC10 | Consultar vocabulário | 🟡 | `/vocabulario` (tradução, exemplos, classe, nível, revisão) | — | jornada. **Falta:** pronúncia (campo `phonetic` preparado, sem áudio — fora do escopo) |
| UC11 | Consultar progresso | ✅ | `/progresso` + atalho no Perfil (F1-UC05) | — | `rules.test`, jornada |
| UC12 | Configurar preferências | 🟡 | `/preferencias` | — | `services.test`, `api.test`. **Falta:** envio de notificações |

Mapeamento dos UCs da Análise (F1 §18): F1-UC01→UC01, F1-UC02→UC04, F1-UC03→UC05/UC06, F1-UC04→UC09,
F1-UC05→UC11 (todos ✅).

## 5. Fluxograma (F3)

| Elemento | Status | Onde |
| --- | --- | --- |
| Novo usuário → Criar conta | ✅ | `/cadastro` |
| Usuário existente → Login | ✅ | `/entrar` |
| Perfil existente → Configurar perfil | ✅ | `/perfil` → `/perfil/editar` |
| Nivelamento | ✅ | `/nivelamento` (após a configuração inicial — decisão D2 do MVP-SCOPE) |
| Aprender → Aula → Exercício | ✅ | `/aprender` → aula → exercícios |
| Conversar → Chat IA → Correção | ✅ | `/conversar` → chat → correções e resumo |
| Progresso (convergência) | ✅ | resumo da aula e da conversa levam ao progresso |
| Revisão | ✅ | `/revisao` |

## 6. Tarefas da Pessoa 2 — Experiência do usuário e IA (F4)

| Tarefa | Status | Evidência |
| --- | --- | --- |
| Criar os protótipos das telas no Figma | ⛔ | **Não feito: sem acesso ao Figma neste ambiente.** Substituído por protótipo navegável em código + [FIGMA-GUIDE.md](../design/FIGMA-GUIDE.md) com variáveis, componentes e fluxos para a equipe montar o arquivo |
| Desenhar login, cadastro e página inicial | ✅ | telas implementadas; [SCREEN-SPECIFICATIONS.md](../design/SCREEN-SPECIFICATIONS.md) §1–7; capturas |
| Desenhar os modos Aprender e Conversação | ✅ | telas implementadas; SCREEN-SPECIFICATIONS §8–12 |
| Definir o comportamento da IA em cada modo | ✅ | [IA-BEHAVIOR.md](./IA-BEHAVIOR.md) §3–4 + código (`correctionPolicy`, `prompts`) |
| Documentar personalidade, correções e adaptação ao nível | ✅ | IA-BEHAVIOR §2, §5, §6 |
| Especificar como o usuário visualizará o progresso | ✅ | [UX-SPECIFICATION.md §7](./UX-SPECIFICATION.md#7-visualização-do-progresso) + tela `/progresso` |
| **Entregável:** protótipo navegável | ✅ | `apps/web` em modo demonstração (`npm run dev`) |
| **Entregável:** documento de comportamento da IA | ✅ | `docs/IA-BEHAVIOR.md` (+ `docs/AI-PROMPT-STRATEGY.md`) |

## 7. Entregáveis do projeto

| Entregável | Status | Arquivo |
| --- | --- | --- |
| README | ✅ | [README.md](../README.md) |
| Arquitetura | ✅ | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Comportamento da IA | ✅ | [IA-BEHAVIOR.md](./IA-BEHAVIOR.md) |
| Estratégia de prompts | ✅ | [AI-PROMPT-STRATEGY.md](./AI-PROMPT-STRATEGY.md) |
| Fluxos de usuário | ✅ | [USER-FLOWS.md](./USER-FLOWS.md) |
| Escopo do MVP | ✅ | [MVP-SCOPE.md](./MVP-SCOPE.md) |
| Especificação de UX | ✅ | [UX-SPECIFICATION.md](./UX-SPECIFICATION.md) |
| Modelo de dados (DER e diagrama de classes) | ✅ | [DATABASE-MODEL.md](./DATABASE-MODEL.md) |
| Design system | ✅ | [DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md) |
| Guia do Figma | ✅ | [FIGMA-GUIDE.md](../design/FIGMA-GUIDE.md) (sem arquivo Figma — ver §6) |
| Especificação de telas | ✅ | [SCREEN-SPECIFICATIONS.md](../design/SCREEN-SPECIFICATIONS.md) |
| Componentes | ✅ | [COMPONENTS.md](../design/COMPONENTS.md) |
| Autenticação e e-mail | ✅ | [EMAIL-AND-AUTH.md](./EMAIL-AND-AUTH.md) |
| Página pública | ✅ | `/` (`apps/web/src/features/landing`), ver [UX-SPECIFICATION.md §3.1](./UX-SPECIFICATION.md) |
| `.env.example` sem segredos e `.gitignore` | ✅ | raiz do repositório |
| Testes automatizados | ✅ | 163 (core) + 60 (API) + 53 (web) = 276, mais 16 de ponta a ponta (Playwright, modos demonstração e http) |

## 8. Critérios de aceitação do MVP (F1 §24)

| Critério | Status | Evidência |
| --- | --- | --- |
| Criar conta | ✅ | UC01 |
| Realizar o nivelamento | ✅ | UC04 |
| Acessar o Modo Aprender | ✅ | UC05 |
| Acessar o Modo Conversação | ✅ | UC09 |
| Conversar com a IA | ✅ | modo demonstração; provedor real implementado (ver §9) |
| Explicar conceitos básicos | ✅ | aulas + "Explicar de outro jeito" |
| Corrigir exercícios | ✅ | RF10 |
| Registrar progresso | ✅ | RF15/RF16 |
| Visualizar o progresso | ✅ | `/progresso` |
| Funcionar em dispositivos móveis | ✅ | layout mobile first verificado em 390px (emulado) e sem rolagem horizontal a partir de 320px |
| Autenticação e dados protegidos | ✅ | RNF04 |

## 9. Lacunas e limitações conhecidas (sem esconder)

| # | Item | Situação | Próximo passo sugerido |
| --- | --- | --- | --- |
| L1 | Protótipo no Figma | não criado (sem acesso) | seguir FIGMA-GUIDE.md e adicionar o link ao README |
| L2 | Provedor real de IA | implementado (`AnthropicProvider`) e coberto por testes com provedor simulado, **mas não executado contra a API real** neste ambiente (sem chave) | configurar `ANTHROPIC_API_KEY` e validar com o roteiro de AI-PROMPT-STRATEGY §8 |
| L3 | Recuperação de senha e e-mails | **implementados** (link por e-mail com token guardado como hash, 15 min, uso único; boas-vindas). O envio por SMTP foi testado com o transporte do nodemailer em memória e com a caixa de saída local, **não contra um servidor SMTP real** neste ambiente. Sem confirmação de e-mail no cadastro e sem fila de envio | configurar SMTP (`SMTP_HOST`, `MAIL_FROM`, `APP_PUBLIC_URL`) e validar a entrega; fila com nova tentativa; confirmação de e-mail |
| L4 | Lembretes de estudo | preferência salva, **sem envio** | notificações push ou e-mail |
| L5 | Pronúncia, voz e áudio | fora do escopo do MVP (F1 §7) | campo `phonetic` já previsto |
| L6 | Administração de conteúdo | sem telas (ator Administrador preparado com `role`) | CMS ou painel administrativo |
| L7 | Escala horizontal | SQLite em arquivo único | adaptador PostgreSQL implementando as mesmas portas |
| L8 | Acessibilidade e compatibilidade | verificações manuais e testes por papéis ARIA; só Chromium | axe + leitor de tela + Safari/Firefox/aparelhos reais |
| L9 | Modo demonstração da IA | roteiros e 25 regras de erros comuns; não entende frases fora dos padrões | usar provedor real para conversa livre |
| L10 | Política de privacidade | texto informativo do protótipo | revisão jurídica antes de uso real |
| L11 | Aviso de sessão expirada | o motivo do fim da sessão fica na memória da página: depois de recarregar, a pessoa vai ao login **sem** o aviso "Sua sessão expirou" | guardar o motivo em `sessionStorage` se o aviso depois de recarregar for importante |
| L12 | Tamanho do JavaScript | um único arquivo (~219 KB com gzip, 712 KB sem compressão); o Vite avisa que passa de 500 KB | dividir por rota com `React.lazy` (a página pública e as telas autenticadas são boas fronteiras) |
| L13 | Revogação de sessão no logout | sair remove o cookie, mas o token continua válido no servidor até vencer (72 h) ou até a senha mudar | lista de revogação ou versão da sessão também no logout |

## 10. Testes de regressão da auditoria de sessão

A auditoria de estabilidade (sair da conta, sessão expirada, troca de conta, cache privado) pediu, no mínimo, os
testes abaixo. Todos rodam em `npm test` (`web/test`) ou em `npm run test:e2e`.

| # | Cenário | Onde |
| --- | --- | --- |
| 1 | Demo → Alex → Perfil → Sair → visitante; rota protegida leva ao login | `session.test` (TESTE 1/2), `e2e` demo |
| 2 | Depois de sair **não** aparece "Sua sessão expirou" | `session.test` (TESTE 1/2), `e2e` demo |
| 3 | Sessão expirada de verdade → uma única transição para o login e retorno à página | `session.test` (TESTE 3), `e2e` demo e http |
| 4 | UNAUTHENTICATED não oferece "Tentar de novo" | `session.test` (TESTE 4), `e2e` demo |
| 5 | Alex → sair → nova conta → Perfil mostra a conta nova | `session.test` (TESTE 5) |
| 6 | Conta A → sair → conta B sem nenhum cache de A | `session.test` (TESTE 6), `e2e` http |
| 7 | Excluir conta → visitante → Voltar não revela dados | `session.test` (TESTE 7), `e2e` http |
| 8 | Configuração inicial → Sair funciona | `session.test` (TESTE 8) |
| 9 | Nivelamento → Sair funciona | `session.test` (TESTE 9) |
| 10 | Cadastro completo | `session.test` (TESTE 10), `e2e` http |
| 11 | Login correto | `auth.test` ("após entrar, volta para a página…"), `e2e` demo |
| 12 | Login incorreto | `auth.test` ("mensagem genérica…"), `e2e` demo e http |
| 13 | Recarregar rota protegida com sessão | `session.test` (TESTE 13), `e2e` http |
| 14 | Recarregar sem sessão | `session.test` (TESTE 14) |
| 15 | Erro de rede → "Tentar de novo" funciona | `session.test` (TESTE 15) |
| 16 | Campos continuam permitindo selecionar texto | `e2e` demo ("seleção de texto") |
| 17 | Texto estrutural não pode ser selecionado | `e2e` demo ("seleção de texto") |

Os testes 16 e 17 ficam só no navegador real: o jsdom não aplica o CSS do app, então não mede `user-select`.
Testes adicionais da mesma auditoria: saída em outra aba (`e2e` demo), conta exibida × cookie (`api.test`),
armazenamento do modo demonstração consistente entre abas (`services.test`), autosave de preferências em sequência
e clique duplo no nivelamento (`session.test`).

## 11. Fase 2 — página pública, e-mail e recuperação de senha

### 11.1 Testes pedidos e onde estão

Abreviações: `core` = `packages/core/test/passwordReset.test.ts`, `api` = `apps/api/test/passwordReset.test.ts`,
`email` = `apps/api/test/email.test.ts`, `web` = `apps/web/test/passwordReset.test.tsx`,
`landing` = `apps/web/test/landing.test.tsx`, `e2e` = `e2e/*.spec.ts`.

| # | Cenário | Onde |
| --- | --- | --- |
| 1 | Pedido com conta existente | `core` ("gera um link só quando a conta existe"), `api`, `e2e` http |
| 2 | Pedido com e-mail inexistente | `core`, `api`, `web`, `e2e` http ("e-mail sem conta") |
| 3 | Respostas externas iguais | `api` (mesmo status, corpo e cabeçalhos) |
| 4 | E-mail/token só quando a conta existe | `core` (retorna `null`), `api` (caixa de saída só com o endereço existente), `e2e` http |
| 5 | Token válido | `core`, `api`, `web` |
| 6 | Token inválido | `core`, `api`, `web` |
| 7 | Token adulterado | `core`, `api` |
| 8 | Token vencido | `core` (inclusive o limite exato), `api`, `web` |
| 9 | Uso único | `core` (inclusive envios simultâneos), `api`, `web`, `e2e` http |
| 10 | Novo pedido invalida o anterior | `core`, `api` |
| 11 | Senha nova funciona | `core`, `api`, `web`, `e2e` demo e http |
| 12 | Senha antiga não funciona | `core`, `api`, `web`, `e2e` http |
| 13 | Política de senha | `core`, `api`, `web` (mesma política do cadastro; erro não consome o link) |
| 14 | Rate limit | `api` (429 no 11º pedido do mesmo IP) |
| 15 | Não revela existência de conta | `api` (respostas iguais, nenhum e-mail para endereço desconhecido, logs sem token nem e-mail) |
| — | E-mail: destinatário, assunto, template, URL, validade, boas-vindas, sem senha, sem hash, falha do mailer | `email`, `api` |
| — | Falha de SMTP no cadastro (conta continua) e na recuperação (mesma resposta, sem detalhes) | `api` |
| — | Sessões antigas encerradas após a troca de senha | `core` (versão da sessão), `api` (dois aparelhos, cookie antigo), `web`, `e2e` http |
| — | Página pública: renderiza, cabeçalho, CTAs, links, Entrar, Criar conta, demonstração, âncoras, celular, sessão ativa em `/`, ausência de conteúdo falso | `landing`, `e2e` demo ("página pública no celular") e http |
| — | Jornada página pública → cadastro → configuração → nivelamento → Início | `e2e` http |
| — | Login → esqueci a senha → link pela caixa de saída de teste → senha nova → login; senha antiga recusada | `e2e` http |

Nenhum teste envia e-mail de verdade: `MemoryMailer`/mailer falso nos testes de unidade e integração, caixa de
saída local no servidor dos testes E2E.

### 11.2 Critérios de aceitação

| Grupo | Critério | Status | Evidência |
| --- | --- | --- | --- |
| Página pública | `/` completa: cabeçalho, hero, problema, como funciona, Aprender, Conversar, IA, Progresso, Segurança, chamada final, rodapé | ✅ | `features/landing`, `landing.test` |
| | Responsiva e sem rolagem horizontal a partir de 320px | ✅ | `e2e` demo (320px e celular), verificação em 320/390/820/1440px |
| | Acessível (menu com `aria-expanded`, Esc, foco no título da seção, movimento reduzido) | ✅ | `landing.test`, `e2e` demo |
| | Identidade visual do English AI (mesmos tokens e componentes) | ✅ | `design/screenshots/*-01-pagina-publica.jpg` |
| E-mail | Serviço centralizado (`EmailService`) | ✅ | `apps/api/src/email/` |
| | Caixa de saída local e mailer em memória | ✅ | `OutboxMailer`, `MemoryMailer` |
| | SMTP real configurável | ✅ (não executado contra servidor real — ver L3) | `SmtpMailer`, `email.test` |
| | Template base, boas-vindas e recuperação | ✅ | `templates/` |
| | Sem credenciais no front-end; `.env.example` só com exemplos | ✅ | `config/env.ts`, `.env.example` |
| Recuperação de senha | Pedido real, anti-enumeração, token seguro, só hash no banco, validade, uso único | ✅ | §11.1 |
| | Página de senha nova; senha nova funciona, antiga não; links inválidos tratados | ✅ | `/redefinir-senha/:token`, §11.1 |
| Regressão | Logout, cache por conta, sessão entre abas, demo e http continuam funcionando; área interna não redesenhada | ✅ | os 200 testes e os 11 E2E anteriores continuam passando, sem alteração no corpo dos testes (só as linhas de import dos arquivos E2E ganharam os novos helpers); telas internas sem mudanças de estilo |
