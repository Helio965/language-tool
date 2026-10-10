# Escopo do MVP — English AI

> **Transição para Python:** os requisitos e as decisões acadêmicas deste documento
> foram preservados. A implementação atual roda com Flask/Jinja na raiz; a versão
> anterior e seus detalhes de framework estão em [legacy/MVP-SCOPE.md](legacy/MVP-SCOPE.md).
> Evidências da nova execução ficam em [MIGRATION-AUDIT.md](MIGRATION-AUDIT.md),
> não nas contagens/capturas históricas do protótipo TypeScript.

> Projeto acadêmico — MVP em desenvolvimento.
> Este documento registra a **análise dos materiais do projeto** e as decisões de escopo tomadas a partir deles. Ele não substitui os documentos originais: apenas os consolida.

## 1. Fontes analisadas

| # | Material | Conteúdo principal |
|---|----------|--------------------|
| F1 | **Análise de requisitos** (v1.0, 02/10/2026) | Contexto, objetivos, público, escopo do MVP, fora de escopo, atores, RF01–RF20, RNF01–RNF10, RN01–RN08, Modo Aprender, Modo Conversação, personalidade da IA, trilha de conteúdo, personalização, progresso, UC01–UC05, arquitetura conceitual, entidades, privacidade, segurança, riscos, critérios de aceitação, roadmap |
| F2 | **Especificação de Casos de Uso — English AI** (v1.0) | Atores e UC01–UC12 com fluxos principais e alternativos |
| F3 | **Fluxograma de caso de uso** (PDF) | Fluxo Usuários → Criar conta / Login / Configurar Perfil → Nivelamento → Aprender / Conversar → Aula / Chat IA → Exercício / Correção → Progresso → Revisão |
| F4 | **Imagem — Pessoa 2: Experiência do usuário e IA** | Tarefas de UX/IA e entregáveis (protótipo navegável e documento de comportamento da IA) |

## 2. Problema e objetivo (F1 §2–4)

Pessoas iniciantes — principalmente brasileiros — têm dificuldade para saber por onde começar, falta de prática de conversação, receio de errar, explicações inadequadas ao seu nível, conteúdos espalhados e pouca personalização.

**Objetivo:** uma plataforma, com foco inicial em dispositivos móveis, que combine **ensino estruturado, IA, conversação e acompanhamento de progresso** em um único ambiente. A IA atua como **ferramenta pedagógica**, não apenas como chatbot.

## 3. Funcionalidades do MVP (F1 §6 + F2)

| Funcionalidade | Origem |
|----------------|--------|
| Criação de conta | F1 RF01, F2 UC01 |
| Login / autenticação | F1 RF02, F2 UC02 |
| Perfil e configuração inicial (objetivo, nível percebido, experiência, interesses) | F1 RF03/RF04, F2 UC03 |
| Nivelamento com **nível estimado** | F1 RF05, F2 UC04 |
| Modo Aprender (aula → explicação → exemplos → exercício → correção → revisão) | F1 RF06–RF11, §12, F2 UC05–UC07 |
| Gramática e vocabulário por nível | F1 RF07, RF08, §15 |
| Exercícios com correção e explicação de erros | F1 RF09–RF11, F2 UC06–UC07 |
| Modo Conversação com IA, contexto e correção contextual | F1 RF12–RF14, §13, F2 UC09 |
| Personalidade da IA como camada de experiência | F1 RF13, §14 |
| Histórico básico respeitando privacidade | F1 RF15, RN07 |
| Progresso | F1 RF16, §17, F2 UC11 |
| Vocabulário estudado | F1 RF17, F2 UC10 |
| Revisão | F1 RF18, F2 UC08 |
| Preferências (idioma das explicações, intensidade das correções, histórico, notificações…) | F1 RF19, F2 UC12 |
| Exclusão de dados | F1 RF20, §21 |

## 4. Fora do escopo do MVP (F1 §7)

Não serão implementados como requisitos obrigatórios:

- reconhecimento de voz, avaliação automática de pronúncia e conversação por áudio;
- chamadas de vídeo;
- gamificação avançada e ranking entre usuários;
- múltiplos personagens/personalidades;
- marketplace;
- certificação oficial de proficiência;
- preparação completa para exames internacionais.

