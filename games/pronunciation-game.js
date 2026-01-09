// Pronunciation Game Module
// Handles speech recognition and pronunciation practice

import { renderPicture } from '../utils/imageRenderer.js';

// Flag to prevent double-loading
let isLoadingQuestion = false;

// Flag to prevent concurrent recording attempts
let isProcessingRecording = false;

export async function loadPronunciationQuestion(question) {
    // Prevent double-loading
    if (isLoadingQuestion) {
        console.log('Already loading pronunciation question, skipping...');
        return;
    }

    isLoadingQuestion = true;
    console.log('Loading pronunciation question:', question);

    // Clear feedback from previous question
    const feedback = document.getElementById('pronunciation-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // Cancel any ongoing speech first
    if (window.speechManager) {
        speechManager.cancelSpeech();
    }

    // Clear and set word
    const wordElement = document.getElementById('pronunciation-word');
    if (wordElement) {
        wordElement.textContent = ''; // Clear first
        setTimeout(() => {
            wordElement.textContent = question.word;
        }, 50); // Small delay to ensure visual update
    }

    // Add picture and Hebrew translation
    const pictureElement = document.getElementById('pronunciation-picture');
    const hebrewElement = document.getElementById('pronunciation-hebrew');
    const pictureContainer = document.querySelector('#pronunciation-game .picture-container');

    // Make sure picture container is visible
    if (pictureContainer) {
        pictureContainer.style.display = 'flex';
    }

    // Render picture (image or emoji)
    if (pictureElement) {
        renderPicture(pictureElement, question);
    }
    if (hebrewElement) {
        hebrewElement.textContent = question.hebrew || '';
        hebrewElement.style.display = 'block';
    }

    // Reset recording state
    const recordBtn = document.getElementById('record-btn');
    const nextBtn = document.getElementById('pronunciation-next');

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
        await speechManager.speakWord(question.word, '', 'pronunciation');
    } catch (error) {
        console.error('Error playing word audio:', error);
    }

    console.log('Pronunciation question loaded successfully');
    isLoadingQuestion = false;
}

export async function toggleRecording() {
    const recordBtn = document.getElementById('record-btn');
    const feedback = document.getElementById('pronunciation-feedback');

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

        await this.processPronunciationResult(result);

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

export async function processPronunciationResult(result) {
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    const feedback = document.getElementById('pronunciation-feedback');

    const comparison = speechManager.comparePronunciation(question.word, result.transcript);

    // Track word attempt immediately
    const isCorrect = comparison.accuracy >= 0.7;
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'pronunciation');
    }

    // Display text feedback
    if (feedback) {
        feedback.textContent = comparison.feedback;
    }

    if (comparison.accuracy >= 0.7) {
        if (feedback) feedback.className = 'feedback correct';
        this.scores.pronunciation += Math.round(comparison.accuracy * 10);

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

        // Play audio feedback for correct answer
        try {
            if (comparison.audioFeedback) {
                await speechManager.speak(comparison.audioFeedback);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        this.updateScore('pronunciation');

        // Auto-advance on correct pronunciation after 1.5 seconds (consistent with other games)
        setTimeout(() => {
            this.nextQuestion('pronunciation');
        }, 1500);

    } else {
        if (feedback) feedback.className = 'feedback incorrect';

        // For incorrect answers: Play feedback then demo correct pronunciation
        try {
            if (comparison.audioFeedback) {
                await speechManager.speak(comparison.audioFeedback);
                // Add a pause between feedback and word repetition for clarity
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Play correct pronunciation after feedback completes
            await speechManager.speakWord(question.word, '', 'pronunciation');
        } catch (error) {
            console.error('Error playing feedback:', error);
        }

        this.updateScore('pronunciation');

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        // Show overlay Next button and disable retry to prevent getting points after wrong answer
        document.getElementById('pronunciation-next').style.display = 'block';

        // Disable record button to prevent retry
        const recordBtn = document.getElementById('record-btn');
        if (recordBtn) {
            recordBtn.disabled = true;
            recordBtn.style.opacity = '0.5';
            recordBtn.style.cursor = 'not-allowed';
        }
    }
}
