/**
 * G1 confetti-perf profiler (DEV-only).
 *
 * The celebration confetti animates smoothly on most games but janks on the
 * voice-recording games (phonics say-sound, word-journey say-word, pronunciation,
 * practice, abc say-letter). The app code at burst time is identical to non-mic
 * games (`triggerConfetti` + `playAnswerSfx` + `speak`), so the difference must be
 * the audio-capture session that mic games held moments earlier. That can't be
 * reproduced in headless tests (the mic is faked), so this captures real
 * frame-timing + long-task data in the actual browser during a real burst.
 *
 * HOW TO USE (in the running app, DevTools console):
 *   1. window.__PROFILE_CONFETTI__ = true
 *   2. Play a NON-mic game (e.g. vocabulary), answer correctly → read the
 *      "[confetti-profile]" summary logged after the burst. This is the baseline.
 *   3. Play a mic game (e.g. pronunciation/phonics say-sound), answer correctly
 *      → read its summary and compare.
 *
 * Compare `worstFrameMs` / `jankyFrames` / `longTasks`. If a mic burst shows many
 * long frames while baseline is clean — and the longTask attribution points at
 * audio/script — that localizes the cost. If both are clean in numbers but the
 * mic one *looks* janky, the cost is below the frame-timing layer (compositor /
 * OS audio device), confirming the out-of-app hypothesis → mitigate with a
 * lighter/shorter burst on mic games rather than a rendering-path change.
 */

const PROFILE_WINDOW_MS = 2500

interface FrameProfile {
  label: string
  frames: number
  durationMs: number
  meanFrameMs: number
  p95FrameMs: number
  worstFrameMs: number
  /** frames slower than 32ms (a dropped frame at 30fps) */
  jankyFrames: number
  /** PerformanceObserver longtask entries (>50ms main-thread blocks) during the window */
  longTasks: { startOffsetMs: number; durationMs: number; attribution: string }[]
}

function isEnabled(): boolean {
  return Boolean((window as any).__PROFILE_CONFETTI__)
}

/**
 * Record rAF frame intervals + longtask entries for PROFILE_WINDOW_MS and log a
 * summary. `label` describes the burst context (game id, correct/incorrect).
 */
export function profileBurst(label: string): void {
  if (!isEnabled()) return

  const t0 = performance.now()
  const deltas: number[] = []
  let last = t0

  const longTasks: FrameProfile['longTasks'] = []
  let observer: PerformanceObserver | null = null
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const attribution =
          (entry as any).attribution?.map?.((a: any) => a.name).join(',') || 'unknown'
        longTasks.push({
          startOffsetMs: Math.round(entry.startTime - t0),
          durationMs: Math.round(entry.duration),
          attribution,
        })
      }
    })
    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    /* longtask not supported (Safari) — frame timing still works */
  }

  const tick = (now: number) => {
    deltas.push(now - last)
    last = now
    if (now - t0 < PROFILE_WINDOW_MS) {
      requestAnimationFrame(tick)
      return
    }
    observer?.disconnect()
    const sorted = [...deltas].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    const profile: FrameProfile = {
      label,
      frames: deltas.length,
      durationMs: Math.round(now - t0),
      meanFrameMs: round1(deltas.reduce((s, d) => s + d, 0) / (deltas.length || 1)),
      p95FrameMs: round1(p95),
      worstFrameMs: round1(Math.max(...deltas, 0)),
      jankyFrames: deltas.filter((d) => d > 32).length,
      longTasks,
    }
    // eslint-disable-next-line no-console
    console.log(`[confetti-profile] ${label}`, profile)
  }
  requestAnimationFrame(tick)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
