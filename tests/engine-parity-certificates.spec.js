// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Slice 4.4.b1 — PARITY oracle for the CertificateManager rewrite.
 *
 * Runs the same award/lookup/stat scenario through legacy
 * `managers/CertificateManager.js` and new `src/engine/certificates.ts`, asserting
 * the resulting certificate ledger + derived outputs are deep-equal. Each
 * certificate's `timestamp` is normalized out (wall-clock, differs ms apart
 * between the two runs); `earnedDate` is date-only (same day → identical). Only
 * the DATA half is ported — the legacy DOM/canvas/audio methods are intentionally
 * gone, so they are not exercised here.
 */

const LEGACY = '/managers/CertificateManager.js';
const NEXT = '/src/engine/certificates.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('CertificateManager parity: award/dedup/lookup/stats identical', async ({ page }) => {
  const { legacy, next } = await page.evaluate(async ({ legacyPath, nextPath }) => {
    const legacyMod = await import(legacyPath);
    const nextMod = await import(nextPath);

    const stripTs = (certs) => certs.map(({ timestamp, ...rest }) => rest);

    const run = (Mod) => {
      const up = { certificates: [], studentName: 'דנה' };
      const m = new Mod.CertificateManager(up);
      m.initialize();

      // Strictly-increasing deterministic timestamps so the "most recent first"
      // sort is stable + identical across both runs (real Date.now() ties within
      // a run, which would break ordering nondeterministically — the sort code
      // itself is byte-identical in both implementations).
      const origNow = Date.now;
      let t = 1_700_000_000_000;
      Date.now = () => (t += 1000);

      const a = m.awardCertificate({ id: 'cert-t1', topicId: 't1', topicName: 'Animals', score: 85.6 });
      const dup = m.awardCertificate({ id: 'cert-t1', topicId: 't1', topicName: 'Animals', score: 99 }); // dedup → returns existing
      m.awardCertificate({ id: 'cert-t2', topicId: 't2', topicName: 'Food', score: 70 });
      m.awardCertificate({ id: 'cert-t3', topicId: 't3', topicName: 'Colors', score: 92.4 });
      Date.now = origNow;

      return {
        awardedScore: a.score,                       // rounded
        dupIsSame: dup.id === a.id && up.certificates.length === 3,
        ledger: stripTs(up.certificates),            // insertion order
        all: stripTs(m.getAllCertificates()),        // sorted most-recent-first
        hasT2: m.hasCertificate('cert-t2'),
        missing: m.getCertificate('nope'),
        byTopic: stripTs([m.getCertificateByTopic('t3')]),
        avg: m.getAverageScore(),
        stats: { ...m.getStats(), mostRecentCertificate: m.getStats().mostRecentCertificate
          ? (({ timestamp, ...r }) => r)(m.getStats().mostRecentCertificate) : null },
        studentName: m.getStudentName(),
        formatted: m.formatDate('2026-06-01'),
      };
    };

    return { legacy: run(legacyMod), next: run(nextMod) };
  }, { legacyPath: LEGACY, nextPath: NEXT });

  expect(next).toEqual(legacy);
});
