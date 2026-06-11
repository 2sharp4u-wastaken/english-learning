import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ensureMicHold, scheduleMicRelease } from '@/bridge/micHold'
import { isAndroid } from '@/lib/platform'

/**
 * Parallel mic capture for a "hear yourself" playback button.
 *
 * webkitSpeechRecognition (used for pronunciation scoring) doesn't expose the
 * captured audio, so to let kids replay their own voice we open a second
 * getUserMedia stream + MediaRecorder alongside the recognition call. Extracted
 * from PronunciationGamePage so Word Journey's say-word stage can reuse the exact
 * same lifecycle.
 *
 * Usage: `await start()` just before recognition begins; `const url = await
 * stop()` once it resolves, then render an <Audio> from `url`. The hook owns the
 * latest object URL — it revokes the previous one on the next `stop()`, on
 * `release()`, and on unmount (also stopping any live mic tracks). Failure
 * (unsupported / permission denied) is silent: recognition still drives scoring.
 */
export interface MicPlayback {
  start: () => Promise<void>
  stop: () => Promise<string | null>
  release: () => void
}

export function useMicPlayback(): MicPlayback {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef = useRef<string | null>(null)

  const release = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    // M1: a parallel capture stream starves Android's speech recognition into
    // silence, so the hear-yourself feature is desktop-only. `stop()` then
    // resolves null and the "שמע את עצמך" button (gated on the URL) never shows.
    if (isAndroid()) return
    if (!('mediaDevices' in navigator) || typeof MediaRecorder === 'undefined') return
    try {
      // G1: keep the audio device alive through capture + celebration (micHold.ts).
      ensureMicHold()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.addEventListener('dataavailable', (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      })
      recorderRef.current = rec
      rec.start()
    } catch {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      recorderRef.current = null
    }
  }, [])

  const stop = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec || rec.state === 'inactive') {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        resolve(null)
        return
      }
      rec.addEventListener(
        'stop',
        () => {
          const chunks = chunksRef.current
          chunksRef.current = []
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          recorderRef.current = null
          scheduleMicRelease() // parallel capture ended — start the linger window
          if (!chunks.length) {
            resolve(null)
            return
          }
          try {
            const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' })
            const url = URL.createObjectURL(blob)
            release() // revoke the previous recording before adopting the new one
            urlRef.current = url
            resolve(url)
          } catch {
            resolve(null)
          }
        },
        { once: true },
      )
      try {
        rec.stop()
      } catch {
        resolve(null)
      }
    })
  }, [release])

  useEffect(() => {
    return () => {
      release()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [release])

  // Stable identity — start/stop/release are already useCallback-memoized, so
  // this object never changes between renders. Consumers put `mic` in effect
  // dependency arrays; an unstable object would re-run those effects every
  // render (e.g. resetting the say-word stage's phase mid-answer).
  return useMemo(() => ({ start, stop, release }), [start, stop, release])
}
