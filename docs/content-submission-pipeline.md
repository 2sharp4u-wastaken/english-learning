# Content Submission Pipeline — parent uploads → automated review → ship to everyone

**Status:** DESIGN (2026-11-02). Supersedes the sketch in backlog §M5 (words) + §M13
(images). Not yet built. This is the "crowdsource missing/wrong vocab pictures and
words from parents, owner-reviewed before they reach prod" feature, redesigned around
a **daily (and on-demand) Claude review agent** instead of a manual queue.

## Goal

A parent on their own device sets a better picture for a word (or adds a word), taps
"share", and it eventually reaches **every** child in the next deploy — but only after
a review gate the owner controls. The review is **automated** (collection + AI
pre-screen + report + one-click execute); the **final publish stays human** (owner
merges a PR).

## Decisions (owner, 2026-11-02)

1. **Queue storage = private D1 + R2; repo stays PUBLIC** ("locked drawer, open wall").
   Pending/rejected submissions live only in storage we already own and never appear
   on any public surface. Only *approved* assets get baked into the public repo — and
   those are meant to be public. **No private repo needed** (and GitHub private repos
   are free anyway; the premise that they cost money is outdated — GitHub Free has
   unlimited private repos + 2,000 Actions min/month). This posture is chosen because
   the real exposure is *unreviewed* uploads (a parent could upload a photo of their
   own child), and this keeps those private while leaving the project open-source.

2. **Auto-approve Claude's high-confidence safe items — via a PR, not a live push.**
   The review agent bakes items it rates clearly safe + on-topic into a **pull
   request** to the deploy branch; the owner merges it. Same speed, but a wrong AI
   guess can never reach children without one explicit merge click. Anything with a
   face/PII, or that the agent isn't confident about, is **never auto-approved** — it
   goes into the report for the owner to decide.

3. **Trigger = daily + on-demand.** A Routine fires once a day (silent no-op when the
   queue is empty) and can also be fired manually anytime. Completion sends a push +
   email notification; the full report lives in the fired session.

## Privacy posture (why "locked drawer, open wall" is safe)

| Data | Where it lives | Visibility |
| --- | --- | --- |
| Pending image bytes | R2 (`REPORTS_BUCKET` or a new `SUBMISSIONS_BUCKET`), random key | Private — served only via an admin endpoint behind `ADMIN_TOKEN` |
| Pending metadata (word, category, submitter) | D1 `submissions` table | Private — admin endpoint only |
| **Approved** image + word | baked into `img/icons/<cat>/<word>.webp` + `data/categories/*` | Public (intended — ships to all kids) |
| Rejected submission | D1 row flipped to `rejected`; R2 object deleted | Never public |

The public repo never contains an unreviewed upload. The submission endpoints carry
the same hardening already applied to `/api/report` (content-type allowlist, size cap,
random unguessable keys, rate limit).

## Architecture

```
Parent device (WordImagesPanel / CustomWordsPanel)
  sets image/word locally (EXISTS today: setImageOverride / custom words)
        │  taps "שתפו" (new)
        ▼
POST /api/submit-image | /api/submit-word   (new Worker endpoints — twins of /api/report)
  • validate (type/size), rate-limit, total cap
  • image bytes → R2 (random key);  metadata → D1 submissions(status='pending')
        ▼
  D1 `submissions`  +  R2 pending objects   ← the private "locked drawer"
        ▲
        │  admin endpoints (behind ADMIN_TOKEN secret):
        │    GET  /api/admin/submissions?status=pending   → rows + short-lived image URLs
        │    POST /api/admin/submissions/:id {status,note} → mark approved/rejected/shipped
        │
┌────────── DAILY + ON-DEMAND CLAUDE ROUTINE (fresh cloud session) ──────────┐
│ 1. List pending from D1; fetch each image from R2 (admin endpoint)          │
│ 2. VISION pre-screen each → { verdict, confidence, reason, hasFacePII }     │
│ 3. Auto-approve ONLY: verdict=approve AND confidence≥HIGH AND !hasFacePII   │
│      AND on-topic for the word                                              │
│ 4. Bake auto-approved → img/icons/<cat>/<word>.webp + imageUrl in           │
│      data/categories/*  (words → category files) on a branch                │
│ 5. Open ONE pull request to v3-react-migration                              │
│ 6. Mark baked rows status='approved'; mark clear-bad rows 'rejected'        │
│ 7. Build report (auto-approved→in PR / needs-you / auto-rejected) +         │
│      PUSH + EMAIL notification; full report stays in the session            │
│ 8. Empty queue → no-op, no notification                                     │
└─────────────────────────────────────────────────────────────────────────────┘
        │  owner reads report, merges the PR  (and/or replies "approve 3,7" for borderline)
        ▼
Cloudflare auto-deploys v3-react-migration → every child gets it next version
```

