# Cloud backend — accounts + multi-device progress sync (Tier-3)

Status: **Phase A LIVE 2026-06-17.** D1 `english-learning-db`
(`2e813bd2-689d-46ac-9889-c8263c868f0c`, region EEUR) + `AUTH_SECRET` provisioned,
schema applied, `d1_databases` binding active in `wrangler.jsonc`, deployed. Verified
live: register → token, `/me`, 401 on wrong password, player CRUD. Phases B–D are
the roadmap. This is the §6 "Tier-3" work the backlog flagged. Everything stays
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
  (mock D1) + `src/bridge/__tests__/cloudAccount.test.ts` (mock fetch).
- **A.1 — guardrails (design-flaws Phase C, SHIPPED code 2026-07-05; needs the
  runbook below applied to go live).** `/api/auth/*` is rate-limited via a D1
  fixed-window counter (`migrations/0002_rate_limits.sql`; register 5/h/IP, login
  20/15min/IP + 10/15min/email; FAILS OPEN if the table is missing). Registration
  can be **invite-gated**: set the `SIGNUP_INVITE_CODE` secret and register
  requires a matching `inviteCode` (client shows the field on the
  `invite-required` error code). Data rights: `GET /api/family/export` (full JSON
  dump) + `DELETE /api/family` (echo the account email as `confirmEmail`) — both
  wired to buttons in the כלי הורה cloud card. **Still open: email verification**
  (needs an email provider; do before any un-invited public signup).
- **B — progress + prefs backup.** Push each player's `v2_userProgress_<id>` /
  `v2_playerPrefs_<id>` blob to `PUT /api/progress/:playerId` / `/api/prefs/:playerId`
  (debounced on change); pull on sign-in to a fresh device. Map local user ids ↔
  cloud player ids at link time.
- **C — bidirectional multi-device sync + conflict resolution.** Offline-first
  queue; per-blob `updatedAt`; merge progress (max of counts, union of learned-word
  sets, sum-safe coins), last-write-wins for prefs/settings.
- **D — leaderboards** (family + global) on the same DB (backlog § LB).

## Go-live runbook (Phase A) — ✅ DONE 2026-06-17 (kept for reference / re-provisioning)
The Worker 503s ("backend not configured") while unprovisioned. The steps that were run:
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

## Guardrails go-live runbook (Phase A.1 — RUN THESE, one-time)
The code ships inert-safe: the rate limiter fails open until the migration is
applied, and signup stays open until the secret is set.
```
wrangler d1 execute english-learning-db --file=migrations/0002_rate_limits.sql --remote
wrangler secret put SIGNUP_INVITE_CODE    # optional but recommended: closes signup to invite-only
```
Then deploy (`npm run cf-deploy` or push → auto-deploy). Verify: 6 rapid
registrations from one machine → the 6th returns 429; with the secret set,
register without a code → 403 `invite-required` and the card shows the
invite-code field.

## Privacy
Kids' data → minimal collection: only the parent email is PII; player names are
pseudonymous under the family. Data rights are live (Phase A.1): the parent can
export the family's full cloud data and permanently delete the account from the
כלי הורה card. Still open before any un-invited public signup: email
verification. Client-submitted leaderboard scores (Phase D) are spoofable
without server validation — treat a global board as "fun, not authoritative."
