export interface GameFeedback {
  text: string
  audio?: string | null
}

interface ConfettiFn {
  (opts: Record<string, unknown>): void
}

interface SettingsManagerLike {
  getSettings(): { showConfetti?: boolean }
}

export function getGameFeedback(
  gameType: string,
  kind: 'correct' | 'incorrect',
): GameFeedback {
  const fn = (window as any).getFeedback as
    | ((game: string, type: string) => GameFeedback)
    | undefined
  if (!fn) return { text: '', audio: null }
  return fn(gameType, kind) ?? { text: '', audio: null }
}

export function getShowConfetti(): boolean {
  const sm = (window as any).SettingsManager as SettingsManagerLike | undefined
  if (!sm?.getSettings) return false
  try {
    return sm.getSettings().showConfetti !== false
  } catch {
    return false
  }
}

export function triggerConfetti(): void {
  const confetti = (window as any).confetti as ConfettiFn | undefined
  if (typeof confetti !== 'function') return
  try {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700'],
    })
  } catch {
    /* swallow — visual nice-to-have */
  }
}
