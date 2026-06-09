import { afterEach, describe, expect, it, vi } from 'vitest'
import { profileBurst } from './confettiProfiler'

/**
 * The profiler is a diagnostic for G1 (confetti jank on mic games). It can't
 * reproduce the jank headlessly (no real audio device), so this just pins the
 * instrumentation contract: it no-ops unless the flag is set, and when enabled it
 * logs one well-formed "[confetti-profile]" summary after the frame window.
 */
describe('profileBurst (G1 confetti profiler)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as any).__PROFILE_CONFETTI__
  })

  it('no-ops when the flag is unset', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    profileBurst('test')
    expect(raf).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('logs a well-formed summary after the window when enabled', () => {
    ;(window as any).__PROFILE_CONFETTI__ = true
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Drive rAF synchronously: advance the clock past the 2.5s window across a
    // few frames so the loop terminates deterministically (no real timers).
    let t = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      t += 1000 // ~1s "frames" — 3 ticks clears the 2500ms window
      cb(t)
      return 0
    })

    profileBurst('mic-game')

    expect(log).toHaveBeenCalledTimes(1)
    const [msg, profile] = log.mock.calls[0]
    expect(msg).toContain('[confetti-profile]')
    expect(msg).toContain('mic-game')
    expect(profile).toMatchObject({
      label: 'mic-game',
      frames: expect.any(Number),
      meanFrameMs: expect.any(Number),
      worstFrameMs: expect.any(Number),
      jankyFrames: expect.any(Number),
      longTasks: expect.any(Array),
    })
  })
})
