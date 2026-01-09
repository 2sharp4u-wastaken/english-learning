// Vocabulary Game Module
// Handles vocabulary learning with click-to-hear mechanic

export async function loadVocabularyQuestion(question) {
    try {
        console.log('Loading vocabulary question:', question);

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

        // Initialize click counter for this question
        let wordClickCount = 0;
        const requiredClicks = this.clickRepeatCount || 3;

        // Remove all previous event listeners by cloning and replacing the element
        const newWordElement = wordElement.cloneNode(true);
        wordElement.parentNode.replaceChild(newWordElement, wordElement);
        // Update reference to point to the new element
        const cleanWordElement = document.getElementById('vocab-word');

        // Set up word display
        cleanWordElement.textContent = question.word;
        cleanWordElement.style.cursor = 'pointer';
        cleanWordElement.style.userSelect = 'none';
        cleanWordElement.style.padding = '15px';
        cleanWordElement.style.border = '3px dashed #667eea';
        cleanWordElement.style.borderRadius = '10px';
        cleanWordElement.style.transition = 'all 0.3s ease';

        // HIDE picture (user requested it not show)
        if (pictureElement) {
            const pictureContainer = pictureElement.closest('.picture-container');
            if (pictureContainer) {
                pictureContainer.style.display = 'none';
            }
        }

        // Clear any existing instruction elements to prevent duplicates
        const existingInstructions = cleanWordElement.parentNode.querySelectorAll('.vocab-instruction');
        existingInstructions.forEach(el => el.remove());

        // HIDE Hebrew translation - it's one of the answer options, showing it gives away the answer!
        if (hebrewElement) {
            hebrewElement.textContent = '';
            hebrewElement.style.display = 'none';
        }

        // Show instruction directly after the word (with class to identify and remove later)
        const instructionEl = document.createElement('div');
        instructionEl.className = 'vocab-instruction';
        instructionEl.style.fontSize = '1em';
        instructionEl.style.color = '#667eea';
        instructionEl.style.fontWeight = 'bold';
        instructionEl.style.marginTop = '15px';
        instructionEl.textContent = `לחץ על המילה ${requiredClicks} פעמים כדי לשמוע אותה ולחשוף את התשובות!`;
        // Insert after the word element
        if (cleanWordElement.nextSibling) {
            cleanWordElement.parentNode.insertBefore(instructionEl, cleanWordElement.nextSibling);
        } else {
            cleanWordElement.parentNode.appendChild(instructionEl);
        }

        // Hide options initially (they'll show after 3 clicks)
        optionsContainer.style.display = 'none';
        optionsContainer.innerHTML = '';

        // Auto-play ONCE when question loads
        try {
            await speechManager.speakWord(question.word, '', 'vocabulary');
        } catch (error) {
            console.error('Error playing initial word audio:', error);
        }

        // Flag to prevent clicks while audio is playing
        let isPlayingAudio = false;

        // Create click handler for word repetition
        const handleWordClick = async () => {
            // Prevent clicking while audio is playing
            if (isPlayingAudio) {
                console.log('Audio is playing, please wait...');
                return;
            }

            // Set flag and visual feedback
            isPlayingAudio = true;
            cleanWordElement.style.cursor = 'wait';

            wordClickCount++;

            // Visual feedback for click
            cleanWordElement.style.transform = 'scale(1.1)';
            setTimeout(() => {
                cleanWordElement.style.transform = 'scale(1)';
            }, 200);

            // Play word and wait for completion
            try {
                await speechManager.speakWord(question.word, '', 'vocabulary');
            } catch (error) {
                console.error('Error playing word audio:', error);
            }

            // Re-enable clicking after audio finishes
            isPlayingAudio = false;
            cleanWordElement.style.cursor = 'pointer';

            // Update instruction
            const currentInstruction = cleanWordElement.parentNode.querySelector('.vocab-instruction');
            if (currentInstruction) {
                const clicksLeft = requiredClicks - wordClickCount;
                if (clicksLeft > 0) {
                    currentInstruction.textContent = `מצוין! עוד ${clicksLeft} ${clicksLeft === 1 ? 'פעם' : 'פעמים'}...`;
                    currentInstruction.style.color = '#667eea';
                } else {
                    currentInstruction.textContent = 'כל הכבוד! עכשיו בחר את התרגום הנכון:';
                    currentInstruction.style.color = '#4caf50'; // Green for completion
                }
            }

            // After 3 clicks, show options
            if (wordClickCount >= requiredClicks) {
                // Remove click handler
                cleanWordElement.removeEventListener('click', handleWordClick);
                cleanWordElement.style.cursor = 'default';
                cleanWordElement.style.border = 'none';

                // Use requestAnimationFrame to ensure clean render cycle
                requestAnimationFrame(() => {
                    // Clear options container
                    optionsContainer.innerHTML = '';

                    // Use pre-shuffled options from question data (no need to shuffle again!)
                    const options = question.options;
                    const correctIndex = question.correct;

                    // Create and append buttons
                    options.forEach((option, index) => {
                        const button = document.createElement('button');
                        button.className = 'option-btn';
                        button.textContent = option;
                        button.setAttribute('role', 'button');
                        button.tabIndex = 0;
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

                    // Show options container
                    optionsContainer.style.display = 'grid';

                    // Enable arrow-key navigation
                    this.enableOptionKeyboardNavigation('vocab-options');

                    // Move focus to first option for accessibility
                    const firstOption = optionsContainer.querySelector('.option-btn');
                    if (firstOption) firstOption.focus();
                });
            }
        };

        // Add click listener to word
        cleanWordElement.addEventListener('click', handleWordClick);

        console.log('Vocabulary question loaded successfully with 3-click mechanic');
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
        this.scores.vocabulary += 10;

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
