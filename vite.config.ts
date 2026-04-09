import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: false, // legacy assets served from project root directly
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        secure: false, // self-signed cert
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
})
