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
    proxy: {
      // server.py runs HTTP unless server.crt/server.key exist at the project
      // root (they don't by default). Keep this aligned with server.py reality.
      // Use 127.0.0.1 explicitly: Node prefers IPv6 (::1) for "localhost", but
      // Python's http.server binds IPv4-only by default → ECONNRESET on proxy.
      '/api': {
        target: 'http://127.0.0.1:3000',
      },
    },
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
