# Cloudflare Pages deploy (prepped — not yet the primary host)

The app currently lives on **Netlify** (`lomdim-anglit.netlify.app`,
`netlify deploy --prod`). This repo is also **ready to deploy to Cloudflare Pages**
with no code changes — everything below is already wired. Switching primary hosts
is a separate decision (DNS / which URL you hand out); this doc just makes the
Cloudflare deploy a one-command operation when you want it.

## Why Cloudflare Pages
Free tier with **no commercial restriction** + **unlimited bandwidth** + a good
Israel edge presence, and **Pages Functions** (generous free serverless) to host the
future M5/M13 backend seam. Vercel's free "Hobby" tier is non-commercial-only and
bandwidth-capped, which is the main reason to prefer Cloudflare for a possibly-public
kids' app. (See backlog §1 / the host-comparison.)

## What's already prepped in the repo
- `cloudflare/_headers` + `cloudflare/_redirects` — the equivalents of
  `netlify.toml`'s caching headers + SPA fallback. The Vite build copy plugin
  (`infra1-copy-static-assets` in `vite.config.ts`) emits them to `dist/` so a
  `dist`-based deploy gets identical behaviour. (Harmless on Netlify, which keeps
  using `netlify.toml`.)
- `.node-version` = `20` — Cloudflare Pages reads it for the build image.
- The build already produces a fully self-contained `dist/` (Vite bundle + the
  runtime-served `data/*.json`, `img/`, legacy scripts, `sw.js`, `vendor/`), so the
  publish directory is just `dist`. The app fetches absolute paths like
  `/data/nikud-map.json`, which work on Cloudflare's root domain (this is why GitHub
  Pages, which serves under `/<repo>/`, was ruled out).

## Deploy — option A: direct CLI (fastest, no GitHub hookup)
```sh
npm i -g wrangler            # or use npx wrangler ...
wrangler login              # opens a browser to auth your Cloudflare account
wrangler pages project create lomdim-anglit   # one-time; pick production branch = main
npm run build
wrangler pages deploy dist --project-name=lomdim-anglit
```
Repeat deploys are just the last two lines.

## Deploy — option B: Git-connected (auto-deploy on push)
In the Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git →
pick this repo, then set:
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** picked up from `.node-version` (20)

Each push to the production branch then builds + deploys automatically (unlike the
current Netlify setup, which is CLI-only / not dashboard-connected).

## After verifying Cloudflare
Spot-check the live Pages URL: `/`, `/sw.js` (must be `Cache-Control: max-age=0`),
`/data/nikud-map.json`, a vocab image under `/img/...`, the PWA install, and a mic
game over HTTPS. Only then decide whether to move the public URL/DNS over and retire
the Netlify site.
