// Speech Synthesis and Recognition for English Learning Games

// M9 (2026-06-11): Android's speech engine sometimes never starts/finishes an
// utterance; the desktop-safe "never cancel()" policy then wedges the queue
// forever (every later speak() is skipped) and can starve recognition too.
// Android therefore gets cancel-based unwedging + watchdogs below, while
// desktop behavior is unchanged. Mirrors src/lib/platform.ts isAndroid().
const SPEECH_IS_ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

class SpeechManager {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.recognition = null;
        this.isRecording = false;
        this.currentRecordingReject = null;
        this._manualStop = false;
        this.voices = [];
        this.englishVoice = null;
        this.hebrewVoice = null;
        this.lastSpeakAt = 0;
        this.microphonePermissionGranted = false;
        this.currentGameContext = null;
        this.permissionState = 'unknown'; // 'granted', 'denied', 'prompt', 'unknown'

        this.initializeVoices();
        this.initializeSpeechRecognition();
        this.initializeMicrophonePermission();
    }

    async initializeMicrophonePermission() {
        // Check cached permission state from localStorage
        const cachedState = localStorage.getItem('microphonePermissionState');
        if (cachedState) {
            this.permissionState = cachedState;
            this.microphonePermissionGranted = (cachedState === 'granted');
        }

        // Check actual permission state if API available
        const actualState = await this.checkMicrophonePermission();
        if (actualState !== 'unknown') {
            this.permissionState = actualState;
            this.microphonePermissionGranted = (actualState === 'granted');
            localStorage.setItem('microphonePermissionState', actualState);
        }

        console.log('Microphone permission state:', this.permissionState);
    }

    initializeVoices() {
        this.voices = this.synthesis.getVoices();

        // Always register onvoiceschanged: Chrome loads system voices immediately
        // but Google voices arrive asynchronously in a second event. Without this,
        // selectVoices() runs on the partial list (system only) and never upgrades.
        this.synthesis.onvoiceschanged = () => {
            this.voices = this.synthesis.getVoices();
            this.selectVoices();
        };

        if (this.voices.length > 0) {
            this.selectVoices();
        }
    }

    selectVoices() {
        // Fixed target voice — always use Google UK English Male
        const TARGET_VOICE = 'Google UK English Male';

        this.englishVoice = this.voices.find(v => v.name === TARGET_VOICE);

        if (!this.englishVoice) {
            // Target not yet loaded (Google voices arrive async) — log what's available
            console.log('[Speech] Target voice not found yet. Available voices:', this.voices.map(v => `${v.name} (${v.lang})`));
            // Temporary fallback until onvoiceschanged fires again with Google voices
            const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
            this.englishVoice = englishVoices.find(v => v.lang.startsWith('en-US')) ||
                               englishVoices.find(v => v.lang.startsWith('en-GB')) ||
                               englishVoices[0];
        }

        // Hebrew voice selection
        this.hebrewVoice = this.voices.find(voice =>
            voice.lang.startsWith('he') || voice.lang.startsWith('iw')
        );

        // Fallback to any voice if no English found
        if (!this.englishVoice && this.voices.length > 0) {
            this.englishVoice = this.voices[0];
        }

        console.log('Available voices:', this.voices.length);
        console.log('Selected English voice:', this.englishVoice?.name, this.englishVoice?.lang);
        console.log('Selected Hebrew voice:', this.hebrewVoice?.name, this.hebrewVoice?.lang);
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;

            // M9 diagnostics: Android devices fail with a silent onend (no
            // result, no error). These lifecycle events tell the downloaded
            // log WHERE the pipeline died: no audiostart = the service never
            // received audio (device/service config); audiostart without
            // speechstart = audio flows but no speech detected; nomatch =
            // heard speech it couldn't transcribe.
            ['audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']
                .forEach((ev) => {
                    this.recognition.addEventListener(ev, () => {
                        console.log(`[Speech] recognition event: ${ev}`);
                    });
                });
        }
    }

    async checkMicrophonePermission() {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'microphone' });

                // Listen for permission changes
                result.addEventListener('change', () => {
                    this.permissionState = result.state;
                    this.microphonePermissionGranted = (result.state === 'granted');
                    localStorage.setItem('microphonePermissionState', result.state);
                    console.log('Microphone permission changed to:', result.state);
                });

                return result.state;
            }
        } catch (error) {
            console.warn('Permission API not supported:', error);
        }
        return 'unknown';
    }

    async requestMicrophoneAccess() {
        // Check current permission state first
        const currentState = await this.checkMicrophonePermission();

        if (currentState === 'granted' || this.microphonePermissionGranted) {
            return { success: true, message: 'מיקרופון כבר מאושר' };
        }

        if (currentState === 'denied') {
            return {
                success: false,
                message: 'מיקרופון נחסם. לאישור גישה:\n1. לחץ על סמל המנעול בשורת הכתובת\n2. מצא "מיקרופון"\n3. בחר "אפשר"\n4. רענן את הדף',
                state: 'denied'
            };
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());

            // Update state
            this.microphonePermissionGranted = true;
            this.permissionState = 'granted';
            localStorage.setItem('microphonePermissionState', 'granted');

            console.log('Microphone access granted');
            return { success: true, message: 'גישה למיקרופון אושרה בהצלחה' };
        } catch (error) {
            console.error('Microphone access error:', error);

            // Update state to denied
            this.permissionState = 'denied';
            localStorage.setItem('microphonePermissionState', 'denied');

            if (error.name === 'NotAllowedError') {
                return {
                    success: false,
                    message: 'מיקרופון נחסם. לאישור גישה:\n1. לחץ על סמל המנעול בשורת הכתובת\n2. מצא "מיקרופון"\n3. בחר "אפשר"\n4. רענן את הדף',
                    state: 'denied'
                };
            } else if (error.name === 'NotFoundError') {
                return {
                    success: false,
                    message: 'לא נמצא מיקרופון. אנא חבר מיקרופון ונסה שוב.',
                    state: 'no-device'
                };
            } else {
                return {
                    success: false,
                    message: 'שגיאה בגישה למיקרופון. אנא בדוק את ההגדרות שלך.',
                    state: 'error'
                };
            }
        }
    }

    getMicrophonePermissionState() {
        return {
            state: this.permissionState,
            granted: this.microphonePermissionGranted,
            message: this.getPermissionStateMessage()
        };
    }

    getPermissionStateMessage() {
        switch (this.permissionState) {
            case 'granted':
                return '✓ מיקרופון מאושר';
            case 'denied':
                return '✗ מיקרופון נחסם - לחץ על המנעול בשורת הכתובת לאישור';
            case 'prompt':
                return '? נדרש אישור למיקרופון';
            default:
                return '? מצב מיקרופון לא ידוע';
        }
    }

    async speak(text, options = {}) {
        // M11: emojis must never be voiced. The React speak boundary
        // (src/bridge/audio.ts) already strips via stripSpeechEmoji; this is
        // the legacy-internal safety net (keep the regex in sync with that
        // module). An emoji-only string strips to "" → nothing to say.
        text = SpeechManager.stripSpeechEmoji(text);
        if (!text) return Promise.resolve();

        // CHROME BUG WORKAROUND (desktop): Calling cancel() corrupts Chrome's
        // speech engine. Instead: allow 1 item to queue so rapid taps feel
        // responsive; if the queue already has a pending item, skip.
        // M9: on Android the opposite holds — a stuck utterance keeps `pending`
        // true FOREVER, so skipping silences the app permanently. There,
        // cancel() the wedged queue and proceed.
        if (!options.allowOverlap) {
            if (this.synthesis.pending) {
                if (SPEECH_IS_ANDROID) {
                    console.warn('[Speech] Queue busy on Android - cancel() to unwedge');
                    this.synthesis.cancel();
                } else {
                    console.log('[Speech] Queue full - skipping');
                    return Promise.resolve();
                }
            }
        }

        // M7: Android loads TTS voices late — re-resolve at speak time if the
        // needed voice is still missing instead of trusting the boot-time pick.
        if (options.language === 'hebrew' && !this.hebrewVoice) {
            this.voices = this.synthesis.getVoices();
            this.selectVoices();
        }

        return this._speakUtterance(text, options, SPEECH_IS_ANDROID ? 1 : 0);
    }

    _speakUtterance(text, options, retriesLeft) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);

            // Route voice/language by requested content language
            if (options.language === 'hebrew') {
                if (this.hebrewVoice) {
                    utterance.voice = this.hebrewVoice;
                }
                utterance.lang = this.hebrewVoice?.lang || 'he-IL';
            } else if (this.englishVoice) {
                utterance.voice = this.englishVoice;
                utterance.lang = 'en-US';
            }

            // Use browser defaults for rate, pitch, and volume

            // Keep a live reference — Chrome may GC the utterance mid-speech,
            // silently dropping its onend (a long-known speechSynthesis bug).
            this._activeUtterance = utterance;

            // M9 watchdogs: never let a speak() promise hang. If the utterance
            // never STARTS, the engine is wedged — on Android cancel()+retry
            // once, then give up gracefully. If it never ENDS, force-settle
            // after a generous text-scaled cap.
            let settled = false;
            let started = false;
            const maxMs = Math.min(15000, 3000 + 120 * text.length);

            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(startTimer);
                clearTimeout(maxTimer);
                if (this._activeUtterance === utterance) this._activeUtterance = null;
                resolve();
            };

            utterance.onstart = () => {
                started = true;
            };
            utterance.onend = finish;
            utterance.onerror = (e) => {
                console.warn('Speech error:', e.error);
                finish(); // Resolve anyway to not break game flow
            };

            const startTimer = setTimeout(() => {
                if (settled || started) return;
                if (!SPEECH_IS_ANDROID && (this.synthesis.speaking || this.synthesis.pending)) {
                    // Desktop: engine legitimately busy with an earlier utterance —
                    // ours is queued, not wedged. maxTimer stays as the safety net.
                    return;
                }
                console.warn('[Speech] Watchdog: utterance never started (engine wedged?)');
                if (SPEECH_IS_ANDROID) {
                    this.synthesis.cancel();
                    if (retriesLeft > 0) {
                        settled = true;
                        clearTimeout(maxTimer);
                        setTimeout(() => {
                            this._speakUtterance(text, options, retriesLeft - 1).then(resolve);
                        }, 250);
                        return;
                    }
                }
                finish();
            }, 3000);

            const maxTimer = setTimeout(() => {
                if (settled) return;
                console.warn('[Speech] Watchdog: utterance exceeded max duration - force-settling');
                if (SPEECH_IS_ANDROID) this.synthesis.cancel();
                finish();
            }, maxMs);

            this.synthesis.speak(utterance);
        });
    }

    async speakHebrew(text, options = {}) {
        try {
            await this.speak(text, { ...options, language: 'hebrew' });
        } catch (error) {
            console.warn('Hebrew speech synthesis failed:', error);
        }
    }

    async speakWord(word, phonetic = '', gameContext = null, allowOverlap = false) {
        try {
            if (!word) {
                console.warn('speakWord called with undefined/null word');
                return;
            }
            const cleanWord = word.replace(/[-\s]/g, '');
            await this.speak(cleanWord, { gameContext, allowOverlap });
        } catch (error) {
            console.warn('Speech synthesis failed:', error);
        }
    }

    async speakSentence(sentence) {
        try {
            await this.speak(sentence);
        } catch (error) {
            console.warn('Speech synthesis failed:', error);
        }
    }

    /**
     * Speak an English word followed by its Hebrew translation.
     * Used in Word Journey (Discover stage) and other gated games where
     * Hebrew vocalization is enabled.
     *
     * @param {string} word              English word to speak
     * @param {string} hebrewText        Hebrew translation text (plain, no nikud)
     * @param {Object} [options]
     * @param {string} [options.gameContext]
     * @param {boolean} [options.allowOverlap=false]
     * @param {boolean} [options.playHebrew=true]   Set false to skip Hebrew part
     */
    async speakWordWithTranslation(word, hebrewText, options = {}) {
        try {
            await this.speakWord(word, '', options.gameContext, options.allowOverlap);
            if (hebrewText && options.playHebrew !== false) {
                await new Promise(resolve => setTimeout(resolve, 350));
                await this.speakHebrew(hebrewText);
            }
        } catch (error) {
            console.warn('speakWordWithTranslation failed:', error);
        }
    }

    async stopRecognitionProperly() {
        return new Promise((resolve) => {
            if (!this.recognition || !this.isRecording) {
                resolve();
                return;
            }

            // M9b: mark this as a deliberate stop so the silent-end auto-retry
            // in startRecording's onend doesn't restart the mic.
            this._manualStop = true;

            // Set up one-time onend handler to know when it's fully stopped
            const onEndHandler = () => {
                this.isRecording = false;
                this._manualStop = false;
                this.recognition.removeEventListener('end', onEndHandler);
                resolve();
            };

            this.recognition.addEventListener('end', onEndHandler);

            try {
                this.recognition.stop();
            } catch (e) {
                // If stop fails, still resolve after timeout
                this.recognition.removeEventListener('end', onEndHandler);
                this.isRecording = false;
                this._manualStop = false;
                setTimeout(resolve, 100);
            }
        });
    }

    async startRecording() {
        return new Promise(async (resolve, reject) => {
            if (!this.recognition) {
                reject(new Error('Speech recognition not supported'));
                return;
            }

            // Properly stop any ongoing recognition and wait for it to finish
            if (this.isRecording) {
                console.log('[Speech] startRecording: stopping previous session first');
                await this.stopRecognitionProperly();
                // Additional delay to ensure complete cleanup
                await new Promise(r => setTimeout(r, 200));
            }

            if (!this.microphonePermissionGranted) {
                const accessResult = await this.requestMicrophoneAccess();
                if (!accessResult.success) {
                    reject(new Error(accessResult.message));
                    return;
                }
            }

            this.isRecording = true;
            this.currentRecordingReject = reject; // Store reject function for manual stop
            console.log('[Speech] Recognition starting...');

            // M9 watchdog: a wedged speech service can leave recognition "on"
            // (green mic dot) but deliver NO result/error/end — the promise
            // would hang and the game freezes. Force an abort after 15s; the
            // 'aborted' onerror path settles the promise so the game can show
            // its retry message. Chrome's own no-speech timeout (~8s) normally
            // fires long before this.
            let recogWatchdog = null;
            const armWatchdog = () => {
                recogWatchdog = setTimeout(() => {
                    if (!this.isRecording) return;
                    console.warn('[Speech] Watchdog: recognition delivered no events in 15s - aborting');
                    try {
                        this.recognition.abort();
                    } catch (e) {
                        // abort() itself failed — settle manually so the caller unblocks
                        this.isRecording = false;
                        const rejectFn = this.currentRecordingReject;
                        this.currentRecordingReject = null;
                        if (rejectFn) rejectFn(new Error('RECORDING_CANCELLED'));
                    }
                }, 15000);
            };
            armWatchdog();

            // M9b: Android's service sometimes ends recognition ~2-3s in with
            // NO result and NO error (tablet log signature: "onend |
            // isRecording=true"). Allow one silent auto-retry before failing.
            let silentRetryUsed = false;

            this.recognition.onresult = (event) => {
                clearTimeout(recogWatchdog);
                this.isRecording = false;
                this.currentRecordingReject = null; // Clear reject function
                const transcript = event.results[0][0].transcript.toLowerCase().trim();
                const confidence = event.results[0][0].confidence;
                console.log(`[Speech] Result received: "${transcript}" (confidence: ${confidence.toFixed(2)})`);

                resolve({
                    transcript,
                    confidence
                });
            };

            this.recognition.onerror = (event) => {
                clearTimeout(recogWatchdog);
                console.error(`[Speech] Recognition onerror: "${event.error}" | isRecording=${this.isRecording} | hasReject=${!!this.currentRecordingReject}`);
                this.isRecording = false;

                if (event.error === 'aborted') {
                    // Browser aborted the session (e.g. stop() was called, or internal abort).
                    // We MUST settle the promise so callers don't hang and flags don't get stuck.
                    const rejectFn = this.currentRecordingReject;
                    this.currentRecordingReject = null;
                    if (rejectFn) {
                        console.warn('[Speech] Aborted — rejecting promise with RECORDING_CANCELLED to unblock caller');
                        rejectFn(new Error('RECORDING_CANCELLED'));
                    }
                    return;
                }

                this.currentRecordingReject = null; // Clear reject function

                let errorMessage = `Speech recognition error: ${event.error}`;

                if (event.error === 'not-allowed') {
                    errorMessage = 'מיקרופון נחסם. אנא אפשר גישה במעלה את הדף:\n1. לחץ על סמל המנעול בשורת הכתובת\n2. מצא "מיקרופון" ובחר "אפשר"\n3. רענן את הדף';
                } else if (event.error === 'no-speech') {
                    errorMessage = 'לא זוהה דיבור. נסה שוב ודבר בקול רם יותר.';
                } else if (event.error === 'audio-capture') {
                    errorMessage = 'לא נמצא מיקרופון. אנא חבר מיקרופון ונסה שוב.';
                } else if (event.error === 'network') {
                    errorMessage = 'שגיאת רשת. אנא בדוק את החיבור לאינטרנט.';
                }

                reject(new Error(errorMessage));
            };

            this.recognition.onend = () => {
                clearTimeout(recogWatchdog);
                console.log(`[Speech] Recognition onend | isRecording=${this.isRecording} | hasReject=${!!this.currentRecordingReject}`);
                const endedSilently = this.isRecording; // no result/error arrived first
                this.isRecording = false;
                if (!this.currentRecordingReject) return;

                // M9b: silent end on Android without a manual stop → one retry.
                if (endedSilently && SPEECH_IS_ANDROID && !this._manualStop && !silentRetryUsed) {
                    silentRetryUsed = true;
                    console.warn('[Speech] Recognition ended silently - retrying once');
                    setTimeout(() => {
                        if (!this.currentRecordingReject) return; // settled meanwhile
                        try {
                            this.isRecording = true;
                            this.recognition.start();
                            armWatchdog();
                        } catch (error) {
                            console.error('[Speech] retry start() threw:', error);
                            this.isRecording = false;
                            const rejectFn = this.currentRecordingReject;
                            this.currentRecordingReject = null;
                            if (rejectFn) rejectFn(new Error('RECORDING_CANCELLED'));
                        }
                    }, 250);
                    return;
                }

                // Pending reject (manual stop, or retry exhausted) — settle it.
                const rejectFn = this.currentRecordingReject;
                this.currentRecordingReject = null;
                rejectFn(new Error('RECORDING_CANCELLED'));
            };

            try {
                this.recognition.start();
            } catch (error) {
                console.error('[Speech] recognition.start() threw:', error);
                this.isRecording = false;
                this.currentRecordingReject = null;
                reject(error);
            }
        });
    }

    async stopRecording() {
        await this.stopRecognitionProperly();
    }

    cancelSpeech() {
        // DISABLED on desktop: cancel() corrupts Chrome's speech engine —
        // let speech finish naturally instead.
        // M9: on Android cancel() is the cure, not the disease — it's the only
        // way to unstick a wedged utterance (and it doesn't corrupt there).
        if (SPEECH_IS_ANDROID) {
            console.log('[Speech] cancelSpeech() — Android: cancelling');
            this.synthesis.cancel();
        } else {
            console.log('[Speech] cancelSpeech() called but DISABLED to prevent Chrome corruption');
        }
        this.currentGameContext = null;
    }

    setGameContext(gameType) {
        this.currentGameContext = gameType;
        console.log('Speech context set to:', gameType);
    }

    // M11: strip emoji before speaking. Mirror of src/lib/stripEmoji.ts
    // stripSpeechEmoji (this classic <script> can't import the TS module).
    static stripSpeechEmoji(text) {
        if (!text) return text;
        return text
            .replace(/[0-9#*]️?⃣/gu, '')   // keycap sequences (1️⃣)
            .replace(/\p{Extended_Pictographic}/gu, '')
            .replace(/[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Map numerals the browser may return to their English word equivalents
    static normalizeSpokenText(text) {
        const numeralMap = {
            '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
            '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
            '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
            '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
            '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
            '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy',
            '80': 'eighty', '90': 'ninety', '100': 'hundred', '1000': 'thousand',
        };
        const trimmed = text.trim();
        return numeralMap[trimmed] !== undefined ? numeralMap[trimmed] : text;
    }

    comparePronunciation(target, spoken) {
        const targetLower = target.toLowerCase().trim();
        const rawSpoken = spoken.toLowerCase().trim();
        // Normalize numerals (e.g. "90" → "ninety") before comparing
        const spokenLower = SpeechManager.normalizeSpokenText(rawSpoken);
        if (spokenLower !== rawSpoken) {
            console.log(`🎤 [COMPARE] Numeral normalized: "${rawSpoken}" → "${spokenLower}"`);
        }

        console.log(`🎤 [COMPARE] Target: "${targetLower}" vs Spoken: "${spokenLower}"`);

        // Exact match check first
        if (targetLower === spokenLower) {
            console.log('🎤 [COMPARE] Exact match!');
            return { accuracy: 1.0, feedback: 'Excellent pronunciation!', audioFeedback: 'Excellent pronunciation!' };
        }

        const targetWords = targetLower.split(' ');
        const spokenWords = spokenLower.split(' ');

        if (targetWords.length !== spokenWords.length) {
            console.log('🎤 [COMPARE] Word count mismatch');
            return { accuracy: 0.3, feedback: 'Word count mismatch', audioFeedback: 'Try again!' };
        }

        let totalAccuracy = 0;
        for (let i = 0; i < targetWords.length; i++) {
            const wordAccuracy = this.calculateWordSimilarity(targetWords[i], spokenWords[i]);
            totalAccuracy += wordAccuracy;
            console.log(`🎤 [COMPARE] Word "${targetWords[i]}" vs "${spokenWords[i]}": ${(wordAccuracy * 100).toFixed(0)}%`);
        }

        const accuracy = totalAccuracy / targetWords.length;
        console.log(`🎤 [COMPARE] Final accuracy: ${(accuracy * 100).toFixed(0)}%`);

        let feedback = '';
        let audioFeedback = '';

        if (accuracy >= 0.9) {
            feedback = 'Excellent pronunciation!';
            audioFeedback = 'Excellent pronunciation!';
        } else if (accuracy >= 0.7) {
            feedback = 'Good! Keep practicing.';
            audioFeedback = 'Good job!';
        } else if (accuracy >= 0.5) {
            feedback = 'Try to pronounce more clearly.';
            audioFeedback = 'Try again!';
        } else {
            feedback = 'Keep practicing!';
            audioFeedback = 'Keep practicing!';
        }

        return { accuracy, feedback, audioFeedback };
    }

    calculateWordSimilarity(target, spoken) {
        // Exact match
        if (target === spoken) return 1.0;
        if (!target || !spoken) return 0.0;

        // CRITICAL: First letter must match for pronunciation
        // If user says "boot" instead of "root", it's wrong even though they're similar
        if (target.charAt(0) !== spoken.charAt(0)) {
            console.log(`🎤 [SIMILARITY] First letter mismatch: "${target[0]}" vs "${spoken[0]}" - penalizing heavily`);
            // Heavy penalty for first letter mismatch (max 40% accuracy)
            const baseSimilarity = this.calculateSimilarity(target, spoken);
            return Math.min(baseSimilarity * 0.5, 0.4);
        }

        // For short words (4 letters or less), be stricter
        // because one character = 25%+ of the word
        const baseAccuracy = this.calculateSimilarity(target, spoken);
        if (target.length <= 4) {
            // For short words, require higher base similarity
            // If base is 0.75, scaled becomes 0.75 * 0.9 = 0.675 (fails 0.7 threshold)
            const scaled = baseAccuracy * 0.9;
            console.log(`🎤 [SIMILARITY] Short word adjustment: ${(baseAccuracy * 100).toFixed(0)}% -> ${(scaled * 100).toFixed(0)}%`);
            return scaled;
        }

        return baseAccuracy;
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    isSpeechSynthesisSupported() {
        return 'speechSynthesis' in window;
    }

    isSpeechRecognitionSupported() {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }
}

const speechManager = new SpeechManager();
window.speechManager = speechManager; // Make globally accessible for game modules

// Verification log - check this appears in console to confirm new code is loaded
console.log('%c[Speech Fix v7] Loaded - fixed voice: Google UK English Male', 'color: cyan; font-weight: bold');
