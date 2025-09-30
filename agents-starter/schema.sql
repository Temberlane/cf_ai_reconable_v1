-- Reconable Lite+ Database Schema
-- D1 database schema for canonical facts and evidence storage

-- Claims table for storing extracted and verified facts
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  policy_tags TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_subject ON claims(subject_id);
CREATE INDEX IF NOT EXISTS idx_claims_predicate ON claims(predicate);
CREATE INDEX IF NOT EXISTS idx_claims_confidence ON claims(confidence);

-- Evidence table for storing raw collected data
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL,
  hash TEXT NOT NULL,
  extraction_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence(subject_id);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence(hash);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence(source_url);

-- Subject runs table for tracking analysis runs
CREATE TABLE IF NOT EXISTS subject_runs (
  id TEXT PRIMARY KEY,
  subject_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  claims_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_user ON subject_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON subject_runs(status);

-- User sessions table for OAuth tokens and consent
CREATE TABLE IF NOT EXISTS user_sessions (
  user_id TEXT PRIMARY KEY,
  linkedin_tokens_json TEXT,
  consent_flags_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vector embeddings table for semantic search
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding_vector TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vector_subject ON vector_embeddings(subject_id);
CREATE INDEX IF NOT EXISTS idx_vector_hash ON vector_embeddings(content_hash);
