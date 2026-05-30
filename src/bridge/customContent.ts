/**
 * customContent bridge — the single seam for parent-authored content
 * (custom words, per-word image overrides, per-word translation overrides).
 *
 * WHY this exists / why the API is async:
 * Slice 4.3 retires the Python `server.py` "save-to-source" endpoints. The
 * runtime already keeps this content in the browser; this bridge makes that the
 * source of truth and adds Export/Import for backup + cross-device. The API is
 * **Promise-based on purpose** so a future mobile (Capacitor) port can swap the
 * backing store (localStorage → IndexedDB → Capacitor Preferences/Filesystem)
 * in this ONE file without touching any feature code.
 *
 * Backing store (today): localStorage, reusing the existing keys so the legacy
 * boot path (data/_loader.js, utils/imageRenderer.js) keeps working unchanged:
 *   - customWords_global          → CustomWord[]            (also read at boot)
 *   - wordImageOverrides          → { "category:word": url }
 *   - wordTranslationOverrides    → { "category:word": he }
 *
 * Image overrides stay in localStorage (NOT IndexedDB yet) because 8 game pages
 * + utils/imageRenderer.js read `window.wordImageOverrides` *synchronously*.
 * Moving blobs to IndexedDB needs a boot-time async hydration of that window
 * object; deferred as a documented future swap (the async API above makes it a
 * one-file change). localStorage quota (~5 MB of base64) is the trigger to do it.
 */
import { getKey, setKey } from './storage'

const CUSTOM_WORDS_KEY = 'customWords_global'
const IMAGE_OVERRIDES_KEY = 'wordImageOverrides'
const TRANS_OVERRIDES_KEY = 'wordTranslationOverrides'

export interface CustomWord {
  word: string
  translation: string
  category: string
  image?: string
  imageUrl?: string
}

export type OverrideMap = Record<string, string>

/** Override map key — mirrors utils/wordImageManager.js (`category:Word`). */
export function overrideKey(category: string, word: string): string {
  return `${category}:${word}`
}

// ─── Custom words ────────────────────────────────────────────────────────────

export async function getCustomWords(): Promise<CustomWord[]> {
  return getKey<CustomWord[]>(CUSTOM_WORDS_KEY) ?? []
}

/**
 * Persist the full custom-words list and push them into the live vocabulary
 * bank. In the legacy multi-page app a cross-tab `storage` event drove
 * `window.refreshCustomWords()`; inside the single-page React app we must call
 * it directly (same tab fires no storage event for its own write).
 */
export async function saveCustomWords(words: CustomWord[]): Promise<void> {
  setKey(CUSTOM_WORDS_KEY, words)
  await refreshLiveBank()
}

export async function deleteCustomWord(word: string): Promise<CustomWord[]> {
  const next = (await getCustomWords()).filter(
    (w) => w.word.toLowerCase() !== word.toLowerCase(),
  )
  await saveCustomWords(next)
  return next
}

async function refreshLiveBank(): Promise<void> {
  const refresh = (window as any).refreshCustomWords
  if (typeof refresh === 'function') {
    try {
      await refresh()
    } catch {
      /* best-effort live update; persisted either way */
    }
  }
}

// ─── Image overrides ─────────────────────────────────────────────────────────

export async function getImageOverrides(): Promise<OverrideMap> {
  return getKey<OverrideMap>(IMAGE_OVERRIDES_KEY) ?? {}
}

export async function setImageOverride(
  category: string,
  word: string,
  imageUrl: string,
): Promise<void> {
  const map = await getImageOverrides()
  map[overrideKey(category, word)] = imageUrl
  setKey(IMAGE_OVERRIDES_KEY, map)
  hydrateImageWindow(map)
}

export async function removeImageOverride(category: string, word: string): Promise<void> {
  const map = await getImageOverrides()
  delete map[overrideKey(category, word)]
  setKey(IMAGE_OVERRIDES_KEY, map)
  hydrateImageWindow(map)
}

/**
 * Keep `window.wordImageOverrides` in sync — the runtime render path
 * (utils/imageRenderer.js + game pages) reads this object synchronously.
 */
function hydrateImageWindow(map: OverrideMap): void {
  ;(window as any).wordImageOverrides = { ...map }
}

// ─── Translation overrides ───────────────────────────────────────────────────

export async function getTranslationOverrides(): Promise<OverrideMap> {
  return getKey<OverrideMap>(TRANS_OVERRIDES_KEY) ?? {}
}

export async function setTranslationOverride(
  category: string,
  word: string,
  translation: string,
): Promise<void> {
  const map = await getTranslationOverrides()
  map[overrideKey(category, word)] = translation
  setKey(TRANS_OVERRIDES_KEY, map)
}

export async function removeTranslationOverride(category: string, word: string): Promise<void> {
  const map = await getTranslationOverrides()
  delete map[overrideKey(category, word)]
  setKey(TRANS_OVERRIDES_KEY, map)
}

// ─── Export / Import (backup + cross-device, replaces save-to-source) ─────────

export interface CustomContentBundle {
  version: 1
  exportedAt: string
  customWords: CustomWord[]
  imageOverrides: OverrideMap
  translationOverrides: OverrideMap
}

export async function exportAll(): Promise<CustomContentBundle> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    customWords: await getCustomWords(),
    imageOverrides: await getImageOverrides(),
    translationOverrides: await getTranslationOverrides(),
  }
}

/**
 * Import a previously exported bundle. `mode` 'merge' (default) layers the
 * bundle on top of existing content; 'replace' overwrites each section present
 * in the bundle. Returns counts for the UI.
 */
export async function importAll(
  bundle: CustomContentBundle,
  mode: 'merge' | 'replace' = 'merge',
): Promise<{ words: number; images: number; translations: number }> {
  if (!bundle || bundle.version !== 1) {
    throw new Error('Unrecognized custom-content bundle')
  }

  // Words — dedupe by lowercase word.
  const incomingWords = bundle.customWords ?? []
  let words: CustomWord[]
  if (mode === 'replace') {
    words = incomingWords
  } else {
    const existing = await getCustomWords()
    const seen = new Set(existing.map((w) => w.word.toLowerCase()))
    words = [...existing]
    for (const w of incomingWords) {
      if (!seen.has(w.word.toLowerCase())) {
        words.push(w)
        seen.add(w.word.toLowerCase())
      }
    }
  }
  await saveCustomWords(words)

  // Override maps — shallow merge or replace.
  const images = bundle.imageOverrides ?? {}
  const mergedImages = mode === 'replace' ? images : { ...(await getImageOverrides()), ...images }
  setKey(IMAGE_OVERRIDES_KEY, mergedImages)
  hydrateImageWindow(mergedImages)

  const translations = bundle.translationOverrides ?? {}
  const mergedTrans =
    mode === 'replace' ? translations : { ...(await getTranslationOverrides()), ...translations }
  setKey(TRANS_OVERRIDES_KEY, mergedTrans)

  return {
    words: incomingWords.length,
    images: Object.keys(images).length,
    translations: Object.keys(translations).length,
  }
}
