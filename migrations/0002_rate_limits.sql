-- Cloud API guardrails (design-flaws Phase C, 2026-07-05). Run with:
--   wrangler d1 execute english-learning-db --file=migrations/0002_rate_limits.sql --remote
-- (drop --remote for the local wrangler dev DB.)
--
-- Fixed-window rate-limit counters for /api/auth/* (worker/auth.ts rateLimit()).
-- The limiter FAILS OPEN if this table is missing, so deploying the Worker
-- before applying this migration degrades to "no rate limiting", never to
-- broken auth — but apply it: the public URL had fully open, unthrottled signup.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,  -- e.g. 'register:1.2.3.4' / 'login-email:a@b.c'
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL   -- epoch ms of the current window
);
