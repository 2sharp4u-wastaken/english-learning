// ABC Game Module
// Teaches uppercase and lowercase letters through multiple activity types

export async function loadABCQuestion(question) {
    try {
        console.log('[ABC] loadABCQuestion called');
        console.log('[ABC] Question type:', question.type);
        console.log('[ABC] Question:', question);

        // Cancel any ongoing speech from previous question
        if (typeof speechManager !== 'undefined') {
            speechManager.cancelSpeech();
        }

        // IMMEDIATELY hide next button to prevent double-clicks
        const nextButton = document.getElementById('abc-next');
        if (nextButton) {
            nextButton.style.display = 'none';
        }

        // Clear feedback from previous question
        const feedback = document.getElementById('abc-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback';
        }

        // Get UI elements
        const letterDisplay = document.getElementById('abc-letter-display');
        const instructionElement = document.getElementById('abc-instruction');
        const optionsContainer = document.getElementById('abc-options');
        const audioBtn = document.getElementById('abc-audio');

        if (!letterDisplay || !optionsContainer) {
            console.error('Required ABC game elements not found');
            return;
        }

        // Store current question for reference
        this.currentABCQuestion = question;
        this.abcAudioPlayed = false;

        // Reset display state between questions
        const pictureContainer = document.getElementById('abc-picture-container');
        if (pictureContainer) {
            pictureContainer.style.display = 'none';
        }
        letterDisplay.style.display = '';

        // Safety check for malformed question
        if (!question || !question.type) {
            console.error('Invalid ABC question:', question);
            return; // Skip this question
        }

        // Configure UI based on question type
        switch (question.type) {
            case 'match-case':
                await this.loadMatchCaseQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            case 'letter-sound':
                await this.loadLetterSoundQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            case 'identify-case':
                await this.loadIdentifyCaseQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            case 'say-letter':
                await this.loadSayLetterQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            case 'alphabet-order':
                await this.loadAlphabetOrderQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            case 'word-picture':
                await this.loadWordPictureQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn);
                break;
            default:
                console.error('Unknown ABC question type:', question.type);
        }

        // Enable arrow-key navigation
        this.enableOptionKeyboardNavigation('abc-options');

        console.log('[ABC] Question loaded successfully');
    } catch (error) {
        console.error('Error loading ABC question:', error);
    }
}

// Helper function to speak just the letter name
async function speakLetter(phonetic) {
    if (typeof speechManager !== 'undefined') {
        try {
            await speechManager.speak(phonetic);
        } catch (error) {
            console.error('Error speaking letter:', error);
        }
    }
}

// Helper function for Match Case questions
export async function loadMatchCaseQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Display the letter prominently
    letterDisplay.textContent = question.letter;
    letterDisplay.className = 'abc-letter-display ' + (question.isUppercase ? 'uppercase' : 'lowercase');

    // Show instruction
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Show audio button for replay
    if (audioBtn) {
        audioBtn.style.display = '';
    }

    // Create options (hidden initially until audio plays)
    this.createABCOptions(question.options, question.correct, optionsContainer, false);

    // Auto-play the letter sound
    try {
        await speakLetter(question.phonetic);
        this.abcAudioPlayed = true;

        // Reveal options after audio plays
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });

        // Focus first option
        const firstOption = optionsContainer.querySelector('.option-btn');
        if (firstOption) firstOption.focus();
    } catch (error) {
        console.error('Error playing letter sound:', error);
        // Show options anyway if audio fails
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });
    }
}

// Helper function for Letter Sound questions
export async function loadLetterSoundQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Show question mark or speaker icon initially
    letterDisplay.textContent = '?';
    letterDisplay.className = 'abc-letter-display listening-mode';

    // Show instruction
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Show and enable audio button
    if (audioBtn) {
        audioBtn.style.display = '';
    }

    // Create options (hidden initially until audio plays)
    this.createABCOptions(question.options, question.correct, optionsContainer, false);

    // Auto-play the letter sound
    try {
        await speakLetter(question.phonetic);
        this.abcAudioPlayed = true;

        // Reveal options after audio plays
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });

        // Focus first option
        const firstOption = optionsContainer.querySelector('.option-btn');
        if (firstOption) firstOption.focus();
    } catch (error) {
        console.error('Error playing letter sound:', error);
        // Show options anyway if audio fails
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });
    }
}