O modelo de dados e a arquitetura **deixam espaço** para alguns deles (ex.: campo opcional de pronúncia no vocabulário, provedor de IA substituível), sem implementá-los.

## 5. Divergências entre os materiais e decisões tomadas

Nenhum requisito foi substituído. Quando os documentos divergem, a decisão abaixo foi registrada e aplicada.

| # | Divergência | Decisão |
|---|-------------|---------|
| D1 | A **Análise de requisitos** numera UC01–UC05 (Criar conta, Realizar nivelamento, Realizar aula, Conversar com IA, Consultar progresso). A **Especificação de Casos de Uso** numera UC01–UC12 com outra ordem. | A **Especificação (F2)** é usada como numeração canônica por ser o documento dedicado e mais detalhado. Mapeamento: F1-UC01→UC01, F1-UC02→UC04, F1-UC03→UC05+UC06, F1-UC04→UC09, F1-UC05→UC11. |
| D2 | **F2 UC01** diz que, após o cadastro, o usuário vai para a *configuração inicial*. O **fluxograma** liga *Criar conta → Nivelamento* e mostra *Configurar Perfil* como entrada separada ("Perfil existente"). | Fluxo de novo usuário: **Cadastro → Configuração inicial (perfil de aprendizagem) → Nivelamento → Início**. A configuração inicial é curta (3 passos) e alimenta a personalização (RN06). *Configurar Perfil* também fica disponível a qualquer momento em **Perfil** (ramo "Perfil existente" do fluxograma). |
| D3 | O fluxograma não mostra para onde o **Login** leva. F2 UC02 diz "o sistema apresenta a tela principal". | Login → **Início**. Se o usuário não concluiu a configuração inicial ou o nivelamento, ele retoma **exatamente** a etapa pendente (não repete etapas concluídas). |
| D4 | **F1 UC05** acessa o progresso via *Perfil → Progresso*. O fluxograma coloca **Progresso** como ponto de convergência dos dois modos. | Progresso tem **tela própria** na navegação principal **e** atalho dentro de Perfil, atendendo aos dois materiais. Fim de aula e fim de conversa levam ao resumo/progresso. |
| D5 | F1 §15 define conteúdo de **Iniciante** e **Básico** e menciona "níveis posteriores". | Níveis estimados: **Iniciante, Básico, Intermediário, Avançado**. O conteúdo do MVP se concentra em Iniciante e Básico, com **uma aula de amostra** de Intermediário e de Avançado para demonstrar a progressão (RN02). |
| D6 | F1 §15 lista "alfabeto e pronúncia", mas F1 §7 tira reconhecimento de voz/pronúncia do MVP. | A aula de alfabeto usa apenas **indicações escritas** de pronúncia. Nenhum recurso de áudio/voz é implementado. |
| D7 | O ator **Administrador** existe (F1 §8, F2 §1), mas não há caso de uso de administração no MVP. | O usuário tem um campo `role` preparado; **não há telas de administração**. O conteúdo é versionado em código e sincronizado no banco (ver ARCHITECTURE.md). |
| D8 | F1 RF14 fala em "modo de interação escolhido pelo usuário"; F2 UC12 fala em "intensidade das correções". | Preferência **intensidade das correções**: *Leve*, *Equilibrada* (padrão) e *Detalhada*. Regras em [IA-BEHAVIOR.md](./IA-BEHAVIOR.md). |
| D9 | O nome da assistente de IA não está definido pela equipe. | Proposta: **Lumi**. O nome é uma **configuração** (`ASSISTANT_PERSONA` em `ai/personality.py`), não uma dependência estrutural. |
| D10 | F2 UC01-A2 exige informar que a conta já existe (o que permite descobrir e-mails cadastrados). | O requisito é mantido. A mitigação é **limitação de tentativas** no endpoint; a recuperação de senha **não** revela se o e-mail existe. Registrado em ARCHITECTURE.md §Segurança. |
| D11 | O fluxograma não mostra uma tela inicial; o prompt do projeto pede uma Página Inicial. | A Página Inicial ("Início") é o hub pós-nivelamento e responde à pergunta *"qual é a próxima coisa que devo fazer?"*. |

