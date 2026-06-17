-- Cloud accounts, Phase A (worker/auth.ts). Run with:
--   wrangler d1 execute english-learning-db --file=migrations/0001_cloud_accounts.sql --remote
-- (drop --remote for the local wrangler dev DB). progress/prefs are defined now
-- but only populated in Phase B (per-player backup) — opaque JSON blobs.

CREATE TABLE IF NOT EXISTS families (
  id       TEXT PRIMARY KEY,
  email    TEXT UNIQUE NOT NULL,
  pw_hash  TEXT NOT NULL,
  pw_salt  TEXT NOT NULL,
  created  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id        TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name      TEXT NOT NULL,
  initial   TEXT,
  created   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_family ON players(family_id);

-- Phase B: per-player progress / prefs backup (opaque JSON blob + updated stamp).
CREATE TABLE IF NOT EXISTS progress (
  player_id TEXT PRIMARY KEY,
  blob      TEXT NOT NULL,
  updated   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prefs (
  player_id TEXT PRIMARY KEY,
  blob      TEXT NOT NULL,
  updated   TEXT NOT NULL
);