// Helper function for Identify Case questions
export async function loadIdentifyCaseQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Display the letter prominently
    letterDisplay.textContent = question.letter;
    letterDisplay.className = 'abc-letter-display ' + (question.isUppercase ? 'uppercase' : 'lowercase');

    // Show instruction
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Show audio button for replay
    if (audioBtn) {
        audioBtn.style.display = '';
    }

    // Create options (hidden initially until audio plays)
    this.createABCOptions(question.options, question.correct, optionsContainer, false);

    // Auto-play the letter sound
    try {
        await speakLetter(question.phonetic);
        this.abcAudioPlayed = true;

        // Reveal options after audio plays
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });

        // Focus first option
        const firstOption = optionsContainer.querySelector('.option-btn');
        if (firstOption) firstOption.focus();
    } catch (error) {
        console.error('Error playing letter sound:', error);
        // Show options anyway if audio fails
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });
    }
}

// Helper function for Say Letter questions (voice recording)
export async function loadSayLetterQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Display both cases (Aa format)
    letterDisplay.textContent = question.letter;
    letterDisplay.className = 'abc-letter-display both-cases';

    // Show instruction
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Hide audio button (user needs to say it, not hear it first)
    if (audioBtn) {
        audioBtn.style.display = 'none';
    }

    // Hide options container and show record button instead
    optionsContainer.innerHTML = '';
    optionsContainer.style.display = 'flex';
    optionsContainer.style.justifyContent = 'center';

    // Create record button
    const recordBtn = document.createElement('button');
    recordBtn.id = 'abc-record-btn';
    recordBtn.className = 'record-btn abc-record-btn';
    recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    recordBtn.setAttribute('aria-label', 'Record your voice');

    recordBtn.addEventListener('click', () => {
        this.toggleABCRecording();
    });

    optionsContainer.appendChild(recordBtn);

    // Focus the record button
    recordBtn.focus();
}

// Helper function for Alphabet Order questions
export async function loadAlphabetOrderQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Display both cases (Aa format)
    letterDisplay.textContent = question.letter;
    letterDisplay.className = 'abc-letter-display both-cases';

    // Show instruction (includes the question about what comes before/after)
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Show audio button for replay
    if (audioBtn) {
        audioBtn.style.display = '';
    }

    // Create options (hidden initially until audio plays)
    this.createABCOptions(question.options, question.correct, optionsContainer, false);

    // Auto-play the letter sound
    try {
        await speakLetter(question.phonetic);
        this.abcAudioPlayed = true;

        // Reveal options after audio plays
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });

        // Focus first option
        const firstOption = optionsContainer.querySelector('.option-btn');
        if (firstOption) firstOption.focus();
    } catch (error) {
        console.error('Error playing letter sound:', error);
        // Show options anyway if audio fails
        const optionButtons = optionsContainer.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => {
            btn.classList.remove('abc-option-hidden');
            btn.disabled = false;
        });
    }
}

// Helper function for Word-Picture questions
export async function loadWordPictureQuestion(question, letterDisplay, instructionElement, optionsContainer, audioBtn) {
    // Show picture container
    const pictureContainer = document.getElementById('abc-picture-container');
    const pictureElement = document.getElementById('abc-picture');
    const wordDisplay = document.getElementById('abc-word-display');

    if (pictureContainer) {
        pictureContainer.style.display = 'flex';
    }
    if (pictureElement) {
        pictureElement.textContent = question.emoji;
    }
    if (wordDisplay) {
        // Hide word text - showing it would reveal the answer!
        wordDisplay.style.display = 'none';
    }

    // Hide the large letter display for this question type
    letterDisplay.style.display = 'none';

    // Show instruction
    if (instructionElement) {
        instructionElement.textContent = question.instruction;
    }

    // Show audio button for word pronunciation
    if (audioBtn) {
        audioBtn.style.display = '';
    }

    // Create options (show immediately for this type)
    this.createABCOptions(question.options, question.correct, optionsContainer, true);

    // Auto-play the word
    try {
        await speechManager.speakWord(question.displayWord, '', 'abc');
        this.abcAudioPlayed = true;

        // Focus first option
        const firstOption = optionsContainer.querySelector('.option-btn');
        if (firstOption) firstOption.focus();
    } catch (error) {
        console.error('Error playing word audio:', error);
    }
}

// Reset visibility of ABC elements (called before each question)
function resetABCDisplay() {
    const pictureContainer = document.getElementById('abc-picture-container');
    const letterDisplay = document.getElementById('abc-letter-display');

    if (pictureContainer) {
        pictureContainer.style.display = 'none';
    }
    if (letterDisplay) {
        letterDisplay.style.display = '';
    }
}

