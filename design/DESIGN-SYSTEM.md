# Design System — English AI

> Fonte única dos tokens visuais. A implementação está em [`apps/web/src/styles/tokens.css`](../apps/web/src/styles/tokens.css) e usa **exatamente** os nomes abaixo, para que o protótipo no Figma (ver [FIGMA-GUIDE.md](./FIGMA-GUIDE.md)) e o código falem a mesma língua.

## 1. Conceito: "caderno vivo"

O English AI é um **caderno de estudos que conversa com você**.

| Ideia | Como aparece na interface |
|-------|---------------------------|
| **Caderno** (estudo estruturado, calma, foco) | fundo cor de papel, grade pontilhada sutil nas telas de entrada, tipografia editorial nos títulos |
| **Marca-texto** (aprender destacando o que importa) | o destaque amarelo marca palavras novas, a parte da frase que mudou numa correção e os pontos-chave da aula |
| **Conversa** (prática natural com a IA) | o símbolo são dois balões de fala sobrepostos — português e inglês — que formam uma ponte |
| **Dois modos, duas cores** | **Aprender** = azul ultramar (tinta de caneta, estrutura); **Conversar** = coral (calor, fala) |

O que evitamos de propósito: verde vibrante + mascote (associação com Duolingo), interface monocromática com barra lateral de chats (associação com ChatGPT), gradientes roxos genéricos de "app de IA" e painéis administrativos cheios de gráficos.

**Princípio de UX:** *simples por fora, bem estruturado por dentro* — uma ação principal por tela, informação progressiva, linguagem sem termos técnicos.

## 2. Cores

Todos os pares de texto foram verificados com a fórmula de contraste da WCAG 2.1 (nível AA: ≥ 4,5:1 para texto, ≥ 3:1 para bordas de componentes).

### 2.1 Neutros (papel e tinta)

| Token | Hex | Uso | Contraste |
|-------|-----|-----|-----------|
| `--paper` | `#F7F3EC` | fundo do app | — |
| `--paper-deep` | `#EFE8DC` | fundo da navegação lateral, áreas recuadas | — |
| `--surface` | `#FFFDF9` | cartões, campos, folhas | — |
| `--line` | `#E4DCCD` | divisórias e contornos decorativos | — |
| `--line-input` | `#8C8270` | borda de campos e controles | 3,4:1 sobre `--paper` |
| `--ink` | `#1A1F3A` | texto principal, botão principal | 14,6:1 |
| `--ink-2` | `#464B66` | texto secundário | 7,7:1 |
| `--ink-3` | `#62667D` | legendas, metadados | 5,1:1 |

### 2.2 Marca e modos

| Token | Hex | Uso | Contraste |
|-------|-----|-----|-----------|
| `--learn` | `#2F45C6` | Modo Aprender, links, foco, ações de estudo | 6,8:1 sobre papel; branco sobre ele 7,5:1 |
| `--learn-ink` | `#24369F` | texto sobre `--learn-soft` | 8,3:1 |
| `--learn-soft` | `#E6E9FB` | fundos de destaque do Modo Aprender | — |
| `--talk` | `#C4441D` | Modo Conversação | branco sobre ele 5,0:1 |
| `--talk-ink` | `#A3381A` | texto sobre `--talk-soft` | 5,6:1 |
| `--talk-soft` | `#FDE7DE` | fundos de destaque do Modo Conversação, balões da IA | — |
| `--marker` | `#FFE27A` | marca-texto (palavra nova, trecho corrigido) | tinta sobre ele 12,6:1 |

### 2.3 Feedback pedagógico

O erro **não** é vermelho alarmante: usamos um tom "amora" acolhedor e sempre acompanhado de explicação.

| Token | Hex | Fundo (`-soft`) | Uso |
|-------|-----|-----------------|-----|
| `--success` | `#17784A` | `#E1F3E8` | resposta correta |
| `--almost` | `#8A4E00` | `#FDF0D8` | "quase lá" (erro de digitação, requisito faltando) |
| `--error` | `#A8234A` | `#FBE4EA` | resposta a ajustar |

Feedback **nunca depende só da cor**: sempre há ícone + título ("Muito bem!", "Quase lá!", "Vamos ajustar") + texto.

## 3. Tipografia

| Papel | Fonte | Por quê |
|-------|-------|---------|
| Display (títulos, saudação, nome da aula) | **Fraunces** (variável, eixo `SOFT` = 50) | serifa editorial e calorosa — dá identidade de "caderno" sem parecer escolar |
| Texto e interface | **Atkinson Hyperlegible Next** (variável) | criada para máxima legibilidade (distingue I/l/1, O/0) — ótimo para quem está aprendendo a ler outro idioma |

