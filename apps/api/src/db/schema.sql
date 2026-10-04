-- =============================================================================
-- English AI — esquema relacional (SQLite). Ver docs/DATABASE-MODEL.md.
-- Idempotente: pode ser executado a cada inicialização.
-- Datas em ISO 8601 (UTC). Campos JSON guardam listas pequenas de leitura conjunta.
-- =============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at        TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  -- Sobe a cada redefinição de senha: sessões emitidas antes deixam de valer.
  -- Bancos criados antes desta coluna recebem-na pela migração em database.ts.
  session_version   INTEGER NOT NULL DEFAULT 0
);

-- Recuperação de senha: apenas o HASH (SHA-256) do token enviado por e-mail fica guardado.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_created ON password_reset_tokens(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS learning_profiles (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal                    TEXT,
  perceived_level         TEXT NOT NULL DEFAULT 'unknown',
  prior_experience        TEXT,
  conversation_interest   INTEGER NOT NULL DEFAULT 0,
  professional_interest   INTEGER NOT NULL DEFAULT 0,
  interest_areas          TEXT NOT NULL DEFAULT '[]',
  estimated_level         TEXT CHECK (estimated_level IN ('beginner', 'basic', 'intermediate', 'advanced')),
  placement_score         INTEGER,
  placement_completed_at  TEXT,
  onboarding_completed_at TEXT,
  difficulties            TEXT NOT NULL DEFAULT '[]',
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id                   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  explanation_language      TEXT NOT NULL DEFAULT 'auto' CHECK (explanation_language IN ('auto', 'pt', 'en')),
  correction_intensity      TEXT NOT NULL DEFAULT 'balanced' CHECK (correction_intensity IN ('light', 'balanced', 'detailed')),
  reply_length              TEXT NOT NULL DEFAULT 'balanced' CHECK (reply_length IN ('short', 'balanced')),
  show_translations         INTEGER NOT NULL DEFAULT 1,
  save_conversation_history INTEGER NOT NULL DEFAULT 1,
  study_reminders           INTEGER NOT NULL DEFAULT 0,
  daily_goal_minutes        INTEGER NOT NULL DEFAULT 10,
  updated_at                TEXT NOT NULL
);

-- Conteúdo pedagógico (sincronizado a partir de packages/core/src/content na inicialização)
CREATE TABLE IF NOT EXISTS lessons (
  id                TEXT PRIMARY KEY,
  level             TEXT NOT NULL,
  sort_order        INTEGER NOT NULL,
  title             TEXT NOT NULL,
  topic             TEXT NOT NULL,
  content           TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  options          TEXT NOT NULL DEFAULT '[]',
  accepted_answers TEXT NOT NULL DEFAULT '[]',
  skill_tag        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id             TEXT PRIMARY KEY,
  word           TEXT NOT NULL,
  translation    TEXT NOT NULL,
  meaning        TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  level          TEXT NOT NULL,
  topic          TEXT NOT NULL,
  examples       TEXT NOT NULL DEFAULT '[]',
  phonetic       TEXT
);

CREATE TABLE IF NOT EXISTS lesson_vocabulary (
  lesson_id     TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  vocabulary_id TEXT NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, vocabulary_id)
);

-- Dados de aprendizagem do usuário
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  lesson_id   TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  skill_tag   TEXT NOT NULL,
  context     TEXT NOT NULL CHECK (context IN ('lesson', 'placement', 'review')),
  answer      TEXT NOT NULL,
  is_correct  INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON exercise_attempts(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_vocabulary (
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id    TEXT NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  status           TEXT NOT NULL CHECK (status IN ('learning', 'learned')),
  times_reviewed   INTEGER NOT NULL DEFAULT 0,
  first_seen_at    TEXT NOT NULL,
  last_reviewed_at TEXT,
  next_review_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, vocabulary_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id          TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status             TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
  correct_count      INTEGER NOT NULL DEFAULT 0,
  total_count        INTEGER NOT NULL DEFAULT 0,
  score              INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  started_at         TEXT NOT NULL,
  completed_at       TEXT,
  updated_at         TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('lesson', 'skill', 'vocabulary')),
  ref_id             TEXT NOT NULL,
  reason             TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'done')),
  due_at             TEXT NOT NULL,
  interval_step      INTEGER NOT NULL DEFAULT 0,
  times_reviewed     INTEGER NOT NULL DEFAULT 0,
  last_score         INTEGER,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at   TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_user_status_due ON reviews(user_id, status, due_at);

CREATE TABLE IF NOT EXISTS conversations (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id           TEXT NOT NULL,
  title              TEXT NOT NULL,
  level_at_start     TEXT NOT NULL,
  context            TEXT NOT NULL,
  retention          TEXT NOT NULL CHECK (retention IN ('saved', 'ephemeral')),
  expires_at         TEXT,
  user_message_count INTEGER NOT NULL DEFAULT 0,
  corrected_skills   TEXT NOT NULL DEFAULT '[]',
  content_deleted_at TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  ended_at           TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_expiry ON conversations(expires_at) WHERE content_deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
  id                   TEXT PRIMARY KEY,
  conversation_id      TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role                 TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content              TEXT NOT NULL,
  translation          TEXT,
  corrections          TEXT NOT NULL DEFAULT '[]',
  deferred_corrections TEXT NOT NULL DEFAULT '[]',
  notices              TEXT NOT NULL DEFAULT '[]',
  created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
