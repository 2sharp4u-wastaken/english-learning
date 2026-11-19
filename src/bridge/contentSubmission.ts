/**
 * contentSubmission bridge — the single seam for SHARING parent-authored content
 * to the project owner for review (content-submission pipeline, Phase 2).
 *
 * The local-override half (setImageOverride / custom words) already applies a
 * parent's picture/word on THEIR device. This bridge is the "share it back" step:
 * it POSTs the picture/word to the Worker (worker/submissions.ts), which stashes
 * it in the private review queue (D1 + R2). Nothing here is public; only after the
 * owner approves does an asset get baked into the repo.
 *
 * Mirrors bugReport.ts: a relative POST to the same-origin Worker, a canvas
 * downscale so an uploaded photo is a small word-icon rather than a megapixel
 * JPEG, and graceful failure (the local override is kept regardless — sharing is
 * strictly additive).
 */

const IMAGE_ENDPOINT = '/api/submit-image'
const WORD_ENDPOINT = '/api/submit-word'

export interface SubmitResult {
  ok: boolean
  /** Hebrew error for the UI when !ok. */
  error?: string
}

/** Pseudonymous submitter id = the active profile id (same as bug reports). */
function getSubmitter(): string | null {
  try {
    return localStorage.getItem('currentUser')
  } catch {
    return null
  }
}

async function errorText(res: Response): Promise<string> {
  // The Worker returns {error} JSON; fall back to a generic Hebrew message.
  try {
    const body = (await res.json()) as { error?: string }
    if (res.status === 429) return 'שותפו יותר מדי תמונות. נסו שוב מאוחר יותר.'
    return body?.error ? 'השיתוף נכשל: ' + body.error : 'השיתוף נכשל.'
  } catch {
    return 'השיתוף נכשל.'
  }
}

/**
 * Downscale an image (data: URL or http(s) URL) to a small word-icon and
 * re-encode to WebP (JPEG fallback). Keeps the review queue + R2 small. Falls
 * back to the original bytes if canvas encoding isn't available (mirrors
 * bugReport.prepareScreenshot). Throws only if the source can't be fetched.
 */
export async function prepareSubmissionImage(
  src: string,
  maxDim = 256,
  quality = 0.85,
): Promise<Blob> {
  const original = await fetch(src).then((r) => r.blob())
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('image decode failed'))
      el.src = src
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )
    if (!blob) throw new Error('toBlob failed')
    return blob
  } catch {
    return original
  }
}

/**
 * POST an already-prepared image blob. Separated from the fetch+downscale so the
 * FormData/endpoint contract is unit-testable without a canvas.
 */
export async function submitWordImageBlob(
  category: string,
  word: string,
  blob: Blob,
): Promise<SubmitResult> {
  try {
    const form = new FormData()
    form.append('payload', JSON.stringify({ word, category, submitter: getSubmitter() }))
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
    form.append('image', blob, `word.${ext}`)
    const res = await fetch(IMAGE_ENDPOINT, { method: 'POST', body: form })
    return res.ok ? { ok: true } : { ok: false, error: await errorText(res) }
  } catch {
    return { ok: false, error: 'השיתוף נכשל (אין חיבור?).' }
  }
}

/** Share a word's picture with the owner: downscale `src`, then POST it. */
export async function submitWordImage(
  category: string,
  word: string,
  src: string,
): Promise<SubmitResult> {
  let blob: Blob
  try {
    blob = await prepareSubmissionImage(src)
  } catch {
    return { ok: false, error: 'לא ניתן לקרוא את התמונה לשיתוף.' }
  }
  return submitWordImageBlob(category, word, blob)
}

/** Share a custom word (word + Hebrew translation + category) with the owner. */
export async function submitWord(
  word: string,
  category: string,
  translation: string,
): Promise<SubmitResult> {
  try {
    const res = await fetch(WORD_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word, category, translation, submitter: getSubmitter() }),
    })
    return res.ok ? { ok: true } : { ok: false, error: await errorText(res) }
  } catch {
    return { ok: false, error: 'השיתוף נכשל (אין חיבור?).' }
  }
}
