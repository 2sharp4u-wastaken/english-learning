/**
 * src/engine/certificates.ts — certificate ledger (award / lookup / stats).
 *
 * Slice 4.4.b1 TypeScript reimplementation of `managers/CertificateManager.js`.
 * Only the DATA half is ported: the legacy module's DOM/canvas/audio methods
 * (showCertificateModal / hideCertificateModal / downloadCertificate /
 * generateGalleryHTML / playCelebration / createConfetti / playMelody) are gone —
 * React renders the certificate UI. Award/lookup/stat logic is byte-faithful;
 * `tests/engine-parity-certificates.spec.js` is the gate. Persistence is a host
 * hook (the app state layer owns saving) instead of the legacy window.app /
 * localStorage fallback.
 */

export interface Certificate {
  id: string
  topicId: string
  topicName: string
  earnedDate: string
  score: number
  timestamp: number
}

export interface CertificateUserProgress {
  certificates: Certificate[]
  studentName?: string
}

export interface CertificateManagerOptions {
  /** Persist hook (legacy saveProgress). Defaults to no-op — the app state
   *  layer owns persistence now. */
  save?: () => void
}

export class CertificateManager {
  userProgress: CertificateUserProgress
  initialized = false
  private save: () => void

  constructor(userProgress: CertificateUserProgress, opts: CertificateManagerOptions = {}) {
    this.userProgress = userProgress
    this.save = opts.save ?? (() => {})
  }

  initialize(): void {
    if (this.initialized) return
    if (!this.userProgress.certificates) this.userProgress.certificates = []
    this.initialized = true
  }

  awardCertificate(certificateData: {
    id: string
    topicId: string
    topicName: string
    score: number
  }): Certificate {
    const { id, topicId, topicName, score } = certificateData

    const existing = this.getCertificate(id)
    if (existing) return existing

    const certificate: Certificate = {
      id,
      topicId,
      topicName,
      earnedDate: new Date().toISOString().split('T')[0],
      score: Math.round(score),
      timestamp: Date.now(),
    }

    this.userProgress.certificates.push(certificate)
    this.save()
    return certificate
  }

  getCertificate(certificateId: string): Certificate | null {
    return this.userProgress.certificates.find((cert) => cert.id === certificateId) || null
  }

  getCertificateByTopic(topicId: string): Certificate | null {
    return this.userProgress.certificates.find((cert) => cert.topicId === topicId) || null
  }

  getAllCertificates(): Certificate[] {
    return [...this.userProgress.certificates].sort((a, b) => b.timestamp - a.timestamp)
  }

  hasCertificate(certificateId: string): boolean {
    return this.userProgress.certificates.some((cert) => cert.id === certificateId)
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
    return date.toLocaleDateString('en-US', options)
  }

  getStudentName(): string {
    return this.userProgress.studentName || 'Student'
  }

  getStats(): {
    totalCertificates: number
    averageScore: number
    mostRecentCertificate: Certificate | null
  } {
    return {
      totalCertificates: this.userProgress.certificates.length,
      averageScore: this.getAverageScore(),
      mostRecentCertificate: this.getMostRecentCertificate(),
    }
  }

  getAverageScore(): number {
    if (this.userProgress.certificates.length === 0) return 0
    const total = this.userProgress.certificates.reduce((sum, cert) => sum + cert.score, 0)
    return Math.round(total / this.userProgress.certificates.length)
  }

  getMostRecentCertificate(): Certificate | null {
    const certs = this.getAllCertificates()
    return certs.length > 0 ? certs[0] : null
  }
}
