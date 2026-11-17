-- Content submission pipeline, Phase 1 (docs/content-submission-pipeline.md). Run with:
--   wrangler d1 execute english-learning-db --file=migrations/0003_submissions.sql --remote
-- (drop --remote for the local wrangler dev DB.)
--
-- The private "locked drawer": parent-submitted words/pictures wait here for review.
-- Image BYTES live in R2 (key = image_key); this table holds only metadata. Pending
-- and rejected rows never reach the public repo — only APPROVED assets get baked in.
-- Like the rate_limits table, the submit handlers FAIL CLOSED if this is missing
-- (they return 503), so a half-applied deploy rejects submissions rather than losing
-- them silently — apply this before enabling the parent "share" UI.

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,   -- crypto.randomUUID()
  kind        TEXT NOT NULL,      -- 'image' | 'word'
  word        TEXT NOT NULL,
  category    TEXT NOT NULL,
  translation TEXT,               -- word submissions only
  image_key   TEXT,               -- R2 key (image submissions only)
  submitter   TEXT,               -- pseudonymous profile/device id
  family_id   TEXT,               -- cloud-account family id, if submitted signed-in
  status      TEXT NOT NULL,      -- 'pending' | 'approved' | 'rejected' | 'shipped'
  review_note TEXT,               -- the review agent's recommendation + reason
  confidence  TEXT,               -- 'high' | 'medium' | 'low' (review agent)
  created     TEXT NOT NULL,      -- ISO timestamp
  reviewed    TEXT                -- ISO timestamp, set when status leaves 'pending'
);

-- The review agent lists by status; the per-(word,category) lookup dedupes resubmits.
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_submissions_word ON submissions (category, word);
