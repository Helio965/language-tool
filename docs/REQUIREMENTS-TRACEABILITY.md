# Rastreabilidade de requisitos — English AI

> Auditoria final do MVP: cada requisito dos materiais do projeto, onde está implementado, como foi verificado
> e o que ficou parcial ou fora do escopo. Fontes: Análise de requisitos (F1), Especificação de Casos de Uso (F2),
> fluxograma (F3) e tarefas da Pessoa 2 (F4) — ver [MVP-SCOPE.md](./MVP-SCOPE.md).

**Legenda:** ✅ atendido · 🟡 parcial (o que falta está descrito) · ⛔ fora do escopo do MVP / não feito

Caminhos abreviados: `core` = `packages/core/src`, `api` = `apps/api/src`, `web` = `apps/web/src`.
Testes: `core/test` = `packages/core/test`, `api/test` = `apps/api/test`, `web/test` = `apps/web/test`.

---

## 1. Requisitos funcionais (F1 §9)

| ID | Requisito | Status | Implementação | Verificação |
| --- | --- | --- | --- | --- |
| RF01 | Cadastro de usuário | ✅ | `core/application/services/authService.ts`, `POST /api/auth/register`, tela `/cadastro` | `services.test` (autenticação), `api.test` (cookie httpOnly), `web/test/auth.test` |
| RF02 | Autenticação segura | ✅ | scrypt + JWT em cookie httpOnly/SameSite=Strict, rate limit (`api/security`, `api/http`) | `api.test`, `security.test`, `auth.test` |
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
| RF20 | Exclusão de dados | ✅ | `DELETE /api/me` com senha; `ON DELETE CASCADE`; apagar conversas | `services.test`, `api.test` |

## 2. Requisitos não funcionais (F1 §10)

| ID | Requisito | Status | Como foi atendido | Limitação |
| --- | --- | --- | --- | --- |
| RNF01 | Usabilidade, foco em celular | ✅ | mobile first, uma ação principal por tela, linguagem simples ([UX-SPECIFICATION.md](./UX-SPECIFICATION.md)) | sem teste com usuários reais (roteiro proposto em UX-SPEC §12) |
| RNF02 | Responsividade | ✅ | 3 layouts (barra inferior, trilho, barra lateral); telas com 2 colunas no desktop | verificado em 390, 820 e 1440px (capturas em `design/screenshots`) |
| RNF03 | Desempenho | 🟡 | estado "IA preparando resposta"; histórico limitado a 12 mensagens; esforço `low` e timeout de 20 s no provedor real; correção de exercícios fechados sem IA | sem medição de latência com provedor real nem teste de carga; JavaScript da web em um único pacote (~205 KB gzip, sem divisão por rota) |
| RNF04 | Segurança | ✅ | scrypt, JWT em cookie httpOnly, CSRF por cabeçalho, helmet, CORS restrito, rate limit, zod, limite de 16 KB, checagem de dono (404), logs sem dados sensíveis, chaves só no `.env` do servidor | `api.test`, `security.test` |
| RNF05 | Privacidade / transparência | ✅ | página "Privacidade e dados", aceite dos termos, remoção de dados pessoais nas mensagens, contexto mínimo para a IA | texto informativo, não revisado juridicamente |
| RNF06 | Escalabilidade | 🟡 | API sem estado de sessão (JWT), núcleo independente de banco (portas), provedor de IA substituível | SQLite é arquivo único: para várias instâncias é preciso trocar o adaptador (ex.: PostgreSQL) — ver ARCHITECTURE §10 |
| RNF07 | Disponibilidade | ✅ | `FallbackAIService`: falha, timeout, recusa ou JSON inválido do provedor → modo demonstração | `ai.test` (fallback) |
| RNF08 | Manutenibilidade | ✅ | monorepo com `core` (domínio e casos de uso sem framework), `api` e `web`; TypeScript estrito; 180 testes | — |
| RNF09 | Acessibilidade | 🟡 | WCAG 2.1 AA como meta: contraste verificado, foco visível, rótulos, `aria-live`, `lang="en"`, movimento reduzido, link de pular navegação | sem auditoria automatizada (ex.: axe) nem teste com leitor de tela real |
| RNF10 | Compatibilidade | 🟡 | HTML/CSS padrão, sem APIs experimentais no navegador; fallback de hash quando o Web Crypto não está disponível | testado apenas no Chromium (Playwright); Safari/Firefox e aparelhos reais não testados |

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
| UC02 | Fazer login | ✅ | `/entrar` → Início ou etapa pendente | A1 credenciais inválidas (mensagem genérica) ✅ | `api.test`, `auth.test` |
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
| `.env.example` sem segredos e `.gitignore` | ✅ | raiz do repositório |
| Testes automatizados | ✅ | 147 (core) + 21 (API) + 12 (web) = 180 |

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
| Funcionar em dispositivos móveis | ✅ | layout mobile first verificado em 390px (emulado) |
| Autenticação e dados protegidos | ✅ | RNF04 |

## 9. Lacunas e limitações conhecidas (sem esconder)

| # | Item | Situação | Próximo passo sugerido |
| --- | --- | --- | --- |
| L1 | Protótipo no Figma | não criado (sem acesso) | seguir FIGMA-GUIDE.md e adicionar o link ao README |
| L2 | Provedor real de IA | implementado (`AnthropicProvider`) e coberto por testes com provedor simulado, **mas não executado contra a API real** neste ambiente (sem chave) | configurar `ANTHROPIC_API_KEY` e validar com o roteiro de AI-PROMPT-STRATEGY §8 |
| L3 | Recuperação de senha | tela e resposta neutra prontas; **e-mail não é enviado** | integrar serviço de e-mail transacional e token de redefinição |
| L4 | Lembretes de estudo | preferência salva, **sem envio** | notificações push ou e-mail |
| L5 | Pronúncia, voz e áudio | fora do escopo do MVP (F1 §7) | campo `phonetic` já previsto |
| L6 | Administração de conteúdo | sem telas (ator Administrador preparado com `role`) | CMS ou painel administrativo |
| L7 | Escala horizontal | SQLite em arquivo único | adaptador PostgreSQL implementando as mesmas portas |
| L8 | Acessibilidade e compatibilidade | verificações manuais e testes por papéis ARIA; só Chromium | axe + leitor de tela + Safari/Firefox/aparelhos reais |
| L9 | Modo demonstração da IA | roteiros e 25 regras de erros comuns; não entende frases fora dos padrões | usar provedor real para conversa livre |
| L10 | Política de privacidade | texto informativo do protótipo | revisão jurídica antes de uso real |
