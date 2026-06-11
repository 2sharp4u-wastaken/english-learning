import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ensureMicHold, scheduleMicRelease, releaseMicHold, isMicHeld } from '../micHold'

/**
 * G1 cure (2026-06-11): mic games hold one keep-alive getUserMedia stream
 * AROUND each recording question so macOS never reconfigures the audio device
 * under the answer confetti (the reconfiguration froze system frame delivery
 * for 175–524ms). Release is a linger timer after capture end — refreshed by
 * the next recording — so all-mic games stay warm end-to-end while mixed games
 * (ABC/Phonics/WJ) drop the mic seconds after a say-question. Pins: single
 * acquisition, linger release, re-recording cancels the linger, leaving
 * /game/* hard-releases.
 */

function makeFakeStream() {
  const track = { stop: vi.fn() }
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track }
}

function installGUM(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  return getUserMedia
}

describe('micHold', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    releaseMicHold()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('acquires one stream and reports held', async () => {
    const { stream } = makeFakeStream()
    const getUserMedia = installGUM(() => Promise.resolve(stream))

    ensureMicHold()
    ensureMicHold() // second call while acquiring must not double-request
    await Promise.resolve()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(isMicHeld()).toBe(true)
    ensureMicHold() // already held — still no new request
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('scheduleMicRelease releases after the linger window, not before', async () => {
    const { stream, track } = makeFakeStream()
    installGUM(() => Promise.resolve(stream))
    ensureMicHold()
    await Promise.resolve()

    scheduleMicRelease()
    vi.advanceTimersByTime(7999)
    expect(isMicHeld()).toBe(true) // celebration window: still warm

    vi.advanceTimersByTime(2)
    expect(track.stop).toHaveBeenCalled()
    expect(isMicHeld()).toBe(false)
  })

  it('a new recording inside the linger window cancels the pending release', async () => {
    const { stream, track } = makeFakeStream()
    installGUM(() => Promise.resolve(stream))
    ensureMicHold()
    await Promise.resolve()

    scheduleMicRelease()
    vi.advanceTimersByTime(5000)
    ensureMicHold() // next say-question starts recording
    vi.advanceTimersByTime(60000)
    expect(track.stop).not.toHaveBeenCalled()
    expect(isMicHeld()).toBe(true)
  })

  it('hard-releases when the hash leaves /game/*', async () => {
    const { stream, track } = makeFakeStream()
    installGUM(() => Promise.resolve(stream))
    window.location.hash = '#/game/pronunciation'
    ensureMicHold()
    await Promise.resolve()
    expect(isMicHeld()).toBe(true)

    window.location.hash = '#/home'
    window.dispatchEvent(new Event('hashchange'))
    expect(track.stop).toHaveBeenCalled()
    expect(isMicHeld()).toBe(false)
  })

  it('is a safe no-op when getUserMedia rejects, and can retry later', async () => {
    installGUM(() => Promise.reject(new Error('denied')))
    ensureMicHold()
    await Promise.resolve()
    await Promise.resolve()
    expect(isMicHeld()).toBe(false)

    const { stream } = makeFakeStream()
    installGUM(() => Promise.resolve(stream))
    ensureMicHold()
    await Promise.resolve()
    expect(isMicHeld()).toBe(true)
  })
})
