/**
 * Bug / feedback report bridge.
 *
 * Beta testers can report an issue (short description in Hebrew or English +
 * an optional screenshot they upload) from any page. This bridge is the single
 * gateway for: capturing page context, downscaling the screenshot, POSTing to
 * the backend, and a deploy-safe LOCAL BUFFER so a report is never lost while
 * the backend isn't live yet (the buffer can be flushed once it is).
 *
 * Backend contract (Cloudflare Worker, to be provisioned): POST /api/report
 * as multipart/form-data with fields `payload` (JSON metadata + description)
 * and optional `screenshot` (downscaled JPEG). See docs/bug-report.md.
 */

const ENDPOINT = '/api/report'
const LOCAL_KEY = 'bugReports_local'
const LOCAL_MAX = 25
/** Cap the buffered screenshot so the localStorage quota (~5MB) can't blow. */
const LOCAL_IMAGE_MAX_BYTES = 900 * 1024

export interface BugReportContext {
  route: string
  userAgent: string
  viewport: string
  language: string
  buildMode: string
  userId: string | null
  createdAt: string
}

export interface BugReportInput {
  description: string
  /** Downscaled screenshot, ready to send. Omit if the user didn't attach one. */
  screenshot?: Blob | null
  /** Same screenshot as a data URL, for the local buffer + preview. */
  screenshotDataUrl?: string | null
}

export interface BugReportResult {
  /** True if the backend accepted it. */
  sent: boolean
  /** True if it was saved to the local buffer (so nothing is lost). */
  bufferedLocally: boolean
}

function gatherContext(): BugReportContext {
  let userId: string | null = null
  try {
    userId = localStorage.getItem('currentUser')
  } catch {
    /* ignore */
  }
  return {
    route: typeof location !== 'undefined' ? location.hash || location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    viewport:
      typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    buildMode: import.meta.env.MODE,
    userId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Downscale + re-encode a user-picked image so both the POST payload and the
 * local buffer stay small (mirrors the M13 picture-upload plan). Falls back to
 * the original file as a data URL if canvas encoding fails.
 */
export async function prepareScreenshot(
  file: File,
  maxDim = 1280,
  quality = 0.8,
): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('image decode failed'))
      el.src = dataUrl
    })
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(img, 0, 0, w, h)
    const outDataUrl = canvas.toDataURL('image/jpeg', quality)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) throw new Error('toBlob failed')
    return { blob, dataUrl: outDataUrl }
  } catch {
    // Couldn't transcode (e.g. exotic format) — send the original bytes.
    return { blob: file, dataUrl }
  }
}

function bufferLocally(input: BugReportInput, context: BugReportContext): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    const arr = Array.isArray(list) ? list : []
    const screenshot =
      input.screenshotDataUrl && input.screenshotDataUrl.length <= LOCAL_IMAGE_MAX_BYTES
        ? input.screenshotDataUrl
        : null
    arr.push({
      description: input.description,
      hasScreenshot: !!input.screenshotDataUrl,
      screenshot,
      context,
    })
    // Keep only the most recent N so the buffer can't grow unbounded.
    while (arr.length > LOCAL_MAX) arr.shift()
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr))
    return true
  } catch {
    return false
  }
}

/**
 * Submit a report. Always buffers locally first (so it survives a backend
 * outage / not-yet-live state), then attempts the POST.
 */
export async function submitBugReport(input: BugReportInput): Promise<BugReportResult> {
  const context = gatherContext()
  const bufferedLocally = bufferLocally(input, context)

  try {
    const form = new FormData()
    form.append('payload', JSON.stringify({ description: input.description, context }))
    if (input.screenshot) {
      form.append('screenshot', input.screenshot, 'screenshot.jpg')
    }
    const res = await fetch(ENDPOINT, { method: 'POST', body: form })
    return { sent: res.ok, bufferedLocally }
  } catch {
    return { sent: false, bufferedLocally }
  }
}

/** Read the local buffer (debug / admin / flush). */
export function getLocalBugReports(): unknown[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