## 6. Atores (F1 §8, F2 §1)

| Ator | Papel no MVP |
|------|--------------|
| Usuário | Ator principal de todos os casos de uso |
| IA | Camada pedagógica (explicação, correção, conversação) — implementada pelo `AIService` |
| Serviço de IA | Provedor externo de modelos — substituível; o MVP traz um provedor **mock** e um adaptador para provedor real |
| Administrador | Preparado no modelo (`role`), sem telas no MVP |

## 7. Tarefas da Pessoa 2 — Experiência do usuário e IA (F4)

| Tarefa | Como foi atendida |
|--------|-------------------|
| Criar os protótipos das telas no Figma | **Sem acesso ao Figma nesta entrega.** O protótipo foi especificado em `design/` (design system, componentes, telas) e implementado inicialmente em `apps/web` e agora em `templates/`/`static/` com backend Python. O guia `design/FIGMA-GUIDE.md` explica como reproduzi-lo no Figma. |
| Desenhar login, cadastro e página inicial | Especificadas em `design/SCREEN-SPECIFICATIONS.md` e implementadas |
| Desenhar os modos Aprender e Conversação | Especificados e implementados |
| Definir o comportamento da IA em cada modo | `docs/IA-BEHAVIOR.md` §3–4 |
| Documentar personalidade, correções e adaptação ao nível | `docs/IA-BEHAVIOR.md` §2, §5–7 |
| Especificar como o usuário visualizará o progresso | `docs/UX-SPECIFICATION.md` §Progresso + tela de Progresso |
| **Entregável:** protótipo navegável | Flask/Jinja (`python app.py`); versão anterior em `apps/web` preservada |
| **Entregável:** documento de comportamento da IA | `docs/IA-BEHAVIOR.md` |

> A imagem também mostra, no topo, os entregáveis de outra frente: *diagrama de classes, DER e documento de arquitetura inicial*. Eles foram produzidos em `docs/DATABASE-MODEL.md` e `docs/ARCHITECTURE.md` para manter a implementação coerente.

## 8. Critérios de aceitação do MVP (F1 §24)

- [x] O usuário consegue criar uma conta.
- [x] O usuário consegue realizar o nivelamento.
- [x] O usuário consegue acessar o Modo Aprender.
- [x] O usuário consegue acessar o Modo Conversação.
- [x] O usuário consegue conversar com a IA (modo demonstração ou provedor real configurado).
- [x] O sistema consegue explicar conceitos básicos.
- [x] O sistema consegue corrigir exercícios.
- [x] O sistema consegue registrar progresso.
- [x] O usuário consegue visualizar seu progresso.
- [x] O sistema funciona em dispositivos móveis (mobile first).
- [x] Informações de autenticação e dados do usuário protegidos (hash de senha, cookie httpOnly, validação, limitação de tentativas).

A verificação detalhada de cada item está em [REQUIREMENTS-TRACEABILITY.md](./REQUIREMENTS-TRACEABILITY.md).

## 9. Riscos considerados (F1 §23)

| Risco | Mitigação no MVP |
|-------|------------------|
| Custo da IA | Modo mock por padrão; limites de tamanho de mensagem e de histórico enviado ao modelo; rate limit nas rotas de IA |
| Respostas incorretas | Exercícios fechados usam gabarito **determinístico**; produção livre usa requisitos locais e problemas de gramática/significado da avaliação por regras/IA. Trechos e formato são validados; aviso de limitações e revisão humana continuam necessários |
| Dependência externa | Provedor substituível e erro seguro; demonstração explícita disponível. O fallback automático anterior foi substituído para não mascarar falha externa como sucesso |
| Privacidade | Contexto da conta com primeiro nome e dados pedagógicos mínimos; histórico opcional, exclusão e saneamento de e-mail/telefone/CPF/cartão/senha declarada. Nomes e outros dados pessoais no texto livre podem escapar às regras; a pessoa é orientada a não compartilhá-los |
| Escopo | Este documento e a lista de fora de escopo |
