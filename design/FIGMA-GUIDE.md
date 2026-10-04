# Guia para o Figma — English AI

## Situação atual (leia primeiro)

- **Nenhum arquivo foi criado no Figma.** Este ambiente de desenvolvimento não tem acesso ao Figma, então não
  existe link de protótipo no Figma e nada aqui deve ser apresentado como se existisse.
- **O protótipo navegável existe e é a aplicação web** (`apps/web`), que roda sem backend e sem chave de API no
  modo demonstração. Ele cobre os fluxos pedidos para a Pessoa 2 (login, cadastro, início, Aprender e
  Conversação) e o restante do MVP. Como rodar: [README.md](../README.md).
- **As imagens em [`screenshots/`](./screenshots)** foram capturadas desse protótipo em celular (390px), tablet
  (820px) e desktop (1440px). Servem de referência para quem for montar o arquivo no Figma.

Este guia descreve como a equipe pode reproduzir o protótipo no Figma **mantendo os mesmos nomes de tokens e
componentes do código**, para que design e implementação não se separem.

---

## 1. Estrutura sugerida do arquivo

| Página do Figma | Conteúdo |
| --- | --- |
| `📌 Capa` | nome, status ("MVP acadêmico"), link do repositório, data |
| `🎨 Fundamentos` | variáveis de cor, tipografia, espaçamento, raios, sombras, ícones, grade |
| `🧩 Componentes` | componentes com *variants* (ver seção 4) |
| `📱 Celular 390` | telas em 390×844 |
| `📟 Tablet 820` | telas principais em 820×1180 |
| `🖥️ Desktop 1440` | telas principais em 1440×900 |
| `🔀 Fluxos` | protótipo conectado (seção 6) |
| `🗂️ Referências` | as capturas de `design/screenshots`, travadas, para comparar |

Nomes de frames: `<largura>/<nº>-<tela>/<estado>`, por exemplo `390/09-aula/feedback-incorreto`, seguindo a
numeração de [SCREEN-SPECIFICATIONS.md](./SCREEN-SPECIFICATIONS.md).

## 2. Variáveis (Figma Variables)

Crie as coleções abaixo. Os nomes usam `/` para agrupar, mas o último segmento é **idêntico** ao token CSS
(`apps/web/src/styles/tokens.css`).

### 2.1 Coleção `color/primitive`

| Variável | Valor | Token CSS |
| --- | --- | --- |
| `neutral/paper` | `#F7F3EC` | `--paper` |
| `neutral/paper-deep` | `#EFE8DC` | `--paper-deep` |
| `neutral/surface` | `#FFFDF9` | `--surface` |
| `neutral/line` | `#E4DCCD` | `--line` |
| `neutral/line-input` | `#8C8270` | `--line-input` |
| `neutral/ink` | `#1A1F3A` | `--ink` |
| `neutral/ink-2` | `#464B66` | `--ink-2` |
| `neutral/ink-3` | `#62667D` | `--ink-3` |
| `mode/learn` · `learn-ink` · `learn-soft` | `#2F45C6` · `#24369F` · `#E6E9FB` | `--learn*` |
| `mode/talk` · `talk-ink` · `talk-soft` | `#C4441D` · `#A3381A` · `#FDE7DE` | `--talk*` |
| `brand/marker` | `#FFE27A` | `--marker` |
| `feedback/success` · `success-soft` | `#17784A` · `#E1F3E8` | `--success*` |
| `feedback/almost` · `almost-soft` | `#8A4E00` · `#FDF0D8` | `--almost*` |
| `feedback/error` · `error-soft` | `#A8234A` · `#FBE4EA` | `--error*` |

### 2.2 Coleção `color/semantic` com dois modos: **Aprender** e **Conversar**

| Variável | Modo Aprender | Modo Conversar |
| --- | --- | --- |
| `accent` | `mode/learn` | `mode/talk` |
| `accent-ink` | `mode/learn-ink` | `mode/talk-ink` |
| `accent-soft` | `mode/learn-soft` | `mode/talk-soft` |

