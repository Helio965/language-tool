# Modelo de dados — English AI

> Base: Análise de requisitos §20 (Usuário, Perfil de aprendizagem, Aula, Exercício, Vocabulário, Conversação, Progresso) + entidades de apoio necessárias aos casos de uso (ExerciseAttempt, UserVocabulary, Message, Review, Preference).
> O esquema executável está em [`apps/api/src/db/schema.sql`](../apps/api/src/db/schema.sql) e os tipos em [`packages/core/src/domain/entities.ts`](../packages/core/src/domain/entities.ts).

## 1. Rastreabilidade das entidades

| Entidade | Origem nos documentos | Atributos dos documentos | Atributos de apoio (decisão técnica) |
|----------|----------------------|--------------------------|--------------------------------------|
| **User** | §20 Usuário | id, nome, e-mail, credenciais, preferências | `role` (ator Administrador, D7), `terms_accepted_at` (privacidade), `session_version` (encerra sessões ao redefinir a senha) |
| **PasswordResetToken** | UC02 (recuperação de senha) | — | hash SHA-256 do token, validade, uso único (`used_at`), criação — ver [EMAIL-AND-AUTH.md](./EMAIL-AND-AUTH.md) |
| **LearningProfile** | §20 Perfil de aprendizagem, UC03, UC04 | nível, objetivo, dificuldades, progresso | nível percebido, experiência anterior, interesses (UC03), pontuação e data do nivelamento |
| **Preference** | UC12, RF19 | idioma das explicações, intensidade das correções, preferências de conversação, histórico, notificações, aprendizagem | meta diária |
| **Lesson** | §20 Aula | título, nível, conteúdo, tópico, exercícios | ordem (RN02), minutos estimados |
| **Exercise** | §20 Exercício | pergunta, alternativas/resposta esperada | tipo, explicação PT/EN, tema (skill) |
| **ExerciseAttempt** | §20 Exercício ("resposta do usuário, resultado"), UC06 | resposta do usuário, resultado | contexto (aula, nivelamento, revisão), data |
| **Vocabulary** | §20 Vocabulário | palavra, significado, exemplos, nível | tradução, classe gramatical, tópico; `phonetic` preparado (pronúncia futura) |
| **UserVocabulary** | §20 Vocabulário ("frequência de revisão"), RF17 | frequência de revisão | status, vezes revisada, próxima revisão |
| **Conversation** | §20 Conversação | usuário, mensagens, contexto, data, configurações de retenção | assunto, nível no início, metadados mínimos (nº de mensagens, temas corrigidos) |
| **Message** | §20 Conversação ("mensagens") | — | papel, conteúdo, tradução de apoio, correções exibidas e adiadas, avisos |
| **Progress** | §20 Progresso | conteúdos concluídos, desempenho, métricas de estudo | por aula: status, acertos, nota, tempo |
| **Review** | §20 Progresso ("revisões"), UC08 | revisões | tipo, referência, motivo, vencimento, passo do intervalo |

> **Indicadores agregados** (taxa de acertos, dias de estudo, sequência, tempo total, erros recorrentes) **não são armazenados**: são calculados a partir de Progress, ExerciseAttempt, Review, UserVocabulary e Conversation (`packages/core/src/domain/progress.ts`). Em escala, podem ser materializados (ver ARCHITECTURE.md §Escalabilidade).

## 2. DER

