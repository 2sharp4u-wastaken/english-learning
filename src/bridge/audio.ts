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

export async function speakWord(word: string, gameContext = 'vocabulary'): Promise<void> {
  const sm = getSpeech()
  if (!sm) return
  try {
    await sm.speakWord(word, '', gameContext)
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