No código, isso é o atributo `data-mode` (`learn`/`talk`). No Figma, troque o modo da variável no frame para
ver a mesma tela nas duas cores.

### 2.3 Coleções `space`, `radius` e `layout`

| Variável | Valor | | Variável | Valor |
| --- | --- | --- | --- | --- |
| `space/1` | 4 | | `radius/s` | 8 |
| `space/2` | 8 | | `radius/m` | 12 |
| `space/3` | 12 | | `radius/l` | 18 |
| `space/4` | 16 | | `radius/xl` | 26 |
| `space/5` | 20 | | `radius/pill` | 999 |
| `space/6` | 24 | | `layout/touch` | 44 |
| `space/8` | 32 | | `layout/nav-bottom-height` | 68 |
| `space/10` | 40 | | `layout/rail-width` | 88 |
| `space/12` | 48 | | `layout/sidebar-width` | 248 |
| `space/16` | 64 | | `layout/content-max` | 1120 |

### 2.4 Estilos de efeito (sombras)

| Estilo | Valor |
| --- | --- |
| `shadow/1` | 0 1 2 `#1A1F3A` 6% + 0 1 1 `#1A1F3A` 4% |
| `shadow/2` | 0 8 24 −12 `#1A1F3A` 22% |
| `shadow/pop` | 0 18 44 −16 `#1A1F3A` 32% |

## 3. Tipografia (estilos de texto)

Fontes gratuitas no Google Fonts: **Fraunces** (títulos) e **Atkinson Hyperlegible Next** (texto).

| Estilo | Fonte | Celular | Desktop | Uso |
| --- | --- | --- | --- | --- |
| `display` | Fraunces | 32 | 44 | boas-vindas, resultado |
| `h1` | Fraunces | 26 | 32 | título da página |
| `h2` | Fraunces | 21 | 24 | seções |
| `h3` | Atkinson, bold | 18 | 18 | títulos de cartão |
| `body` | Atkinson | 16 | 16 | texto corrido, mensagens |
| `small` | Atkinson | 14 | 14 | descrições, metadados |
| `caption` | Atkinson, bold, caixa alta, +4% | 12,5 | 12,5 | rótulos ("SUA FRASE") |

Os tamanhos fluidos do código (`clamp`) viram dois estilos no Figma (celular e desktop).

## 4. Componentes e variants

Use **Auto Layout** em todos, com espaçamentos ligados às variáveis `space/*`.

| Componente | Propriedades (variants) |
| --- | --- |
| `Button` | `variant` = primary/accent/secondary/ghost/danger · `size` = sm/md/lg · `state` = default/hover/pressed/focus/disabled/loading · `icon start`, `icon end` (boolean) · `block` (boolean) |
| `TextField` | `state` = empty/filled/focus/error/disabled · `hint` (boolean) · `type` = text/password |
| `Checkbox`, `Switch` | `checked` (boolean) · `state` = default/focus/error |
| `ChoiceOption` | `selected` · `tone` = none/correct/incorrect · `with description` · `with icon` |
| `SegmentedControl` | `options` = 2/3 · `selected` = 1/2/3 |
| `Chip` | `tone` = neutral/learn/talk/success/almost/error/marker · `selected` |
| `Card` | `tone` = default/flat/accent/learn/talk/ink/marker |
| `ProgressBar` | `tone` · `size` = sm/md · `value` (0–100%) |
| `ProgressRing` | `tone` · `value` |
| `StatTile`, `LevelBadge`, `ModeBadge` | `level` = iniciante/básico/intermediário/avançado · `mode` = learn/talk |
| `CorrectionCard` | `variant` = learn/chat · `expanded` (chat) · `tip` (boolean) · `severity` = meaning/grammar/naturalness |
| `ExerciseFeedback` | `status` = correct/almost/incorrect · `with correction` |
| `ChatBubble` | `from` = ai/user · `translation` (boolean) · `state` = sent/sending |
| `TypingIndicator` | — |
| `EmptyState`, `ErrorState`, `LoadingState`, `InlineAlert` | `tone` = error/info/success/almost |
| `Dialog`, `Toast` | `size` = md/lg |
| `NavBar` | `layout` = bottom/rail/sidebar · `active` = início/aprender/conversar/progresso/perfil |
| `FocusBar` | `icon` = close/back · `progress` (boolean) · `action` (boolean) |

