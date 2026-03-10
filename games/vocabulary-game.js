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
        const audioHint = document.getElementById('vocab-audio-hint');
        if (audioHint) {
            audioHint.textContent = '';
            audioHint.classList.remove('show');
            audioHint.hidden = true;
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

        // Store question data and initialize play count
        const requiredClicks = this.clickRepeatCount || 3;
        this.currentVocabularyQuestion = question;
        this.vocabPlayCount = 0;
        this.vocabRequiredClicks = requiredClicks;
        this.vocabularyAudioPlayed = false;
        this.isManualVocabPlayPending = false;

        // Always show the initial required count as soon as the question appears.
        if (audioHint && requiredClicks > 0) {
            audioHint.textContent = `השמע עוד ${requiredClicks} ${requiredClicks === 1 ? 'פעם' : 'פעמים'}`;
            audioHint.hidden = false;
            audioHint.classList.add('show');
        }

        // Reset next button
        document.getElementById('vocab-next').style.display = 'none';

        // Enable arrow-key navigation (will work once options are revealed)
        this.enableOptionKeyboardNavigation('vocab-options');

        // Auto-play the word audio when question loads (consistent with other games)
        console.log('📢 [VOCABULARY] Auto-playing word on question load');
        try {
            await speechManager.speakWord(question.word, '', 'vocabulary');
            console.log('📢 [VOCABULARY] Auto-play complete - waiting for user plays:', requiredClicks);
        } catch (error) {
            console.error('Error auto-playing word audio:', error);
            // If auto-play fails, show full prompt
            if (audioHint) {
                audioHint.textContent = `לחץ על ההשמעה ${requiredClicks} פעמים`;
                audioHint.hidden = false;
                audioHint.classList.add('show');
            }
        }

        console.log('📢 [VOCABULARY] Question loaded successfully');
    } catch (error) {
        console.error('Error loading vocabulary question:', error);
    }
}

// Called from playCurrentQuestionAudio() after a confirmed manual play finishes.
// Tracks play count and reveals options once the required number is reached.
export function onVocabularyManualAudio() {
    this.vocabPlayCount = (this.vocabPlayCount || 0) + 1;
    const requiredClicks = this.vocabRequiredClicks || 3;
    const clicksLeft = requiredClicks - this.vocabPlayCount;

    console.log('📢 [VOCABULARY] Manual play count:', this.vocabPlayCount, '/', requiredClicks);

    const feedback = document.getElementById('vocab-feedback');
    const audioHint = document.getElementById('vocab-audio-hint');

    if (!this.vocabularyAudioPlayed) {
        if (clicksLeft > 0) {
            if (audioHint) {
                audioHint.textContent = `השמע עוד ${clicksLeft} ${clicksLeft === 1 ? 'פעם' : 'פעמים'}`;
                audioHint.hidden = false;
                audioHint.classList.add('show');
            }
        } else {
            // Required plays reached — reveal options
            if (audioHint) {
                audioHint.textContent = '';
                audioHint.hidden = true;
                audioHint.classList.remove('show');
            }
            if (feedback) {
                feedback.textContent = '';
                feedback.className = 'feedback';
            }

            const optionsContainer = document.getElementById('vocab-options');
            const optionButtons = optionsContainer?.querySelectorAll('.option-btn');
            console.log('📢 [VOCABULARY] Required plays reached - revealing', optionButtons?.length || 0, 'options');
            optionButtons?.forEach(btn => {
                btn.classList.remove('vocab-option-hidden');
                btn.disabled = false;
            });

            const firstOption = optionsContainer?.querySelector('.option-btn');
            if (firstOption) firstOption.focus();

            this.vocabularyAudioPlayed = true;
        }
    }
}

export async function checkVocabularyAnswer(selectedIndex, correctIndex) {
    const buttons = document.querySelectorAll('#vocab-options .option-btn');
    const feedback = document.getElementById('vocab-feedback');
    const audioHint = document.getElementById('vocab-audio-hint');
    const isCorrect = selectedIndex === correctIndex;

    if (audioHint) {
        audioHint.textContent = '';
        audioHint.classList.remove('show');
        audioHint.hidden = true;
    }

    // Track word attempt immediately
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'vocabulary');
    }

    // Disable all buttons
    buttons.forEach(btn => btn.disabled = true);

    if (isCorrect) {
        buttons[selectedIndex].classList.add('correct');
        // Use scoreManager to add points (persists across sessions)
        window.scoreManager.addPoints('vocabulary', 10);

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

        // Save progress immediately to prevent loss if user navigates away
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

        // Auto-advance only on correct answers after 1.5 seconds
        setTimeout(() => {
            this.loadQuestion('vocabulary');
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
