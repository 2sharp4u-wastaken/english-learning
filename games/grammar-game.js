// Grammar Game Module
// Handles grammar exercises with fill-in-the-blank questions

const GRAMMAR_CATEGORY_LABELS = {
    'verb-to-be':           '🔵 I am / She is',
    'verb-to-be-negative':  '🚫 I am not',
    'verb-to-be-question':  '❓ Is she...?',
    'verb-to-be-past':      '⏮️ was / were',
    'present-simple':       '▶️ Present Simple',
    'present-continuous':   '🔄 Present Continuous',
    'past-simple':          '⏪ Past Simple',
    'plurals':              '👥 Plurals',
    'prepositions':         '📍 Prepositions',
    'possessives':          '👤 Possessives',
    'pronouns':             '👆 Pronouns',
    'question-words':       '🤔 Question Words',
    'comparatives':         '📊 Comparatives',
    'articles':             '📝 a / an / the',
    'modals':               '💪 can / can\'t',
    'future':               '🔮 Future (will)',
};

export function loadGrammarQuestion(question) {
    console.log('Loading grammar question:', question);

    // Update category badge
    const categoryEl = document.getElementById('grammar-category');
    if (categoryEl) {
        categoryEl.textContent = GRAMMAR_CATEGORY_LABELS[question.category] || question.category || '';
    }

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

    const hebrewEl = document.getElementById('grammar-hebrew');
    if (hebrewEl) {
        hebrewEl.textContent = question.hebrewSentence || question.translation || '';
    }

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
    const sentenceElement = document.getElementById('grammar-sentence');
    const isCorrect = selectedIndex === correctIndex;
    const correctAnswer = question.options[question.correct];
    const fullSentence = question.sentence.includes('___')
        ? question.sentence.replace('___', correctAnswer)
        : question.sentence;

    if (window.gameManager?.handleMoraleAnswerResult) {
        window.gameManager.handleMoraleAnswerResult(isCorrect);
    }

    // Disable all options
    options.forEach(btn => btn.disabled = true);

    if (isCorrect) {
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
        // Use scoreManager to add points (persists across sessions)
        window.scoreManager.addPoints('grammar', 10);
        // Update local score for consistency
        this.scores.grammar = window.scoreManager.getScore('grammar');

        // Replace blank with full correct sentence so the learner clearly sees it
        if (sentenceElement) {
            sentenceElement.textContent = fullSentence;
        }

        // Save progress immediately to prevent loss if user navigates away
        this.currentQuestionIndex++;
        this.saveGameState();

        // Audio feedback: praise phrase (if any) + full correct sentence
        try {
            if (fbData.audio) {
                await speechManager.speak(fbData.audio);
            }
            await speechManager.speak(fullSentence);
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Show Next button instead of auto-advancing so user can read the explanation
        document.getElementById('grammar-next').style.display = 'block';
    } else {
        options[selectedIndex].classList.add('incorrect');
        options[correctIndex].classList.add('correct');
        const ruleExplanation = this.currentLanguage === 'en'
            ? question.explanation
            : question.hebrewExplanation;

        // Show explicit correct answer + rule so it is unambiguous
        const baseText = this.currentLanguage === 'he'
            ? 'הנה התשובה הנכונה:'
            : 'Here is the correct answer:';

        let html = `<strong>${baseText}</strong><br>${fullSentence}`;
        if (ruleExplanation) {
            html += `<br>${ruleExplanation}`;
        }

        feedback.innerHTML = html;
        feedback.className = 'feedback incorrect';

        // Replace blank with full correct sentence
        if (sentenceElement) {
            sentenceElement.textContent = fullSentence;
        }

        // Audio feedback: speak the full correct sentence
        try {
            await speechManager.speak(fullSentence);
        } catch (error) {
            console.error('Error playing audio feedback:', error);
        }

        // Increment question index and save immediately to prevent retry exploit
        this.currentQuestionIndex++;
        this.saveGameState();

        document.getElementById('grammar-next').style.display = 'block';
    }

    this.updateScore('grammar');
    // For incorrect answers the Next button is already shown above
}
