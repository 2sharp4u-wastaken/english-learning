// @ts-check
/**
 * Reusable webkitSpeechRecognition stub for the mic games (Pronunciation,
 * Practice, ABC say-letter, Phonics say-sound, Word Journey say-word).
 *
 * The five mic surfaces all route recording through the *real* legacy
 * `window.speechManager` (speechSynthesis.js), which wires itself to
 * `window.webkitSpeechRecognition` at construction. Headless Chromium has no
 * recognition engine, so `isSpeechRecognitionSupported()` returns false and the
 * record path is unreachable — which is why these games shipped without
 * Playwright coverage (see the Slice 3.11 / 3.16 deferral notes).
 *
 * `installMockSpeech(page)` injects a fake recognition class **before the app
 * boots** (via `addInitScript`, so it survives the goto/reload in `seedUser`).
 * The real SpeechManager then builds against it, so the production compare /
 * score / persistence plumbing runs unchanged — we only replace the browser's
 * audio→transcript engine. Tests feed transcripts with `queueTranscript`.
 *
 * Also stubs the mic permission gate (permissions.query → granted, getUserMedia
 * → a no-op stream) so `SpeechManager.startRecording()` never prompts. The
 * parallel "hear yourself" MediaRecorder capture fails silently against the
 * no-op stream — by design it never affects scoring.
 */

export async function installMockSpeech(page) {
  await page.addInitScript(() => {
    // FIFO queue the test feeds. Each entry is either
    //   { transcript: string, confidence?: number }  → fires `onresult`
    //   { error: string }                             → fires `onerror`
    window.__mockSpeech = { queue: [], lastTranscript: null };

    class MockSpeechRecognition extends EventTarget {
      constructor() {
        super();
        this.continuous = false;
        this.interimResults = false;
        this.lang = 'en-US';
        this.maxAlternatives = 1;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this._active = false;
      }

      // SpeechManager listens via BOTH `recognition.onX = ...` (start/stop path)
      // and `addEventListener('end', ...)` (stopRecognitionProperly), so fire both.
      _fire(type, detail) {
        const handler = this['on' + type];
        if (typeof handler === 'function') handler.call(this, detail);
        this.dispatchEvent(new Event(type));
      }

      start() {
        this._active = true;
        // Async, like a real engine — handlers are assigned right after start().
        setTimeout(() => {
          if (!this._active) return;
          this._active = false;
          const next = window.__mockSpeech.queue.shift();
          if (next && next.error) {
            this._fire('error', { error: next.error });
            this._fire('end');
            return;
          }
          const transcript = next && next.transcript != null ? next.transcript : '';
          const confidence = next && next.confidence != null ? next.confidence : 0.95;
          window.__mockSpeech.lastTranscript = transcript;
          this._fire('result', { results: [[{ transcript, confidence }]] });
          this._fire('end');
        }, 10);
      }

      stop() {
        this._active = false;
        this._fire('end');
      }

      abort() {
        this._active = false;
        this._fire('error', { error: 'aborted' });
        this._fire('end');
      }
    }

    window.webkitSpeechRecognition = MockSpeechRecognition;
    window.SpeechRecognition = MockSpeechRecognition;

    // Make the permission gate pass without a real device.
    try {
      const perms = navigator.permissions;
      if (perms && perms.query) {
        const orig = perms.query.bind(perms);
        perms.query = (desc) =>
          desc && desc.name === 'microphone'
            ? Promise.resolve({ state: 'granted', addEventListener() {} })
            : orig(desc);
      }
    } catch {
      /* permissions API absent — startRecording falls through to getUserMedia */
    }

    // No-op media stream so getUserMedia resolves; MediaRecorder will reject it
    // (not a real MediaStream) and the page's capture swallows that silently.
    try {
      const fakeStream = () => ({ getTracks: () => [{ stop() {} }] });
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
      }
      navigator.mediaDevices.getUserMedia = () => Promise.resolve(fakeStream());
    } catch {
      /* leave native getUserMedia in place */
    }
  });
}

/** Queue the transcript the next `start()` should return. Call before clicking record. */
export async function queueTranscript(page, transcript, confidence = 0.95) {
  await page.evaluate(
    ({ t, c }) => {
      window.__mockSpeech.queue.push({ transcript: t, confidence: c });
    },
    { t: transcript, c: confidence },
  );
}

/** Queue a recognition error (e.g. 'no-speech', 'aborted') for the next `start()`. */
export async function queueSpeechError(page, error) {
  await page.evaluate((e) => {
    window.__mockSpeech.queue.push({ error: e });
  }, error);
}
