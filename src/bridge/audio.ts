interface LegacySpeechManager {
  speakWord(word: string, phonetic?: string, gameContext?: string | null, allowOverlap?: boolean): Promise<void>
  speak(text: string, options?: Record<string, unknown>): Promise<void>
  setGameContext(gameType: string): void
  cancelSpeech(): void
}

function getSpeech(): LegacySpeechManager | null {
  return (window as any).speechManager ?? null
}

export function setGameContext(gameType: string): void {
  getSpeech()?.setGameContext(gameType)
}

export function cancelSpeech(): void {
  getSpeech()?.cancelSpeech()
}

/**
 * Hard-reset the browser's speech synthesis queue. The legacy
 * `speechManager.cancelSpeech()` is a no-op (Chrome bug workaround), but in
 * practice the queue's `pending` flag can get stuck true, after which every
 * `speak()` short-circuits. Calling the native `cancel()` clears that state.
 * Use sparingly — at the start of a fresh game session, not between
 * utterances.
 */
export function hardResetSpeech(): void {
  try {
    window.speechSynthesis?.cancel()
  } catch {
    /* ignore */
  }
}

export async function speakWord(
  word: string,
  gameContext = 'vocabulary',
  options: { allowOverlap?: boolean } = {},
): Promise<void> {
  const sm = getSpeech()
  if (!sm) return
  try {
    await sm.speakWord(word, '', gameContext, options.allowOverlap ?? false)
  } catch {
    /* legacy already swallows errors; keep parity */
  }
}

export async function speak(text: string): Promise<void> {
  const sm = getSpeech()
  if (!sm || !text) return
  try {
    await sm.speak(text)
  } catch {
    /* swallow */
  }
}

export async function speakHebrew(text: string): Promise<void> {
  const sm = getSpeech()
  if (!sm || !text) return
  try {
    await sm.speak(text, { language: 'hebrew' })
  } catch {
    /* swallow */
  }
}
