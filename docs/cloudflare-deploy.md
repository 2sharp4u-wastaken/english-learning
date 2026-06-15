# Cloudflare deploy (Workers static assets — prepped, not yet primary)

The app currently lives on **Netlify** (`lomdim-anglit.netlify.app`,
`netlify deploy --prod`). This repo is also ready to deploy to **Cloudflare Workers**
(static assets) — the future-facing successor to Cloudflare Pages, chosen so the
M5/M13 backend can later run as Worker Functions in the same project. Switching the
public URL is a separate decision; this doc makes the Cloudflare deploy reliable.

> **Use Workers, not Pages, and not the "Vite framework" auto-detect.** The first
> attempt failed because Cloudflare's C3 auto-setup rewrote `vite.config.ts` to
> inject `@cloudflare/vite-plugin` (ESM-only → broke the build) and pushed a copy to
> a throwaway `english-learning-v2` repo. Committing `wrangler.jsonc` (below) stops
> that: with an explicit config present, the build just runs `npm run build` and
> uploads `./dist`. Deploy from the canonical **`english-learning`** repo — don't
> maintain `english-learning-v2` (connecting a host is read-only, so a second repo
> is redundant and only drifts).

## What's prepped in the repo
- **`wrangler.jsonc`** — static-assets config (`assets.directory = ./dist`,
  `not_found_handling = single-page-application`). No `main`/Worker script yet (pure
  static); add one when M5/M13 needs Functions.
- `cloudflare/_headers` + `_redirects` — caching + SPA fallback, emitted into `dist/`
  by the Vite copy plugin (Workers Assets honors both).
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