```mermaid
erDiagram
    USER ||--|| LEARNING_PROFILE : "possui"
    USER ||--|| PREFERENCE : "configura"
    USER ||--o{ PROGRESS : "registra"
    USER ||--o{ EXERCISE_ATTEMPT : "responde"
    USER ||--o{ USER_VOCABULARY : "estuda"
    USER ||--o{ REVIEW : "revisa"
    USER ||--o{ CONVERSATION : "conversa"
    USER ||--o{ PASSWORD_RESET_TOKEN : "pede redefinição"
    LESSON ||--o{ EXERCISE : "contém"
    LESSON ||--o{ PROGRESS : "é acompanhada em"
    LESSON }o--o{ VOCABULARY : "apresenta (lesson_vocabulary)"
    EXERCISE ||--o{ EXERCISE_ATTEMPT : "recebe"
    VOCABULARY ||--o{ USER_VOCABULARY : "é estudada em"
    CONVERSATION ||--o{ MESSAGE : "contém"

    USER {
        text id PK
        text name
        text email UK
        text password_hash
        text role
        text created_at
        text terms_accepted_at
        int session_version
    }
    PASSWORD_RESET_TOKEN {
        text id PK
        text user_id FK
        text token_hash UK "SHA-256; o token só existe no e-mail"
        text expires_at
        text used_at "nulo até ser usado"
        text created_at
    }
    LEARNING_PROFILE {
        text user_id PK,FK
        text goal
        text perceived_level
        text prior_experience
        int conversation_interest
        int professional_interest
        text interest_areas "JSON"
        text estimated_level
        int placement_score
        text placement_completed_at
        text onboarding_completed_at
        text difficulties "JSON"
        text updated_at
    }
    PREFERENCE {
        text user_id PK,FK
        text explanation_language
        text correction_intensity
        text reply_length
        int show_translations
        int save_conversation_history
        int study_reminders
        int daily_goal_minutes
        text updated_at
    }
    LESSON {
        text id PK
        text level
        int sort_order
        text title
        text topic
        text content "JSON"
        int estimated_minutes
    }
    EXERCISE {
        text id PK
        text lesson_id FK
        text type
        text prompt
        text options "JSON"
        text accepted_answers "JSON"
        text skill_tag
    }
    EXERCISE_ATTEMPT {
        text id PK
        text user_id FK
        text exercise_id
        text lesson_id FK
        text skill_tag
        text context
        text answer
        int is_correct
        text created_at
    }
    VOCABULARY {
        text id PK
        text word
        text translation
        text meaning
        text part_of_speech
        text level
        text topic
        text examples "JSON"
        text phonetic
    }
    USER_VOCABULARY {
        text user_id PK,FK
        text vocabulary_id PK,FK
        text status
        int times_reviewed
        text first_seen_at
        text last_reviewed_at
        text next_review_at
    }
    PROGRESS {
        text user_id PK,FK
        text lesson_id PK,FK
        text status
        int correct_count
        int total_count
        int score
        int time_spent_seconds
        text started_at
        text completed_at
        text updated_at
    }
    REVIEW {
        text id PK
        text user_id FK
        text kind
        text ref_id
        text reason
        text status
        text due_at
        int interval_step
        int times_reviewed
        int last_score
        int time_spent_seconds
        text last_reviewed_at
        text created_at
    }
    CONVERSATION {
        text id PK
        text user_id FK
        text topic_id
        text title
        text level_at_start
        text context "JSON"
        text retention
        text expires_at
        int user_message_count
        text corrected_skills "JSON"
        text content_deleted_at
        text created_at
        text updated_at
        text ended_at
    }
    MESSAGE {
        text id PK
        text conversation_id FK
        text role
        text content
        text translation
        text corrections "JSON"
        text deferred_corrections "JSON"
        text notices "JSON"
        text created_at
    }
```

### Observações do modelo

- **Exercícios de nivelamento e de vocabulário** não são linhas de `EXERCISE`: são gerados a partir do catálogo (`placement:*`, `vocab:*`). Por isso `exercise_attempt.exercise_id` **não** tem chave estrangeira — apenas `lesson_id` tem. Essa decisão evita criar uma entidade extra de "Nivelamento" não prevista nos documentos; o resultado do nivelamento fica no `LEARNING_PROFILE`.
- **Review.ref_id** é polimórfico (id de aula, tag de tema ou `vocabulary`), conforme `kind`.
- **Exclusão de dados (RF20):** todas as tabelas do usuário usam `ON DELETE CASCADE` a partir de `USER` (inclusive `PASSWORD_RESET_TOKEN`).
- **Recuperação de senha:** `PASSWORD_RESET_TOKEN` guarda só o hash do token; no máximo um pedido ativo por conta (um novo pedido apaga os anteriores); pedidos vencidos há mais de um dia são removidos pela limpeza periódica. `USER.session_version` sobe a cada redefinição e invalida os tokens de sessão emitidos antes.
- **Migrações:** o esquema é idempotente (`CREATE … IF NOT EXISTS`); colunas novas em bancos existentes entram por migrações aditivas em `apps/api/src/db/database.ts` (ex.: `session_version` com padrão 0), sem apagar dados.
- **Retenção (RN07):** ao expirar ou ao ser apagada, uma conversa perde as mensagens e os fatos do contexto; ficam só metadados sem conteúdo (`user_message_count`, `corrected_skills`) para o progresso.
- **Campos JSON**: listas pequenas e de leitura conjunta (interesses, exemplos, correções). Em PostgreSQL, viram `jsonb`.
- **Datas** em ISO 8601 UTC (texto) para portabilidade entre navegador, API e banco.

## 3. Diagrama de classes (domínio e serviços)

