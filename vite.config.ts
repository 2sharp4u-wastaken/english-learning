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
  },
})
