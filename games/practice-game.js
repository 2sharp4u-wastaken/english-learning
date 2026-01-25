// Practice Game Module
// Handles pronunciation practice with side-by-side comparison

import { renderPicture } from '../utils/imageRenderer.js';

// Flag to prevent double-loading
let isLoadingQuestion = false;

// Flag to prevent concurrent recording attempts
let isProcessingRecording = false;

// Store current word for playback
let currentWord = '';
let currentTranscript = '';

export async function loadPracticeQuestion(question) {
    // Prevent double-loading
    if (isLoadingQuestion) {
        console.log('Already loading practice question, skipping...');
        return;
    }

    isLoadingQuestion = true;
    console.log('Loading practice question:', question);

    // Clear feedback from previous question
    const feedback = document.getElementById('practice-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // Cancel any ongoing speech first
    if (window.speechManager) {
        speechManager.cancelSpeech();
    }

    // Store current word for playback
    currentWord = question.word;
    currentTranscript = '';

    // Clear and set word
    const wordElement = document.getElementById('practice-word');
    if (wordElement) {
        wordElement.textContent = ''; // Clear first
        setTimeout(() => {
            wordElement.textContent = question.word;
        }, 50); // Small delay to ensure visual update
    }

    // Add picture and Hebrew translation
    const pictureElement = document.getElementById('practice-picture');
    const hebrewElement = document.getElementById('practice-hebrew');

    // Render picture (image or emoji)
    if (pictureElement) {
        renderPicture(pictureElement, question);
    }
    if (hebrewElement) {
        hebrewElement.textContent = question.hebrew || '';
        hebrewElement.style.display = 'block';
    }

    // Hide comparison area from previous question
    const comparisonArea = document.getElementById('comparison-area');
    if (comparisonArea) {
        comparisonArea.style.display = 'none';
    }

    // Hide "Listen to Your Recording" button
    const listenUserBtn = document.getElementById('practice-listen-user');
    if (listenUserBtn) {
        listenUserBtn.style.display = 'none';
    }

    // Reset recording state
    const recordBtn = document.getElementById('practice-record-btn');
    const nextBtn = document.getElementById('practice-next');

    if (recordBtn) {
        recordBtn.classList.remove('recording');
        recordBtn.disabled = false;
        recordBtn.style.opacity = '';
        recordBtn.style.cursor = '';
    }
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }
    if (nextBtn) nextBtn.style.display = 'none';

    // Auto-play the word audio when question loads
    try {
        await speechManager.speakWord(question.word, '', 'practice');
    } catch (error) {
        console.error('Error playing word audio:', error);
    }

    console.log('Practice question loaded successfully');
    isLoadingQuestion = false;
}