Detalhes de cada um: [COMPONENTS.md](./COMPONENTS.md).

## 5. Grade e frames

| Frame | Tamanho | Grade | Navegação |
| --- | --- | --- | --- |
| Celular | 390×844 | 4 colunas, margem 16, gutter 12 | `NavBar/bottom` (68px) |
| Tablet | 820×1180 | 8 colunas, margem 32, gutter 16 (à direita do trilho de 88px) | `NavBar/rail` |
| Desktop | 1440×900 | 12 colunas, conteúdo até 1120, gutter 24 (à direita da barra de 248px) | `NavBar/sidebar` |

Telas imersivas (aula, conversa, revisão) usam `FocusBar` no lugar da navegação.

## 6. Protótipo conectado (fluxos)

Conecte no modo *Prototype* seguindo [USER-FLOWS.md](../docs/USER-FLOWS.md). Fluxos mínimos (tarefas da
Pessoa 2):

| Fluxo | Telas (frames) | Interações |
| --- | --- | --- |
| **Cadastro** | 01 Boas-vindas → 02 Cadastro (vazio → erros → preenchido) → 05 Configuração (3 etapas) → 06 Nivelamento (intro → pergunta → resultado) → 07 Início | *On tap*, *Smart animate* nas etapas |
| **Login** | 01 → 03 Entrar (erro) → 07 Início | — |
| **Modo Aprender** | 07 Início → 09 Aula (apresentação → explicação → exemplos → vocabulário → exercício → feedback correto/incorreto → resumo) | overlay do feedback deslizando de baixo |
| **Modo Conversação** | 10 Conversar → 11 Conversa (abertura → digitando → resposta com correção recolhida → "Por quê?" aberto) → diálogo Encerrar → 12 Feedback | *After delay* 800ms para o indicador "digitando" |
| **Progresso** | 07 Início → 13 Progresso → 14 Revisão | — |

Comece pelo celular; tablet e desktop só para Início, Aula, Conversa e Progresso, que mudam de estrutura
(colunas laterais).

## 7. Como usar as capturas

1. Arraste as imagens de `design/screenshots/` para a página `🗂️ Referências` (uma por frame, mesmo tamanho).
2. Construa cada tela por cima da referência, com opacidade 30%, usando só componentes e variáveis.
3. Ao terminar, oculte a referência e compare lado a lado.

Para gerar novas capturas após mudanças, rode o protótipo (`npm run dev`) e capture nas mesmas larguras.

## 8. Mantendo design e código alinhados

- Mudou uma cor ou espaçamento? Altere **o token** em `tokens.css` e a variável de mesmo nome no Figma — e
  atualize [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) com o novo contraste.
- Componente novo no Figma → mesmo nome em `apps/web/src/components` e uma linha em COMPONENTS.md.
- Textos da interface: a fonte da verdade é o código; copie do protótipo para o Figma, não o contrário.

## 9. Checklist de entrega no Figma

- [ ] Variáveis criadas com os nomes da seção 2 (incluindo os modos Aprender/Conversar).
- [ ] Estilos de texto e sombra criados.
- [ ] Componentes com variants da seção 4.
- [ ] Telas de login, cadastro, início, Aprender e Conversação no celular.
- [ ] Estados de carregamento, vazio, erro e sucesso em pelo menos uma tela de cada fluxo.
- [ ] Fluxos conectados da seção 6 e link de visualização compartilhado com a equipe.
- [ ] Link do arquivo do Figma adicionado ao README (seção "Protótipo").
