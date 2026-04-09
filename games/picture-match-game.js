// Picture Match Game — hear a word, pick the correct picture
// Standalone game: complements the listening game (which picks text) by picking images

import { renderPicture } from '../utils/imageRenderer.js';

export async function loadPictureMatchQuestion(question) {
    const feedback = document.getElementById('picture-match-feedback');
    const optionsContainer = document.getElementById('picture-match-options');
    const nextBtn = document.getElementById('picture-match-next');

    if (feedback) { feedback.textContent = ''; feedback.className = 'feedback'; }
    if (nextBtn) nextBtn.style.display = 'none';
    optionsContainer.innerHTML = '';

    // Show speaker icon in picture area (the picture is the challenge, not the cue)
    const pictureEl = document.getElementById('picture-match-picture');
    const hebrewEl = document.getElementById('picture-match-hebrew');

    if (pictureEl) pictureEl.textContent = '🔊';
    if (hebrewEl) hebrewEl.style.display = 'none';

    const wordEl = document.getElementById('picture-match-word');
    if (wordEl) wordEl.textContent = question.word || '';

    // Reset plays counter by tier
    this.resetAudioPlayCounter('picture-match');

    // Build picture option buttons (hidden + disabled until audio plays)
    question.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn picture-match-option-btn listening-option-hidden';
        btn.disabled = true;
        btn.setAttribute('aria-label', opt.word);
        const imgContainer = document.createElement('div');
        imgContainer.className = 'picture-match-option-img';
        renderPicture(imgContainer, { picture: opt.picture, imageUrl: opt.imageUrl, word: opt.word, category: question.category });
        btn.appendChild(imgContainer);
        btn.addEventListener('click', () => this.checkPictureMatchAnswer(i, question));
        optionsContainer.appendChild(btn);
    });

    this.currentPictureMatchQuestion = question;

    // Auto-play then reveal options
    try {
        await speechManager.speakWord(question.word, '', 'picture-match');
        this.consumeAudioPlay('picture-match');

        const optionBtns = optionsContainer.querySelectorAll('.option-btn');
        optionBtns.forEach(b => {
            b.classList.remove('listening-option-hidden');
            b.disabled = false;
        });

        const first = optionsContainer.querySelector('.option-btn');
        if (first) first.focus();
    } catch (err) {
        // If audio fails, reveal options immediately
        optionsContainer.querySelectorAll('.option-btn').forEach(b => {
            b.classList.remove('listening-option-hidden');
            b.disabled = false;
        });
    }
}

export async function checkPictureMatchAnswer(selectedIdx, question) {
    const options = document.querySelectorAll('#picture-match-options .option-btn');
    const feedback = document.getElementById('picture-match-feedback');
    const correctIdx = question.correct;
    const isCorrect = selectedIdx === correctIdx;

    // Track word mastery
    if (question.word && question.category) {
        this.recordWordAttempt(question.word, question.category, isCorrect, 0, 'picture-match');
    }

    options.forEach(btn => btn.disabled = true);
    options[selectedIdx]?.classList.add(isCorrect ? 'correct' : 'incorrect');
    if (!isCorrect && options[correctIdx]) options[correctIdx].classList.add('correct');

    if (isCorrect) {
        const fbData = getFeedback('picture-match', 'correct');
        if (feedback) { feedback.textContent = fbData.text; feedback.className = 'feedback correct'; }

        try {
            const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : null;
            if (settings?.showConfetti && typeof confetti !== 'undefined') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
        } catch (_) {}

        window.scoreManager.addPoints('picture-match', 10);
        this.currentQuestionIndex++;
        this.saveGameState();

        try {
            if (fbData.audio) await speechManager.speak(fbData.audio);
        } catch (_) {}

        setTimeout(() => this.loadQuestion('picture-match'), 1500);
    } else {
        const fbData = getFeedback('picture-match', 'incorrect');
        if (feedback) { feedback.textContent = fbData.text; feedback.className = 'feedback incorrect'; }

        try {
            if (fbData.audio) await speechManager.speak(fbData.audio);
            await speechManager.speakWord(question.word, '', 'picture-match');
        } catch (_) {}

        this.currentQuestionIndex++;
        this.saveGameState();

        const nextBtn = document.getElementById('picture-match-next');
        if (nextBtn) nextBtn.style.display = 'block';
    }

    this.updateScore('picture-match');
}
