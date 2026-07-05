import { describe, it, expect } from 'vitest'
import { sha256Hex } from '../sha256'

/** Reference digest via WebCrypto (the async API our sync impl replaces). */
async function webCryptoSha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** FIPS 180-4 vectors + a cross-check against WebCrypto (incl. UTF-8 Hebrew). */
describe('sha256Hex', () => {
  it('matches the standard test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    )
  })

  it('matches WebCrypto for multi-block, boundary-length, and UTF-8 inputs', async () => {
    const cases = [
      'a'.repeat(55), // exactly fits one padded block
      'a'.repeat(56), // forces a second block for the length field
      'a'.repeat(64), // exact block size
      'a'.repeat(1000), // many blocks
      'סיסמה-של-אבא-1234', // Hebrew (multi-byte UTF-8)
      'עברית and English מעורבב 🎈', // mixed + astral emoji
      'deadbeefcafe$sha256$looks-like-our-format',
    ]
    for (const s of cases) {
      expect(sha256Hex(s)).toBe(await webCryptoSha256(s))
    }
  })
})
