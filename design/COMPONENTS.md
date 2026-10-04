# Componentes — English AI

> Biblioteca de componentes do protótipo (`apps/web/src/components`). Cada componente usa só os tokens de
> [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). Para recriar no Figma, ver [FIGMA-GUIDE.md](./FIGMA-GUIDE.md) —
> os nomes de propriedades abaixo são os mesmos das *variants* sugeridas.

Convenções:

- **Cor de acento por modo:** componentes com `accent` usam `--accent`, que vale `--learn` (azul) no Modo
  Aprender e `--talk` (coral) no Modo Conversação (`[data-mode]`).
- **Tamanho de toque:** controles interativos têm no mínimo 44px de altura (`--touch`), exceto o botão `sm`
  (36px), usado só em ações secundárias.
- **Foco:** anel de 3px `--learn` em `:focus-visible`, com 2px de afastamento.

---

## 1. Ações

### Button — `Button.tsx`

| Propriedade | Valores | Observações |
| --- | --- | --- |
| `variant` | `primary` (tinta), `accent` (cor do modo), `secondary` (contorno), `ghost` (texto), `danger` (amora) | um `primary`/`accent` por tela |
| `size` | `sm` 36px · `md` 44px · `lg` 52px | `lg` para a ação principal no celular |
| `block` | sim/não | ocupa a largura toda |
| `icon` / `iconEnd` | ícone Lucide | ícone de seta no fim indica avanço |
| `loading` + `loadingLabel` | — | troca o texto ("Criando sua conta…"), mostra spinner e bloqueia clique duplo |
| `to` | rota | renderiza um link com a mesma aparência (navegação ≠ ação) |

Estados: padrão, hover (eleva 1px), pressionado, foco, desabilitado (50% de opacidade), carregando.
Em telas de até 420px, rótulos longos quebram linha em vez de empurrar o layout para fora da tela.

## 2. Formulários

### TextField / PasswordField — `TextField.tsx`

Rótulo sempre visível acima do campo; dica e erro abaixo, ligados por `aria-describedby`.
Estados: vazio, preenchido, foco, erro (`aria-invalid`, borda e mensagem em `--error`), desabilitado.
`PasswordField` acrescenta o botão "Mostrar/Ocultar senha".

### Checkbox — `Controls.tsx`

Caixa 22px + texto (pode conter link). Mostra erro abaixo quando obrigatório (aceite dos termos).

### Switch — `Controls.tsx`

Interruptor com título e descrição, usado em preferências (`role="switch"`, `aria-checked`).

### ChoiceGroup — `Controls.tsx`

Grupo de opções em cartão (rádio ou múltipla seleção) com título, descrição e ícone opcionais.

| Propriedade | Valores |
| --- | --- |
| `multiple` | rádio (padrão) ou checkbox |
| `columns` | 1, 2 ou 3 |
| `tone(option)` | `correct` (verde) / `incorrect` (amora) — usado no feedback dos exercícios |
| `disabled` | trava as opções após verificar |

Usado em: configuração inicial, nivelamento, exercícios de múltipla escolha/seleção, intensidade de correção.

### SegmentedControl — `Controls.tsx`

2–3 opções curtas lado a lado (idioma das explicações, tamanho das respostas).

### Chip — `Controls.tsx`

Etiqueta compacta, opcionalmente selecionável. Tons: `neutral`, `learn`, `talk`, `success`, `almost`,
`error`, `marker` ("Para você"). Usado em interesses, meta diária, filtros do vocabulário.

## 3. Exibição

| Componente | Função | Variações |
| --- | --- | --- |
| **Card** (`Display.tsx`) | superfície de conteúdo | `tone`: `default`, `flat`, `accent`, `learn`, `talk`, `ink` (escuro), `marker` |
| **PageHeader** | título da página (recebe foco na navegação) + subtítulo + `eyebrow` | — |
| **SectionTitle** | título de seção com ação opcional à direita | — |
| **StatTile** | número grande + rótulo + dica + ícone | — |
| **ProgressBar** | barra com rótulo acessível | `tone`: `accent`, `learn`, `talk`, `success`, `ink`; `size`: `sm`, `md` |
| **ProgressRing** | anel com valor no centro (meta de hoje, resultado da aula) | `tone`: `success`, `learn`, `talk` |
| **LevelBadge** | "Nível estimado: Básico" com ícone de barras | prefixo configurável |
| **ModeBadge** | "Modo Aprender" / "Modo Conversação" | `mode`: `learn`, `talk` |
| **Highlight** | marca-texto em um trecho da frase de exemplo | — |

## 4. Componentes pedagógicos

### CorrectionCard — `CorrectionCard.tsx`

O componente central da proposta pedagógica (UC07).

