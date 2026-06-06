import { describe, it, expect } from 'vitest'
import {
  GameManager,
  EXPRESSION_MILESTONE_COUNT,
  EXPRESSION_MILESTONE_CERT_ID,
} from '../gameManager'
import { ProgressManager } from '../progress'

/**
 * Slice 5.5 — the "אלוף ביטויים" milestone certificate is awarded once the child
 * has mastered EXPRESSION_MILESTONE_COUNT (30) distinct expressions. Awarding lives
 * in GameManager.recordExpressionAttempt; here we drive it with a real
 * ProgressManager + a fake CertificateManager and assert the gate + idempotency.
 */

interface FakeCert {
  id: string
  topicName: string
  score: number
}

function makeManager() {
  const certificates: FakeCert[] = []
  const certificateManager = {
    hasCertificate: (id: string) => certificates.some((c) => c.id === id),
    awardCertificate: (c: FakeCert) => {
      certificates.push(c)
      return c
    },
  }
  const app: any = {
    userProgress: { certificates, expressionMastery: {} },
    certificateManager,
    saveUserProgress: () => {},
  }
  const gm = new GameManager({ getApp: () => app })
  gm.progressManager = new ProgressManager() as any
  return { gm, certificates }
}

/** Master `n` distinct phrases (3 correct answers each). */
function masterPhrases(gm: GameManager, n: number): void {
  for (let i = 0; i < n; i++) {
    gm.recordExpressionAttempt(`phrase ${i}`, true)
    gm.recordExpressionAttempt(`phrase ${i}`, true)
    gm.recordExpressionAttempt(`phrase ${i}`, true)
  }
}

describe('expression milestone certificate', () => {
  it('is NOT awarded below the threshold', () => {
    const { gm, certificates } = makeManager()
    masterPhrases(gm, EXPRESSION_MILESTONE_COUNT - 1)
    expect(certificates).toHaveLength(0)
  })

  it('is awarded exactly once at the threshold', () => {
    const { gm, certificates } = makeManager()
    masterPhrases(gm, EXPRESSION_MILESTONE_COUNT)
    expect(certificates).toHaveLength(1)
    expect(certificates[0].id).toBe(EXPRESSION_MILESTONE_CERT_ID)
    expect(certificates[0].topicName).toBe('אלוף ביטויים')
    expect(certificates[0].score).toBe(EXPRESSION_MILESTONE_COUNT)

    // Mastering more phrases does not duplicate the certificate.
    masterPhrases(gm, 5)
    expect(certificates).toHaveLength(1)
  })
})
