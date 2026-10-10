# Especificação de UX — English AI

> Como a plataforma deve se comportar do ponto de vista de quem usa.
> Complementa [USER-FLOWS.md](./USER-FLOWS.md) (fluxos), [IA-BEHAVIOR.md](./IA-BEHAVIOR.md) (IA),
> [../design/DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md) (tokens visuais),
> [../design/SCREEN-SPECIFICATIONS.md](../design/SCREEN-SPECIFICATIONS.md) (tela a tela) e
> [../design/COMPONENTS.md](../design/COMPONENTS.md) (componentes).

## 1. Para quem

Público principal (Análise de requisitos §5): brasileiros de 16 a 45 anos, do iniciante ao intermediário,
que estudam pelo celular em sessões curtas e têm receio de errar ao falar inglês.

| Persona (proto) | Contexto | O que precisa da interface |
| --- | --- | --- |
| **Alex**, 27, analista (conta demo) | estudou na escola, trava na hora de conversar; objetivo: Conversar | praticar sem medo, correções discretas, saber o que revisar |
| **Bia**, 19, universitária | iniciante, estuda no ônibus | aulas curtas, explicações em português, feedback imediato |
| **Carla**, 38, profissional | intermediária, quer inglês para o trabalho | conversas sobre trabalho, explicações em inglês, correção detalhada |

## 2. Princípios de UX (RNF01)

1. **Simples por fora, estruturado por dentro.** Uma ação principal por tela; detalhes sob demanda.
2. **Errar é seguro.** Linguagem acolhedora ("Vamos ajustar"), nenhum erro em vermelho alarmante, nenhuma
   punição (sem vidas, sem perder sequência por errar).
3. **Dois modos inconfundíveis.** Aprender (azul, estrutura) e Conversar (coral, fala) com cor, ícone, rótulo
   e comportamento próprios — a pessoa sempre sabe em qual está.
4. **Transparência.** "Nível estimado", "Lumi é uma IA e pode errar", motivo de cada revisão, quais dados
   são coletados.
5. **Continuidade.** O Início sempre responde "o que eu faço agora?" (próxima aula, revisões pendentes,
   conversar).
6. **Progresso compreensível.** Poucos indicadores, todos com rótulo em linguagem comum.
7. **Mobile first de verdade.** Polegar alcança as ações principais; nada depende de hover.

## 3. Arquitetura de informação

```text
Público
├─ Página pública (/) — apresentação do produto (ver §3.1)
├─ Criar conta (/cadastro) ─ Entrar (/entrar) ─ Recuperar senha (/recuperar-senha)
├─ Redefinir senha (/redefinir-senha/:token) — link do e-mail; abre com ou sem sessão
└─ Termos e privacidade (/termos-e-privacidade)

Primeiro acesso (obrigatório, nesta ordem, nunca repetido)
├─ Configuração inicial (/configuracao) — objetivo, nível percebido, interesses
└─ Nivelamento (/nivelamento) — pode pular e começar como Iniciante

App (navegação principal: 5 destinos)
├─ Início (/inicio)
├─ Aprender (/aprender) ─ Aula (/aprender/aula/:id) [imersiva]
├─ Conversar (/conversar) ─ Conversa (/conversar/:id) [imersiva]
├─ Progresso (/progresso)
└─ Perfil (/perfil)
    ├─ Editar perfil (/perfil/editar) · Refazer nivelamento (/perfil/nivelamento)
    ├─ Preferências (/preferencias) · Privacidade e dados (/privacidade)
    └─ atalhos: Vocabulário (/vocabulario) · Revisão (/revisao, /revisao/:id)
```

### 3.1 Página pública (`/`)

**Objetivo:** explicar o produto com clareza e levar ao cadastro, sem prometer o que não existe. Usa a mesma
identidade do app (papel, azul-marinho, marca-texto amarelo, azul do Aprender, coral do Conversar, Fraunces e
Atkinson Hyperlegible) — não é um segundo design system.