| Variante | Onde | Estrutura |
| --- | --- | --- |
| `learn` | exercícios, resumo da conversa, preferências (pré-visualização) | **Sua frase** (trecho original com sublinhado ondulado) → **Forma recomendada · gravidade** (mudança com marca-texto) → **Explicação** → **Dica** opcional |
| `chat` | abaixo da mensagem do usuário na conversa | "You said" → "More natural" → botão **Por quê?** (`aria-expanded`) que revela a explicação — recolhida por padrão |

Gravidade exibida: "Muda o sentido", "Gramática", "Mais natural".

### ExerciseRunner — `features/exercises/ExerciseRunner.tsx`

Sequência de exercícios: cabeçalho ("Exercício 2 de 6" + tipo) → enunciado → resposta → **Verificar** →
painel de feedback (`role="status"`) → **Continuar**.

| Tipo | Entrada |
| --- | --- |
| Múltipla escolha | `ChoiceGroup` |
| Complete a lacuna | campo dentro da frase |
| Selecione a palavra | `ChoiceGroup` com a frase preenchida ao vivo |
| Traduza | área de texto |
| Escreva sua resposta | área de texto com contador de palavras; corrigida por regras + IA |

Painel de feedback: `correct` (verde), `almost` (âmbar), `incorrect` (amora), sempre com ícone + título +
explicação; "Ver no outro idioma" quando há apoio bilíngue.

## 5. Marca e IA — `Brand.tsx`

| Componente | Uso |
| --- | --- |
| **LogoMark** | símbolo de dois balões sobrepostos (ultramar + coral) |
| **Logo** | símbolo + "English" + selo "AI" em marca-texto; versão `inverse` |
| **AssistantAvatar** | balão coral com centelha; `thinking` anima enquanto a IA responde |

## 6. Estados — `States.tsx`

| Componente | Uso | Acessibilidade |
| --- | --- | --- |
| **LoadingState** | carregamento de tela ou ação longa, com texto | `role="status"`, `aria-live="polite"` |
| **Skeleton** | listas/cartões carregando | decorativo |
| **EmptyState** | sem dados, com explicação e ação | — |
| **ErrorState** | falha ao carregar; `onRetry` ("Tentar de novo") só quando repetir pode resolver, e `actions` para outras saídas (ex.: voltar à lista) | `role="alert"` |
| **InlineAlert** | mensagens dentro de formulários e fluxos | `error` → `role="alert"`; `info`/`success`/`almost` → `role="status"` |

Componentes de erro com regra de produto (`apps/web/src/app/`):

| Componente | Uso |
| --- | --- |
| **QueryErrorState** | erro ao carregar dados, com a ação certa por tipo: rede/servidor/IA/limite → "Tentar de novo"; não encontrado/sem acesso → "Voltar"; sessão → aviso neutro "Verificando sua sessão…" e "Entrar novamente" (nunca "Tentar de novo") |
| **ActionError** | erro de uma ação (enviar, salvar, concluir); omite erros de sessão, que são avisados uma única vez no login |
| **SignOutDialog** | confirmação "Sair da conta?" nas etapas obrigatórias do primeiro acesso (configuração inicial e nivelamento), com loading e erro |

## 7. Sobreposições — `Overlay.tsx`

| Componente | Uso |
| --- | --- |
| **Dialog** | confirmação (encerrar conversa, apagar histórico, excluir conta) e detalhes da palavra; `<dialog>` nativo, Esc, X e clique fora fecham, foco preso no diálogo; título com id único (`useId`) |
| **Toast** (`useToast`) | confirmação curta ("Preferência salva."), some sozinho, `aria-live` |

## 8. Layout — `layouts/`

| Componente | Função |
| --- | --- |
| **AppShell** | navegação principal responsiva (barra inferior / trilho / barra lateral), link "Pular para o conteúdo", foco no título a cada rota; esconde a navegação em rotas imersivas; no modo demonstração, a barra lateral mostra o aviso "Modo demonstração — seus dados ficam salvos só neste navegador" |
| **AuthLayout** | telas públicas com marca e coluna de apoio no desktop |
| **FocusBar** (`components/FocusBar.tsx`) | barra das telas imersivas: voltar/sair, título, barra de progresso da etapa e ação à direita (ex.: "Encerrar") |

## 9. Checklist para um componente novo

- [ ] usa só tokens (cor, espaço, raio, sombra, tipografia);
- [ ] funciona com teclado e tem foco visível;
- [ ] tem rótulo acessível e não depende só de cor;
- [ ] alvo de toque ≥ 44px (ou justificativa);
- [ ] cobre os estados: padrão, foco, desabilitado, carregando/erro quando aplicável;
- [ ] respeita `prefers-reduced-motion`;
- [ ] textos seguem a voz da marca (DESIGN-SYSTEM §8).
