// Speech Synthesis and Recognition for English Learning Games

class SpeechManager {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.recognition = null;
        this.isRecording = false;
        this.currentRecordingReject = null;
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

        if (this.voices.length === 0) {
            this.synthesis.onvoiceschanged = () => {
                this.voices = this.synthesis.getVoices();
                this.selectVoices();
            };
        } else {
            this.selectVoices();
        }
    }

    selectVoices() {
        // Check if user has manually selected a preferred voice
        const preferredVoiceURI = localStorage.getItem('preferredVoiceURI');
        if (preferredVoiceURI) {
            const userSelectedVoice = this.voices.find(v => v.voiceURI === preferredVoiceURI);
            if (userSelectedVoice && userSelectedVoice.lang.startsWith('en')) {
                this.englishVoice = userSelectedVoice;
                console.log('Using user-selected voice:', this.englishVoice.name);
            }
        }

        // If no user preference or not found, use automatic selection
        if (!this.englishVoice) {
            // Priority list for high-quality English voices
            const preferredEnglishVoices = [
                'Samantha', // macOS - natural sounding
                'Google US English', // Chrome - high quality
                'Microsoft Zira', // Windows - clear
                'Microsoft David', // Windows - clear male
                'Alex', // macOS - high quality male
                'Karen', // macOS - clear female
            ];

            // Find all English voices
            const englishVoices = this.voices.filter(voice =>
                voice.lang.startsWith('en-US') || voice.lang.startsWith('en-GB') || voice.lang.startsWith('en')
            );

            // Try to find a preferred high-quality voice
            this.englishVoice = englishVoices.find(voice =>
                preferredEnglishVoices.some(preferred => voice.name.includes(preferred))
            );

            // If no preferred voice found, use first en-US, then en-GB, then any English
            if (!this.englishVoice) {
                this.englishVoice = englishVoices.find(v => v.lang.startsWith('en-US')) ||
                                   englishVoices.find(v => v.lang.startsWith('en-GB')) ||
                                   englishVoices[0];
            }

            // Log all available English voices for debugging
            if (englishVoices.length > 0) {
                console.log('Available English voices:', englishVoices.map(v => `${v.name} (${v.lang})`));
            }
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
        // Cancel any ongoing speech to prevent queuing/doubling
        // Unless allowOverlap is set to true (for rapid clicking in vocabulary game)
        if (!options.allowOverlap) {
            this.synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);

        // Always use English voice for consistency
        if (this.englishVoice) {
            utterance.voice = this.englishVoice;
            utterance.lang = 'en-US';
        }

        // Use browser defaults for rate, pitch, and volume

        this.synthesis.speak(utterance);

        return new Promise((resolve, reject) => {
            utterance.onend = resolve;
            utterance.onerror = (e) => {
                console.warn('Speech error:', e.error);
                resolve(); // Resolve anyway to not break game flow
            };
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

    async stopRecognitionProperly() {
        return new Promise((resolve) => {
            if (!this.recognition || !this.isRecording) {
                resolve();
                return;
            }

            // Set up one-time onend handler to know when it's fully stopped
            const onEndHandler = () => {
                this.isRecording = false;
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
                console.log('Stopping previous recognition session...');
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

            this.recognition.onresult = (event) => {
                this.currentRecordingReject = null; // Clear reject function
                const transcript = event.results[0][0].transcript.toLowerCase().trim();
                const confidence = event.results[0][0].confidence;

                resolve({
                    transcript,
                    confidence
                });
            };

            this.recognition.onerror = (event) => {
                this.isRecording = false;
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
                } else if (event.error === 'aborted') {
                    // User manually stopped - this is not an error
                    return;
                }

                reject(new Error(errorMessage));
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                // If there's still a pending reject (meaning user stopped manually), call it
                if (this.currentRecordingReject) {
                    const rejectFn = this.currentRecordingReject;
                    this.currentRecordingReject = null;
                    rejectFn(new Error('RECORDING_CANCELLED'));
                }
            };

            try {
                this.recognition.start();
            } catch (error) {
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
        try {
            this.synthesis.cancel();
            this.currentGameContext = null;
        } catch (error) {
            console.warn('Error canceling speech:', error);
        }
    }

    setGameContext(gameType) {
        this.currentGameContext = gameType;
        console.log('Speech context set to:', gameType);
    }

    comparePronunciation(target, spoken) {
        const targetWords = target.toLowerCase().split(' ');
        const spokenWords = spoken.toLowerCase().split(' ');

        if (targetWords.length !== spokenWords.length) {
            return { accuracy: 0.3, feedback: 'Word count mismatch' };
        }

        let matches = 0;
        for (let i = 0; i < targetWords.length; i++) {
            if (this.calculateSimilarity(targetWords[i], spokenWords[i]) > 0.7) {
                matches++;
            }
        }

        const accuracy = matches / targetWords.length;

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
