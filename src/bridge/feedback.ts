import { getSettings } from './settings'

export interface GameFeedback {
  text: string
  audio?: string | null
}

interface ConfettiFn {
  (opts: Record<string, unknown>): void
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

// Read confetti pref through the settings bridge so we honor both legacy
// (`englishLearningSettings`) and v2 (`v2_englishLearningSettings`) keys plus
// the `showConfetti: true` default. Legacy `SettingsManager.getSettings()`
// reads the unprefixed key only — broken when only the v2 key is populated.
export function getShowConfetti(): boolean {
  try {
    return getSettings().showConfetti !== false
  } catch {
    return true
  }
}

interface AudioEffects {
  playCorrect(): Promise<void>
  playWrong(): Promise<void>
}

/**
 * Trigger the shared correct/wrong WAV. Other games hit this implicitly via
 * `getGameFeedback()` (legacy feedback.js:165); pronunciation reads
 * `comparison.feedback` directly so it has to fire the SFX explicitly to stay
 * in parity with vocab/listening/etc.
 */
export function playAnswerSfx(kind: 'correct' | 'incorrect'): void {
  const fx = (window as any).audioEffects as AudioEffects | undefined
  if (!fx) return
  const fn = kind === 'correct' ? fx.playCorrect : fx.playWrong
  try {
    fn.call(fx)?.catch?.(() => {})
  } catch {
    /* swallow */
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