Nothing new to provision: D1 (`english-learning-db`), R2, the Worker, and the deploy
branch all already exist. The render path already prefers `imageUrl`/override over the
emoji (`word.imageUrl || overrides[...]`), so a baked `imageUrl` "replaces" the emoji
everywhere automatically while the emoji remains as an offline/old-Android fallback.

## Data model — D1 `submissions`

```sql
CREATE TABLE submissions (
  id          TEXT PRIMARY KEY,   -- crypto.randomUUID()
  kind        TEXT NOT NULL,      -- 'image' | 'word'
  word        TEXT NOT NULL,
  category    TEXT NOT NULL,
  translation TEXT,               -- word submissions only
  image_key   TEXT,               -- R2 key (image submissions)
  submitter   TEXT,               -- pseudonymous profile/device id
  family_id   TEXT,               -- if submitted via a cloud account (optional)
  status      TEXT NOT NULL,      -- 'pending' | 'approved' | 'rejected' | 'shipped'
  review_note TEXT,               -- the agent's recommendation + reason
  confidence  TEXT,               -- 'high' | 'medium' | 'low' (agent)
  created     TEXT NOT NULL,
  reviewed    TEXT
);
```
`status` lifecycle: `pending` → (`approved` in PR | `rejected`) → `shipped` on merge.

## The review agent — what it checks

Per submission the vision pass returns a structured verdict:
- **on-topic?** does the image clearly depict the word (a chair for "chair")?
- **appropriate?** nothing unsafe/offensive for a 5–8 kids' app.
- **face/PII?** any human faces, names, documents → `hasFacePII=true` → **never
  auto-approve** (owner decides).
- **quality?** in focus, framed, not a screenshot of something unrelated.
- **confidence** high/medium/low.

**Auto-approve gate (all must hold):** `verdict=approve` ∧ `confidence=high` ∧
`!hasFacePII` ∧ on-topic. Everything else → the "needs you" section of the report.
Clear junk/unsafe → auto-reject (R2 object deleted, row `rejected`), surfaced in the
report so the owner can see what was turned away.

This is a filter, not a verdict — the owner still merges the PR.

## Notification + "execute" flow

- The Routine is a **fresh-session-per-fire** Routine with `notifications: {push,email}`.
- On a day with results it pushes a short summary ("3 pictures ready to merge, 2 need
  your eyes") + emails the report; the full detail (thumbnails, reasons, PR link) is in
  the fired session, openable in the Claude app.
- **Execute:** owner either (a) merges the PR the agent opened (ships the auto-approved
  batch), and/or (b) replies in the session "approve the duck one too" → the agent bakes
  the borderline pick into the same/next PR.
- Empty queue → the run is a silent no-op (no push, no email, no PR) so quiet days cost
  ~nothing.

## Abuse / cost controls

- `/api/submit-*` are unauthenticated like `/api/report`: **rate-limit** (reuse the D1
  fixed-window limiter in `worker/auth.ts`) + a **total-pending cap** per device and
  globally (R2 storage cost). Optionally gate behind a cloud account to cut spam.
- The daily agent spends Claude usage only when the queue is non-empty.
- `ADMIN_TOKEN` is a Worker secret; the admin list/fetch/update endpoints 401 without it.

## Honest trade-offs

- **AI review is fallible.** Keeping the human merge gate is the safety net; do not
  remove it for kids' content going into a permanent public bundle.
- **Permanence.** Once a PR merges, the asset is in public git history forever — the
  merge click is the point of no return.
- **Style drift.** Parent photos look different from the curated SVG/emoji set; that's
  a curation call the owner makes at merge time.
- **Still client-trust** on the parent side (not the §6 account-security boundary) —
  acceptable because the owner gates every publish.

## Phased build plan

1. **P1 — Submit path.** Worker `/api/submit-image` + `/api/submit-word`, D1
   `submissions` migration, R2 writes, rate-limit + cap. Unit-test like `auth.test.ts`.
2. **P2 — Parent UI.** "שתפו" button + client downscale on `WordImagesPanel` (local
   half exists) and `CustomWordsPanel`. Applies locally immediately (today's path) and
   POSTs the submission.
3. **P3 — Admin endpoints.** `GET/POST /api/admin/submissions*` behind `ADMIN_TOKEN`.
4. **P4 — Review agent + bake script.** `scripts/review-submissions.*` (list → vision
   screen → bake approved into `img/`+`data/categories/*` → open PR → mark D1). Wire it
   as a daily + on-demand Routine with push/email notifications.
5. **P5 — Optional hardening.** Cloud-account gating on submit; auto-prune old rejected
   rows; a tiny stats line in the owner report (submissions/week, approval rate).

## Related

- Render/override internals: `src/bridge/customContent.ts`, `WordJourneyPicture.tsx`.
- Bug-report pipeline to clone: `worker/index.ts` (`/api/report` + R2 + GitHub issue).
- Deploy flow: push to `v3-react-migration` → Cloudflare Workers Build (docs/cloudflare-deploy.md).
- Supersedes backlog §M5 / §M13 (kept as pointers to this doc).