```mermaid
classDiagram
    direction LR

    class User {
      +id: string
      +name: string
      +email: string
      +role: UserRole
      +createdAt: ISODate
      +termsAcceptedAt: ISODate
    }
    class LearningProfile {
      +goal: Goal
      +perceivedLevel: PerceivedLevel
      +priorExperience: PriorExperience
      +interestAreas: InterestArea[]
      +estimatedLevel: Level
      +placementScore: number
      +difficulties: SkillTag[]
    }
    class Preferences {
      +explanationLanguage: auto|pt|en
      +correctionIntensity: light|balanced|detailed
      +replyLength: short|balanced
      +showTranslations: boolean
      +saveConversationHistory: boolean
      +studyReminders: boolean
      +dailyGoalMinutes: number
    }
    class Lesson {
      +id: string
      +level: Level
      +title: string
      +topic: string
      +explanation: Bilingual[]
      +examples: Example[]
      +exercises: Exercise[]
    }
    class Exercise {
      +id: string
      +type: ExerciseType
      +prompt: string
      +options: string[]
      +acceptedAnswers: string[]
      +explanation: ExplanationText
      +skillTag: SkillTag
    }
    class ExerciseAttempt {
      +answer: string
      +isCorrect: boolean
      +context: lesson|placement|review
    }
    class VocabularyEntry {
      +word: string
      +translation: string
      +meaning: string
      +level: Level
    }
    class UserVocabulary {
      +status: learning|learned
      +timesReviewed: number
      +nextReviewAt: ISODate
    }
    class Conversation {
      +topicId: string
      +context: ConversationContext
      +retention: saved|ephemeral
      +expiresAt: ISODate
    }
    class Message {
      +role: user|assistant
      +content: string
      +translation: string
      +corrections: Correction[]
      +deferredCorrections: Correction[]
    }
    class Correction {
      +original: string
      +suggestion: string
      +explanation: string
      +severity: meaning|grammar|naturalness
    }
    class Progress {
      +status: in_progress|completed
      +score: number
      +timeSpentSeconds: number
    }
    class Review {
      +kind: lesson|skill|vocabulary
      +reason: ReviewReason
      +dueAt: ISODate
      +intervalStep: number
    }

    User "1" -- "1" LearningProfile
    User "1" -- "1" Preferences
    User "1" -- "*" Progress
    User "1" -- "*" ExerciseAttempt
    User "1" -- "*" UserVocabulary
    User "1" -- "*" Review
    User "1" -- "*" Conversation
    Lesson "1" *-- "*" Exercise
    Lesson "*" -- "*" VocabularyEntry
    Exercise "1" -- "*" ExerciseAttempt
    VocabularyEntry "1" -- "*" UserVocabulary
    Conversation "1" *-- "*" Message
    Message "1" *-- "*" Correction

    class AIService {
      <<interface>>
      +providerName: string
      +startConversation(input) AssistantReply
      +conversation(input) ConversationTurnOutput
      +explain(input) string
      +anotherExample(input) Example
      +correct(input) CorrectOutput
      +generateExercise(input) Exercise
    }
    class MockAIService
    class LLMAIService
    class FallbackAIService
    class AIProvider {
      <<interface>>
      +name: string
      +complete(request) string
    }
    class AnthropicProvider
    AIService <|.. MockAIService
    AIService <|.. LLMAIService
    AIService <|.. FallbackAIService
    LLMAIService --> AIProvider
    AIProvider <|.. AnthropicProvider

    class DataStore {
      <<interface>>
      +users
      +profiles
      +preferences
      +progress
      +attempts
      +userVocabulary
      +reviews
      +conversations
      +messages
      +passwordResets
      +deleteUserData(userId)
    }
    class SqliteDataStore
    class DocumentStore
    DataStore <|.. SqliteDataStore
    DataStore <|.. DocumentStore
```

## 4. Índices

| Tabela | Índice | Motivo |
|--------|--------|--------|
| users | `UNIQUE(email)` | login e verificação de conta existente (UC01-A2) |
| password_reset_tokens | `UNIQUE(token_hash)` | busca do link pelo hash |
| password_reset_tokens | `(user_id, created_at)` | pedido mais recente da conta (intervalo mínimo entre e-mails) |
| password_reset_tokens | `(expires_at)` | limpeza de pedidos vencidos |
| exercise_attempts | `(user_id, created_at)` | progresso, dificuldades recentes |
| reviews | `(user_id, status, due_at)` | fila de revisão |
| conversations | `(user_id, updated_at)` | histórico |
| conversations | `(expires_at)` parcial onde `content_deleted_at IS NULL` | limpeza por retenção |
| messages | `(conversation_id, created_at)` | leitura da conversa |
