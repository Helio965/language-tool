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

## 2. Princípios de UX

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
├─ Boas-vindas (/)
├─ Criar conta (/cadastro) ─ Entrar (/entrar) ─ Recuperar senha (/recuperar-senha)
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

**Telas imersivas** (aula, conversa, revisão, edição de perfil): escondem a navegação principal e mostram uma
barra de foco com "voltar", título e, quando faz sentido, progresso da etapa. Assim a pessoa não sai sem querer
no meio de um exercício.

**Guardas de fluxo:** quem não entrou vai para o login (e volta para a página pedida depois); quem não terminou
a configuração ou o nivelamento é levado à etapa pendente; quem já entrou não vê telas públicas.

## 4. Padrões de interação

| Padrão | Regra |
| --- | --- |
| Ação principal | um botão primário por tela/etapa, no fim do conteúdo; em formulários, ocupa a largura toda no celular |
| Validação de formulário | ao sair do campo e ao enviar; mensagem abaixo do campo, ligada por `aria-describedby`; foco vai ao primeiro campo com erro |
| Senha | requisitos visíveis enquanto digita (✓/○, com texto para leitor de tela); botão "mostrar senha" |
| Salvamento | preferências salvam na hora (toast "Preferência salva."); formulários longos salvam ao concluir |
| Ações destrutivas | sempre com diálogo de confirmação; excluir conta exige a senha |
| Tempo de espera da IA | estado explícito ("Lumi está preparando uma resposta…", "A IA está analisando sua frase…"); a mensagem enviada aparece imediatamente |
| Falha ao enviar | o texto volta para o campo, com mensagem clara e possibilidade de reenviar |
| Exercícios | responder → **Verificar** (desabilitado até haver resposta) → feedback → **Continuar** (recebe o foco) |
| Conversa | Enter envia, Shift+Enter quebra linha; limite de 600 caracteres com contador nos últimos 100 |
| Navegação | itens com `aria-current="page"`; título da página recebe o foco a cada troca de rota |

## 5. Estados de interface

Toda tela que carrega dados implementa os quatro estados:

| Estado | Componente | Comportamento | Exemplo |
| --- | --- | --- | --- |
| **Carregando** | `Skeleton` (listas e cartões) ou `LoadingState` (tela/ação) | forma do conteúdo final, sem saltos de layout; `role="status"` | "Preparando sua aula…" |
| **Vazio** | `EmptyState` | explica por que está vazio e oferece a próxima ação | Progresso sem atividade → "Começar minha primeira aula" |
| **Erro** | `ErrorState` (tela) / `InlineAlert` (ação) | mensagem em linguagem comum + "Tentar novamente"; nunca mostra detalhes técnicos | "Sem conexão com o servidor. Verifique sua internet e tente de novo." |
| **Sucesso** | toast, feedback do exercício, resumo | confirma o que aconteceu e indica o próximo passo | "Conta criada! Vamos personalizar seus estudos." |

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

## 8. Acessibilidade (RNF03)

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
| Texto | tamanhos em `rem`; layout suporta zoom de 200% sem perda de conteúdo; fonte Atkinson Hyperlegible para leitura |
| Cor | nenhuma informação transmitida só por cor |
| Tabelas | política de dados com cabeçalhos (`scope`) e versão empilhada legível no celular |

## 9. Responsividade

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
| Recuperação de senha | "Se existir uma conta com este e-mail, enviaremos as instruções de recuperação." |
| Resultado do nivelamento | nível estimado + "Este resultado é uma estimativa pedagógica para personalizar seus estudos — não é uma certificação oficial de proficiência." |
| Revisão | motivo explícito: "Você teve dificuldade com Simple Present nos últimos exercícios." |

## 11. Privacidade na experiência (RNF05, LGPD)

- Cadastro pede só nome, e-mail e senha; consentimento explícito com link para os termos.
- Página "Privacidade e dados" mostra o que é coletado, para quê e por quanto tempo; permite desativar o
  histórico, apagar todas as conversas e excluir a conta.
- O chat lembra, no rodapé, para não compartilhar dados pessoais.
- O modo demonstração guarda tudo apenas no navegador e diz isso na tela de boas-vindas ("os dados ficam apenas neste navegador e a IA é simulada").

## 12. Como validar a experiência (sugestão para a equipe)

Teste de usabilidade com 5 pessoas do público-alvo, no celular, com as tarefas:

1. Criar conta e chegar ao Início.
2. Fazer a primeira aula e acertar/errar exercícios.
3. Conversar com a Lumi por 5 mensagens e ver o feedback.
4. Descobrir o que precisa revisar.
5. Desativar o histórico de conversas.

Métricas: conclusão da tarefa, tempo, erros de navegação e a pergunta "você se sentiu à vontade para errar?"
(escala de 1 a 5).
