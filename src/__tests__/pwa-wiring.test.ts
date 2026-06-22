import { describe, expect, it } from 'vitest'
// Vite ?raw/?url imports (typed via vite/client) instead of node:fs, so the build
// `tsc` (which type-checks src, including tests) needs no @types/node. A ?url import
// also fails the test if the icon file is missing — a free existence check.
import manifestRaw from '../../manifest.webmanifest?raw'
import swSource from '../../sw.js?raw'
import indexHtml from '../../index.html?raw'
import mainTsx from '../main.tsx?raw'
import viteConfig from '../../vite.config.ts?raw'
import icon192 from '../../img/pwa/pwa-192.png?url'
import icon512 from '../../img/pwa/pwa-512.png?url'

/**
 * PWA wiring guard (Slice INFRA1). The service worker only runs in a production
 * build over a secure context (verified manually via `vite preview`), so this
 * can't exercise SW behavior headlessly. It pins the *static wiring* instead —
 * the pieces that, if broken, silently make the app non-installable or break
 * offline: manifest, icons, index.html links, self-hosted confetti (no CDN →
 * offline), the SW registration, and the build copy step.
 */
describe('PWA wiring (INFRA1)', () => {
  it('manifest is valid and installable', () => {
    const m = JSON.parse(manifestRaw)
    expect(m.name).toBeTruthy()
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/#/home')
    expect(m.lang).toBe('he')
    expect(m.dir).toBe('rtl')
    expect(Array.isArray(m.icons) && m.icons.length).toBeTruthy()
    expect(m.icons.some((i: { purpose?: string }) => (i.purpose || '').includes('maskable'))).toBe(true)
    expect(m.icons.every((i: { src: string }) => i.src.startsWith('/img/pwa/'))).toBe(true)
    // The referenced icon files resolve (the ?url imports above would throw otherwise).
    expect(icon192).toBeTruthy()
    expect(icon512).toBeTruthy()
  })

  it('index.html links the manifest/icon and self-hosts confetti (no CDN)', () => {
    expect(indexHtml).toContain('rel="manifest"')
    expect(indexHtml).toContain('apple-touch-icon')
    expect(indexHtml).toContain('name="theme-color"')
    expect(indexHtml).toContain('/vendor/confetti.browser.min.js')
    expect(indexHtml).not.toContain('cdn.jsdelivr.net') // offline-capable
  })

  it('the service worker exists and is registered from the entry', () => {
    expect(swSource).toContain("addEventListener('install'")
    expect(swSource).toContain("addEventListener('fetch'")
    expect(mainTsx).toContain("serviceWorker.register('/sw.js')")
  })

  it('the build copies sw.js + vendor into dist (not Vite-processed)', () => {
    expect(viteConfig).toContain("'sw.js'")
    expect(viteConfig).toContain("'vendor'")
  })

  it('vite.config stamps the git SHA into sw.js CACHE_VERSION on every build (M22)', () => {
    // Browsers only re-install a SW when /sw.js changes byte-for-byte. vite.config
    // regex-replaces CACHE_VERSION with 'v2-<gitSHA>' at build time so every deploy
    // ships a byte-different SW → install → activate (cache purge) → controllerchange
    // → the M22 update banner. Without this the SW is identical every deploy and
    // updates never reach installed/mobile users.
    expect(swSource).toContain("const CACHE_VERSION = 'v2'")
    expect(viteConfig).toContain("CACHE_VERSION = '[^']*'")
    expect(viteConfig).toContain('GIT_SHA')
  })
})