| Ordem | Seção (âncora) | Conteúdo |
| --- | --- | --- |
| 1 | Hero (`#inicio`) | título "Aprenda inglês no seu ritmo, com uma IA que realmente explica", subtítulo, **Começar gratuitamente** · **Já tenho conta** · (demo) **Explorar demonstração com dados de exemplo**; fatos do conteúdo (aulas, exercícios, temas); prévia do app (aula e conversa) |
| 2 | Problema (`#problema`) | 7 dificuldades comuns, cada uma com o que o produto faz |
| 3 | Como funciona (`#como-funciona`) | 5 passos numerados: conta → objetivos → nivelamento → aprender ou conversar → evolução |
| 4 | Modo Aprender (`#aprender`) | recursos + exemplo de exercício com o cartão de correção real |
| 5 | Modo Conversação (`#conversar`) | princípio **Naturalidade > correção excessiva**, recursos e exemplo de conversa |
| 6 | IA (`#ia`) | 7 capacidades + correção explicada ("I have 25 years.") + aviso de que a IA pode errar |
| 7 | Progresso (`#progresso`) | métricas acompanhadas + prévia marcada como **Exemplo ilustrativo** |
| 8 | Personalização (`#personalizacao`) | nível, objetivo, desempenho, erros recorrentes, vocabulário, progresso |
| 9 | Privacidade e segurança (`#seguranca`) | 7 garantias + aviso de que o texto de privacidade é informativo |
| 10 | Chamada final | "Seu próximo passo no inglês pode começar agora." + Criar conta · Entrar · (demo) Testar a demonstração |
| 11 | Rodapé | Sobre o projeto (`#sobre`, inclusive o que ainda não faz parte do produto) · Produto · Conta · Informações · Legal |

**Navegação.** Cabeçalho fixo: logo (volta ao topo), seções e **Entrar** / **Criar conta**. Abaixo de 1100px, as
seções ficam num **menu** (botão com `aria-expanded`; Esc fecha e devolve o foco ao botão; escolher uma seção
fecha o menu); abaixo de 600px, "Criar conta" vai para dentro do menu. Links de âncora atualizam o endereço
(`/#aprender`), sem criar nova entrada no histórico, e levam o foco ao título da seção. A rolagem é suave só
quando a pessoa não pediu movimento reduzido (`prefers-reduced-motion`). Chegar por `/#seguranca` abre direto
na seção.

**`/` × `/inicio`.** `/` é só para visitantes: com sessão, a guarda `PublicOnly` leva à etapa pendente
(configuração, nivelamento) ou ao Início. `/inicio` é a área autenticada.

**Honestidade (regra de conteúdo).** Nada de depoimentos, números de usuários, porcentagens de melhora, parceiros
ou certificações. Números só do próprio conteúdo (calculados a partir do `core`); exemplos de correção gerados pelo
verificador gramatical do projeto; prévias de dados marcadas como ilustrativas. Ações de demonstração aparecem só
no modo demonstração.

**Telas imersivas** (aula, conversa, revisão, edição de perfil): escondem a navegação principal e mostram uma
barra de foco com "voltar", título e, quando faz sentido, progresso da etapa. Assim a pessoa não sai sem querer
no meio de um exercício.

**Guardas de fluxo:** quem não entrou vai para o login (e volta para a página pedida depois); quem não terminou
a configuração ou o nivelamento é levado à etapa pendente; quem já entrou não vê telas públicas — exceto o link de
redefinição de senha, que abre com ou sem sessão.

## 4. Padrões de interação

| Padrão | Regra |
| --- | --- |
| Ação principal | um botão primário por tela/etapa, no fim do conteúdo; em formulários, ocupa a largura toda no celular |
| Validação de formulário | ao sair do campo e ao enviar; mensagem abaixo do campo, ligada por `aria-describedby`; foco vai ao primeiro campo com erro |
| Senha | requisitos visíveis enquanto digita (✓/○, com texto para leitor de tela); botão "mostrar senha" |
| Salvamento | preferências salvam na hora (toast "Preferência salva."); formulários longos salvam ao concluir |
| Ações destrutivas | sempre com diálogo de confirmação; excluir conta exige a senha |
| Tempo de espera da IA | estado explícito ("Lumi está preparando uma resposta…", "A IA está analisando sua frase…"); a mensagem enviada aparece imediatamente |
| Falha ao enviar | o texto volta para o campo (com o foco), com mensagem clara e possibilidade de reenviar |
| Exercícios | responder → **Verificar** (desabilitado até haver resposta) → feedback → **Continuar** (recebe o foco) |
| Conversa | Enter envia, Shift+Enter quebra linha; limite de 600 caracteres com contador nos últimos 100 |
| Navegação | itens com `aria-current="page"`; título da página recebe o foco a cada troca de rota |
| Botões assíncronos | mostram o andamento ("Entrando…", "Saindo…", "Excluindo…"), não aceitam clique repetido e voltam ao normal se a ação falhar |
| Sair da conta | leva ao login com o aviso discreto "Você saiu da sua conta."; nunca mostra "sessão expirou" |
| Sair no primeiro acesso | na configuração inicial e no nivelamento, o "X" é **Sair da conta** (com confirmação); a etapa é retomada ao entrar de novo |
| Âncoras da página pública | atualizam o endereço sem nova entrada no histórico, levam o foco ao título da seção e só animam a rolagem sem `prefers-reduced-motion` |
| Seleção de texto | a interface (títulos, cards, menus, botões, estatísticas, mensagens) não é selecionável com o mouse; campos editáveis continuam selecionáveis para copiar, colar e corrigir. Áreas que precisem de cópia usam `.allow-text-selection` |