As fontes são servidas pelo próprio app (pacotes `@fontsource`), sem chamadas a serviços de terceiros (privacidade).

| Token | Mobile | Desktop | Altura de linha | Peso | Fonte |
|-------|--------|---------|-----------------|------|-------|
| `--text-display` | 32px | 44px | 1.1 | 560 | Fraunces |
| `--text-h1` | 26px | 32px | 1.15 | 560 | Fraunces |
| `--text-h2` | 21px | 24px | 1.2 | 600 | Fraunces |
| `--text-h3` | 18px | 18px | 1.3 | 700 | Atkinson |
| `--text-body` | 16px | 16px | 1.55 | 400 | Atkinson |
| `--text-small` | 14px | 14px | 1.45 | 400 | Atkinson |
| `--text-caption` | 12.5px | 12.5px | 1.4 | 700, caixa alta, espaçamento 0.06em | Atkinson |

Textos em **inglês** de conteúdo (exemplos, frases de exercício) usam o mesmo corpo, com o trecho-chave destacado por `--marker`.

## 4. Espaçamento, forma e profundidade

| Grupo | Tokens |
|-------|--------|
| Espaço (base 4px) | `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64 |
| Raio | `--radius-s` 8 · `--radius-m` 12 · `--radius-l` 18 · `--radius-xl` 26 · `--radius-pill` 999 |
| Sombra | `--shadow-1` 0 1px 2px rgba(26,31,58,.06) · `--shadow-2` 0 8px 24px -12px rgba(26,31,58,.22) · `--shadow-pop` 0 18px 44px -16px rgba(26,31,58,.32) |
| Área de toque | mínimo **44 × 44 px** (botões principais 52px de altura) |
| Foco | contorno 3px `--learn` com 2px de afastamento (`:focus-visible`) |

## 5. Movimento

| Token | Valor | Uso |
|-------|-------|-----|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entradas |
| `--dur-fast` | 120ms | estados de botão |
| `--dur-base` | 220ms | painéis de feedback, chips |
| `--dur-slow` | 380ms | entrada de páginas (revelação escalonada) |

- Entrada de página: elementos sobem 8px e aparecem com atraso escalonado (40ms).
- Feedback de exercício: painel desliza de baixo para cima.
- IA "digitando": três pontos pulsando dentro de um balão.
- Barras de progresso animam da posição anterior para a nova.
- `prefers-reduced-motion: reduce` desativa todas as animações não essenciais.

## 6. Grade e responsividade (mobile first)

| Faixa | Largura | Navegação | Conteúdo |
|-------|---------|-----------|----------|
| Mobile | < 600px | barra inferior com 5 destinos | 1 coluna, margem 16–20px |
| Tablet | 600–1023px | trilho lateral (ícones + rótulo) | 1–2 colunas, máx. 760px |
| Desktop | ≥ 1024px | barra lateral de 248px com marca, navegação e nível | grade de 12 colunas, máx. 1120px; telas usam 2 colunas (conteúdo + painel de apoio) |

O desktop **não estica** o mobile: Início ganha coluna lateral de progresso; Aula ganha sumário fixo das etapas; Conversa ganha painel de "feedback da conversa"; Progresso organiza indicadores em grade.

## 7. Iconografia e imagem

- Ícones de linha (Lucide), traço 2px, tamanho 20–24px, sempre com rótulo visível ou `aria-label`.
- Símbolo da marca: dois balões sobrepostos (ultramar atrás, coral à frente) — ver `apps/web/src/components/Logo.tsx`.
- Avatar da IA: balão coral com uma pequena estrela de quatro pontas (centelha), indicando "IA".
- Sem fotos de banco de imagens; ilustrações são composições geométricas simples feitas com as cores do sistema.

## 8. Voz e tom da interface

| Faça | Evite |
|------|-------|
| "Vamos ajustar" | "Errado!" |
| "Seu nível estimado é Básico" | "Você é nível Básico" (soa como certificação) |
| "A IA está preparando uma resposta…" | "Processando requisição" |
| "Seu progresso aparecerá aqui assim que você começar sua primeira aula." | "Sem dados" |
| Frases curtas, verbo no início dos botões ("Começar aula") | jargão técnico, siglas |

Os textos da interface são em **português**; o conteúdo de prática é em **inglês**, com apoio em português conforme o nível (ver `docs/IA-BEHAVIOR.md`).
