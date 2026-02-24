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

const GAMES = [
    { id: 'vocabulary',      icon: 'fa-book',        label: 'אוצר מילים', title: 'בונה אוצר מילים' },
    { id: 'grammar',         icon: 'fa-spell-check', label: 'דקדוק',      title: 'תרגול דקדוק' },
    { id: 'grammar-beginner',icon: 'fa-volume-up',   label: 'דקדוק+',     title: 'דקדוק למתחילים - למידה בהאזנה' },
    { id: 'pronunciation',   icon: 'fa-microphone',  label: 'הגייה',      title: 'הגייה' },
    { id: 'listening',       icon: 'fa-headphones',  label: 'הקשבה',      title: 'הקשבה' },
    { id: 'reading',         icon: 'fa-book-open',   label: 'קריאה',      title: 'איית אותי' },
    { id: 'abc',             icon: 'fa-font',        label: 'ABC',         title: 'ABC אותיות' },
    { id: 'memory',          icon: 'fa-th',          label: 'זיכרון',     title: 'זיכרון - מצא את הזוגות' },
    { id: 'scramble',        icon: 'fa-random',      label: 'סידור',      title: 'סידור משפטים' },
    { id: 'fill-blanks',     icon: 'fa-fill-drip',   label: 'השלמה',      title: 'השלם את המשפט' },
];

// Inline styles applied to the header when it is visible and fixed.
// Used on non-home pages (always shown) and on home page once user logs in.
const FIXED_STYLE = 'position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 1000;';

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildHeaderHTML(activePage) {
    const isHome = activePage === 'home';

    const gameButtons = GAMES.map(g => `
            <button class="top-game-btn" data-game="${g.id}" title="${g.title}">
                <i class="fas ${g.icon}"></i>
                <span>${g.label}</span>
            </button>`).join('');

    const statsClass    = activePage === 'stats'    ? ' active' : '';
    const settingsClass = activePage === 'settings' ? ' active' : '';

    // Score display is only meaningful on the home page
    const scoreHTML = isHome
        ? '<span class="header-score" id="header-score">ניקוד: <span id="current-score">0</span></span>'
        : '';

    // Header starts hidden on home (shown after login), always visible on other pages
    const headerStyle  = isHome ? 'display: none;' : `display: flex; ${FIXED_STYLE}`;
    // Streak widget only shown on home page
    const streakStyle  = isHome ? '' : ' style="display: none;"';

    return `<header class="top-header" id="top-header" style="${headerStyle}">
        <div class="header-left">
            <div class="app-logo" id="header-home-btn" style="cursor: pointer;">
                <span class="home-notification-dot" id="home-notification-dot"></span>
                <i class="fas fa-graduation-cap"></i>
                <span>לומדים אנגלית</span>
            </div>
            <nav class="top-game-nav">
                ${gameButtons}
                <button class="top-game-btn" data-game="practice" id="practice-top-btn" title="מצב תרגול"${isHome ? ' style="display: none;"' : ''}>
                    <i class="fas fa-bullseye"></i>
                    <span>תרגול</span>
                    <span class="practice-badge" id="practice-badge"></span>
                </button>
            </nav>
            <div class="top-screen-nav">
                <button class="top-screen-btn" id="nav-courses-btn" title="קורסים">
                    <i class="fas fa-graduation-cap"></i>
                    <span>קורסים</span>
                </button>
                <button class="top-screen-btn" id="nav-profile-btn" title="פרופיל">
                    <i class="fas fa-user-circle"></i>
                    <span>פרופיל</span>
                </button>
            </div>
        </div>
        <div class="header-right">
            <div class="streak-widget"${streakStyle}>
                <div class="streak-flame">🔥</div>
                <div class="streak-count" id="streak-count">0</div>
                <div class="streak-label">ימים ברצף</div>
            </div>
            <a href="stats.html" class="header-icon-btn${statsClass}" id="stats-btn" title="סטטיסטיקות">
                <i class="fas fa-chart-line"></i>
            </a>
            <a href="settings.html" class="header-icon-btn${settingsClass}" id="settings-btn" title="הגדרות">
                <i class="fas fa-cog"></i>
            </a>
            <div class="header-user-info" id="header-user-info">
                <div class="header-user-avatar" id="header-user-avatar">O</div>
                <div class="header-user-details">
                    <span class="header-user-name" id="header-user-name">User</span>
                    ${scoreHTML}
                </div>
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
    const topGameBtns = document.querySelectorAll('.top-game-btn');
    const statsBtn   = document.getElementById('stats-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Show the header after login
    function showHeader() {
        updateUserInfo();
        topHeader.style.cssText = `display: flex; ${FIXED_STYLE}`;
        document.querySelector('.app-layout')?.classList.add('header-mode');
        // Sync content offset to actual header height (may be taller than 80px if it wraps)
        requestAnimationFrame(() => {
            syncHeaderOffset('home');
            watchHeaderHeight('home');
        });
    }

    // Game nav buttons → switch game in gameManager
    topGameBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const gameType = btn.dataset.game;
            if (!gameType) return;

            const go = () => {
                if (window.gameManager) {
                    topGameBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    window.gameManager.switchGame(gameType);
                } else {
                    setTimeout(go, 100);
                }
            };
            go();
        });
    });

    // Logo → show welcome screen
    document.getElementById('header-home-btn')?.addEventListener('click', () => {
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
        topGameBtns.forEach(b => b.classList.remove('active'));
    });

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
    // Practice button starts hidden in the template (home-page logic controls it there).
    // On non-home pages we always want it visible since gamification.js isn't loaded here.
    const practiceBtn = document.getElementById('practice-top-btn');
    if (practiceBtn) practiceBtn.style.removeProperty('display');

    // Logo → navigate back to home
    document.getElementById('header-home-btn')?.addEventListener('click', () => {
        window.location.replace('index.html');
    });

    // Game nav buttons → navigate to index.html#game
    document.querySelectorAll('.top-game-btn[data-game]').forEach(btn => {
        btn.addEventListener('click', () => {
            const game = btn.dataset.game;
            if (game) window.location.replace(`index.html#${game}`);
        });
    });

    // Screen nav buttons → navigate to index.html with hash
    document.getElementById('nav-courses-btn')?.addEventListener('click', () => {
        window.location.replace('index.html#courses');
    });
    document.getElementById('nav-profile-btn')?.addEventListener('click', () => {
        window.location.replace('index.html#profile');
    });

    // Logout
    document.getElementById('header-logout-btn')?.addEventListener('click', () => {
        if (typeof authService !== 'undefined') {
            authService.logout();
            window.location.replace('index.html');
        }
    });

    // Auth events — use correct event name ('user-logged-in', not 'userLoggedIn')
    window.addEventListener('user-logged-in', updateUserInfo);
    updateUserInfo();
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

    if (activePage === 'home') {
        setupHomeEvents();
    } else {
        setupOtherPageEvents();
        // Non-home pages: header is always visible, sync offset immediately
        // Use rAF to ensure layout is calculated before measuring
        requestAnimationFrame(() => {
            syncHeaderOffset(activePage);
            watchHeaderHeight(activePage);
        });
    }
}

// Exported so home page can call it after the header becomes visible (post-login)
export { syncHeaderOffset, watchHeaderHeight };
