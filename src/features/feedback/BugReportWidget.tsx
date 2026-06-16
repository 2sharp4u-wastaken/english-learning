import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bug, X, ImageUp, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { prepareScreenshot, submitBugReport } from '@/bridge/bugReport'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/**
 * Floating "report an issue" widget, available on EVERY page (mounted in
 * AppShell, both the game and hub branches). Beta testers tap the small bug
 * button → describe the issue (Hebrew or English) + optionally upload a
 * screenshot they took → submit. Goes to the backend queue (and is buffered
 * locally so nothing is lost before the backend is live; see bridge/bugReport).
 *
 * Adult-facing utility chrome, so the Hebrew is plain (no nikud) and the whole
 * subtree is marked `data-nikud-skip` so utils/nikudDOM.js never mangles it.
 * Kept unobtrusive (small, dismissible, no navigation) so a player still feels
 * inside the game and can cancel out instantly (X / Cancel / backdrop / Esc).
 */
export function BugReportWidget() {
  const { pathname } = useLocation()
  const isGameRoute = pathname.startsWith('/game/')
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [screenshot, setScreenshot] = useState<Blob | null>(null)
  const [preparing, setPreparing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | null>(null)

  const reset = useCallback(() => {
    setDescription('')
    setStatus('idle')
    setPreview(null)
    setScreenshot(null)
    setPreparing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const close = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(false)
    reset()
  }, [reset])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    setPreparing(true)
    try {
      const { blob, dataUrl } = await prepareScreenshot(file)
      setScreenshot(blob)
      setPreview(dataUrl)
    } catch {
      // ignore — the user can retry or submit without a screenshot
    } finally {
      setPreparing(false)
    }
  }, [])

  const removeScreenshot = useCallback(() => {
    setScreenshot(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!description.trim() || status === 'submitting') return
    setStatus('submitting')
    const result = await submitBugReport({
      description: description.trim(),
      screenshot,
      screenshotDataUrl: preview,
    })
    if (result.sent || result.bufferedLocally) {
      setStatus('success')
      closeTimer.current = window.setTimeout(close, 1800)
    } else {
      setStatus('error')
    }
  }, [description, status, screenshot, preview, close])

  return (
    <div data-nikud-skip>
      {/* Floating launcher — clears the mobile bottom nav on hub routes and the
          centered game footer on game routes. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="bug-report-button"
          aria-label="דיווח על תקלה"
          title="דיווח על תקלה"
          className={cn(
            'fixed start-3 z-[60] flex items-center gap-1.5 rounded-full border border-white/15',
            'bg-[color:var(--ink-900)]/80 px-3 py-2 text-xs font-semibold text-white/80 shadow-lg backdrop-blur',
            'transition hover:bg-[color:var(--ink-900)] hover:text-white',
            isGameRoute ? 'bottom-3' : 'bottom-[4.75rem] sm:bottom-4',
          )}
        >
          <Bug className="size-4 text-[color:var(--coral-400)]" aria-hidden />
          <span className="hidden sm:inline">דיווח</span>
        </button>
      ) : null}

      {open ? (
        <div
          role="presentation"
          data-testid="bug-report-backdrop"
          onClick={close}
          className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-report-title"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[color:var(--ink-900)] p-5 shadow-[var(--shadow-panel)] animate-[feedbackReveal_0.2s_ease-out]"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="bug-report-title"
                className="flex items-center gap-2 text-lg font-bold text-white"
              >
                <Bug className="size-5 text-[color:var(--coral-400)]" aria-hidden />
                דיווח על תקלה
              </h2>
              <button
                type="button"
                onClick={close}
                data-testid="bug-report-close"
                aria-label="סגירה"
                className="flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            {status === 'success' ? (
              <div
                data-testid="bug-report-success"
                className="flex flex-col items-center gap-3 py-8 text-center"
              >
                <CheckCircle2 className="size-12 text-[color:var(--mint-400)]" aria-hidden />
                <p className="text-base font-bold text-white">תודה! הדיווח התקבל 🙌</p>
                <p className="text-sm text-[color:var(--slate-300)]">נבדוק אותו בקרוב.</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-[color:var(--slate-300)]">
                  צרו צילום מסך של התקלה, העלו אותו כאן והוסיפו משפט קצר (עברית או אנגלית).
                </p>

                {/* Screenshot upload + preview */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="bug-report-file"
                  className="sr-only"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
                {preview ? (
                  <div className="relative mb-3 overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src={preview}
                      alt="צילום מסך"
                      className="max-h-48 w-full object-contain bg-black/30"
                    />
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      aria-label="הסרת צילום המסך"
                      className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="bug-report-upload"
                    disabled={preparing}
                    className="mb-3 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm font-medium text-[color:var(--slate-200)] transition hover:bg-white/10 disabled:opacity-60"
                  >
                    {preparing ? (
                      <Loader2 className="size-6 animate-spin" aria-hidden />
                    ) : (
                      <ImageUp className="size-6 text-[color:var(--blue-400)]" aria-hidden />
                    )}
                    {preparing ? 'מעבד תמונה…' : 'העלאת צילום מסך (לא חובה)'}
                  </button>
                )}

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="bug-report-description"
                  rows={3}
                  placeholder="מה קרה? (עברית או אנגלית)"
                  className="mb-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[color:var(--blue-400)] focus:outline-none"
                />

                {status === 'error' ? (
                  <p
                    data-testid="bug-report-error"
                    className="mb-3 text-center text-sm font-medium text-[color:var(--coral-400)]"
                  >
                    לא הצלחנו לשלוח כרגע — נסו שוב מאוחר יותר.
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    data-testid="bug-report-cancel"
                    className="flex-1 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!description.trim() || status === 'submitting'}
                    data-testid="bug-report-submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-5 py-2.5 text-sm font-bold text-[color:var(--ink-950)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === 'submitting' ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    שליחה
                  </button>
                </div>

                {/* Version stamp — attached to every report so we know the exact
                    bundle; shown here so the tester can read it aloud too. */}
                <p className="mt-3 text-center text-[11px] text-white/35" dir="ltr">
                  v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
                  {typeof __GIT_SHA__ !== 'undefined' && __GIT_SHA__ !== 'dev'
                    ? ` · ${__GIT_SHA__}`
                    : ''}
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
