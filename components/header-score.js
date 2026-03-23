// Lightweight header score/coin updater for non-home pages.
// Shows the all-time accumulated totalPoints and coin balance from userProgress.

function getCurrentUserId() {
    if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
        const id = authService.getCurrentUserId();
        if (id) return id;
    }
    return localStorage.getItem('currentUser') || 'O';
}

function getUserProgress(userId) {
    const raw = localStorage.getItem(`v2_userProgress_${userId}`) || localStorage.getItem(`userProgress_${userId}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function updateHeaderScore() {
    const userId = getCurrentUserId();
    const progress = getUserProgress(userId);

    const scoreEl = document.getElementById('current-score');
    if (scoreEl) {
        scoreEl.textContent = (progress && typeof progress.totalPoints === 'number') ? progress.totalPoints : 0;
    }

    const coinEl = document.getElementById('header-coin-count');
    if (coinEl) {
        coinEl.textContent = (progress && typeof progress.coins === 'number') ? progress.coins : 0;
    }
}

function isHomePage() {
    const path = window.location.pathname || '';
    return path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('index.html');
}

function initHeaderScore() {
    if (isHomePage()) return;

    updateHeaderScore();

    window.addEventListener('storage', (e) => {
        if (!e || !e.key) return;
        if (e.key.startsWith('v2_userProgress_') || e.key.startsWith('userProgress_') || e.key === 'currentUser') {
            updateHeaderScore();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScore);
} else {
    initHeaderScore();
}
