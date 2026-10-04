# Fluxos de usuário — English AI

> Base: Fluxograma de caso de uso (F3), Especificação de Casos de Uso UC01–UC12 (F2) e Análise de requisitos §12–13 (F1). As decisões sobre pontos divergentes estão em [MVP-SCOPE.md §5](./MVP-SCOPE.md#5-divergências-entre-os-materiais-e-decisões-tomadas).

## 1. Fluxo principal (fluxograma do projeto)

```mermaid
flowchart TD
    U([Usuário]) --> Q{Já tem conta?}
    Q -- "Novo usuário" --> C[Criar conta<br/>UC01]
    Q -- "Usuário existente" --> L[Login<br/>UC02]
    Q -- "Perfil existente" --> P2[Configurar perfil<br/>UC03 — a partir de Perfil]
    C --> P[Configuração inicial<br/>UC03]
    P --> N[Nivelamento<br/>UC04]
    L --> R{Etapas pendentes?}
    R -- "configuração" --> P
    R -- "nivelamento" --> N
    R -- "não" --> H
    N --> H[Página inicial]
    P2 --> H
    H --> A[Aprender]
    H --> V[Conversar]
    A --> AU[Aula<br/>UC05]
    AU --> EX[Exercício<br/>UC06]
    EX --> CO[Correção<br/>UC07]
    V --> CH[Chat IA<br/>UC09]
    CH --> CC[Correção contextual]
    CO --> PR[Progresso<br/>UC11]
    CC --> PR
    PR --> RV[Revisão<br/>UC08]
    RV --> PR
```

Regra: **o usuário nunca repete uma etapa concluída**. A sessão guarda `nextStep` (`onboarding` → `placement` → `ready`), e as rotas protegidas redirecionam para a etapa pendente.

## 2. Cadastro (UC01)

```mermaid
flowchart TD
    A[Tela de cadastro] --> B[Nome, e-mail, senha,<br/>confirmação, aceite dos termos]
    B --> C{Validação no app<br/>em tempo real}
    C -- inválido (A1) --> D[Mensagem junto ao campo] --> B
    C -- válido --> E[Enviar — botão em carregamento]
    E --> F{API valida de novo}
    F -- inválido (A1) --> D
    F -- conta existe (A2) --> G[Aviso + atalho "Entrar com este e-mail"]
    F -- criada --> H[Feedback "Conta criada!"] --> I[Configuração inicial]
```

## 3. Login (UC02) e recuperação de senha

```mermaid
flowchart TD
    A[Tela de login] --> B[E-mail e senha<br/>mostrar/ocultar senha]
    B --> C{Credenciais válidas?}
    C -- não (A1) --> D["E-mail ou senha incorretos" — nova tentativa] --> B
    C -- sim --> E{nextStep}
    E -- onboarding --> F[Configuração inicial]
    E -- placement --> G[Nivelamento]
    E -- ready --> H[Página inicial]
    A --> R[Esqueci minha senha] --> S[Informar e-mail] --> T[Mensagem genérica<br/>não revela se o e-mail existe]
```

## 4. Configuração inicial (UC03)

Três passos curtos com indicador de progresso; "Voltar" preserva as escolhas.

1. **Objetivo** — aprender o básico, conversar, trabalho, viagem, tecnologia (escolha única).
2. **Sua experiência** — nível percebido (inclui "Não sei dizer") e experiência anterior.
3. **Interesses** — interesse em conversação, interesse profissional e até 3 áreas.

Resultado: perfil salvo → Nivelamento. Depois, o mesmo formulário fica em **Perfil → Editar perfil de aprendizagem**.

## 5. Nivelamento (UC04)

```mermaid
flowchart TD
    A[Introdução: ~3 min, 'não é prova oficial'] --> B{Começar ou<br/>'Prefiro começar do zero'}
    B -- começar --> C[Etapa 1: atividades de nível Iniciante]
    B -- do zero --> Z[Nível estimado: Iniciante]
    C --> D{≥ 3 de 4 corretas?}
    D -- não --> R[Resultado]
    D -- sim --> E[Etapa 2: Básico] --> F{≥ 3 de 4?}
    F -- não --> R
    F -- sim --> G[Etapa 3: Intermediário] --> R
    R --> S[Nível estimado + o que significa<br/>+ comparação com o nível percebido]
    Z --> S
    S --> H[Página inicial]
```

O resultado é sempre apresentado como **"nível estimado"** e salvo no perfil. Pode ser refeito em Perfil.

## 6. Modo Aprender (UC05, UC06, UC07)

```mermaid
flowchart LR
    T[Trilha de aulas] --> A[Aula: objetivos]
    A --> B[Explicação<br/>+ 'Explicar de outro jeito']
    B --> C[Exemplos<br/>+ 'Me dê outro exemplo']
    C --> D[Vocabulário]
    D --> E[Exercício n]
    E --> F{Correção}
    F -- correta --> G[Feedback positivo<br/>+ 'Por que está certo?']
    F -- quase --> H[Quase lá + grafia esperada]
    F -- a ajustar --> I[Sua resposta · Forma recomendada · Explicação]
    G --> J{Mais exercícios?}
    H --> J
    I --> J
    J -- sim --> E
    J -- não --> K[Resumo da aula: acertos, palavras novas, pontos-chave]
    K --> L[Praticar na conversa]
    K --> M[Próxima aula]
    K --> N[Revisar agora, se nota < 70%]
```

- A aula guarda o andamento: sair e voltar mostra **"Continuar de onde parei"** no Início.
- Exercícios abertos ("Escreva sua resposta") são analisados pela IA/regras e mostram a correção no formato do documento: *Sua frase / Forma recomendada / Explicação*.

## 7. Modo Conversação (UC09)

```mermaid
flowchart TD
    A[Escolher assunto<br/>recomendados primeiro] --> B[IA abre a conversa<br/>cumprimento + pergunta]
    B --> C[Usuário escreve]
    C --> D[IA está preparando uma resposta…]
    D --> E[Resposta natural + próxima pergunta]
    E --> F{Erro relevante?}
    F -- "sim e é momento" --> G[Nota discreta sob a mensagem:<br/>You said / More natural]
    F -- "sim, mas acabou de corrigir" --> H[Guardada para o resumo]
    F -- não --> C
    G --> C
    H --> C
    C --> I[Encerrar conversa]
    I --> J[Feedback da conversa:<br/>mensagens, frases sem ajuste, pontos para praticar, aulas sugeridas]
    J --> K[Progresso / Revisão]
```

Atalhos: **"Praticar isso"** no fim de uma aula abre uma conversa já com o tema da aula. Com o histórico desativado, o conteúdo é apagado ao encerrar.

## 8. Revisão (UC08)

Início ou Progresso → "Você tem N conteúdos para revisar" → lista com **motivo** de cada item → sessão de 3–6 atividades → resultado e próxima data → progresso atualizado.

## 9. Vocabulário (UC10)

Vocabulário → filtros (Todas · Para revisar · Aprendidas) e busca → palavra → tradução, significado, exemplo, nível, status, aula de origem → "Já aprendi" / "Quero revisar". Sugestões do nível do usuário aparecem abaixo da lista.

## 10. Progresso (UC11)

Progresso (aba principal ou Perfil → Seu progresso) → resumo (nível estimado e avanço no nível) → números principais → últimos 7 dias → desempenho por tema → precisa revisar → aulas recentes.

## 11. Preferências e dados (UC12, RF20)

Perfil → Preferências → idioma das explicações · intensidade das correções · preferências de conversa · histórico · lembretes · meta diária → salvo automaticamente com confirmação.
Perfil → Privacidade e dados → o que coletamos → apagar histórico de conversas → excluir conta (confirmação com senha).
