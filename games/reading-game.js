// Reading Game Module
// Handles word building and spelling practice

import { renderPicture } from '../utils/imageRenderer.js';

export async function loadReadingQuestion(question) {
    console.log('Loading reading question:', question);

    // Cancel any ongoing speech from previous question
    if (typeof speechManager !== 'undefined') {
        speechManager.cancelSpeech();
    }

    this.currentTargetWord = question.word;
    this.builtWord = '';
    this.currentQuestionAttempts = 0; // Reset attempts for new question

    // Clear feedback from previous question
    const feedback = document.getElementById('reading-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // Display word and picture
    const wordElement = document.getElementById('reading-word');
    const hebrewElement = document.getElementById('reading-hebrew');

    // Clear any existing timers to prevent double-advance
    if (this.wordDisplayTimer) {
        clearTimeout(this.wordDisplayTimer);
        this.wordDisplayTimer = null;
    }
    if (this.readingAutoAdvanceTimer) {
        clearTimeout(this.readingAutoAdvanceTimer);
        this.readingAutoAdvanceTimer = null;
    }

    // Show both English and Hebrew words immediately
    wordElement.textContent = question.word;
    wordElement.style.visibility = 'visible';
    wordElement.style.opacity = '1';

    // Render picture (image or emoji)
    const pictureElement = document.getElementById('reading-picture');
    if (pictureElement) {
        renderPicture(pictureElement, question);
    }

    if (hebrewElement) {
        hebrewElement.textContent = question.hebrew || '';
        hebrewElement.style.visibility = 'visible';
        hebrewElement.style.opacity = '1';
    }

    // Start fixed 3-second timer to hide English word (Hebrew stays visible)
    this.wordDisplayTimer = setTimeout(() => {
        wordElement.style.visibility = 'hidden';
        wordElement.style.opacity = '0';
        // Hebrew word stays visible
        this.wordDisplayTimer = null;
    }, 3000);

    // Play audio without affecting timing
    // Cancel any ongoing speech first to allow rapid clicking/stuttering effect
    try {
        speechManager.cancelSpeech();
        speechManager.speakWord((question.word || '').toLowerCase(), '', 'reading');
    } catch (error) {
        console.error('Error playing word audio:', error);
    }

    // Clear built word display (innerHTML to remove all letter button children)
    const builtWordElement = document.getElementById('built-word');
    builtWordElement.innerHTML = '';
    builtWordElement.className = 'built-word';

    // Reset all letter buttons from previous question
    document.querySelectorAll('#letter-bank .letter-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('used');
    });

    // Create letter bank
    this.createLetterBank(question);

    // Reset feedback and next button
    document.getElementById('reading-feedback').textContent = '';
    document.getElementById('reading-feedback').className = 'feedback';
    document.getElementById('reading-next').style.display = 'none';

    // Enable check and clear buttons
    document.getElementById('check-word').disabled = false;
    const clearWordButton = document.getElementById('clear-word');
    if (clearWordButton) {
        clearWordButton.disabled = false;
    } else {
        console.error('clear-word button not found in loadReadingQuestion');
    }

    console.log('Reading question loaded successfully');
}

export function createLetterBank(question) {
    const letterBank = document.getElementById('letter-bank');
    letterBank.innerHTML = '';

    // Get all letters needed (word letters + extra letters)
    const wordLetters = question.word.split('');
    const extraLetters = question.extraLetters || [];
    const allLetters = [...wordLetters, ...extraLetters];

    // Shuffle the letters (Fisher-Yates)
    const shuffledLetters = [...allLetters];
    for (let i = shuffledLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledLetters[i], shuffledLetters[j]] = [shuffledLetters[j], shuffledLetters[i]];
    }

    // Create letter buttons with unique IDs to handle duplicates
    shuffledLetters.forEach((letter, index) => {
        const button = document.createElement('button');
        button.className = 'letter-btn';
        button.textContent = letter;
        button.dataset.letter = letter;
        button.dataset.index = index;
        button.id = `letter-${index}`; // Unique ID for each button
        button.setAttribute('aria-label', `Choose letter ${letter}`);

        button.addEventListener('click', () => {
            this.addLetterToWord(letter, button);
        });

        letterBank.appendChild(button);
    });
}

export function addLetterToWord(letter, button) {
    if (button.classList.contains('used')) return;

    // Add animation
    button.classList.add('animate-click');
    setTimeout(() => button.classList.remove('animate-click'), 300);

    // Add letter to built word
    this.builtWord += letter;

    // Create letter button in built word area
    const builtWordElement = document.getElementById('built-word');
    const letterBtn = document.createElement('button');
    letterBtn.className = 'letter-btn';
    letterBtn.textContent = letter;
    letterBtn.style.pointerEvents = 'none';
    builtWordElement.appendChild(letterBtn);

    // Mark button as used
    button.classList.add('used');

    // Enable check button if word has letters
    document.getElementById('check-word').disabled = this.builtWord.length === 0;
}