## 5. Estados de interface

Toda tela que carrega dados implementa os quatro estados:

| Estado | Componente | Comportamento | Exemplo |
| --- | --- | --- | --- |
| **Carregando** | `Skeleton` (listas e cartões) ou `LoadingState` (tela/ação) | forma do conteúdo final, sem saltos de layout; `role="status"` | "Preparando sua aula…" |
| **Vazio** | `EmptyState` | explica por que está vazio e oferece a próxima ação | Progresso sem atividade → "Começar minha primeira aula" |
| **Erro** | `QueryErrorState` (tela) / `ActionError` (ação) | mensagem em linguagem comum + a ação que faz sentido para o tipo de erro (tabela abaixo); nunca mostra detalhes técnicos | "Sem conexão com o servidor. Verifique sua internet e tente de novo." |
| **Sucesso** | toast, feedback do exercício, resumo | confirma o que aconteceu e indica o próximo passo | "Conta criada! Vamos personalizar seus estudos." |

Erros não terminam em beco sem saída — a ação depende do tipo:

| Tipo de erro | O que a pessoa vê | Ação |
| --- | --- | --- |
| Sem conexão / erro do servidor / IA indisponível | "Não foi possível carregar" + mensagem | **Tentar de novo** |
| Muitas tentativas | "Muitas tentativas em pouco tempo" + pedido para aguardar | **Tentar de novo** |
| Sessão expirada | aviso neutro "Verificando sua sessão…" (sem caixa vermelha) e, em seguida, **um** aviso no login: "Sua sessão expirou. Entre novamente para continuar." | **Entrar novamente** (automático); depois do login, volta à página |
| Não encontrado (aula, conversa ou revisão inexistente) | "Não encontramos este conteúdo" | **Voltar** à lista correspondente |
| Sem acesso | "Acesso não permitido" | **Voltar ao início** |
| Não foi possível verificar a conta ao abrir o app | "Não foi possível verificar sua conta" | **Tentar de novo** |

Estados específicos do domínio:

| Estado | Onde | Tratamento |
| --- | --- | --- |
| IA pensando | chat, escrita livre, "Explicar de outro jeito" | avatar animado + texto; respeita movimento reduzido |
| IA indisponível | qualquer chamada de IA | a aplicação usa o modo demonstração automaticamente; nada quebra para a pessoa |
| Dado pessoal removido | chat | aviso abaixo da mensagem (ver IA-BEHAVIOR §10) |
| Conversa encerrada | chat | composer substituído por aviso + "Ver feedback" |
| Histórico desativado | Conversar, chat, resumo | aviso informativo de que o conteúdo é apagado ao encerrar |
| Nível acima do recomendado | assuntos/aulas | aviso informativo ("Um pouco acima do seu nível — ótimo para se desafiar"), sem bloquear |
| Todas as aulas concluídas | Início | "Você concluiu todas as aulas disponíveis!" + convite a conversar |

## 6. Feedback pedagógico

| Situação | Visual | Texto |
| --- | --- | --- |
| Correto | verde (`--success`) + ícone ✓ | "Muito bem!" / "Isso mesmo!" + "Por que está certo?" (opcional) |
| Quase | âmbar (`--almost`) + ícone ◉ | "Quase lá!" + o detalhe (grafia, requisito) |
| A ajustar | amora (`--error`) + ícone ✕ | "Vamos ajustar" + Sua resposta × Forma recomendada + Explicação |
| Correção na conversa | cartão discreto sob a mensagem | "You said / More natural / Por quê?" (explicação recolhida) |

Feedback nunca depende só da cor: há sempre ícone, título e texto. O trecho alterado é marcado com
marca-texto (`--marker`) e o trecho original com sublinhado ondulado.

## 7. Visualização do progresso