export async function togglePracticeRecording() {
    const recordBtn = document.getElementById('practice-record-btn');
    const feedback = document.getElementById('practice-feedback');

    if (!recordBtn) {
        console.error('Record button not found');
        return;
    }

    // If already recording, stop it
    if (speechManager.isRecording) {
        console.log('Stopping recording...');
        try {
            await speechManager.stopRecording();
            recordBtn.classList.remove('recording');
            isProcessingRecording = false;
            if (feedback) {
                const fbData = getFeedback('pronunciation', 'cancelled');
                feedback.textContent = fbData.text;
                feedback.className = 'feedback';
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
        }
        return;
    }

    // Prevent concurrent recording attempts
    if (isProcessingRecording) {
        console.log('Already processing a recording, please wait...');
        return;
    }

    // Check if speech recognition is supported
    if (!speechManager.isSpeechRecognitionSupported()) {
        if (feedback) {
            const fbData = getFeedback('errors', 'speechNotSupported');
            feedback.textContent = fbData.text;
            feedback.className = 'feedback incorrect';
        }
        return;
    }

    // Start recording
    try {
        isProcessingRecording = true;

        // Cancel any ongoing speech first to avoid conflicts
        speechManager.cancelSpeech();

        // Wait a bit for speech to fully stop
        await new Promise(resolve => setTimeout(resolve, 100));

        recordBtn.classList.add('recording');

        if (feedback) {
            const fbData = getFeedback('pronunciation', 'recording');
            feedback.textContent = fbData.text;
            feedback.className = 'feedback';
        }

        const result = await speechManager.startRecording();

        recordBtn.classList.remove('recording');

        await this.processPracticeResult(result);

    } catch (error) {
        recordBtn.classList.remove('recording');

        // Don't show error if recording was cancelled by user
        if (error.message === 'RECORDING_CANCELLED') {
            console.log('Recording was cancelled by user');
            if (feedback) {
                feedback.textContent = '';
                feedback.className = 'feedback';
            }
        } else {
            if (feedback) {
                const fbData = getFeedback('errors', 'recordingFailed');
                feedback.textContent = fbData.text;
                feedback.className = 'feedback incorrect';
            }
            console.error('Recording error:', error);
        }
    } finally {
        isProcessingRecording = false;
    }
}

export async function processPracticeResult(result) {
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    const feedback = document.getElementById('practice-feedback');

    // Store transcript for playback
    currentTranscript = result.transcript || '';

    const comparison = speechManager.comparePronunciation(question.word, result.transcript);

    // Track word attempt immediately
    const isCorrect = comparison.accuracy >= 0.7;
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'practice');
    }

    // Show comparison area
    const comparisonArea = document.getElementById('comparison-area');
    if (comparisonArea) {
        comparisonArea.style.display = 'block';
    }

    // Update comparison text
    const targetEl = document.getElementById('comparison-target');
    const userEl = document.getElementById('comparison-user');
    const scoreEl = document.querySelector('.accuracy-score .score-percentage');

    if (targetEl) {
        targetEl.textContent = question.word;
    }
    if (userEl) {
        userEl.textContent = result.transcript || '(not recognized)';
        // Color-code based on accuracy
        userEl.classList.remove('match', 'mismatch');
        if (comparison.accuracy >= 0.9) {
            userEl.classList.add('match'); // Green for excellent match
        } else if (comparison.accuracy < 0.7) {
            userEl.classList.add('mismatch'); // Red for poor match
        }
        // Default styling (no class) for intermediate accuracy
    }
    if (scoreEl) {
        scoreEl.textContent = `${Math.round(comparison.accuracy * 100)}%`;
    }

    // Display text feedback
    if (feedback) {
        feedback.textContent = comparison.feedback;
    }

    // Auto-play native pronunciation after showing comparison
    try {
        await speechManager.speakWord(question.word, '', 'practice');
    } catch (error) {
        console.error('Error playing native pronunciation:', error);
    }

    // Enable "Listen to Your Recording" button
    const listenUserBtn = document.getElementById('practice-listen-user');
    if (listenUserBtn) {
        listenUserBtn.style.display = 'inline-block';
    }

    if (comparison.accuracy >= 0.7) {
        if (feedback) feedback.className = 'feedback correct';
        this.scores.practice += Math.round(comparison.accuracy * 10);

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

        // Save progress immediately to prevent loss if user navigates away
        this.currentQuestionIndex++;
        this.saveGameState();

        this.updateScore('practice');

        // Auto-advance on correct pronunciation after 2 seconds
        setTimeout(() => {
            this.loadQuestion('practice');
        }, 2000);

    } else {
        if (feedback) feedback.className = 'feedback incorrect';

        this.updateScore('practice');

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        // Show overlay Next button and disable retry to prevent getting points after wrong answer
        document.getElementById('practice-next').style.display = 'block';

        // Disable record button to prevent retry
        const recordBtn = document.getElementById('practice-record-btn');
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
            recordBtn.style.cursor = 'not-allowed';
        }
    }
}

export async function playNativePronunciation() {
    if (!currentWord) {
        console.error('No current word to play');
        return;
    }

    try {
        // Cancel any ongoing speech first
        speechManager.cancelSpeech();
        await new Promise(resolve => setTimeout(resolve, 100));

        await speechManager.speakWord(currentWord, '', 'practice');
    } catch (error) {
        console.error('Error playing native pronunciation:', error);
    }
}

export async function playUserPronunciation() {
    if (!currentTranscript) {
        console.error('No user transcript to play');
        return;
    }

    try {
        // Cancel any ongoing speech first
        speechManager.cancelSpeech();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Play the user's transcript via TTS
        await speechManager.speak(currentTranscript);
    } catch (error) {
        console.error('Error playing user pronunciation:', error);
    }
}
