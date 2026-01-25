// Listening Game Module
// Handles listening comprehension with audio-first approach

import { renderPicture } from '../utils/imageRenderer.js';

export async function loadListeningQuestion(question) {
    console.log('📢 [LISTENING] loadListeningQuestion called');
    console.log('📢 [LISTENING] Question:', question.word, '| Options:', question.options);

    // Cancel any ongoing speech from previous question
    if (typeof speechManager !== 'undefined') {
        speechManager.cancelSpeech();
    }

    // Hide next button from previous question
    const nextBtn = document.getElementById('listening-next');
    if (nextBtn) {
        nextBtn.style.display = 'none';
    }

    // Clear feedback from previous question
    const feedback = document.getElementById('listening-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // IMMEDIATELY clear previous Hebrew word display to prevent overlap
    const hebrewElement = document.getElementById('listening-hebrew');
    if (hebrewElement) {
        hebrewElement.textContent = '';
        hebrewElement.style.display = 'none';
    }

    const optionsContainer = document.getElementById('listening-options');
    optionsContainer.innerHTML = '';

    // Use pre-shuffled options from question data (no need to shuffle again!)
    const options = question.options;
    const correctIndex = question.correct;

    // Safety check: ensure options exist
    if (!options || !Array.isArray(options)) {
        console.error('Listening question missing options:', question);
        return;
    }

    console.log('📢 [LISTENING] Creating', options.length, 'option buttons (hidden initially)');
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn listening-option-hidden'; // Hidden initially
        button.textContent = option;
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        button.disabled = true; // Disabled until audio finishes
        console.log('📢 [LISTENING] Option', index, ':', option, '- disabled:', button.disabled);
        button.addEventListener('click', () => {
            this.checkListeningAnswer(index, correctIndex);
        });
        button.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                button.click();
            }
        });
        optionsContainer.appendChild(button);
    });

    // The old "playsRemaining" logic has been removed from here.

    // Add picture and show Hebrew translation immediately
    const pictureElement = document.getElementById('listening-picture');

    // Render picture (image or emoji)
    if (pictureElement) {
        renderPicture(pictureElement, question);
    }
    if (hebrewElement) {
        hebrewElement.textContent = question.hebrew || '';
        hebrewElement.style.display = 'block'; // Show immediately
    }

    // Show prompt to click play button (no auto-play due to browser restrictions)
    if (feedback) {
        feedback.textContent = '🔊 לחץ על כפתור ההשמעה כדי לשמוע את המילה';
        feedback.className = 'feedback listening-prompt';
    }

    // Store question data for manual playback
    this.currentListeningQuestion = question;
    this.listeningAudioPlayed = false;
    console.log('📢 [LISTENING] listeningAudioPlayed flag set to FALSE - options hidden until audio plays');

    // Don't auto-play audio (Chrome blocks it) - wait for user to click play button
    // Audio will play when user clicks the listening-audio button

    // Reset next button
    document.getElementById('listening-next').style.display = 'none';

    // Enable arrow-key navigation
    this.enableOptionKeyboardNavigation('listening-options');

    console.log('📢 [LISTENING] Question loaded - waiting for user to click play button');
}

export function showListeningHebrew() {
    const hebrewElement = document.getElementById('listening-hebrew');
    if (hebrewElement && hebrewElement.textContent) {
        hebrewElement.style.display = 'block';
    }
}

export async function checkListeningAnswer(selectedIndex, correctIndex) {
    const options = document.querySelectorAll('#listening-options .option-btn');
    const feedback = document.getElementById('listening-feedback');

    // Track word attempt immediately
    const isCorrect = selectedIndex === correctIndex;
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'listening');
    }

    // Disable all options
    options.forEach(btn => btn.disabled = true);

    if (selectedIndex === correctIndex) {
        options[selectedIndex].classList.add('correct');

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
        const fbData = getFeedback('listening', 'correct');

        feedback.textContent = fbData.text;
        feedback.className = 'feedback correct';
        console.log('🏆 [LISTENING] Before score increment:', this.scores.listening);
        this.scores.listening += 10;
        console.log('🏆 [LISTENING] After score increment:', this.scores.listening);

        // Audio feedback for correct answer
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        setTimeout(() => {
            this.nextQuestion('listening');
        }, 1500);
    } else {
        options[selectedIndex].classList.add('incorrect');
        options[correctIndex].classList.add('correct');

        // Get centralized feedback
        const fbData = getFeedback('listening', 'incorrect');

        feedback.textContent = fbData.text;
        feedback.className = 'feedback incorrect';

        // Audio feedback for incorrect answer and play correct word
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
            // Play the correct word again immediately after feedback
            const question = this.shuffledQuestions[this.currentQuestionIndex];
            await speechManager.speakWord(question.word, '', 'listening');
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        document.getElementById('listening-next').style.display = 'block';
    }

    this.updateScore('listening');
}
