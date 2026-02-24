// Lightweight header score updater for non-home pages.

function getCurrentUserId() {
    if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
        const id = authService.getCurrentUserId();
        if (id) return id;
    }
    return localStorage.getItem('currentUser') || 'O';
}

function getLatestSavedScore(userId) {
    const prefix = `savedGame_${userId}_`;
    let latest = null;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
            const gameState = JSON.parse(raw);
            if (!gameState || typeof gameState.timestamp !== 'number') continue;
            if (!latest || gameState.timestamp > latest.timestamp) {
                latest = gameState;
            }
        } catch (e) {
            // ignore malformed entries
        }
    }

    return latest && typeof latest.score === 'number' ? latest.score : null;
}

function updateHeaderScore() {
    const scoreEl = document.getElementById('current-score');
    if (!scoreEl) return;

    const userId = getCurrentUserId();
    const latestScore = getLatestSavedScore(userId);
    scoreEl.textContent = latestScore !== null ? latestScore : 0;
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
        if (e.key.startsWith('savedGame_') || e.key === 'currentUser') {
            updateHeaderScore();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScore);
} else {
    initHeaderScore();
}
