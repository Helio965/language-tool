# Componentes — English AI

A interface atual usa Flask/Jinja, CSS e JavaScript de apresentação. Este
documento mapeia o design para os arquivos executados pela versão Python.
A especificação acadêmica anterior, com nomes React e suas variantes, está em
[docs/legacy/design/COMPONENTS.md](../docs/legacy/design/COMPONENTS.md).

Os tokens estão em [tokens.css](../static/css/tokens.css). Os estilos
compartilhados ficam em [ui.css](../static/css/ui.css), que importa `fonts.css`
e `global.css`; [python.css](../static/css/python.css) adapta esses estilos ao
HTML atual. As variantes de [FIGMA-GUIDE.md](./FIGMA-GUIDE.md) são propostas de
design; não equivalem a uma API de componentes React instalada.

## 1. Mapeamento atual

| Peça visual | Template, macro ou função atual | Estilos e comportamento |
| --- | --- | --- |
| Botão e link de ação | macro `button` em [macros.html](../templates/macros.html); `button`, `link`, `busy`, `action` em [common.js](../static/js/common.js) | `.button-*`; estado pendente altera rótulo, desabilita e define `aria-busy` |
| Campo e senha | macro `field`; [auth/form.html](../templates/auth/form.html) | `.field-*`; mostrar/ocultar em `initCommon`, erros por campo em `fieldsError` |
| Requisitos da senha | `#password-checks` em `auth/form.html` | [auth.js](../static/js/auth.js) atualiza comprimento, letra e número |
| Opções, chips e seleção segmentada | HTML nativo nos templates e módulos de cada fluxo | `.choice-*`; radio/checkbox, `fieldset`/`legend`; `hydrate` atualiza estado visual |
| Cartão, título e indicador numérico | macro `header`; `card`, `stat` em `common.js` | `.display-card`, `.display-pageHeader`, `.display-stat` |
| Barra e anel de progresso | macros `progress_bar`, `ring`; função `progress`; `<progress>` nos fluxos de foco | `.display-progress`, `.display-ring`; nomes acessíveis e valores |
| Correção | macro `correction` nas prévias públicas; função `correction` para dados da API | `.correction-*`; frases com `lang="en"`, explicação em `<details>` na conversa |
| Marca, avatar e ícones | macros `logo`, `avatar`, `icon`; função `avatar` em `common.js` | SVG inline; `.brand-*`, `.ui-icon`; SVG decorativo com `aria-hidden` |
| Carregamento, vazio e erro | `.states-loading` nos templates; `empty`, `load`, `showError` em `common.js` | regiões `role="status"` e `role="alert"` conforme o estado |
| Diálogo e aviso curto | `<dialog id="ui-dialog">`, `#toast` em [base.html](../templates/base.html) | `dialog`, `toast` em `common.js`; título associado e `aria-live` |
| Navegação | `base.html` | `.shell-*`; barra inferior, trilho e barra lateral com media queries |
| Barra de foco | templates de aula, conversa, revisão, configuração e nivelamento | `.focusbar-*`; saída, título e progresso quando aplicável |
| Página pública | [landing.html](../templates/landing.html) | `.landing-*`; menu e âncoras em `initCommon` |

## 2. Ações e formulários

A macro `button` recebe `label`, `href`, `variant`, `size`, `id` e `attrs`.
Com `href`, gera um link; sem ele, um botão `type="button"`. Formulários declaram
separadamente os botões `type="submit"`. As classes oferecem `primary`, `accent`,
`secondary`, `ghost`, `danger` e tamanhos `sm`, `md`, `lg`. A meta de toque é
44px; `sm` tem 36px e fica reservado a ações secundárias.

Os campos têm rótulo visível. `fieldsError` associa mensagens com
`aria-describedby`, define `aria-invalid` e foca o primeiro campo informado
pela API. `auth.js` atualiza os requisitos da senha e bloqueia envios
simultâneos. A validação definitiva permanece nos serviços Python.

Preferências usam radios e checkboxes em
[configuracoes/preferences.html](../templates/configuracoes/preferences.html).
[account.js](../static/js/account.js) enfileira alterações, envia cada mudança à
API e mostra “Preferência salva.” após sucesso. Se houver erro, restaura o campo
a partir do último estado salvo e mostra a mensagem. A tela atual não inclui a
prévia ao vivo de correção da especificação acadêmica anterior.

## 3. Peças pedagógicas

**Correção:** exercícios e resumos apresentam Sua frase → Forma recomendada →
Explicação, com dica quando fornecida. A conversa usa You said → More natural →
Por quê?, com `<details>` recolhido. `common.js` destaca os trechos descritos em
`changes`; a macro Jinja das prévias públicas destaca a recomendação completa.

**Exercícios:** [learning.js](../static/js/learning.js) usa o mesmo executor
visual para aulas e revisões: enunciado, resposta, Verificar, feedback e próxima
ação. Tipos: múltipla escolha, seleção de palavra, lacuna, tradução e escrita.
A API Python emite atividades, corrige respostas e calcula resultados. O
feedback combina cor, símbolo, título e explicação; a explicação de apoio pode
ser aberta em outro idioma. Após verificar, os campos ficam desabilitados e o
foco segue para a próxima ação.

**Conversa:** [conversation.js](../static/js/conversation.js) apresenta
mensagens, traduções disponíveis, correções, contadores e resumo. O estado
pendente usa o texto “Lumi está preparando uma resposta…”. Os estilos históricos
de três pontos em `ui.css` não são usados pelo fluxo atual.

## 4. Estados, diálogos e navegação

`load` mostra Tentar de novo para falhas recuperáveis e omite essa ação para
`NOT_FOUND`, `FORBIDDEN`, `VALIDATION`. A API redireciona ao login quando a sessão
termina; `showError` omite esse erro na tela anterior.

Os diálogos usam `<dialog>` nativo, título associado, botão de fechar e
fechamento pelo fundo; o navegador oferece modalidade e Escape. Cada abertura
substitui o conteúdo e as ações. O aviso curto usa uma região `aria-live`.

`base.html` monta a navegação autenticada e Pular para o conteúdo. No celular,
telas imersivas escondem a barra inferior; a barra lateral permanece em faixas
maiores. Configuração e nivelamento têm layout próprio. A navegação usa URLs
Flask. O provedor `mock`/`demo` recebe identificação de IA em demonstração;
essa indicação descreve respostas simuladas. Os dados da conta são persistidos
no backend Python, conforme [ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## 5. Checklist para novas peças

Este checklist define objetivos de revisão; não certifica todas as telas:

- [ ] reutilizar tokens de cor, espaço, raio, sombra e tipografia;
- [ ] funcionar com teclado, foco visível e rótulos acessíveis;
- [ ] apresentar feedback em texto, além da cor;
- [ ] revisar alvos de toque, estados pendentes e falhas;
- [ ] respeitar `prefers-reduced-motion`;
- [ ] seguir a voz em [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).
