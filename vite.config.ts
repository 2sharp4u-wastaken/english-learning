import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// INFRA1: `publicDir` is false (legacy assets are served from the project root by
// the dev server), so `vite build` emits only the bundled module graph. These
// runtime-served assets are referenced by bare/absolute paths and are NOT in that
// graph, so without this copy step a built `dist/` (and `vite preview`) 404s on
// them — silently breaking audio/feedback, nikud, and every vocab picture:
//   - 5 legacy non-module <script> tags in index.html (error/speech/feedback/audio/gamification)
//   - data/*.json fetched at runtime (nikud map + phonetic index)
//   - img/ (vocab pictures referenced via imageUrl strings, not imports)
//   - PWA (INFRA1): manifest.webmanifest + sw.js (root) + vendor/ (self-hosted confetti)
// This makes `dist/` a faithful, deployable copy of what `npm run dev` serves.
function copyStaticAssets(): Plugin {
  const rootFiles = [
    'error-tracker.js',
    'speechSynthesis.js',
    'feedback.js',
    'audio-effects.js',
    'gamification.js',
    // PWA (INFRA1): the service worker is referenced only as a runtime string
    // (navigator.serviceWorker.register('/sw.js')), so Vite never processes it —
    // it must be copied to the root verbatim. (The manifest + apple-touch-icon are
    // <link>ed in index.html, so Vite already hashes + emits + rewrites those.)
    'sw.js',
  ]
  return {
    name: 'infra1-copy-static-assets',
    apply: 'build',
    closeBundle() {
      const root = __dirname
      const out = path.resolve(root, 'dist')
      for (const file of rootFiles) {
        fs.copyFileSync(path.resolve(root, file), path.join(out, file))
      }
      // vendor/: self-hosted canvas-confetti (no jsdelivr CDN → offline-capable).
      fs.cpSync(path.resolve(root, 'vendor'), path.join(out, 'vendor'), { recursive: true })
      // data/: only the runtime-fetched JSON (the .js banks are already bundled
      // via the _loader module graph — copying them would be dead weight).
      const dataDir = path.resolve(root, 'data')
      for (const entry of fs.readdirSync(dataDir, { recursive: true }) as string[]) {
        if (!entry.endsWith('.json')) continue
        const dest = path.join(out, 'data', entry)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(path.join(dataDir, entry), dest)
      }
      // img/: the full picture tree (referenced by imageUrl strings, not imports).
      fs.cpSync(path.resolve(root, 'img'), path.join(out, 'img'), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), copyStaticAssets()],
  root: '.',
  publicDir: false, // legacy assets served from project root directly
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3002,
    // Slice 4.3 made the app fully Python-free — no `/api/*` calls remain, so the
    // dev proxy to server.py was removed. `npm run dev` runs standalone. (mic on
    // localhost is a secure context over HTTP; for LAN testing add `https` here.)
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      output: {
        // Slice 4.0 chunking. Split heavy node_modules out of the app chunk so
        // they cache independently and per-game lazy chunks stay tiny:
        //   - vendor: React/Router/Lucide etc. (long-lived, cache across deploys)
        //   - motion: framer-motion + motion-dom (heavy, only HomeMascot uses it)
        // The old eager legacy vanilla-JS graph (gameLogic.js/app.js/legacy game
        // modules) that used to fuse into the src/main.tsx entry and bloat the index
        // chunk past 500 KB is GONE (deleted in Slices 4.4.b/4.5 — the engine is now
        // src/engine/*; index chunk ≈380 KB). What still fuses into the entry are the
        // remaining eager index.html <script type="module"> tags: utils/consoleLogger.js
        // + data/_loader.js (the shared content bank) — small, intentionally eager.
        // React game pages are NOT named here — React.lazy() in GameHostPage already
        // gives each its own on-demand chunk.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion)[\\/]/.test(id)) {
              return 'motion'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
