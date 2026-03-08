// Lightweight header score updater for non-home pages.
// Shows the all-time accumulated totalPoints from userProgress.

function getCurrentUserId() {
    if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
        const id = authService.getCurrentUserId();
        if (id) return id;
    }
    return localStorage.getItem('currentUser') || 'O';
}

function getAllTimeTotalPoints(userId) {
    const raw = localStorage.getItem(`userProgress_${userId}`);
    if (!raw) return 0;
    try {
        const progress = JSON.parse(raw);
        return (typeof progress.totalPoints === 'number') ? progress.totalPoints : 0;
    } catch (e) {
        return 0;
    }
}

function updateHeaderScore() {
    const scoreEl = document.getElementById('current-score');
    if (!scoreEl) return;

    const userId = getCurrentUserId();
    scoreEl.textContent = getAllTimeTotalPoints(userId);
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
        if (e.key.startsWith('userProgress_') || e.key === 'currentUser') {
            updateHeaderScore();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScore);
} else {
    initHeaderScore();
}