export function clearBuiltWord() {
    console.log('clearBuiltWord called, clear-word button enabled:', !document.getElementById('clear-word').disabled);
    this.builtWord = '';

    const builtWordElement = document.getElementById('built-word');
    if (builtWordElement) {
        builtWordElement.innerHTML = '';
    }

    // Reset all letter buttons to available state
    const letterButtons = document.querySelectorAll('.letter-btn');
    letterButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.classList.remove('used'); // Remove the 'used' class so letters can be selected again
    });

    // Clear feedback
    const feedbackElement = document.getElementById('reading-feedback');
    if (feedbackElement) {
        feedbackElement.textContent = '';
        feedbackElement.className = 'feedback';
    }
}

export async function checkBuiltWord() {
    const feedback = document.getElementById('reading-feedback');
    const builtWordElement = document.getElementById('built-word');

    const isCorrect = this.builtWord === this.currentTargetWord;

    // Track word attempt immediately
    const question = this.shuffledQuestions[this.currentQuestionIndex];
    if (question && question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'reading');
    }

    if (this.builtWord === this.currentTargetWord) {
        // Correct!
        builtWordElement.classList.add('correct');

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
        const fbData = getFeedback('reading', 'correct');

        feedback.textContent = fbData.text;
        feedback.className = 'feedback correct';

        // Award points based on attempts (10 minus number of tries)
        const points = Math.max(0, 10 - this.currentQuestionAttempts);
        this.scores.reading += points;
        this.updateScore('reading');

        // Disable all buttons
        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
        document.getElementById('check-word').disabled = true;
        document.getElementById('clear-word').disabled = true;

        // Don't show Next button - will auto-advance after feedback (consistent with other games)

        // Audio feedback
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
            // Play word immediately after feedback
            await speechManager.speakWord(this.currentTargetWord, '', 'reading');
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Auto-advance after 1.5 seconds (consistent with other games)
        this.readingAutoAdvanceTimer = setTimeout(() => {
            this.readingAutoAdvanceTimer = null;
            this.nextQuestion('reading');
        }, 1500);
    } else {
        // Incorrect - increment attempts and redisplay word
        this.currentQuestionAttempts++;
        console.log(`Wrong answer attempt ${this.currentQuestionAttempts} for current question`);

        builtWordElement.classList.add('incorrect');

        // Get centralized feedback
        const fbData = getFeedback('reading', 'incorrect');

        feedback.textContent = fbData.text;
        feedback.className = 'feedback incorrect';

        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Redisplay English word and hide after 3 seconds (Hebrew stays visible)
        const wordElement = document.getElementById('reading-word');
        const hebrewElement = document.getElementById('reading-hebrew');
        const question = this.shuffledQuestions[this.currentQuestionIndex];

        if (wordElement && question) {
            // Clear any existing timer before starting new one
            if (this.wordDisplayTimer) {
                clearTimeout(this.wordDisplayTimer);
                this.wordDisplayTimer = null;
            }

            wordElement.textContent = question.word;
            wordElement.style.visibility = 'visible';
            wordElement.style.opacity = '1';

            // Ensure Hebrew word is visible
            if (hebrewElement && question.hebrew) {
                hebrewElement.textContent = question.hebrew;
                hebrewElement.style.visibility = 'visible';
                hebrewElement.style.opacity = '1';
            }

            // Start fixed 3-second timer to hide English word (Hebrew stays visible)
            this.wordDisplayTimer = setTimeout(() => {
                wordElement.style.visibility = 'hidden';
                wordElement.style.opacity = '0';
                // Hebrew word stays visible
                this.wordDisplayTimer = null;
            }, 3000);

            // Play audio without affecting timing
            // Cancel any ongoing speech first to allow rapid clicking/stuttering effect
            try {
                speechManager.cancelSpeech();
                speechManager.speakWord((question.word || '').toLowerCase(), '', 'reading');
            } catch (error) {
                console.error('Error playing word audio:', error);
            }
        }

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        // Show overlay Next button - disable retry to prevent getting points after wrong answer
        document.getElementById('reading-next').style.display = 'block';

        // Disable all buttons to prevent retry
        document.querySelectorAll('.letter-btn').forEach(btn => btn.disabled = true);
        document.getElementById('check-word').disabled = true;
        document.getElementById('clear-word').disabled = true;
    }
}
