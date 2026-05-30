/**
 * wordImport bridge — Claude-powered custom-word import, ported from the legacy
 * utils/wordImporter.js (Slice 4.3). Calls the Anthropic API **directly from the
 * browser** (anthropic-dangerous-direct-browser-access) with a parent-supplied
 * key, then persists via the customContent bridge. No Python server involved.
 */
import { getCustomWords, saveCustomWords, type CustomWord } from './customContent'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

const VALID_CATEGORIES = [
  'animals', 'colors', 'numbers', 'food', 'body', 'family',
  'clothes', 'home', 'actions', 'nature', 'school', 'minecraft',
  'gaming', 'roblox', 'feelings', 'adjectives', 'places',
  'time', 'weather', 'sports', 'custom',
]

export type ImportLogType =
  | 'info' | 'skip' | 'warn' | 'api' | 'prompt' | 'response' | 'success' | 'error'

export interface ImportLog {
  type: ImportLogType
  text: string
  time: string
}

export interface ImportResult {
  ok: boolean
  added: number
  skipped: number
  message: string
}

/** Parse a comma-separated list into validated lowercase English words. */
export function parseWords(text: string): string[] {
  return text
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && /^[a-zA-Z\s'-]+$/.test(w))
    .map((w) => w.toLowerCase())
}

function buildPrompt(words: string[]): string {
  return `You are a vocabulary assistant for an English learning app for Hebrew-speaking children ages 5–8.

For each English word provided, return a JSON array. Each item must have:
- "word": the English word (lowercase, trimmed)
- "translation": the Hebrew translation appropriate for children ages 5–8
- "category": choose the BEST match from this list: ${VALID_CATEGORIES.join(', ')}
- "image": a single emoji that best represents the word

Return ONLY a valid JSON array — no explanation, no markdown, no code block. Just raw JSON.

Example: [{"word":"cat","translation":"חתול","category":"animals","image":"🐱"}]

Words to process: ${words.join(', ')}`
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    let detail = ''
    try {
      detail = JSON.parse(errText).error?.message || ''
    } catch {
      /* ignore */
    }
    if (response.status === 401) throw new Error(`מפתח API שגוי (401)${detail ? ': ' + detail : ''}`)
    if (response.status === 400 && detail.includes('credit'))
      throw new Error('אין מספיק קרדיטים — הוסף תשלום ב-platform.claude.com/settings/billing')
    if (response.status === 429) throw new Error(`חריגה ממגבלת השימוש (429)${detail ? ': ' + detail : ''}`)
    throw new Error(`שגיאת שרת (${response.status})${detail ? ': ' + detail : ''}`)
  }

  const data = await response.json()
  return String(data.content[0].text).trim()
}

function parseResponse(text: string): CustomWord[] {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(stripped)
  if (!Array.isArray(parsed)) throw new Error('התגובה אינה מערך JSON')

  return parsed
    .filter((item: any) => item && typeof item.word === 'string' && item.word.trim())
    .map((item: any) => ({
      word: item.word.toLowerCase().trim(),
      translation: String(item.translation || '').trim(),
      category: VALID_CATEGORIES.includes(item.category) ? item.category : 'custom',
      image: String(item.image || '📝').trim(),
    }))
}

function nowTime(): string {
  return new Date().toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function builtinWordSet(): Set<string> {
  const bank = ((window as any).vocabularyBank as { word: string }[]) ?? []
  return new Set(bank.map((w) => w.word.toLowerCase()))
}

/**
 * Import custom words from a comma-separated string. Emits progress via `onLog`
 * and returns a summary. Persists through the customContent bridge (which also
 * pushes the new words into the live vocabulary bank).
 */
export async function importCustomWords(
  wordsText: string,
  apiKey: string,
  onLog: (log: ImportLog) => void = () => {},
): Promise<ImportResult> {
  const log = (type: ImportLogType, text: string) => onLog({ type, text, time: nowTime() })

  if (!apiKey || !apiKey.trim()) {
    return { ok: false, added: 0, skipped: 0, message: 'חסר מפתח API — הכנס מפתח Claude API' }
  }

  const words = parseWords(wordsText)
  if (words.length === 0) {
    return { ok: false, added: 0, skipped: 0, message: 'לא נמצאו מילים תקינות — הכנס מילים באנגלית מופרדות בפסיק' }
  }
  log('info', `🔤 מילים שזוהו (${words.length}): ${words.join(', ')}`)

  const existing = await getCustomWords()
  const existingSet = new Set(existing.map((w) => w.word.toLowerCase()))
  const builtinSet = builtinWordSet()

  const skippedCustom = words.filter((w) => existingSet.has(w))
  const skippedBuiltin = words.filter((w) => !existingSet.has(w) && builtinSet.has(w))
  const newWords = words.filter((w) => !existingSet.has(w) && !builtinSet.has(w))

  skippedCustom.forEach((w) => log('skip', `⏭️ "${w}" — כבר קיים במילים המותאמות`))
  skippedBuiltin.forEach((w) => log('skip', `⏭️ "${w}" — כבר קיים במאגר הראשי`))
  const skipped = skippedCustom.length + skippedBuiltin.length

  if (newWords.length === 0) {
    return { ok: false, added: 0, skipped, message: `כל ${words.length} המילים כבר קיימות במאגר — אין מה לייבא` }
  }

  log('api', `🤖 מודל: ${MODEL} · 📡 ${API_URL}`)
  log('info', '⏳ ממתין לתגובה מ-Claude...')

  try {
    const responseText = await callClaude(buildPrompt(newWords), apiKey.trim())
    const imported = parseResponse(responseText)
    imported.forEach((w) =>
      log('success', `✅ ${w.word} → ${w.translation} | ${w.category} | ${w.image}`),
    )

    const merged = [...existing]
    const mergedSet = new Set(existing.map((w) => w.word.toLowerCase()))
    let added = 0
    for (const item of imported) {
      if (!mergedSet.has(item.word)) {
        merged.push(item)
        mergedSet.add(item.word)
        added++
      }
    }
    await saveCustomWords(merged)
    log('success', `💾 נשמר — סה"כ ${merged.length} מילים מותאמות`)

    return {
      ok: true,
      added,
      skipped,
      message: `יובאו ${added} מילים בהצלחה${skipped > 0 ? ` (${skipped} כבר קיימות)` : ''}`,
    }
  } catch (err) {
    const msg =
      err instanceof SyntaxError
        ? 'לא ניתן לפענח את התגובה מה-API — נסה שוב'
        : err instanceof Error
          ? err.message
          : 'שגיאה לא ידועה'
    log('error', `❌ שגיאה: ${msg}`)
    return { ok: false, added: 0, skipped, message: msg }
  }
}
