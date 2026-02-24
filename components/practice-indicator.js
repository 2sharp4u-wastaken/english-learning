// Lightweight practice badge updater for non-home pages.
// Computes struggling words from localStorage + vocabularyBank.

function getCurrentUserId() {
    if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
        const id = authService.getCurrentUserId();
        if (id) return id;
    }
    return localStorage.getItem('currentUser') || 'O';
}

function loadUserProgress(userId) {
    const storageKey = `userProgress_${userId}`;
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch (error) {
        console.error('Error parsing user progress:', error);
        return null;
    }
}

function getSelectedCategories() {
    const raw = localStorage.getItem('englishLearningSettings');
    if (!raw) return [];
    try {
        const settings = JSON.parse(raw);
        return settings.selectedCategories || [];
    } catch (error) {
        console.error('Error parsing settings:', error);
        return [];
    }
}

function countStrugglingWords() {
    const progress = loadUserProgress(getCurrentUserId());
    const wordMastery = progress && progress.wordMastery ? progress.wordMastery : {};
    const allWords = window.vocabularyBank || [];
    if (!allWords.length) return null;

    const selectedCategories = getSelectedCategories();
    const filteredWords = selectedCategories.length > 0
        ? allWords.filter(word => selectedCategories.includes(word.category))
        : allWords;

    let strugglingCount = 0;
    filteredWords.forEach(word => {
        const key = `${word.word}_${word.category}`;
        const stats = wordMastery[key];
        const hasAttempts = stats && stats.totalAttempts > 0;
        const isStruggling = stats && stats.masteryLevel < 0.5;
        if (hasAttempts && isStruggling) strugglingCount++;
    });

    return strugglingCount;
}

function updatePracticeButton() {
    const practiceBtn = document.querySelector('.top-game-btn[data-game="practice"]');
    if (!practiceBtn) return;

    const count = countStrugglingWords();
    if (count === null) return;

    const badge = practiceBtn.querySelector('.practice-badge');
    if (count === 0) {
        practiceBtn.classList.remove('has-words');
        if (badge) badge.textContent = '';
        return;
    }

    practiceBtn.classList.add('has-words');
    if (badge) badge.textContent = count;
}

function isHomePage() {
    const path = window.location.pathname || '';
    return path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('index.html');
}

function initPracticeIndicator() {
    if (isHomePage()) return;

    let attempts = 0;
    const tick = () => {
        attempts += 1;
        if (!window.vocabularyBank) {
            if (attempts < 50) {
                setTimeout(tick, 100);
            }
            return;
        }
        updatePracticeButton();
    };
    tick();

    window.addEventListener('storage', (e) => {
        if (!e || !e.key) return;
        if (e.key === 'englishLearningSettings' || e.key === 'currentUser' || e.key.startsWith('userProgress_')) {
            updatePracticeButton();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPracticeIndicator);
} else {
    initPracticeIndicator();
}
