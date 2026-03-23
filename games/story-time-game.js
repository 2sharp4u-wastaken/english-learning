// Story Time (זמן סיפור) Game
// Two-phase game: Read phase (tap highlighted words to hear pronunciation)
// then Quiz phase (comprehension questions)
// Standalone game class, loaded by GameManager

export class StoryTimeGame {
    constructor() {
        this.currentStory = null;
        this.currentQuizIndex = 0;
        this.storyIndex = 0; // Tracks which story we're on (independent of GameManager.currentQuestionIndex)
        this.phase = 'read'; // 'read' or 'quiz'
        this.isAnswerSelected = false;
        this.quizCorrect = 0;
        this.quizTotal = 0;
        console.log('[StoryTime] Initialized');
    }

    /**
     * Load a story descriptor — called by GameManager loadQuestion dispatch.
     * The "question" here is a story object from getStoriesForSession().
     * @param {Object} story - { id, title, sentences[], highlights[], questions[] }
     */
    loadQuestion(story) {
        this.currentStory = story;
        this.currentQuizIndex = 0;
        this.phase = 'read';
        this.isAnswerSelected = false;

        const container = document.getElementById('story-time-container');
        if (container) container.style.display = 'block';

        this.renderReadPhase();
    }

    /**
     * Render the read-along phase: story text with highlighted tappable words
     */
    renderReadPhase() {
        const story = this.currentStory;

        // Title
        const titleEl = document.getElementById('story-time-title');
        if (titleEl) titleEl.textContent = `📖 ${story.title}`;

        // Story text
        const textEl = document.getElementById('story-time-text');
        if (textEl) {
            const highlightWords = new Map(
                story.highlights.map(h => [h.word.toLowerCase(), h])
            );

            const sentenceHTML = story.sentences.map((sentence, idx) => {
                // Split sentence into words, preserving punctuation
                const tokens = sentence.split(/(\s+)/);
                const rendered = tokens.map(token => {
                    const cleanToken = token.replace(/[.,!?;:'"]+$/, '').toLowerCase();
                    if (highlightWords.has(cleanToken)) {
                        const h = highlightWords.get(cleanToken);
                        return `<span class="story-highlight" data-word="${h.word}" data-translation="${h.translation}" tabindex="0">${token}</span>`;
                    }
                    return token;
                });
                return `<p class="story-sentence"><button class="story-play-btn" data-sentence-idx="${idx}" title="השמע משפט">🔊</button>${rendered.join('')}</p>`;
            });

            textEl.innerHTML = sentenceHTML.join('');

            // Add click listeners for highlighted words
            textEl.querySelectorAll('.story-highlight').forEach(el => {
                el.addEventListener('click', () => this.onHighlightTap(el));
            });

            // Add click listeners for sentence play buttons
            textEl.querySelectorAll('.story-play-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.sentenceIdx, 10);
                    this.speakSentence(story.sentences[idx], btn);
                });
            });
        }

        // Show "Ready for questions" button, hide quiz area
        const readyBtn = document.getElementById('story-time-ready');
        if (readyBtn) {
            readyBtn.style.display = 'block';
            readyBtn.onclick = () => this.startQuizPhase();
        }

        const quizArea = document.getElementById('story-time-quiz');
        if (quizArea) quizArea.style.display = 'none';

        // Instruction hint
        const hintEl = document.getElementById('story-time-hint');
        if (hintEl) hintEl.textContent = '👆 לחץ על מילים מודגשות כדי לשמוע אותן';

        // Hide feedback/next
        const feedback = document.getElementById('story-time-feedback');
        if (feedback) { feedback.textContent = ''; feedback.style.display = 'none'; }
        const nextBtn = document.getElementById('story-time-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Handle tap on a highlighted word — speak it
     */
    onHighlightTap(el) {
        const word = el.dataset.word;
        const translation = el.dataset.translation;

        // Visual pulse
        el.classList.add('story-highlight-active');
        setTimeout(() => el.classList.remove('story-highlight-active'), 600);

        // Show translation tooltip briefly
        const tooltip = document.createElement('span');
        tooltip.className = 'story-word-tooltip';
        tooltip.textContent = translation;
        el.style.position = 'relative';
        el.appendChild(tooltip);
        setTimeout(() => tooltip.remove(), 1500);

        // Speak the word
        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(word, '', 'story-time').catch(() => {});
        }
    }

    /**
     * Transition from read phase to quiz phase
     */
    startQuizPhase() {
        this.phase = 'quiz';
        this.currentQuizIndex = 0;
        this.isAnswerSelected = false;

        // Hide read-phase controls
        const readyBtn = document.getElementById('story-time-ready');
        if (readyBtn) readyBtn.style.display = 'none';

        const hintEl = document.getElementById('story-time-hint');
        if (hintEl) hintEl.textContent = '❓ ענה על השאלות לפי הסיפור';

        // Show quiz area
        const quizArea = document.getElementById('story-time-quiz');
        if (quizArea) quizArea.style.display = 'block';

        this.renderQuizQuestion();
    }

