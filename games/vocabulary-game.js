// Vocabulary Game Module
// Handles vocabulary learning with audio-first approach (like listening game)

export async function loadVocabularyQuestion(question) {
    try {
        console.log('📢 [VOCABULARY] loadVocabularyQuestion called');
        console.log('📢 [VOCABULARY] Question:', question.word, '| Options:', question.options);

        // Cancel any ongoing speech from previous question
        if (typeof speechManager !== 'undefined') {
            speechManager.cancelSpeech();
        }

        // IMMEDIATELY hide next button to prevent double-clicks
        const nextButton = document.getElementById('vocab-next');
        if (nextButton) {
            nextButton.style.display = 'none';
        }

        // Clear feedback from previous question
        const feedback = document.getElementById('vocab-feedback');
        if (feedback) {
            feedback.textContent = '';
            feedback.className = 'feedback';
        }

        // Check if required elements exist
        const wordElement = document.getElementById('vocab-word');
        const pictureElement = document.getElementById('vocab-picture');
        const hebrewElement = document.getElementById('vocab-hebrew');
        const optionsContainer = document.getElementById('vocab-options');

        if (!wordElement || !optionsContainer) {
            console.error('Required vocabulary game elements not found');
            return;
        }

        // Set up word display (remove click styling - no longer clickable)
        wordElement.textContent = question.word;
        wordElement.style.cursor = 'default';
        wordElement.style.userSelect = 'none';
        wordElement.style.padding = '15px';
        wordElement.style.border = 'none';
        wordElement.style.borderRadius = '10px';

        // HIDE picture (user requested it not show)
        if (pictureElement) {
            const pictureContainer = pictureElement.closest('.picture-container');
            if (pictureContainer) {
                pictureContainer.style.display = 'none';
            }
        }

        // Clear any existing instruction elements to prevent duplicates
        const existingInstructions = wordElement.parentNode.querySelectorAll('.vocab-instruction');
        existingInstructions.forEach(el => el.remove());

        // HIDE Hebrew translation - it's one of the answer options, showing it gives away the answer!
        if (hebrewElement) {
            hebrewElement.textContent = '';
            hebrewElement.style.display = 'none';
        }

        // Create options (hidden initially)
        optionsContainer.innerHTML = '';
        optionsContainer.style.display = 'grid';

        const options = question.options;
        const correctIndex = question.correct;

        console.log('📢 [VOCABULARY] Creating', options.length, 'option buttons (hidden initially)');
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn vocab-option-hidden'; // Hidden initially
            button.textContent = option;
            button.setAttribute('role', 'button');
            button.tabIndex = 0;
            button.disabled = true; // Disabled until audio plays
            console.log('📢 [VOCABULARY] Option', index, ':', option, '- disabled:', button.disabled);
            button.addEventListener('click', () => {
                this.checkVocabularyAnswer(index, correctIndex);
            });
            button.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    button.click();
                }
            });
            optionsContainer.appendChild(button);
        });

        // Show prompt to click play button (same as listening game)
        if (feedback) {
            feedback.textContent = '🔊 לחץ על כפתור ההשמעה כדי לשמוע את המילה';
            feedback.className = 'feedback vocab-prompt';
        }

        // Store question data and flag for audio playback
        this.currentVocabularyQuestion = question;
        this.vocabularyAudioPlayed = false;
        console.log('📢 [VOCABULARY] vocabularyAudioPlayed flag set to FALSE - options hidden until audio plays');

        // Don't auto-play audio - wait for user to click play button
        // Reset next button
        document.getElementById('vocab-next').style.display = 'none';

        // Enable arrow-key navigation (will work once options are revealed)
        this.enableOptionKeyboardNavigation('vocab-options');

        console.log('📢 [VOCABULARY] Question loaded - waiting for user to click play button');
    } catch (error) {
        console.error('Error loading vocabulary question:', error);
    }
}

export async function checkVocabularyAnswer(selectedIndex, correctIndex) {
    const buttons = document.querySelectorAll('#vocab-options .option-btn');
    const feedback = document.getElementById('vocab-feedback');
    const isCorrect = selectedIndex === correctIndex;

    // Track word attempt immediately
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'vocabulary');
    }

    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);

    if (isCorrect) {
        buttons[selectedIndex].classList.add('correct');
        console.log('🏆 [VOCABULARY] Before score increment:', this.scores.vocabulary);
        this.scores.vocabulary += 10;
        console.log('🏆 [VOCABULARY] After score increment:', this.scores.vocabulary);

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
        const fbData = getFeedback('vocabulary', 'correct');

        if (feedback) {
            feedback.textContent = fbData.text;
            feedback.className = 'feedback correct';
        }

        // Audio feedback
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Auto-advance only on correct answers after 1.5 seconds
        setTimeout(() => {
            this.nextQuestion('vocabulary');
        }, 1500);
    } else {
        buttons[selectedIndex].classList.add('incorrect');
        buttons[correctIndex].classList.add('correct');

        // Get centralized feedback
        const fbData = getFeedback('vocabulary', 'incorrect');

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

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        // Show Next button for manual advancement on wrong answers
        document.getElementById('vocab-next').style.display = 'block';
    }

    this.updateScore('vocabulary');
}
