# Cloudflare deploy (Workers static assets) — ✅ LIVE 2026-06-15

**LIVE at https://english-learning.2sharp4u.workers.dev/** (Cloudflare Worker
`english-learning`, account 2sharp4u@gmail.com, **Git-connected** to
`2sharp4u-wastaken/english-learning` @ branch `v3-react-migration` → **auto-deploys on
every push**). Chosen as the future-facing successor to Pages so the M5/M13 backend
can later run as Worker Functions in the same project.

**Netlify (`lomdim-anglit.netlify.app`) is still live too** and is NOT auto-connected —
it only updates on a manual `netlify deploy --prod`. So pushing updates Cloudflare
automatically; Netlify lags until you redeploy it (keep them in sync or retire one).
Verified live on Cloudflare: `/` (with `translate="no"`), `/sw.js`
(`max-age=0,must-revalidate`), `/data/nikud-map.json`, `/img/*`, `/assets/*`
(immutable), SPA deep-link fallback — all 200.

> **The painful gotchas (so a fresh session doesn't re-hit them):**
> 1. **Use Workers, preset = None — NOT the "Vite framework" auto-detect.** The first
>    attempt let Cloudflare's C3 auto-setup rewrite `vite.config.ts` to inject
>    `@cloudflare/vite-plugin` (ESM-only → broke the build) and fork a throwaway
>    `english-learning-v2` repo. Committing **`wrangler.jsonc`** stops that (explicit
>    config ⇒ no auto-config).
> 2. **Production branch is pinned at Worker-create time.** The Worker was created
>    while the GitHub default was `main` (which is **173 commits behind**, has no
>    `build` script / deps → "Missing script: build"). Fix: set the GitHub default to
>    `v3-react-migration` AND the Worker's Settings → Build → Branch control →
>    Production branch = `v3-react-migration`. Changing the GitHub default alone does
>    NOT retro-update an existing Worker.
> 3. **No `_redirects`.** Cloudflare rejects the SPA catch-all `/* /index.html 200`
>    ("infinite loop" [code 100324]). SPA fallback comes from `wrangler.jsonc`'s
>    `not_found_handling`. `_headers` is fine.
> 4. The "english-learning-v2 build token" under Settings → API token is a harmless
>    naming artifact (the GitHub auth was first set up for v2); ignore it.
> 5. Don't maintain `english-learning-v2` — connecting a host is read-only, so a
>    second repo is redundant and only drifts. Delete it + the v2 Worker.
>
> **Shorter URL (deferred, user chose to skip for the beta):** renaming the Worker is
> messy (name = URL + tied to the Git build identity → clean rename = delete+recreate
> as `lomdim`). The real win is a **custom domain** (Worker → Settings → Domains &
> Routes → Add Custom Domain; free to attach, auto-SSL). A QR for the current URL was
> generated for the family/friends beta.

## What's prepped in the repo
- **`wrangler.jsonc`** — static-assets config (`assets.directory = ./dist`,
  `not_found_handling = single-page-application`). No `main`/Worker script yet (pure
  static); add one when M5/M13 needs Functions.
- `cloudflare/_headers` — caching headers, emitted into `dist/` by the Vite copy
  plugin. (No `_redirects`: Cloudflare rejects the SPA catch-all `/* /index.html 200`
  with "infinite loop" [code 100324] — SPA fallback comes from `wrangler.jsonc`'s
  `not_found_handling: single-page-application` instead.)
- `.node-version` = 20.

## Deploy — option A: dashboard "Workers Builds" (Git-connected, auto-deploys on push)
1. Delete the broken **`english-learning-v2`** Worker (and the `english-learning-v2`
   GitHub repo) if they exist.
2. dash.cloudflare.com → **Workers & Pages** → **Create** → **Workers** → **Connect to
   a Git repository** (NOT "Import a Vite app" / framework preset — leave preset
   **None**).
3. Pick **`english-learning`**, production branch **`v3-react-migration`**.
4. Build command: `npm run build` · Deploy command: `npx wrangler deploy`.
   (Cloudflare reads `wrangler.jsonc` → no C3 auto-config, no plugin injection.)
5. Save & Deploy → you get `english-learning.<account>.workers.dev`.

## Deploy — option B: direct CLI (needs a working `wrangler login` or API token)
```sh
npm run build
npx wrangler deploy        # reads wrangler.jsonc, uploads ./dist
```
Note: interactive `wrangler login` (browser callback) has been unreliable from the
agent shell; a `CLOUDFLARE_API_TOKEN` ("Workers Scripts: Edit" + "Account: Read") is
the robust non-interactive alternative.

## After it's live — spot-check the *.workers.dev URL
`/` loads · `/sw.js` returns `Cache-Control: max-age=0, must-revalidate` ·
`/data/nikud-map.json` 200 · an `/img/...` picture 200 · deep-link SPA fallback ·
PWA install + a mic game over HTTPS. Only then consider moving the public URL/DNS off
Netlify.
