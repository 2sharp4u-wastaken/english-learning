import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
