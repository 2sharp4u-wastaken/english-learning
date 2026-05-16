/**
 * Top Navigation Header Module
 * Single source of truth for the header across index.html, stats.html, settings.html.
 *
 * Usage:
 *   import { initTopHeader } from './components/top-header.js';
 *   initTopHeader({ activePage: 'home' });   // index.html
 *   initTopHeader({ activePage: 'stats' });  // stats.html
 *   initTopHeader({ activePage: 'settings' }); // settings.html
 */

import { toggle as toggleCase, init as initCase } from '../utils/caseManager.js';

/** Game metadata — used for back-button game name display */
const GAME_NAMES = {
    'vocabulary':       { icon: 'fa-book',        name: 'מבחן מילים' },
    'grammar':          { icon: 'fa-spell-check', name: 'תרגול דקדוק' },
    'grammar-beginner': { icon: 'fa-volume-up',   name: 'דקדוק למתחילים' },
    'pronunciation':    { icon: 'fa-microphone',  name: 'הגייה' },
    'listening':        { icon: 'fa-headphones',  name: 'הקשבה' },
    'reading':          { icon: 'fa-book-open',   name: 'איית אותי' },
    'abc':              { icon: 'fa-font',        name: 'אותיות' },
    'memory':           { icon: 'fa-th',          name: 'זיכרון' },
    'scramble':         { icon: 'fa-random',      name: 'סידור משפטים' },
    'fill-blanks':      { icon: 'fa-fill-drip',   name: 'השלם את המשפט' },
    'word-journey':     { icon: 'fa-route',       name: 'מסע המילים' },
    'picture-match':    { icon: 'fa-image',       name: 'מילה לתמונה' },
    'practice':         { icon: 'fa-bullseye',    name: 'תרגול' },
    'true-or-not':      { icon: 'fa-check-circle', name: 'נכון או לא?' },
    'story-time':       { icon: 'fa-book-reader',  name: 'זמן סיפור' },
};

// Inline styles applied to the header when it is visible and fixed.
// Used on non-home pages (always shown) and on home page once user logs in.
const FIXED_STYLE = 'position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 1000;';

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHeaderHTML(activePage) {
    const isHome = activePage === 'home';

    const statsClass    = activePage === 'stats'    ? ' active' : '';
    const settingsClass = activePage === 'settings' ? ' active' : '';

    // Header starts hidden on home (shown after login), always visible on other pages
    const headerStyle  = isHome ? 'display: none;' : `display: flex; ${FIXED_STYLE}`;

    return `<header class="top-header" id="top-header" style="${headerStyle}">
        <div class="header-left">
            <div class="app-logo" id="header-home-btn" style="cursor: pointer;">
                <span class="home-notification-dot" id="home-notification-dot"></span>
                <i class="fas fa-graduation-cap"></i>
                <span>לומדים אנגלית</span>
            </div>
            <!-- Back button + game name — visible during active games only -->
            <div class="header-game-info" id="header-game-info" style="display: none;">
                <button class="header-back-btn" id="header-back-btn" title="חזרה לבית">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span class="header-game-name" id="header-game-name"></span>
            </div>
        </div>
        <div class="header-right">
            <!-- Score — always visible -->
            <span class="header-score" id="header-score">ניקוד: <span id="current-score">0</span></span>
            <!-- Coins — always visible -->
            <div class="header-coins" id="header-coins" title="מטבעות">
                <i class="fas fa-coins"></i>
                <span id="header-coin-count">0</span>
            </div>
            <!-- Case toggle — always visible -->
            <button class="case-toggle-btn" id="global-case-toggle" title="החלף רישיות (ABC / abc)">
                <span class="case-upper">ABC</span>
                <span class="case-lower">abc</span>
            </button>
            <!-- Nikud toggle — always visible -->
            <button class="nikud-toggle-btn" id="nikud-toggle" title="הצג/הסתר ניקוד (אֶ/א)">
                <span class="nikud-on">אֶ</span>
                <span class="nikud-off-label">א</span>
            </button>
            <a href="stats.html" class="header-icon-btn${statsClass}" id="stats-btn" title="סטטיסטיקות">
                <i class="fas fa-chart-line"></i>
            </a>
            <a href="settings.html" class="header-icon-btn${settingsClass}" id="settings-btn" title="הגדרות">
                <i class="fas fa-cog"></i>
            </a>
            <div class="header-user-info" id="header-user-info">
                <div class="header-user-avatar" id="header-user-avatar">O</div>
                <span class="header-user-name" id="header-user-name">User</span>
            </div>
            <button class="header-icon-btn" id="header-logout-btn" title="התנתק">
                <i class="fas fa-sign-out-alt"></i>
            </button>
        </div>
    </header>`;
}

