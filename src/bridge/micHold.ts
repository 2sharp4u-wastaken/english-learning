/**
 * G1 cure (2026-06-11): keep the OS audio-capture device alive AROUND each
 * recording question, so its teardown never lands under the answer confetti.
 *
 * Every webkitSpeechRecognition / MediaRecorder capture CLOSES the audio device
 * when it ends, and macOS reconfigures the device on close — freezing system
 * frame delivery for 175–524ms (measured; built-in mic, no Bluetooth). That
 * freeze landed exactly on the answer confetti, while the page's own rAF loop
 * stayed at a clean ~8ms/frame — which is why no rendering-path or burst-size
 * fix could ever work (4 tried, all reverted).
 *
 * Shape: one extra keep-alive getUserMedia stream, acquired at recording start
 * and released on a LINGER timer after the capture ends — long enough for the
 * celebration (burst ~3.3s + voicing) to play against a still-warm device, so
 * the reconfiguration happens later, on a quiet/static screen where a stall is
 * imperceptible. A new recording inside the window cancels the timer, so
 * all-mic games (Pronunciation/Practice) effectively stay warm end-to-end,
 * while mixed games (ABC/Phonics/Word Journey) drop the mic seconds after a
 * say-question. Verified live: held stream ⇒ smooth burst.
 */

import { isAndroid } from '@/lib/platform'

const LINGER_MS = 8000

let holdStream: MediaStream | null = null
let acquiring = false
let releaseTimer: number | null = null

function cancelReleaseTimer(): void {
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer)
    releaseTimer = null
  }
}

/**
 * Acquire (once) the keep-alive stream. Called by the recording bridges at
 * capture start — lazily, so ABC/Phonics sessions without a say-question never
 * touch the mic beyond their own recognition.
 */
export function ensureMicHold(): void {
  // M1: never hold on Android — the freeze this cures is macOS-only, and a
  // page-held stream starves Android's speech recognition into silence.
  if (isAndroid()) return
  cancelReleaseTimer()
  if (holdStream || acquiring) return
  if (typeof navigator === 'undefined' || !('mediaDevices' in navigator)) return
  acquiring = true
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      acquiring = false
      holdStream = stream
    })
    .catch(() => {
      // Denied/unavailable — games degrade to the old (janky-burst) behavior.
      acquiring = false
    })
}

/**
 * Schedule the release for LINGER_MS from now. Called by the recording bridges
 * when a capture ends; a subsequent ensureMicHold() (next recording question)
 * cancels it.
 */
export function scheduleMicRelease(): void {
  cancelReleaseTimer()
  if (!holdStream && !acquiring) return
  releaseTimer = window.setTimeout(releaseMicHold, LINGER_MS)
}

export function releaseMicHold(): void {
  cancelReleaseTimer()
  holdStream?.getTracks().forEach((t) => t.stop())
  holdStream = null
}

/** Test seam. */
export function isMicHeld(): boolean {
  return holdStream !== null
}

// Hard release when navigating off a game route (hash router), and on page
// hide as a belt-and-braces (the browser kills tracks on unload anyway).
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (!window.location.hash.startsWith('#/game/')) releaseMicHold()
  })
  window.addEventListener('pagehide', releaseMicHold)
}
