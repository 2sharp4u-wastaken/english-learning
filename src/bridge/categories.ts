import type { VocabularyCategory } from './types'

// Canonical base list. Mirrors the hardcoded list in legacy settings.js; the
// static wordCount is used as a fallback when the live vocabularyBank has
// not loaded yet.
const BASE_CATEGORIES: VocabularyCategory[] = [
  { id: 'animals',         name: 'חיות',            wordCount: 30 },
  { id: 'colors',          name: 'צבעים',           wordCount: 15 },
  { id: 'numbers',         name: 'מספרים',          wordCount: 26 },
  { id: 'food',            name: 'אוכל ושתייה',     wordCount: 30 },
  { id: 'body',            name: 'חלקי גוף',        wordCount: 15 },
  { id: 'family',          name: 'משפחה',           wordCount: 10 },
  { id: 'clothes',         name: 'בגדים',           wordCount: 15 },
  { id: 'home',            name: 'בית וחפצים',      wordCount: 30 },
  { id: 'actions',         name: 'פעולות',          wordCount: 20 },
  { id: 'nature',          name: 'טבע',             wordCount: 15 },
  { id: 'school',          name: 'בית ספר',         wordCount: 10 },
  { id: 'minecraft',       name: '🎮 Minecraft',   wordCount: 25 },
  { id: 'gaming',          name: '🎮 משחקים',       wordCount: 25 },
  { id: 'roblox',          name: '🎮 Roblox',      wordCount: 20 },
  { id: 'feelings',        name: 'רגשות',           wordCount: 22 },
  { id: 'adjectives',      name: 'תארים',           wordCount: 34 },
  { id: 'places',          name: 'מקומות',          wordCount: 18 },
  { id: 'time',            name: 'זמן',             wordCount: 20 },
  { id: 'weather',         name: 'מזג אוויר',       wordCount: 15 },
  { id: 'sports',          name: 'ספורט',           wordCount: 29 },
  { id: 'transportation',  name: 'תחבורה',          wordCount: 26 },
  { id: 'tools',           name: 'כלים וציוד',      wordCount: 16 },
  { id: 'signs',           name: 'שלטים וסמלים',    wordCount: 12 },
  { id: 'music',           name: 'מוזיקה',          wordCount: 11 },
]

interface WordLike {
  category?: string
}

function getVocabularyBank(): WordLike[] {
  const bank = (window as any).vocabularyBank
  return Array.isArray(bank) ? bank : []
}

function getCustomWordsFallback(): WordLike[] {
  try {
    const raw = localStorage.getItem('customWords_global')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export interface CatalogWord {
  word: string
  translation: string
  category: string
  image?: string
  imageUrl?: string
}

/**
 * The full word catalog (base bank + injected custom words), as used by the
 * parent Word Images tool. Reads the live `vocabularyBank` (which already
 * includes custom words injected at boot); falls back to the persisted custom
 * words alone if the bank has not loaded.
 */
export function getAllWords(): CatalogWord[] {
  const bank = getVocabularyBank() as CatalogWord[]
  const source = bank.length > 0 ? bank : (getCustomWordsFallback() as CatalogWord[])
  return source
    .filter((w) => w.word && w.category)
    .map((w) => ({
      word: w.word,
      translation: w.translation ?? '',
      category: w.category,
      image: w.image,
      imageUrl: w.imageUrl,
    }))
}

/**
 * Get the full category list with live word counts from the vocabularyBank.
 * Falls back to static counts if the bank has not loaded. Adds any unknown
 * categories discovered in the bank / custom-words fallback.
 */
export function getCategories(): VocabularyCategory[] {
  const bank = getVocabularyBank()
  const source = bank.length > 0 ? bank : getCustomWordsFallback()

  const liveCounts = new Map<string, number>()
  for (const w of bank) {
    if (w.category) liveCounts.set(w.category, (liveCounts.get(w.category) ?? 0) + 1)
  }

  const out: VocabularyCategory[] = BASE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    wordCount: bank.length > 0 ? (liveCounts.get(c.id) ?? 0) : c.wordCount,
  }))

  const known = new Set(out.map((c) => c.id))
  for (const w of source) {
    if (w.category && !known.has(w.category)) {
      known.add(w.category)
      out.push({
        id: w.category,
        name: w.category === 'custom' ? 'מותאם אישית' : w.category,
        wordCount: liveCounts.get(w.category) ?? 0,
      })
    }
  }

  return out
}