// ---------------------------------------------------------------------------
// Shared helper: populate avatar + name from authService
// ---------------------------------------------------------------------------

function updateUserInfo() {
    const avatar = document.getElementById('header-user-avatar');
    const name   = document.getElementById('header-user-name');
    if (!avatar || !name) return;

    if (typeof authService !== 'undefined' && authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        if (user) {
            avatar.textContent   = user.name.charAt(0).toUpperCase();
            avatar.style.background = user.avatarColor || 'linear-gradient(135deg, #667eea, #764ba2)';
            name.textContent     = user.name;
        }
    }
}

// ---------------------------------------------------------------------------
// Home-page event wiring (index.html)
// ---------------------------------------------------------------------------

function setupHomeEvents() {
    const topHeader  = document.getElementById('top-header');
    const statsBtn   = document.getElementById('stats-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Show the header after login
    function showHeader() {
        updateUserInfo();
        topHeader.style.cssText = `display: flex; ${FIXED_STYLE}`;
        document.querySelector('.app-layout')?.classList.add('header-mode');
        setHeaderMode('hub');
        requestAnimationFrame(() => {
            syncHeaderOffset('home');
            watchHeaderHeight('home');
        });
    }

    // Navigate back to hub (shared by logo click + back button)
    function navigateToHub() {
        if (typeof gameManager !== 'undefined' && gameManager.isGameActive) {
            const saved = gameManager.saveGameState();
            if (saved) gameManager.showToast('המשחק נשמר בהצלחה');
            gameManager.isGameActive = false;
        }
        if (window.location.hash) history.replaceState(null, null, window.location.pathname);

        document.querySelectorAll('.game-content').forEach(s => {
            s.classList.remove('active');
            s.style.display = 'none';
        });

        const welcome = document.getElementById('welcome-screen');
        if (welcome) { welcome.classList.add('active'); welcome.style.display = 'block'; }

        if (typeof gameManager !== 'undefined' && gameManager.populateResumeGames) {
            gameManager.populateResumeGames();
        }
        if (window.gameManager?.updateTotalScoreDisplay) {
            window.gameManager.updateTotalScoreDisplay();
        }
        // Refresh hero card and lock states with current save/progress data
        if (typeof window.updateHomeCardStates === 'function') {
            window.updateHomeCardStates();
        }
        setHeaderMode('hub');
    }

    // Logo → show welcome screen
    document.getElementById('header-home-btn')?.addEventListener('click', navigateToHub);

    // Back button → same as logo
    document.getElementById('header-back-btn')?.addEventListener('click', navigateToHub);

    // Logout
    document.getElementById('header-logout-btn')?.addEventListener('click', () => {
        if (typeof authService !== 'undefined') {
            if (window.location.hash) history.replaceState(null, null, window.location.pathname);
            authService.logout();
            topHeader.style.display = 'none';
            document.querySelector('.app-layout')?.classList.remove('header-mode');
        }
    });

    // Stats / Settings links → auto-save before navigating away
    [statsBtn, settingsBtn].forEach(btn => {
        btn?.addEventListener('click', () => {
            if (typeof gameManager !== 'undefined' && gameManager.isGameActive) {
                const saved = gameManager.saveGameState();
                if (saved) gameManager.showToast('המשחק נשמר בהצלחה');
            }
        });
    });

    // Auth events (auth.js dispatches 'user-logged-in')
    window.addEventListener('user-logged-in', () => setTimeout(showHeader, 100));
    if (typeof authService !== 'undefined' && authService.isAuthenticated()) {
        setTimeout(showHeader, 200);
    }
}

// ---------------------------------------------------------------------------
// Stats / Settings page event wiring
// ---------------------------------------------------------------------------

function setupOtherPageEvents() {
    // Logo → navigate back to home
    document.getElementById('header-home-btn')?.addEventListener('click', () => {
        window.location.replace('index.html');
    });

    // User-info pill → navigate to user hub
    document.getElementById('header-user-info')?.addEventListener('click', () => {
        window.location.replace('index.html#user-hub');
    });

    // Logout
    document.getElementById('header-logout-btn')?.addEventListener('click', () => {
        if (typeof authService !== 'undefined') {
            authService.logout();
            window.location.replace('index.html');
        }
    });

    // Auth events
    window.addEventListener('user-logged-in', updateUserInfo);
    updateUserInfo();
}

// ---------------------------------------------------------------------------
// Header mode toggling — hub vs game
// ---------------------------------------------------------------------------

/**
 * Switch the header between 'hub' mode (home screen) and 'game' mode (active game).
 * In hub mode: logo visible, back/game-name hidden, stats/settings/logout visible, score hidden.
 * In game mode: logo hidden, back/game-name visible, stats/settings/logout hidden, score visible.
 */
function setHeaderMode(mode) {
    const header = document.getElementById('top-header');
    if (!header) return;

    const gameInfo = document.getElementById('header-game-info');
    const logo     = document.getElementById('header-home-btn');

    if (mode === 'game') {
        header.classList.add('game-active');
        if (logo) logo.style.display = 'none';
        if (gameInfo) gameInfo.style.display = 'flex';
    } else {
        header.classList.remove('game-active');
        if (logo) logo.style.display = '';
        if (gameInfo) gameInfo.style.display = 'none';
    }
}

/**
 * Show the active game name + back button in the header.
 * Called from gameLogic.js performGameSwitch().
 */
function showGameInHeader(gameType) {
    const meta = GAME_NAMES[gameType];
    if (!meta) return;

    const nameEl = document.getElementById('header-game-name');
    if (nameEl) nameEl.textContent = meta.name;

    setHeaderMode('game');
}


// ---------------------------------------------------------------------------
// Dynamic header offset — keeps content clear of the header regardless of
// how many rows the header wraps to on the current screen width.
// ---------------------------------------------------------------------------

function syncHeaderOffset(activePage) {
    const header = document.getElementById('top-header');
    if (!header || header.style.display === 'none') return;

    const h = header.offsetHeight;
    if (!h) return;

    if (activePage === 'home') {
        // Override the hardcoded 80px padding from the header-mode CSS rule
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.paddingTop = h + 'px';
    } else if (activePage === 'stats') {
        const container = document.querySelector('.stats-container');
        if (container) container.style.marginTop = h + 'px';
    } else if (activePage === 'settings') {
        const container = document.querySelector('.settings-container');
        if (container) container.style.paddingTop = (h + 10) + 'px';
        // Keep the settings sticky action bar just below the header
        const actionBar = document.querySelector('.settings-action-bar');
        if (actionBar) actionBar.style.top = h + 'px';
    }
}

function watchHeaderHeight(activePage) {
    const header = document.getElementById('top-header');
    if (!header) return;

    // Re-sync on every resize (header may wrap/unwrap)
    window.addEventListener('resize', () => syncHeaderOffset(activePage));

    // ResizeObserver fires whenever the header itself changes height
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => syncHeaderOffset(activePage)).observe(header);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initTopHeader(options = {}) {
    const { activePage = 'home' } = options;

    // Inject the header as the very first element inside <body>
    document.body.insertAdjacentHTML('afterbegin', buildHeaderHTML(activePage));

    // Restore persisted case mode (applies body class)
    initCase();

    // Wire the global case toggle button
    document.getElementById('global-case-toggle')?.addEventListener('click', () => {
        toggleCase();
    });

    // Initialise nikud state from localStorage
    if (window._showNikud === undefined) {
        try {
            const s = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
            window._showNikud = s.showNikud !== false;
        } catch (_) { window._showNikud = true; }
    }
    // Sync button visual to current state
    document.getElementById('nikud-toggle')?.classList.toggle('active', window._showNikud !== false);

    // Wire the nikud toggle button
    document.getElementById('nikud-toggle')?.addEventListener('click', () => {
        const next = window._showNikud === false; // flip
        window._showNikud = next;
        document.getElementById('nikud-toggle')?.classList.toggle('active', next);
        try {
            const s = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
            s.showNikud = next;
            localStorage.setItem('englishLearningSettings', JSON.stringify(s));
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('nikud-changed'));
    });

    if (activePage === 'home') {
        setupHomeEvents();
    } else {
        setupOtherPageEvents();
        requestAnimationFrame(() => {
            syncHeaderOffset(activePage);
            watchHeaderHeight(activePage);
        });
    }
}

// Exported so home page can call it after the header becomes visible (post-login)
export { syncHeaderOffset, watchHeaderHeight, showGameInHeader, setHeaderMode };