> Tarefa da Pessoa 2: "Especificar a visualização do progresso". Requisitos: RF15, RF16, UC11,
> Análise de requisitos §17 ("poucos indicadores, fáceis de entender").

### 7.1 Perguntas que a visualização responde

1. **Onde estou?** → nível estimado e quanto do nível já foi concluído.
2. **Estou estudando com regularidade?** → sequência de dias, minutos por dia, meta diária.
3. **Estou melhorando?** → taxa de acertos geral e por tema.
4. **O que devo revisar?** → lista de revisões com o motivo e erros recorrentes com atalho para a aula.

### 7.2 Indicadores

| Indicador | Definição | Visualização | Onde |
| --- | --- | --- | --- |
| Nível estimado | nível atual + aulas concluídas do nível / total | cartão escuro com nome do nível, barra de progresso e nota "não é certificação" | Progresso, Início, Perfil, barra lateral |
| Meta de hoje | minutos estudados hoje / meta diária (5–30 min) | anel de progresso | Início |
| Sequência | dias seguidos com atividade (aula, revisão ou conversa) | número + ícone de chama | Início, Progresso |
| Aulas concluídas | total de aulas com status concluído | número | Progresso |
| Exercícios | total de respostas | número | Progresso |
| Taxa de acertos | acertos / exercícios (— quando não há dados) | número em % | Progresso, Início |
| Palavras estudadas | palavras vistas; "aprendidas" como dica | número + dica | Progresso |
| Tempo de estudo | minutos totais; dias de estudo como dica | número formatado (ex.: "1h 20min") | Progresso |
| Últimos 7 dias | minutos por dia, hoje destacado | gráfico de barras verticais simples | Progresso |
| Desempenho por tema | % de acertos por tema gramatical | barras horizontais: ≥ 70% verde, 40–69% azul, < 40% coral | Progresso |
| Precisa revisar | revisões pendentes com motivo | lista com título + motivo + "Revisar" | Progresso, Início (3 primeiras + total) |
| Erros recorrentes | temas com mais erros (exercícios + conversas) | lista com contagem + "Rever aula" | Progresso |
| Aulas recentes | últimas aulas com nota e data relativa | lista com links | Progresso |

### 7.3 Regras de apresentação

- **Ordem de leitura** (celular, de cima para baixo): nível → resumo (6 números) → últimos 7 dias → precisa
  revisar → por tema → erros recorrentes → aulas recentes. No desktop, a mesma ordem em grade de 2 colunas.
- **Sem gráficos complexos:** nada de pizza, radar ou eixos duplos. Barras com rótulo de valor.
- **Acessível sem o gráfico:** cada barra tem texto equivalente para leitores de tela ("seg: 12 minutos");
  barras de tema têm rótulo com %, número de exercícios e cor + texto.
- **Linguagem de evolução, não de julgamento:** "Precisa revisar", não "Pontos fracos".
- **Estado vazio:** "Nada por aqui ainda — seu progresso aparecerá assim que você começar sua primeira aula",
  com botão para a primeira aula.
- **Nível sempre como estimativa:** a palavra "estimado" acompanha o nível em todas as telas.
- **Atualização:** os números refletem a última atividade assim que a pessoa volta à tela (cache invalidado ao
  concluir aula, revisão ou conversa).

## 8. Acessibilidade (RNF09)

Meta: **WCAG 2.1 nível AA**.

| Item | Como foi atendido |
| --- | --- |
| Contraste | todos os pares de texto verificados (DESIGN-SYSTEM §2); texto ≥ 4,5:1, bordas de controles ≥ 3:1 |
| Teclado | todos os controles são elementos nativos (`button`, `a`, `input`, `textarea`, `dialog`); ordem lógica; Esc fecha diálogos |
| Foco visível | anel de 3px em `:focus-visible` em todos os controles, inclusive opções de exercício |
| Pular navegação | link "Pular para o conteúdo" em todas as telas |
| Gestão de foco | título da página recebe foco ao trocar de rota; foco no primeiro erro do formulário; "Continuar" recebe foco após o feedback |
| Leitores de tela | rótulos em todos os campos; erros com `role="alert"`; feedback e chat em regiões `aria-live`; ícones decorativos com `aria-hidden` |
| Idioma | `lang="pt-BR"` na página e `lang="en"` em frases em inglês, para pronúncia correta no leitor de tela |
| Alvos de toque | 44×44px em botões, campos, navegação e opções (`--touch`); botões pequenos de ações secundárias têm 36px, acima do mínimo de 24px da WCAG 2.2 (2.5.8) |
| Movimento | `prefers-reduced-motion` desativa animações não essenciais |
| Texto | tamanhos em `rem`; sem rolagem horizontal de 320px a 1920px (verificado também em 640, 853 e 1024px, que equivalem a zoom de 200%, 150% e 125% numa tela de 1280px); fonte Atkinson Hyperlegible para leitura |
| Seleção de texto | restrita a campos editáveis só por CSS (`user-select`), sem bloquear eventos: foco, teclado, leitores de tela e copiar/colar nos campos funcionam normalmente |
| Diálogos | `<dialog>` nativo modal (foco preso), título ligado por `aria-labelledby` com id único, fecha com Esc, X e clique fora |
| Cor | nenhuma informação transmitida só por cor |
| Tabelas | política de dados com cabeçalhos (`scope`) e versão empilhada legível no celular |

