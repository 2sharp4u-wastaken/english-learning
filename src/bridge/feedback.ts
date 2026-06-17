import { getSettings } from './settings'
import { getPlayerPrefs } from './playerPrefs'

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
    // Honor BOTH the parent-global setting AND the per-kid customization
    // (playerPrefs.confetti). Every call site gates on this before
    // triggerConfetti(), so it's the one place the per-kid toggle takes effect.
    return getSettings().showConfetti !== false && getPlayerPrefs().confetti !== false
  } catch {
    return true
  }
}

interface AudioEffects {
  playCorrect(): Promise<void>
  playWrong(): Promise<void>
  playLevelUp(): Promise<void>
  playVictory(): Promise<void>
  playClick(): Promise<void>
  playCoin(): Promise<void>
  playStreak(): Promise<void>
  playSparkle(): Promise<void>
  playWelcomeChime(type?: string): Promise<void>
}

// Per-kid sound gating (playerPrefs): master switch + per-category. correct/wrong
// → answerSounds; coin → coinSounds; click/streak/sparkle (home pills) →
// heroSounds; celebration sounds (levelUp/victory) ride the master switch only.
function soundAllowed(effect: SoundEffect): boolean {
  const p = getPlayerPrefs()
  if (!p.soundOn) return false
  if (effect === 'correct' || effect === 'wrong') return p.answerSounds !== false
  if (effect === 'coin') return p.coinSounds !== false
  if (effect === 'click' || effect === 'streak' || effect === 'sparkle') return p.heroSounds !== false
  return true
}

/** Named UI sound effects (legacy `window.audioEffects`), e.g. for tappable
 *  home-screen chips. No-op if the legacy effects manager isn't loaded.
 *  `coin`/`streak`/`sparkle` are the per-pill home signatures (audio-effects.js). */
export type SoundEffect =
  | 'correct'
  | 'wrong'
  | 'levelUp'
  | 'victory'
  | 'click'
  | 'coin'
  | 'streak'
  | 'sparkle'

export function playEffect(effect: SoundEffect): void {
  const fx = (window as any).audioEffects as AudioEffects | undefined
  if (!fx) return
  if (!soundAllowed(effect)) return
  const map: Record<SoundEffect, (() => Promise<void>) | undefined> = {
    correct: fx.playCorrect,
    wrong: fx.playWrong,
    levelUp: fx.playLevelUp,
    victory: fx.playVictory,
    click: fx.playClick,
    coin: fx.playCoin,
    streak: fx.playStreak,
    sparkle: fx.playSparkle,
  }
  try {
    map[effect]?.call(fx)?.catch?.(() => {})
  } catch {
    /* swallow — audio is a nice-to-have */
  }
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
  if (!soundAllowed(kind === 'correct' ? 'correct' : 'wrong')) return
  const fn = kind === 'correct' ? fx.playCorrect : fx.playWrong
  try {
    fn.call(fx)?.catch?.(() => {})
  } catch {
    /* swallow */
  }
}

// G1 note (2026-06-11): the burst is intentionally IDENTICAL on mic and
// non-mic games. The mic-game jank was never a rendering cost — macOS
// reconfigures the audio device when each capture closes, freezing system
// frame delivery for up to ~500ms while the page's rAF stays clean. The cure
// is bridge/micHold.ts (keep-alive capture stream per mic-game session), not a
// different burst.
export function triggerConfetti(label?: string): void {
  const confetti = (window as any).confetti as ConfettiFn | undefined
  if (typeof confetti !== 'function') return
  // Per-kid motion prefs: skip entirely in reduced-motion, scale the burst by
  // the celebration level (calm / normal / party).
  const prefs = getPlayerPrefs()
  if (prefs.reducedMotion) return
  const particleCount = prefs.celebration === 'party' ? 180 : prefs.celebration === 'calm' ? 40 : 100
  // G1 profiling: when window.__PROFILE_CONFETTI__ is set, record frame timing +
  // long tasks for the burst. DEV-only so it tree-shakes out of prod builds.
  if (import.meta.env.DEV) {
    void import('./confettiProfiler').then((m) => m.profileBurst(label ?? 'confetti'))
  }
  try {
    confetti({
      particleCount,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700'],
    })
  } catch {
    /* swallow — visual nice-to-have */
  }
}

/**
 * Play the per-kid login/welcome chime (playerPrefs.loginSound) once at sign-in.
 * Skips when sound is off or the child chose 'none'. The audio engine already
 * supports the variants (arpeggio/bell/chord).
 */
export function playLoginChime(): void {
  const prefs = getPlayerPrefs()
  if (!prefs.soundOn || prefs.loginSound === 'none') return
  const fx = (window as any).audioEffects as AudioEffects | undefined
  try {
    fx?.playWelcomeChime?.(prefs.loginSound)?.catch?.(() => {})
  } catch {
    /* swallow */
  }
}

/**
 * Pre-initialise canvas-confetti once. Its first invocation lazily creates a
 * full-screen canvas (and a worker), which is the visible "hiccup" on the first
 * celebration of a page load. Firing one invisible, instantly-gone particle on
 * app startup pays that cost up front so every real burst animates smoothly.
 */
let warmedUp = false
export function warmUpConfetti(): void {
  if (warmedUp) return
  const confetti = (window as any).confetti as ConfettiFn | undefined
  if (typeof confetti !== 'function') return
  warmedUp = true
  try {
    confetti({ particleCount: 1, startVelocity: 0, ticks: 1, origin: { x: -1, y: -1 } })
  } catch {
    /* swallow */
  }
}
