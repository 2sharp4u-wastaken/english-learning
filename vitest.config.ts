import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest — in-process unit tests for the pure `src/engine/*` logic (Slice 4.6).
 *
 * Scope is deliberately narrow: `src/**` only. The Playwright e2e specs live in
 * `tests/*.spec.js` (Playwright's `testDir: './tests'`), so the two runners never
 * see each other's files — Vitest's `include` stays inside `src/`, and Playwright
 * only scans `tests/`. Engine logic that needs no browser (selection bucketing,
 * shuffle, default-progress schema) is unit-tested here, off the Vite dev server,
 * so it's deterministic and immune to the long-run dev-server flake that bites the
 * Playwright suite. Content/integration validation stays in Playwright.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    // jsdom's default `about:blank` is an opaque origin, where `localStorage` is
    // unavailable. The engine reads localStorage in a few constructors (settings,
    // progress), so give jsdom a real origin to back a working Storage.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