// Flag to prevent concurrent recording attempts
let isProcessingABCRecording = false;

// Toggle recording for say-letter questions
export async function toggleABCRecording() {
    const recordBtn = document.getElementById('abc-record-btn');
    const feedback = document.getElementById('abc-feedback');

    if (!recordBtn) {
        console.error('ABC Record button not found');
        return;
    }

    // If already recording, stop it
    if (speechManager.isRecording) {
        console.log('Stopping ABC recording...');
        try {
            await speechManager.stopRecording();
            recordBtn.classList.remove('recording');
            isProcessingABCRecording = false;
            if (feedback) {
                feedback.textContent = 'ההקלטה בוטלה';
                feedback.className = 'feedback';
            }
        } catch (error) {
            console.error('Error stopping ABC recording:', error);
        }
        return;
    }

    // Prevent concurrent recording attempts
    if (isProcessingABCRecording) {
        console.log('Already processing ABC recording, please wait...');
        return;
    }

    // Check if speech recognition is supported
    if (!speechManager.isSpeechRecognitionSupported()) {
        if (feedback) {
            feedback.textContent = 'זיהוי קול אינו נתמך בדפדפן זה';
            feedback.className = 'feedback incorrect';
        }
        return;
    }

    // Start recording
    try {
        isProcessingABCRecording = true;

        // Cancel any ongoing speech first
        speechManager.cancelSpeech();

        await new Promise(resolve => setTimeout(resolve, 100));

        recordBtn.classList.add('recording');

        if (feedback) {
            feedback.textContent = 'מקשיב... אמור את שם האות';
            feedback.className = 'feedback';
        }

        const result = await speechManager.startRecording();

        recordBtn.classList.remove('recording');

        await this.processABCSpeechResult(result);

    } catch (error) {
        recordBtn.classList.remove('recording');

        if (error.message === 'RECORDING_CANCELLED') {
            console.log('ABC Recording was cancelled by user');
            if (feedback) {
                feedback.textContent = '';
                feedback.className = 'feedback';
            }
        } else {
            if (feedback) {
                feedback.textContent = 'שגיאה בהקלטה, נסה שוב';
                feedback.className = 'feedback incorrect';
            }
            console.error('ABC Recording error:', error);
        }
    } finally {
        isProcessingABCRecording = false;
    }
}

// Process speech recognition result for say-letter questions
export async function processABCSpeechResult(result) {
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    const feedback = document.getElementById('abc-feedback');
    const recordBtn = document.getElementById('abc-record-btn');

    // Normalize the transcript and expected letter name
    const transcript = (result.transcript || '').toLowerCase().trim();
    const expectedPhonetic = question.phonetic.toLowerCase();
    const expectedLetter = question.letterUpper.toLowerCase();

    console.log('[ABC Speech] Transcript:', transcript);
    console.log('[ABC Speech] Expected phonetic:', expectedPhonetic);
    console.log('[ABC Speech] Expected letter:', expectedLetter);

    // Check if the spoken word matches the letter name or phonetic
    // Be lenient - accept the letter name, phonetic, or close matches
    const isCorrect = transcript.includes(expectedPhonetic) ||
                      transcript.includes(expectedLetter) ||
                      expectedPhonetic.includes(transcript) ||
                      (transcript.length > 0 && levenshteinDistance(transcript, expectedPhonetic) <= 2);

    // Track letter attempt for mastery
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'abc');
    }

    if (isCorrect) {
        // Use scoreManager to add points (persists across sessions)
        window.scoreManager.addPoints('abc', 10);

        // Trigger confetti if enabled
        try {
            const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
            if (settings && settings.showConfetti && typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700']
                });
            }
        } catch (error) {
            console.error('Error triggering confetti:', error);
        }

        const fbData = getFeedback('abc', 'correct');

        if (feedback) {
            feedback.textContent = `${fbData.text} (שמעתי: "${transcript}")`;
            feedback.className = 'feedback correct';
        }

        // Disable record button
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
        }

        // Save progress
        this.currentQuestionIndex++;
        this.saveGameState();

        // Audio feedback
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        this.updateScore('abc');

        // Auto-advance after 1.5 seconds
        setTimeout(() => {
            this.loadQuestion('abc');
        }, 1500);

    } else {
        const fbData = getFeedback('abc', 'incorrect');

        if (feedback) {
            feedback.textContent = `${fbData.text} (שמעתי: "${transcript || 'לא זוהה'}", הצפוי: "${question.phonetic}")`;
            feedback.className = 'feedback incorrect';
        }

        // Disable record button
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
        }

        // Audio feedback then correct pronunciation
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            // Play the correct letter name
            await speakLetter(question.phonetic);
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Save progress
        this.currentQuestionIndex++;
        this.saveGameState();

        this.updateScore('abc');

        // Show Next button
        document.getElementById('abc-next').style.display = 'block';
    }
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}

