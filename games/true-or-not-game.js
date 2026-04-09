// True or Not? (נכון או לא?) Game
// Show image + English word — child decides if they match (✓) or not (✗)
// Standalone game class, loaded by GameManager

import { renderPicture } from '../utils/imageRenderer.js';

export class TrueOrNotGame {
    constructor() {
        this.currentQuestion = null;
        this.isAnswerSelected = false;
        console.log('[TrueOrNot] Initialized');
    }

    /**
     * Build question array from learned words.
     * Returns 10 questions: 5 correct matches + 5 mismatches, shuffled.
     * @param {Array} words - Learned word objects { word, translation, category, image, imageUrl }
     * @returns {Array} Question objects { word, translation, category, image, imageUrl, displayImage, displayImageUrl, isMatch }
     */
    buildQuestions(words) {
        if (words.length < 4) return [];

        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const questions = [];

        // 5 correct matches
        const matchWords = shuffled.slice(0, Math.min(5, shuffled.length));
        for (const w of matchWords) {
            questions.push({
                word: w.word,
                translation: w.translation,
                category: w.category,
                image: w.image,
                imageUrl: w.imageUrl,
                displayImage: w.image,
                displayImageUrl: w.imageUrl,
                isMatch: true
            });
        }

        // 5 mismatches — swap image with a different word (preferably different category)
        const mismatchWords = shuffled.slice(Math.min(5, shuffled.length), Math.min(10, shuffled.length));
        // If not enough unique words, reuse from matchWords
        while (mismatchWords.length < 5 && shuffled.length >= 4) {
            const extra = shuffled[Math.floor(Math.random() * shuffled.length)];
            if (!mismatchWords.some(w => w.word === extra.word)) {
                mismatchWords.push(extra);
            }
            if (mismatchWords.length >= Math.min(5, shuffled.length)) break;
        }

        for (const w of mismatchWords) {
            // Find a different word's image to display
            const candidates = shuffled.filter(c =>
                c.word !== w.word && c.category !== w.category
            );
            // Fallback to any different word if no cross-category match
            const pool = candidates.length > 0
                ? candidates
                : shuffled.filter(c => c.word !== w.word);
            if (pool.length === 0) continue;

            const decoy = pool[Math.floor(Math.random() * pool.length)];
            questions.push({
                word: w.word,
                translation: w.translation,
                category: w.category,
                image: w.image,
                imageUrl: w.imageUrl,
                displayImage: decoy.image,
                displayImageUrl: decoy.imageUrl,
                isMatch: false
            });
        }

        // Shuffle all questions together
        return questions.sort(() => Math.random() - 0.5);
    }

    /**
     * Render a question — called by GameManager loadQuestion dispatch
     * @param {Object} question - Question object from buildQuestions()
     */
    loadQuestion(question) {
        this.currentQuestion = question;
        this.isAnswerSelected = false;

        const container = document.getElementById('true-or-not-container');
        if (container) container.style.display = 'block';

        // Render the displayed image (may or may not match the word)
        const imageArea = document.getElementById('true-or-not-image');
        if (imageArea) {
            renderPicture(imageArea, {
                picture: question.displayImage,
                imageUrl: question.displayImageUrl,
                word: question.isMatch ? question.word : '?',
                category: question.category
            });
        }

        // Show the English word
        const wordEl = document.getElementById('true-or-not-word');
        if (wordEl) wordEl.textContent = question.word;

        // Show Hebrew translation hint
        const hebrewEl = document.getElementById('true-or-not-hebrew');
        if (hebrewEl) {
            hebrewEl.textContent = question.translation;
        }

        // Reset buttons
        const trueBtn = document.getElementById('true-or-not-yes');
        const falseBtn = document.getElementById('true-or-not-no');
        if (trueBtn) {
            trueBtn.disabled = false;
            trueBtn.className = 'ton-answer-btn ton-yes';
        }
        if (falseBtn) {
            falseBtn.disabled = false;
            falseBtn.className = 'ton-answer-btn ton-no';
        }

        // Reset feedback
        const feedback = document.getElementById('true-or-not-feedback');
        if (feedback) { feedback.textContent = ''; feedback.style.display = 'none'; }

        const nextBtn = document.getElementById('true-or-not-next');
        if (nextBtn) nextBtn.style.display = 'none';

        // Speak the word
        if (typeof speechManager !== 'undefined') {
            speechManager.speakWord(question.word, '', 'true-or-not').catch(() => {});
        }
    }

    /**
     * Handle answer — child taps ✓ (true) or ✗ (false)
     * @param {boolean} userSaysMatch - true if child tapped ✓
     */
    checkAnswer(userSaysMatch) {
        if (this.isAnswerSelected) return;
        this.isAnswerSelected = true;

        const q = this.currentQuestion;
        const isCorrect = userSaysMatch === q.isMatch;

        // Morale feedback
        if (window.gameManager?.handleMoraleAnswerResult) {
            window.gameManager.handleMoraleAnswerResult(isCorrect);
        }

        // Track word mastery
        if (window.gameManager?.recordWordAttempt) {
            window.gameManager.recordWordAttempt(q.word, q.category, isCorrect, 0, 'true-or-not');
        }

        // Visual feedback on buttons
        const trueBtn = document.getElementById('true-or-not-yes');
        const falseBtn = document.getElementById('true-or-not-no');
        if (trueBtn) trueBtn.disabled = true;
        if (falseBtn) falseBtn.disabled = true;

        if (q.isMatch) {
            // Correct answer was ✓
            if (trueBtn) trueBtn.classList.add('correct');
            if (!isCorrect && falseBtn) falseBtn.classList.add('incorrect');
        } else {
            // Correct answer was ✗
            if (falseBtn) falseBtn.classList.add('correct');
            if (!isCorrect && trueBtn) trueBtn.classList.add('incorrect');
        }

        // Feedback text
        const feedback = document.getElementById('true-or-not-feedback');
        if (feedback) {
            if (isCorrect) {
                const msgs = ['🎉 כל הכבוד!', '⭐ נכון!', '🌟 מצוין!', '👏 יפה!'];
                feedback.textContent = msgs[Math.floor(Math.random() * msgs.length)];
                feedback.className = 'feedback success';
            } else {
                const answer = q.isMatch ? 'כן, זו תמונה מתאימה!' : 'לא, זו תמונה לא מתאימה!';
                feedback.textContent = `❌ ${answer}`;
                feedback.className = 'feedback error';
            }
            feedback.style.display = 'block';
        }

        // Score and state
        window.gameManager.currentQuestionIndex++;
        window.gameManager.saveGameState();

        if (isCorrect) {
            window.scoreManager.addPoints('true-or-not', 10);
            window.gameManager.updateScore('true-or-not');
            if (typeof confetti === 'function') {
                confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
            }
            try { window.audioEffects?.playCorrect(); } catch (e) {}
        } else {
            try { window.audioEffects?.playWrong(); } catch (e) {}
        }

        // Show next button (or auto-advance on correct after delay)
        const nextBtn = document.getElementById('true-or-not-next');
        if (isCorrect) {
            setTimeout(() => window.gameManager.loadQuestion('true-or-not'), 1500);
        } else {
            if (nextBtn) nextBtn.style.display = 'block';
        }
    }

    cleanup() {
        const container = document.getElementById('true-or-not-container');
        if (container) container.style.display = 'none';
    }
}
