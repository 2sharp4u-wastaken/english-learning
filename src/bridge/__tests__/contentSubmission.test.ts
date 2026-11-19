import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { submitWord, submitWordImageBlob } from '../contentSubmission'

/**
 * contentSubmission bridge — the "share to owner" POST contract. Mocks fetch;
 * the canvas downscale (prepareSubmissionImage) is exercised only in the browser
 * (jsdom has no real canvas), so we test the FormData/JSON payload + the result
 * mapping via submitWordImageBlob (blob in, no canvas).
 */

let lastCall: { url: string; init: RequestInit } | null

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (url: string, init: RequestInit) => {
    lastCall = { url, init }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }
  }) as unknown as typeof fetch
}

beforeEach(() => {
  lastCall = null
  try {
    localStorage.setItem('currentUser', 'Zohar')
  } catch {
    /* ignore */
  }
})
afterEach(() => vi.restoreAllMocks())

describe('submitWord', () => {
  it('POSTs the word/category/translation + submitter as JSON and reports ok', async () => {
    globalThis.fetch = mockFetch(200, { ok: true, id: 'abc' })
    const res = await submitWord('duck', 'animals', 'ברווז')
    expect(res.ok).toBe(true)
    expect(lastCall!.url).toBe('/api/submit-word')
    expect(lastCall!.init.method).toBe('POST')
    const body = JSON.parse(String(lastCall!.init.body))
    expect(body).toMatchObject({ word: 'duck', category: 'animals', translation: 'ברווז', submitter: 'Zohar' })
  })

  it('maps a 429 to a friendly Hebrew error', async () => {
    globalThis.fetch = mockFetch(429, { error: 'too many submissions' })
    const res = await submitWord('duck', 'animals', 'ברווז')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('יותר מדי')
  })

  it('reports !ok (no throw) on a network failure', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const res = await submitWord('duck', 'animals', 'ברווז')
    expect(res.ok).toBe(false)
    expect(res.error).toBeTruthy()
  })
})

describe('submitWordImageBlob', () => {
  it('POSTs multipart with payload + image and reports ok', async () => {
    globalThis.fetch = mockFetch(200, { ok: true, id: 'img1' })
    const blob = new Blob([new Uint8Array(8)], { type: 'image/webp' })
    const res = await submitWordImageBlob('furniture', 'chair', blob)
    expect(res.ok).toBe(true)
    expect(lastCall!.url).toBe('/api/submit-image')
    const form = lastCall!.init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    const payload = JSON.parse(String(form.get('payload')))
    expect(payload).toMatchObject({ word: 'chair', category: 'furniture', submitter: 'Zohar' })
    expect(form.get('image')).toBeTruthy()
  })

  it('maps a 415 (unsupported type) to an error result', async () => {
    globalThis.fetch = mockFetch(415, { error: 'unsupported image type' })
    const res = await submitWordImageBlob('furniture', 'chair', new Blob([new Uint8Array(4)], { type: 'image/webp' }))
    expect(res.ok).toBe(false)
    expect(res.error).toContain('unsupported')
  })
})