    /**
     * Render the current comprehension question
     */
    renderQuizQuestion() {
        const story = this.currentStory;
        const q = story.questions[this.currentQuizIndex];
        if (!q) return;

        this.isAnswerSelected = false;

        // Question text
        const questionEl = document.getElementById('story-time-question');
        if (questionEl) questionEl.textContent = q.question;

        // Question counter
        const counterEl = document.getElementById('story-time-q-counter');
        if (counterEl) {
            counterEl.textContent = `שאלה ${this.currentQuizIndex + 1} מתוך ${story.questions.length}`;
        }

        // Options
        const optionsEl = document.getElementById('story-time-options');
        if (optionsEl) {
            optionsEl.innerHTML = '';
            const colors = ['st-option-blue', 'st-option-green', 'st-option-orange'];

            q.options.forEach((opt, i) => {
                const btn = document.createElement('button');
                btn.className = `st-option-btn ${colors[i % colors.length]}`;
                btn.textContent = opt;
                btn.addEventListener('click', () => this.checkQuizAnswer(i));
                optionsEl.appendChild(btn);
            });
        }

        // Reset feedback and next
        const feedback = document.getElementById('story-time-feedback');
        if (feedback) { feedback.textContent = ''; feedback.style.display = 'none'; }
        const nextBtn = document.getElementById('story-time-next');
        if (nextBtn) nextBtn.style.display = 'none';
    }

    /**
     * Check a comprehension answer
     * @param {number} selectedIdx - Index of selected option
     */
    checkQuizAnswer(selectedIdx) {
        if (this.isAnswerSelected) return;
        this.isAnswerSelected = true;

        const story = this.currentStory;
        const q = story.questions[this.currentQuizIndex];
        const isCorrect = selectedIdx === q.correctIndex;

        this.quizTotal++;
        if (isCorrect) this.quizCorrect++;

        // Morale
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        // Track word attempts for highlighted words in this story
        if (isCorrect && window.gameManager?.recordWordAttempt) {
            for (const h of story.highlights) {
                window.gameManager.recordWordAttempt(h.word, '', isCorrect, 0, 'story-time');
            }
        }

        // Visual feedback on option buttons
        const options = document.querySelectorAll('#story-time-options .st-option-btn');
        options.forEach(btn => btn.disabled = true);
        if (options[selectedIdx]) {
            options[selectedIdx].classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        if (!isCorrect && options[q.correctIndex]) {
            options[q.correctIndex].classList.add('correct');
        }

        // Feedback
        const feedback = document.getElementById('story-time-feedback');
        if (feedback) {
            if (isCorrect) {
                const msgs = ['🎉 נכון!', '⭐ כל הכבוד!', '🌟 מצוין!'];
                feedback.textContent = msgs[Math.floor(Math.random() * msgs.length)];
                feedback.className = 'feedback success';
            } else {
                feedback.textContent = `❌ התשובה הנכונה: "${q.options[q.correctIndex]}"`;
                feedback.className = 'feedback error';
            }
            feedback.style.display = 'block';
        }

        // Score and state — each quiz question increments the global question index
        window.gameManager.currentQuestionIndex++;
        window.gameManager.saveGameState();

        if (isCorrect) {
            window.scoreManager.addPoints('story-time', 15);
            window.gameManager.updateScore('story-time');
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}
        } else {
            try { window.audioEffects?.playWrong(); } catch (e) {}
        }

        // Determine what's next
        this.currentQuizIndex++;
        const hasMoreQuestions = this.currentQuizIndex < story.questions.length;

        if (hasMoreQuestions) {
            // Show next quiz question after delay or on click
            if (isCorrect) {
                setTimeout(() => this.renderQuizQuestion(), 1500);
            } else {
                const nextBtn = document.getElementById('story-time-next');
                if (nextBtn) {
                    nextBtn.style.display = 'block';
                    nextBtn.onclick = () => this.renderQuizQuestion();
                }
            }
        } else {
            // This story's questions are done — advance to next story via GameManager
            // GameManager's loadQuestion will call us again with the next story,
            // or endGame if no more stories
            if (isCorrect) {
                setTimeout(() => window.gameManager.loadQuestion('story-time'), 1800);
            } else {
                const nextBtn = document.getElementById('story-time-next');
                if (nextBtn) {
                    nextBtn.style.display = 'block';
                    nextBtn.onclick = () => window.gameManager.loadQuestion('story-time');
                }
            }
        }
    }

    /**
     * Speak a full sentence using TTS
     */
    async speakSentence(sentence, btn) {
        if (btn) {
            btn.classList.add('story-play-btn-active');
            setTimeout(() => btn.classList.remove('story-play-btn-active'), 1000);
        }
        if (typeof speechManager !== 'undefined') {
            await speechManager.speak(sentence);
        }
    }

    cleanup() {
        const container = document.getElementById('story-time-container');
        if (container) container.style.display = 'none';
    }
}
