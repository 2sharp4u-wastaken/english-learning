import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AppState } from '../appState'

/**
 * Progress-save throttling (design-flaws fix, 2026-07-05): every answer used to
 * JSON.stringify the whole blob synchronously. Now: leading write immediate,
 * rapid successors coalesce into one trailing write, flushPendingSave forces it.
 */
describe('AppState save throttle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const read = (id: string) => JSON.parse(localStorage.getItem(`v2_userProgress_${id}`) || 'null')

  it('writes immediately when idle, coalesces a burst into one trailing write', () => {
    const app = new AppState({ getUserId: () => 'thr' })
    app.userProgress = app.getDefaultProgress()
    app.loadedUserId = 'thr'

    app.userProgress.totalGamesPlayed = 1
    app.saveUserProgress() // leading — immediate
    expect(read('thr').totalGamesPlayed).toBe(1)

    app.userProgress.totalGamesPlayed = 2
    app.saveUserProgress() // within window — deferred
    app.userProgress.totalGamesPlayed = 3
    app.saveUserProgress() // still one pending timer
    expect(read('thr').totalGamesPlayed).toBe(1)

    vi.advanceTimersByTime(AppState.SAVE_THROTTLE_MS + 1)
    expect(read('thr').totalGamesPlayed).toBe(3) // latest state, single write
  })

  it('flushPendingSave writes the pending state out immediately', () => {
    const app = new AppState({ getUserId: () => 'thr2' })
    app.userProgress = app.getDefaultProgress()
    app.loadedUserId = 'thr2'

    app.saveUserProgress()
    app.userProgress.totalGamesPlayed = 42
    app.saveUserProgress() // deferred
    expect(read('thr2').totalGamesPlayed).toBe(0)

    app.flushPendingSave()
    expect(read('thr2').totalGamesPlayed).toBe(42)
    app.flushPendingSave() // no pending — must be a no-op, not a double write
  })

  it('deferred writes land on the LOADED user even after the active user changes', () => {
    let activeUser = 'kid-a'
    const app = new AppState({ getUserId: () => activeUser })
    localStorage.setItem('v2_userProgress_kid-a', JSON.stringify(app.getDefaultProgress()))
    app.userProgress = app.loadUserProgress() // pins loadedUserId = kid-a

    app.saveUserProgress()
    app.userProgress.totalGamesPlayed = 9
    app.saveUserProgress() // deferred

    activeUser = 'kid-b' // user switch happens before the timer fires
    vi.advanceTimersByTime(AppState.SAVE_THROTTLE_MS + 1)
    expect(read('kid-a').totalGamesPlayed).toBe(9)
    expect(read('kid-b')).toBeNull() // kid-a's blob must never land on kid-b's key
  })
})
