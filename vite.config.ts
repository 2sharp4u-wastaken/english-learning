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
        // The legacy vanilla-JS graph (gameLogic.js, app.js, data/_loader.js →
        // managers + legacy game modules) is loaded eagerly via index.html
        // <script type="module"> tags, which Vite FUSES into the same entry as
        // src/main.tsx — so it can't be split via manualChunks (entry modules
        // can't be reassigned). That ~500 KB of eager legacy is what keeps the
        // index chunk above 500 KB; it shrinks when Phase 4.4 deletes the legacy
        // game files. React game pages are NOT named here — React.lazy() in
        // GameHostPage already gives each its own on-demand chunk.
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
