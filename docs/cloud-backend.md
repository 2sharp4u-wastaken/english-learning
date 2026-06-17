# Cloud backend — accounts + multi-device progress sync (Tier-3)

Status: **Phase A code SHIPPED 2026-06-17** (not yet provisioned/live). Phases B–D
are the roadmap. This is the §6 "Tier-3" work the backlog flagged. Everything stays
**offline-first** — the cloud account is an optional layer; the app plays fully
offline with on-device profiles regardless.

## Why
Today each browser's localStorage is its own island (`bridge/auth.ts` users,
`v2_userProgress_<id>`, `v2_playerPrefs_<id>`). To let a child use the tablet AND
the laptop as the same profile, progress must live server-side and sync. The same
backend gives **real (non-devtools-bypassable) parent-password secrecy** and, later,
leaderboards (backlog § LB) and the M5/M13 word/image review queues.

## Architecture (Cloudflare-native — reuses the existing Worker)
- **Host/seam:** the app already runs on a Cloudflare Worker (`worker/index.ts`,
  serves `ASSETS` + `/api/report*`). Cloud endpoints are added to the same Worker.
- **Storage: Cloudflare D1** (SQLite). Schema in `migrations/0001_cloud_accounts.sql`:
  `families(id,email,pw_hash,pw_salt,created)`, `players(id,family_id,name,initial,created)`,
  `progress(player_id,blob,updated)`, `prefs(player_id,blob,updated)`. The
  progress/prefs **blobs are the exact per-user JSON the client already stores** —
  so backup/sync is opaque pass-through (no schema churn per feature).
- **Identity:** a **family account = parent email + password**. Players are
  pseudonymous names under it (only PII is the parent email).
- **Auth:** passwords hashed server-side with **PBKDF2-SHA256** (per-account salt,
  100k iters, Web Crypto); sessions are **HMAC-SHA256-signed JWTs** (`AUTH_SECRET`),
  stored client-side, sent as `Authorization: Bearer`. See `worker/auth.ts`.

## Phases
- **A — family account + server auth + players API (SHIPPED, code).**
  `worker/auth.ts` + routes in `worker/index.ts`: `POST /api/auth/register`,
  `POST /api/auth/login`, `GET /api/auth/me`, `GET/POST /api/players`,
  `DELETE /api/players/:id`. Client: `src/bridge/cloudAccount.ts` (optional, offline-
  first) + the "חשבון בענן וגיבוי" card in כלי הורה. Tests: `worker/__tests__/auth.test.ts`
  (8, mock D1) + `src/bridge/__tests__/cloudAccount.test.ts` (4, mock fetch).
- **B — progress + prefs backup.** Push each player's `v2_userProgress_<id>` /
  `v2_playerPrefs_<id>` blob to `PUT /api/progress/:playerId` / `/api/prefs/:playerId`
  (debounced on change); pull on sign-in to a fresh device. Map local user ids ↔
  cloud player ids at link time.
- **C — bidirectional multi-device sync + conflict resolution.** Offline-first
  queue; per-blob `updatedAt`; merge progress (max of counts, union of learned-word
  sets, sum-safe coins), last-write-wins for prefs/settings.
- **D — leaderboards** (family + global) on the same DB (backlog § LB).

## Go-live runbook (Phase A) — NOT done yet
The Worker 503s ("backend not configured") while unprovisioned, so the code is
already safe to deploy. To turn it on:
```
wrangler d1 create english-learning-db
#   → copy the printed database_id
wrangler d1 execute english-learning-db --file=migrations/0001_cloud_accounts.sql --remote
wrangler secret put AUTH_SECRET           # paste a long random string
```
Then **uncomment the `d1_databases` block in `wrangler.jsonc`** (paste the
`database_id`) and deploy: `npm run cf-deploy` (or push → auto-deploy).
Verify: `POST /api/auth/register {email,password}` returns a token; `GET /api/auth/me`
with that Bearer returns the family; wrong password → 401; the כלי הורה card
registers/logs in. The app still works offline with no account.

## Privacy
Kids' data → minimal collection: only the parent email is PII; player names are
pseudonymous under the family. Plan a data export/delete path before a public
launch of the cloud layer. Client-submitted leaderboard scores (Phase D) are
spoofable without server validation — treat a global board as "fun, not authoritative."