// Create option buttons for ABC questions
export function createABCOptions(options, correctIndex, optionsContainer, showImmediately = true) {
    optionsContainer.innerHTML = '';
    optionsContainer.style.display = 'grid';

    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn abc-option' + (showImmediately ? '' : ' abc-option-hidden');
        button.textContent = option;
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        button.disabled = !showImmediately;

        button.addEventListener('click', () => {
            this.checkABCAnswer(index, correctIndex);
        });

        button.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                button.click();
            }
        });

        optionsContainer.appendChild(button);
    });
}

export async function checkABCAnswer(selectedIndex, correctIndex) {
    const buttons = document.querySelectorAll('#abc-options .option-btn');
    const feedback = document.getElementById('abc-feedback');
    const isCorrect = selectedIndex === correctIndex;

    const question = this.shuffledQuestions[this.currentQuestionIndex];

    // Track letter attempt for mastery (using word/category fields)
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'abc');
    }

    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);

    if (isCorrect) {
        buttons[selectedIndex].classList.add('correct');
        window.scoreManager.addPoints('abc', 10);

        // Trigger confetti if enabled
        try {
            const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
            if (settings && settings.showConfetti && typeof confetti !== 'undefined') {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#667eea', '#764ba2', '#4facfe', '#00f2fe', '#ffd700']
                });
            }
        } catch (error) {
            console.error('Error triggering confetti:', error);
        }

        // Get centralized feedback
        const fbData = getFeedback('abc', 'correct');

        if (feedback) {
            feedback.textContent = fbData.text;
            feedback.className = 'feedback correct';
        }

        // Save progress
        this.currentQuestionIndex++;
        this.saveGameState();

        // Audio feedback
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Auto-advance after 1.5 seconds
        setTimeout(() => {
            this.loadQuestion('abc');
        }, 1500);
    } else {
        buttons[selectedIndex].classList.add('incorrect');
        buttons[correctIndex].classList.add('correct');

        // Get centralized feedback
        const fbData = getFeedback('abc', 'incorrect');

        if (feedback) {
            feedback.textContent = fbData.text;
            feedback.className = 'feedback incorrect';
        }

        // Audio feedback
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Increment question index
        this.currentQuestionIndex++;
        this.saveGameState();

        // Show Next button for manual advancement
        document.getElementById('abc-next').style.display = 'block';
    }

    this.updateScore('abc');
}

// Play ABC letter audio (for replay button)
export async function playABCLetterAudio() {
    const question = this.currentABCQuestion;
    if (!question) return;

    try {
        // For word-picture questions, play the word instead of just the letter
        if (question.type === 'word-picture' && question.displayWord) {
            await speechManager.speakWord(question.displayWord, '', 'abc');
        } else if (question.phonetic) {
            await speakLetter(question.phonetic);
        }

        // If first play, reveal options
        if (!this.abcAudioPlayed) {
            this.abcAudioPlayed = true;
            const optionsContainer = document.getElementById('abc-options');
            const optionButtons = optionsContainer?.querySelectorAll('.option-btn');
            optionButtons?.forEach(btn => {
                btn.classList.remove('abc-option-hidden');
                btn.disabled = false;
            });

            // Focus first option
            const firstOption = optionsContainer?.querySelector('.option-btn');
            if (firstOption) firstOption.focus();
        }
    } catch (error) {
        console.error('Error playing ABC audio:', error);
    }
}

// Reset all letter mastery data for ABC game
export function resetABCMastery() {
    if (!window.app || !window.app.userProgress || !window.app.userProgress.wordMastery) {
        console.warn('Cannot reset ABC mastery: app not initialized');
        return false;
    }

    const wordMastery = window.app.userProgress.wordMastery;
    let resetCount = 0;

    // Find and delete all ABC letter mastery entries (format: "A_abc", "B_abc", etc.)
    Object.keys(wordMastery).forEach(key => {
        if (key.endsWith('_abc') && key.length <= 6) { // Single letter + "_abc"
            delete wordMastery[key];
            resetCount++;
        }
    });

    // Save the updated progress
    window.app.saveUserProgress();

    console.log(`[ABC] Reset mastery for ${resetCount} letters`);
    return true;
}
