// Grammar Game Module
// Handles grammar exercises with fill-in-the-blank questions

export function loadGrammarQuestion(question) {
    console.log('Loading grammar question:', question);

    // Clear feedback from previous question
    const feedback = document.getElementById('grammar-feedback');
    if (feedback) {
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    // Create sentence with blank
    const sentenceParts = question.sentence.split('___');
    const sentenceElement = document.getElementById('grammar-sentence');

    // Remove trailing dot if present
    const secondPart = (sentenceParts[1] || '').replace(/\.$/, '');

    sentenceElement.innerHTML = `${sentenceParts[0]}<span class="blank">______</span>${secondPart}`;

    const optionsContainer = document.getElementById('grammar-options');
    optionsContainer.innerHTML = '';

    // Randomize answer positions by shuffling options
    const shuffledOptions = [...question.options];
    const correctAnswer = question.options[question.correct];

    // Shuffle the options array
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    // Find the new position of the correct answer
    const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);

    shuffledOptions.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        button.addEventListener('click', () => {
            this.checkGrammarAnswer(index, newCorrectIndex, question);
        });
        button.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                button.click();
            }
        });
        optionsContainer.appendChild(button);
    });

    // Enable arrow-key navigation
    this.enableOptionKeyboardNavigation('grammar-options');

    // Reset feedback and next button
    document.getElementById('grammar-feedback').textContent = '';
    document.getElementById('grammar-feedback').className = 'feedback';
    document.getElementById('grammar-next').style.display = 'none';
    // Focus first option
    const firstGrammarOption = optionsContainer.querySelector('.option-btn');
    if (firstGrammarOption) firstGrammarOption.focus();

    console.log('Grammar question loaded successfully');
}

export async function checkGrammarAnswer(selectedIndex, correctIndex, question) {
    const options = document.querySelectorAll('#grammar-options .option-btn');
    const feedback = document.getElementById('grammar-feedback');

    // Disable all options
    options.forEach(btn => btn.disabled = true);

    if (selectedIndex === correctIndex) {
        options[selectedIndex].classList.add('correct');
        const explanation = this.currentLanguage === 'en' ? question.explanation : question.hebrewExplanation;

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
        const fbData = getFeedback('grammar', 'correct', explanation);

        feedback.innerHTML = fbData.text;
        feedback.className = 'feedback correct';
        this.scores.grammar += 10;

        // Audio feedback for correct answer
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        setTimeout(() => {
            this.nextQuestion('grammar');
        }, 1500);
    } else {
        options[selectedIndex].classList.add('incorrect');
        options[correctIndex].classList.add('correct');
        const explanation = this.currentLanguage === 'en' ? question.explanation : question.hebrewExplanation;

        // Get centralized feedback
        const fbData = getFeedback('grammar', 'incorrect', explanation);

        feedback.innerHTML = fbData.text;
        feedback.className = 'feedback incorrect';

        // Audio feedback for incorrect answer
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        document.getElementById('grammar-next').style.display = 'block';
    }

    this.updateScore('grammar');
    // For incorrect answers the Next button is already shown above
}
