import { describe, it, expect, beforeEach } from 'vitest'
import { AppState } from '../appState'
import { ProgressManager } from '../progress'

/**
 * Cert-level recalibration (backlog "Certificate / level recalibration", 2026-06-25):
 * milestone certificates are split into two tracks — `met` (words introduced) and
 * `mastered` (derived-Learned) — with per-preset thresholds. These tests pin:
 *   - each track keys off the RIGHT count (introduced vs mastered),
 *   - the award is additive + idempotent (re-running grants nothing new),
 *   - switching the difficulty preset can only ADD newly-qualifying tiers and never
 *     revokes an earned one.
 */
function harness(certDifficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const app = new AppState({ getUserId: () => 'certtest' })
  app.userProgress = app.getDefaultProgress()
  app.settings = { ...(app.settings || {}), certDifficulty } as any
  const pm = new ProgressManager()
  pm.initialize(app.userProgress)
  app.progressManager = pm
  return { app, pm }
}

/** Introduce a word without mastering it (1 correct attempt: totalAttempts 1 < 3). */
function introduce(pm: ProgressManager, word: string) {
  pm.recordWordAttempt(word, 'animals', true, 'vocabulary')
}

/** Master a word (3 correct attempts clears the lifecycle bar). */
function master(pm: ProgressManager, word: string) {
  for (let i = 0; i < 3; i++) pm.recordWordAttempt(word, 'animals', true, 'vocabulary')
}

const ids = (certs: { id: string }[]) => certs.map((c) => c.id).sort()

describe('AppState.checkMilestoneCertificates — two tracks', () => {
  beforeEach(() => localStorage.clear())

  it('met track keys off introduced count; mastered track off derived-learned', () => {
    const { app, pm } = harness('normal')
    // 5 mastered (also introduced) + 5 introduced-only ⇒ introduced 10, mastered 5.
    for (let i = 0; i < 5; i++) master(pm, `m${i}`)
    for (let i = 0; i < 5; i++) introduce(pm, `i${i}`)
    expect(pm.getIntroducedCount()).toBe(10)
    expect(pm.getDerivedLearnedCount()).toBe(5)

    const earned = app.checkMilestoneCertificates()
    // normal met [1,10,...] → met-1 + met-2; normal mastered [1,5,...] → tier1 + tier2.
    expect(ids(earned)).toEqual(
      ['milestone-first-word', 'milestone-met-1', 'milestone-met-2', 'milestone-word-explorer'].sort(),
    )
  })

  it('introduced-only words never grant a mastered-track cert beyond what mastery earns', () => {
    const { app, pm } = harness('normal')
    for (let i = 0; i < 10; i++) introduce(pm, `i${i}`)
    expect(pm.getDerivedLearnedCount()).toBe(0)

    const earned = app.checkMilestoneCertificates()
    // Only met-track certs (met-1 at 1, met-2 at 10). No mastered certs at all.
    expect(ids(earned)).toEqual(['milestone-met-1', 'milestone-met-2'])
    expect(earned.every((c) => c.id.startsWith('milestone-met-'))).toBe(true)
  })

  it('is additive + idempotent — a second call grants nothing new', () => {
    const { app, pm } = harness('normal')
    for (let i = 0; i < 5; i++) master(pm, `m${i}`)
    expect(app.checkMilestoneCertificates().length).toBeGreaterThan(0)
    expect(app.checkMilestoneCertificates()).toEqual([])
  })

  it('loosening the preset (hard → easy) adds newly-qualifying tiers but never revokes', () => {
    const { app, pm } = harness('hard')
    for (let i = 0; i < 5; i++) master(pm, `m${i}`)
    for (let i = 0; i < 5; i++) introduce(pm, `i${i}`)
    // hard met [1,25,..] → only met-1; hard mastered [1,10,..] → only tier1.
    expect(ids(app.checkMilestoneCertificates())).toEqual(['milestone-first-word', 'milestone-met-1'])

    app.settings = { ...(app.settings as any), certDifficulty: 'easy' }
    // easy met [1,5,15,..] introduced 10 → met-2 (5) newly; easy mastered [1,3,10,..]
    // mastered 5 → tier2 (3 = milestone-word-explorer) newly.
    expect(ids(app.checkMilestoneCertificates())).toEqual(['milestone-met-2', 'milestone-word-explorer'])

    // Tightening back to hard revokes nothing and grants nothing.
    app.settings = { ...(app.settings as any), certDifficulty: 'hard' }
    expect(app.checkMilestoneCertificates()).toEqual([])
    expect(app.userProgress.certificates.length).toBe(4)
  })

  it('defaults to the normal preset when certDifficulty is unset', () => {
    const { app, pm } = harness('normal')
    app.settings = { ...(app.settings as any), certDifficulty: undefined }
    for (let i = 0; i < 10; i++) master(pm, `m${i}`)
    // normal mastered [1,5,15,..] mastered 10 → tier1 + tier2 (not tier3 at 15).
    const masteredCerts = app
      .checkMilestoneCertificates()
      .filter((c) => !c.id.startsWith('milestone-met-'))
    expect(ids(masteredCerts)).toEqual(['milestone-first-word', 'milestone-word-explorer'])
  })
})
