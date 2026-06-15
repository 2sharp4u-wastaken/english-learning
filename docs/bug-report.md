# Beta bug / feedback report feature

A floating "report an issue" widget on **every page** (hub + games) lets beta
testers describe a problem (Hebrew or English) and upload a screenshot they took,
then submit. Reports land in a queue we triage.

## Architecture

```
BugReportWidget (src/features/feedback/BugReportWidget.tsx)
  → bridge/bugReport.ts   (downscale screenshot, gather context, POST + local buffer)
  → POST /api/report      (multipart: payload JSON + optional screenshot)
      ↓ (Cloudflare Worker, worker/index.ts)
      screenshot → R2 (REPORTS_BUCKET)            ← image storage
      GitHub Issue (label `beta-report`)          ← the triage queue
```

- **Frontend** is live and backend-agnostic. It POSTs to `/api/report` AND always
  writes a copy to the `bugReports_local` localStorage buffer (capped, screenshot
  inlined only if < ~900 KB) so **no report is lost before the backend is live**.
  `getLocalBugReports()` reads the buffer.
- **Screenshot** is a user-uploaded file (mobile: camera/gallery), downscaled
  client-side to ≤1280px JPEG q0.8 — small payload + handles the "take a
  screenshot of the issue" flow. (Programmatic page capture is unreliable —
  misses canvas/confetti/cross-origin — so we don't do it.)
- **Queue = GitHub Issues** (repo `2sharp4u-wastaken/english-learning`): triage in
  the Issues tab or with `gh issue list --label beta-report`. R2 holds the image
  because the Issues REST API can't reliably attach binaries; the issue body
  embeds the Worker-served image URL.

## Why this backend (vs the alternatives)
- **R2 is storage, GitHub is the queue** — composed, not redundant. A chat
  webhook (Telegram/Discord) was the other finalist (fastest, instant phone
  ping) but can't be read/triaged from a Claude Code session; GitHub Issues can
  (`gh`). R2-only works too but has no ready triage UI.

## Status: LIVE (2026-06-16)

Provisioned + verified end-to-end on account `2sharp4u@gmail.com`:
- R2 bucket `english-learning-reports` created; `wrangler.jsonc` carries `main`,
  the `ASSETS` + `REPORTS_BUCKET` bindings, and the `GITHUB_REPO` var.
- `GITHUB_TOKEN` = a **no-expiry** fine-grained PAT (repo `english-learning`,
  Issues: RW), set via `wrangler secret put`. **No-expiry by choice** — an
  expiring token would silently stop issue creation when it lapsed (reports
  would still buffer locally + screenshots still hit R2, but no issues). If it's
  ever rotated, re-run `wrangler secret put GITHUB_TOKEN`.
- `beta-report` label created in the repo.
- Verified: a POST created issue #1 with the screenshot served from R2.

## Re-provisioning from scratch (if ever needed)

The steps that stood it up — for a fresh account/repo. (Historical note: the
Worker was first committed *unwired* so a missing binding couldn't break the
live auto-deploy; it's wired now.)

1. **Authenticate** (so the CLI — and Claude — can act):
   ```sh
   wrangler login          # Cloudflare
   gh auth login           # GitHub (lets us triage with gh)
   ```
2. **Create the R2 bucket:**
   ```sh
   wrangler r2 bucket create english-learning-reports
   ```
3. **Create a GitHub fine-grained PAT** with **Issues: Read and write** on the
   `english-learning` repo, then set it + the repo as Worker secrets/vars:
   ```sh
   wrangler secret put GITHUB_TOKEN     # paste the PAT
   # GITHUB_REPO is a plain var — add to wrangler.jsonc vars (step 4)
   ```
4. **Wire the Worker into `wrangler.jsonc`** (add to the existing config):
   ```jsonc
   "main": "worker/index.ts",
   "assets": { "directory": "./dist", "binding": "ASSETS",
               "not_found_handling": "single-page-application" },
   "r2_buckets": [{ "binding": "REPORTS_BUCKET", "bucket_name": "english-learning-reports" }],
   "vars": { "GITHUB_REPO": "2sharp4u-wastaken/english-learning" }
   ```
   (Note: adding `binding: "ASSETS"` is required so the Worker can serve the SPA
   via `env.ASSETS.fetch` once a `main` script exists.)
5. **Create the `beta-report` label** once: `gh label create beta-report --color FBCA04`.
6. **Deploy** — a `git push` triggers the Cloudflare Workers build, which now
   bundles `main` too. Verify: submit a report → a `beta-report` issue appears.

## Triaging the queue
- `gh issue list --label beta-report` / `gh issue view <n>` / `gh issue close <n>`.
- Each issue carries the screenshot + a context table (route, user, viewport, UA,
  build, timestamp).
- Pre-backend reports sit in each tester's `bugReports_local` — only recoverable
  from that device until the backend is live.