## 9. Responsividade (RNF02)

| Faixa | Navegação | Comportamento das telas |
| --- | --- | --- |
| Celular (< 600px) | barra inferior com 5 destinos | 1 coluna; ações principais ao alcance do polegar; chat ocupa a tela toda |
| Tablet (600–1023px) | trilho lateral com ícone + rótulo | 1–2 colunas conforme a tela; conteúdo centralizado |
| Desktop (≥ 1024px) | barra lateral com marca, navegação e nível estimado | 2 colunas: Início com coluna de resumo do dia; Aula com sumário das etapas; Conversa com painel "Feedback da conversa"; Progresso em grade |

Telas imersivas mantêm o mesmo comportamento em todas as larguras: barra de foco no topo, conteúdo centralizado.

## 10. Microtextos e voz

Seguem DESIGN-SYSTEM §8. Exemplos-chave:

| Contexto | Texto |
| --- | --- |
| Botão do Modo Aprender | "Continuar aula" / "Começar aula" |
| Botão do Modo Conversação | "Nova conversa" / "Encerrar e ver feedback" |
| Erro de login | "E-mail ou senha incorretos. Tente novamente." (não revela se o e-mail existe) |
| E-mail já cadastrado | "Já existe uma conta com este e-mail. Entrar com este e-mail" |
| Recuperação de senha | "Se existir uma conta com este e-mail, enviaremos as instruções de recuperação." + (http) "Confira a caixa de entrada e a pasta de spam. O link vale por 15 minutos e só pode ser usado uma vez." |
| Redefinição — link indisponível | "Este link venceu" · "Este link já foi usado" · "Link inválido", sempre com **Pedir um novo link** e **Voltar para o login** |
| Redefinição — sucesso | "Senha redefinida com sucesso." + "Por segurança, as sessões abertas com a senha antiga foram encerradas." + **Entrar** |
| Simulação (modo demonstração) | "Simulação do modo demonstração — Nenhum e-mail real é enviado na demonstração." |
| Resultado do nivelamento | nível estimado + "Este resultado é uma estimativa pedagógica para personalizar seus estudos — não é uma certificação oficial de proficiência." |
| Revisão | motivo explícito: "Você teve dificuldade com Simple Present nos últimos exercícios." |

## 11. Privacidade na experiência (RNF05, LGPD)

- Cadastro pede só nome, e-mail e senha; consentimento explícito com link para os termos.
- Página "Privacidade e dados" mostra o que é coletado, para quê e por quanto tempo; permite desativar o
  histórico, apagar todas as conversas e excluir a conta.
- O chat lembra, no rodapé, para não compartilhar dados pessoais.
- O modo demonstração guarda tudo apenas no navegador e diz isso na página pública ("os dados ficam apenas neste navegador e a IA é simulada") e na barra lateral do app.
- Na recuperação de senha, a resposta nunca revela se o e-mail tem conta. A demonstração mostra uma simulação
  identificada e nunca finge que um e-mail real foi enviado.
- Os e-mails (boas-vindas e recuperação) nunca contêm senha e dizem como ignorar a mensagem se ela não foi pedida.

## 12. Como validar a experiência (sugestão para a equipe)

Teste de usabilidade com 5 pessoas do público-alvo, no celular, com as tarefas:

1. Criar conta e chegar ao Início.
2. Fazer a primeira aula e acertar/errar exercícios.
3. Conversar com a Lumi por 5 mensagens e ver o feedback.
4. Descobrir o que precisa revisar.
5. Desativar o histórico de conversas.

Métricas: conclusão da tarefa, tempo, erros de navegação e a pergunta "você se sentiu à vontade para errar?"
(escala de 1 a 5).
