// Stats Page JavaScript

// userId → { displayName, name } — populated at init so renderers can show real names
let _usersMap = {};

const gameNames = {
    vocabulary: { name: 'בונה אוצר מילים', icon: '📚' },
    grammar: { name: 'תרגול דקדוק', icon: '✍️' },
    'grammar-beginner': { name: 'דקדוק מתחילים', icon: '📝' },
    pronunciation: { name: 'הגייה', icon: '🎤' },
    listening: { name: 'הקשבה', icon: '🎧' },
    reading: { name: 'איות', icon: '🔤' },
    abc: { name: 'ABC אותיות', icon: '🔠' },
    memory: { name: 'משחק זיכרון', icon: '🧠' },
    scramble: { name: 'סידור משפטים', icon: '🔀' },
    'fill-blanks': { name: 'השלם את המשפט', icon: '✏️' }
};

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function getAllUsers() {
    if (typeof authService !== 'undefined' && authService.getUsers) {
        const users = authService.getUsers();
        return Object.values(users);
    }
    return [
        { id: 'omer', name: 'Omer', displayName: 'Omer' },
        { id: 'zohar', name: 'Zohar', displayName: 'Zohar' },
        { id: 'idan', name: 'Idan', displayName: 'Idan' }
    ];
}

function loadUserProgress(userName) {
    const saved = localStorage.getItem(`userProgress_${userName}`);
    if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
    }
    return getDefaultProgress();
}

function getDefaultProgress() {
    return {
        hasPlayedBefore: false,
        totalGamesPlayed: 0,
        totalPoints: 0,
        bestScores: { vocabulary: 0, grammar: 0, pronunciation: 0, listening: 0, reading: 0, abc: 0, memory: 0 },
        streakDays: 0,
        lastPlayDate: null,
        totalCorrectAnswers: 0,
        preferredDifficulty: 'beginner',
        wordMastery: {},
        gameHistory: {}
    };
}

function calculateAverageScore(userName, gameType) {
    const history = localStorage.getItem(`${userName}_${gameType}_history`);
    if (!history) return 0;
    try {
        const scores = JSON.parse(history);
        if (!scores.length) return 0;
        const avg = Math.round(scores.reduce((a, s) => a + s, 0) / scores.length);
        return Math.min(100, avg); // clamp: old sessions may have stored raw points not percentages
    } catch (e) { return 0; }
}

function getGamesPlayed(userName, gameType) {
    const history = localStorage.getItem(`${userName}_${gameType}_history`);
    if (!history) return 0;
    try { return JSON.parse(history).length; } catch (e) { return 0; }
}

function getWordMasteryStats(userName) {
    const progress = loadUserProgress(userName);
    const wordMastery = progress.wordMastery || {};
    const stats = { total: 0, struggling: [], learning: [], mastered: [] };

    Object.entries(wordMastery).forEach(([wordKey, data]) => {
        if (!data || typeof data !== 'object') return; // guard against corrupted entries
        stats.total++;
        const mastery = data.masteryLevel || 0;
        const [word] = wordKey.split('_');
        const totalAttempts = data.totalAttempts || 0;
        const correctAttempts = data.correctAttempts || 0;
        const info = {
            word,
            mastery,
            attempts: totalAttempts,
            accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
            category: data.category || 'Unknown'
        };
        if (mastery < 0.5) stats.struggling.push(info);
        else if (mastery < 0.8) stats.learning.push(info);
        else stats.mastered.push(info);
    });

    stats.struggling.sort((a, b) => a.mastery - b.mastery);
    stats.learning.sort((a, b) => a.mastery - b.mastery);
    stats.mastered.sort((a, b) => b.mastery - a.mastery);
    return stats;
}

function loadMemoryBestRecords(userName) {
    try {
        const raw = localStorage.getItem(`memoryBest_${userName}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
}

// ---------------------------------------------------------------------------
// Delete stats
// ---------------------------------------------------------------------------

async function deleteUserStats(userId, displayName) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את כל הנתונים של ${displayName}?\nפעולה זו אינה הפיכה!`)) return;

    let isAuthorized = false;
    if (typeof showPasswordModal === 'function') {
        isAuthorized = await showPasswordModal(`מחק נתונים של ${displayName}`);
    } else {
        const pw = prompt('הכנס סיסמת מנהל:');
        isAuthorized = !!(pw && typeof authService !== 'undefined' && authService.verifyAdminPassword(pw));
        if (pw && !isAuthorized) alert('סיסמה שגויה!');
    }
    if (!isAuthorized) return;

    const gameTypes = ['vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening', 'reading', 'abc', 'memory', 'scramble', 'fill-blanks'];
    localStorage.removeItem(`userProgress_${userId}`);
    localStorage.removeItem(`memoryBest_${userId}`);
    gameTypes.forEach(g => {
        localStorage.removeItem(`${userId}_${g}_history`);
        localStorage.removeItem(`scoreHistory_${userId}_${g}`);
    });
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(`userProgress_${userId}`) || k.startsWith(`${userId}_`) || k.startsWith(`memoryBest_${userId}`))) {
            toRemove.push(k);
        }
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    alert(`הנתונים של ${displayName} נמחקו בהצלחה!`);
    setTimeout(() => location.reload(), 400);
}

// ---------------------------------------------------------------------------
// Content tab switching
// ---------------------------------------------------------------------------

function switchUser(userName) {
    document.querySelectorAll('.user-tab').forEach(t => t.classList.toggle('active', t.dataset.user === userName));
    document.getElementById('hall-of-fame-tab')?.classList.remove('active');
    document.querySelectorAll('.user-stats-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`stats-${userName}`)?.classList.add('active');
}

function switchContentTab(userId, tabId) {
    const container = document.getElementById(`stats-${userId}`);
    if (!container) return;
    container.querySelectorAll('.content-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    container.querySelectorAll('.content-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabId));
}

// ---------------------------------------------------------------------------
// Panel renderers
// ---------------------------------------------------------------------------

function renderOverviewPanel(userName, progress, masteryStats, totalGamesPlayed, overallAverage) {
    const totalPoints = progress.totalPoints || 0;
    const streakDays = progress.streakDays || 0;
    const wordsMastered = masteryStats.mastered.length;
    const wordsTotal = masteryStats.total;
    const streakColor = streakDays >= 14 ? '#f97316' : streakDays >= 7 ? '#f59e0b' : '#667eea';
    // Show display name if available, fall back to userName (the ID)
    const userInfo = _usersMap[userName] || {};
    const displayName = userInfo.displayName || userInfo.name || userName;
    const avatarLetter = displayName.charAt(0).toUpperCase();
    // Authoritative games count: prefer stored progress value, fall back to history count
    const gamesCount = Math.max(progress.totalGamesPlayed || 0, totalGamesPlayed);

    return `
        <div class="hero-card">
            <div class="hero-avatar">${avatarLetter}</div>
            <div class="hero-info">
                <div class="hero-name">${displayName}</div>
                ${streakDays > 0
                    ? `<div class="hero-streak" style="color:${streakColor}"><i class="fas fa-fire"></i> ${streakDays} ימים ברצף</div>`
                    : `<div class="hero-streak-zero">התחל רצף היום!</div>`}
            </div>
        </div>

        <div class="metric-tiles">
            <div class="metric-tile primary">
                <i class="fas fa-star"></i>
                <div class="metric-value">${totalPoints.toLocaleString()}</div>
                <div class="metric-label">ניקוד כולל</div>
            </div>
            <div class="metric-tile">
                <i class="fas fa-gamepad"></i>
                <div class="metric-value">${gamesCount}</div>
                <div class="metric-label">משחקים שוחקו</div>
            </div>
            <div class="metric-tile green">
                <i class="fas fa-check-circle"></i>
                <div class="metric-value">${wordsMastered}</div>
                <div class="metric-label">מילים נשלטות${wordsTotal > 0 ? `<br><span class="metric-sub">${wordsTotal} מילים תורגלו</span>` : ''}</div>
            </div>
            <div class="metric-tile">
                <i class="fas fa-chart-bar"></i>
                <div class="metric-value">${overallAverage}%</div>
                <div class="metric-label">ממוצע כללי</div>
            </div>
            <div class="metric-tile ${streakDays >= 7 ? 'orange' : ''}">
                <i class="fas fa-fire"></i>
                <div class="metric-value">${streakDays}</div>
                <div class="metric-label">רצף ימים</div>
            </div>
        </div>

        <div class="delete-zone">
            <div class="delete-zone-header">
                <i class="fas fa-shield-alt"></i> אזור מנהל
            </div>
            <p class="delete-zone-desc">מחיקת הנתונים תמחק את כל ההיסטוריה, הניקוד ושליטת המילים של ${displayName}. פעולה זו אינה הפיכה.</p>
            <button class="delete-user-btn" onclick="deleteUserStats('${userName}', '${displayName}')">
                <i class="fas fa-trash-alt"></i> מחק את כל הנתונים של ${displayName}
            </button>
        </div>
    `;
}

function renderGamesPanel(userName, progress, totalGamesPlayed) {
    const totalPoints = progress.totalPoints || 0;

    if (totalGamesPlayed === 0) {
        return `<div class="no-data"><i class="fas fa-inbox"></i><p>עדיין לא שיחקת אף משחק</p><p>התחל לשחק כדי לראות את הסטטיסטיקות שלך!</p></div>`;
    }

    let rows = '';
    Object.keys(gameNames).forEach(gameType => {
        const played = getGamesPlayed(userName, gameType);
        if (played === 0) return;
        const avg = calculateAverageScore(userName, gameType);
        const best = progress.bestScores?.[gameType] || 0;
        rows += `
            <tr>
                <td class="game-icon">${gameNames[gameType].icon}</td>
                <td class="game-name">${gameNames[gameType].name}</td>
                <td>${played}</td>
                <td class="score average-score">${avg}%</td>
                <td class="score top-score">${best}%</td>
            </tr>
        `;
    });

    return `
        <div class="panel-score-banner">
            <i class="fas fa-star"></i>
            ניקוד כולל נצבר: <strong>${totalPoints.toLocaleString()} נקודות</strong>
        </div>
        <div class="games-stats-table">
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>משחק</th>
                        <th>שוחק</th>
                        <th>ממוצע %</th>
                        <th>שיא %</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderWordTable(words, color) {
    return `
        <table>
            <thead>
                <tr>
                    <th>מילה</th>
                    <th>קטגוריה</th>
                    <th>ניסיונות</th>
                    <th>דיוק</th>
                    <th>שליטה</th>
                </tr>
            </thead>
            <tbody>
                ${words.map(w => `
                    <tr>
                        <td class="game-name"><strong>${w.word}</strong></td>
                        <td>${w.category}</td>
                        <td>${w.attempts}</td>
                        <td>${w.accuracy}%</td>
                        <td>
                            <div class="mastery-bar-row">
                                <div class="mastery-bar-track">
                                    <div class="mastery-bar-fill" style="width:${w.mastery * 100}%; background: linear-gradient(90deg, ${color}, ${color}cc);"></div>
                                </div>
                                <span class="mastery-pct" style="color:${color}">${Math.round(w.mastery * 100)}%</span>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderWordsPanel(masteryStats) {
    if (masteryStats.total === 0) {
        return `<div class="no-data"><i class="fas fa-book-open"></i><p>עדיין לא נלמדו מילים</p><p>שחק כדי לבנות שליטה במילים!</p></div>`;
    }

    let html = `
        <div class="mastery-overview">
            <div class="mastery-tile struggling">
                <div class="mastery-count">${masteryStats.struggling.length}</div>
                <div class="mastery-label">נאבקים</div>
            </div>
            <div class="mastery-tile learning">
                <div class="mastery-count">${masteryStats.learning.length}</div>
                <div class="mastery-label">בלמידה</div>
            </div>
            <div class="mastery-tile mastered">
                <div class="mastery-count">${masteryStats.mastered.length}</div>
                <div class="mastery-label">שליטה מלאה</div>
            </div>
            <div class="mastery-tile total-words">
                <div class="mastery-count">${masteryStats.total}</div>
                <div class="mastery-label">סה"כ מילים</div>
            </div>
        </div>
    `;

    if (masteryStats.struggling.length > 0) {
        html += `
            <div class="games-stats-table">
                <h3 class="words-section-title" style="color:#f59e0b">
                    <i class="fas fa-exclamation-triangle"></i> דורשים תשומת לב (${masteryStats.struggling.length})
                </h3>
                ${renderWordTable(masteryStats.struggling.slice(0, 10), '#f59e0b')}
            </div>
        `;
    }

    if (masteryStats.mastered.length > 0) {
        html += `
            <div class="games-stats-table">
                <h3 class="words-section-title" style="color:#10b981">
                    <i class="fas fa-trophy"></i> שליטה מלאה (${masteryStats.mastered.length})
                </h3>
                ${renderWordTable(masteryStats.mastered.slice(0, 10), '#10b981')}
            </div>
        `;
    }

    return html;
}

function renderMemoryPanel(memoryBestRecords) {
    const levels = Object.keys(memoryBestRecords).sort((a, b) => Number(a) - Number(b));

    if (levels.length === 0) {
        return `<div class="no-data"><i class="fas fa-brain"></i><p>עדיין לא שיחקת משחק זיכרון</p></div>`;
    }

    const rows = levels.map(levelKey => {
        const rec = memoryBestRecords[levelKey];
        if (!rec) return '';
        const stars = '★'.repeat(rec.stars || 0) + '☆'.repeat(3 - (rec.stars || 0));
        return `
            <tr>
                <td>רמה ${levelKey}</td>
                <td class="score top-score">${rec.score ?? 0}</td>
                <td>${rec.timeSeconds != null ? rec.timeSeconds + ' שנ\'' : '—'}</td>
                <td>${rec.moves ?? '—'}</td>
                <td class="memory-stars">${stars}</td>
                <td>${rec.date || '—'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="games-stats-table">
            <h2><i class="fas fa-brain"></i> שיאים אישיים — משחק הזיכרון</h2>
            <table>
                <thead>
                    <tr>
                        <th>רמה</th>
                        <th>ניקוד</th>
                        <th>זמן</th>
                        <th>מהלכים</th>
                        <th>כוכבים</th>
                        <th>תאריך</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderCoinsPanel(progress) {
    const coins = progress.coins || 0;
    const totalEarned = progress.totalCoinsEarned || 0;
    const today = new Date().toISOString().split('T')[0];
    const rawHistory = Array.isArray(progress.coinHistory) ? progress.coinHistory : [];
    const history = rawHistory.slice(-10).reverse();
    const earnedToday = rawHistory
        .filter(e => e && e.date === today && (e.amount || 0) > 0)
        .reduce((s, e) => s + (e.amount || 0), 0);

    const reasonLabels = {
        'daily login': 'כניסה יומית',
        'correct answer': 'תשובה נכונה',
        'perfect answer': 'תשובה מושלמת',
        'activity complete': 'סיום פעילות',
        'topic complete': 'סיום נושא',
        'perfect game': 'משחק מושלם',
    };

    const historyRows = history.map(e => {
        const label = reasonLabels[e.reason] || e.reason;
        const sign = e.amount >= 0 ? '+' : '';
        const color = e.amount >= 0 ? '#10b981' : '#ef4444';
        return `<tr>
            <td>${e.date || '—'}</td>
            <td>${label}</td>
            <td style="color:${color};font-weight:700">${sign}${e.amount}</td>
            <td>${e.balance}</td>
        </tr>`;
    }).join('');

    return `
        <div class="metric-tiles" style="grid-template-columns: repeat(3, 1fr);">
            <div class="metric-tile primary">
                <i class="fas fa-coins"></i>
                <div class="metric-value">${coins.toLocaleString()}</div>
                <div class="metric-label">יתרת מטבעות</div>
            </div>
            <div class="metric-tile green">
                <i class="fas fa-trophy"></i>
                <div class="metric-value">${totalEarned.toLocaleString()}</div>
                <div class="metric-label">סה"כ הרוויח</div>
            </div>
            <div class="metric-tile orange">
                <i class="fas fa-sun"></i>
                <div class="metric-value">${earnedToday}</div>
                <div class="metric-label">הרוויח היום</div>
            </div>
        </div>
        ${history.length > 0 ? `
        <div class="games-stats-table">
            <h2><i class="fas fa-history"></i> היסטוריית מטבעות</h2>
            <table>
                <thead>
                    <tr><th>תאריך</th><th>סיבה</th><th>סכום</th><th>יתרה</th></tr>
                </thead>
                <tbody>${historyRows}</tbody>
            </table>
        </div>` : `<div class="no-data"><i class="fas fa-coins"></i><p>עדיין לא נצברו מטבעות</p><p>שחק כדי לצבור מטבעות!</p></div>`}
    `;
}

// ---------------------------------------------------------------------------
// Main render: build content tabs + all 4 panels
// ---------------------------------------------------------------------------

function renderUserStats(userName) {
    const container = document.getElementById(`stats-${userName}`);
    if (!container) return;

    try {
    const progress = loadUserProgress(userName);
    const totalGamesPlayed = Object.keys(gameNames).reduce((t, g) => t + getGamesPlayed(userName, g), 0);
    const playedTypes = Object.keys(gameNames).filter(g => getGamesPlayed(userName, g) > 0);
    const overallAverage = playedTypes.length > 0
        ? Math.round(playedTypes.reduce((s, g) => s + calculateAverageScore(userName, g), 0) / playedTypes.length)
        : 0;
    const masteryStats = getWordMasteryStats(userName);
    const memoryBestRecords = loadMemoryBestRecords(userName);
    const hasMemory = Object.keys(memoryBestRecords).length > 0;

    container.innerHTML = `
        <nav class="content-tabs">
            <button class="content-tab active" data-tab="overview" onclick="switchContentTab('${userName}', 'overview')">
                <i class="fas fa-home"></i> סקירה
            </button>
            <button class="content-tab" data-tab="games" onclick="switchContentTab('${userName}', 'games')">
                <i class="fas fa-gamepad"></i> משחקים
            </button>
            <button class="content-tab" data-tab="words" onclick="switchContentTab('${userName}', 'words')">
                <i class="fas fa-book"></i> מילים
            </button>
            <button class="content-tab${hasMemory ? '' : ' disabled'}" data-tab="memory"
                onclick="${hasMemory ? `switchContentTab('${userName}', 'memory')` : 'void(0)'}"
                ${hasMemory ? '' : 'disabled title="עדיין לא שיחקת משחק זיכרון"'}>
                <i class="fas fa-brain"></i> זיכרון
            </button>
            <button class="content-tab" data-tab="coins" onclick="switchContentTab('${userName}', 'coins')">
                <i class="fas fa-coins"></i> מטבעות
            </button>
        </nav>

        <div class="content-panel active" data-panel="overview">
            ${renderOverviewPanel(userName, progress, masteryStats, totalGamesPlayed, overallAverage)}
        </div>
        <div class="content-panel" data-panel="games">
            ${renderGamesPanel(userName, progress, totalGamesPlayed)}
        </div>
        <div class="content-panel" data-panel="words">
            ${renderWordsPanel(masteryStats)}
        </div>
        <div class="content-panel" data-panel="memory">
            ${renderMemoryPanel(memoryBestRecords)}
        </div>
        <div class="content-panel" data-panel="coins">
            ${renderCoinsPanel(progress)}
        </div>
    `;
    } catch (err) {
        console.error(`[stats] Error rendering stats for ${userName}:`, err);
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle" style="color:#f59e0b"></i>
                <p>שגיאה בטעינת הסטטיסטיקות</p>
                <p style="font-size:0.9rem; color:#a0aec0">${err.message || ''}</p>
            </div>`;
    }
}

// ---------------------------------------------------------------------------
// Hall of Fame
// ---------------------------------------------------------------------------

function renderHallOfFame() {
    const users = getAllUsers();

    const userData = users.map(user => {
        const progress = loadUserProgress(user.id);
        const totalGamesPlayed = Object.keys(gameNames).reduce((t, g) => t + getGamesPlayed(user.id, g), 0);
        const masteryStats = getWordMasteryStats(user.id);
        const playedTypes = Object.keys(gameNames).filter(g => getGamesPlayed(user.id, g) > 0);
        const overallAverage = playedTypes.length > 0
            ? Math.round(playedTypes.reduce((s, g) => s + calculateAverageScore(user.id, g), 0) / playedTypes.length)
            : 0;
        return {
            id: user.id,
            name: user.displayName || user.name || user.id,
            totalPoints: progress.totalPoints || 0,
            totalGamesPlayed: Math.max(progress.totalGamesPlayed || 0, totalGamesPlayed),
            wordsMastered: masteryStats.mastered.length,
            streakDays: progress.streakDays || 0,
            overallAverage,
            coins: progress.coins || 0,
        };
    });

    const medals = ['🥇', '🥈', '🥉'];

    function buildLeaderboard(title, icon, key, suffix, color) {
        const sorted = [...userData].sort((a, b) => b[key] - a[key]);
        const rows = sorted.map((u, i) => {
            const medal = medals[i] || `${i + 1}.`;
            const isFirst = i === 0;
            return `
                <tr style="${isFirst ? `background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.08));` : ''}">
                    <td style="font-size:1.4rem; width:48px">${medal}</td>
                    <td style="font-weight:700; font-size:1.1rem; text-align:right">${u.name}</td>
                    <td style="font-weight:800; font-size:1.3rem; color:${color}">${u[key].toLocaleString()}${suffix}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="games-stats-table" style="margin-bottom:20px">
                <h2 style="color:${color}; margin-bottom:16px; font-size:1.3rem; display:flex; align-items:center; gap:10px; padding-bottom:12px; border-bottom:2px solid #e2e8f0">
                    <i class="${icon}"></i> ${title}
                </h2>
                <table>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    const totalPoints = userData.reduce((s, u) => s + u.totalPoints, 0);
    const totalGames = userData.reduce((s, u) => s + u.totalGamesPlayed, 0);
    const totalMastered = userData.reduce((s, u) => s + u.wordsMastered, 0);

    return `
        <div class="hero-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 8px 28px rgba(245,158,11,0.4)">
            <div class="hero-avatar" style="font-size:2.2rem">🏆</div>
            <div class="hero-info">
                <div class="hero-name">היכל התהילה</div>
                <div class="hero-streak" style="color:rgba(255,255,255,0.9)">${users.length} שחקנים · ${totalGames} משחקים · ${totalMastered} מילים נשלטות</div>
            </div>
        </div>

        <div class="metric-tiles" style="grid-template-columns: repeat(3, 1fr); margin-bottom:28px">
            <div class="metric-tile primary">
                <i class="fas fa-star"></i>
                <div class="metric-value">${totalPoints.toLocaleString()}</div>
                <div class="metric-label">ניקוד משותף</div>
            </div>
            <div class="metric-tile green">
                <i class="fas fa-gamepad"></i>
                <div class="metric-value">${totalGames}</div>
                <div class="metric-label">משחקים בסה"כ</div>
            </div>
            <div class="metric-tile orange">
                <i class="fas fa-check-circle"></i>
                <div class="metric-value">${totalMastered}</div>
                <div class="metric-label">מילים נשלטות בסה"כ</div>
            </div>
        </div>

        ${buildLeaderboard('ניקוד כולל', 'fas fa-star', 'totalPoints', '', '#667eea')}
        ${buildLeaderboard('משחקים שוחקו', 'fas fa-gamepad', 'totalGamesPlayed', '', '#10b981')}
        ${buildLeaderboard('מילים נשלטות', 'fas fa-book', 'wordsMastered', '', '#3b82f6')}
        ${buildLeaderboard('ממוצע כללי', 'fas fa-chart-bar', 'overallAverage', '%', '#8b5cf6')}
        ${buildLeaderboard('רצף ימים', 'fas fa-fire', 'streakDays', ' ימים', '#f97316')}
        ${buildLeaderboard('מטבעות', 'fas fa-coins', 'coins', '', '#f59e0b')}
    `;
}

function switchToHallOfFame() {
    document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('hall-of-fame-tab')?.classList.add('active');
    document.querySelectorAll('.user-stats-content').forEach(c => c.classList.remove('active'));
    const hof = document.getElementById('stats-hall-of-fame');
    if (hof) {
        hof.innerHTML = renderHallOfFame();
        hof.classList.add('active');
    }
}

// ---------------------------------------------------------------------------
// Page init
// ---------------------------------------------------------------------------

function initializeStatsPage() {
    const users = getAllUsers();
    const userTabsContainer = document.querySelector('.user-tabs');
    const statsContainer = document.querySelector('.stats-container');
    if (!userTabsContainer || !statsContainer) return;

    const currentUserId = localStorage.getItem('currentUser');
    const defaultUserId = (currentUserId && users.find(u => u.id === currentUserId))
        ? currentUserId
        : (users[0]?.id || null);

    // Build display-name lookup used by renderOverviewPanel
    _usersMap = {};
    users.forEach(u => { _usersMap[u.id] = { displayName: u.displayName, name: u.name }; });

    userTabsContainer.innerHTML = '';
    document.querySelectorAll('.user-stats-content').forEach(el => el.remove());

    users.forEach(user => {
        const isDefault = user.id === defaultUserId;
        const tabWrapper = document.createElement('div');
        tabWrapper.className = 'user-tab-wrapper';

        const tab = document.createElement('button');
        tab.className = 'user-tab' + (isDefault ? ' active' : '');
        tab.dataset.user = user.id;
        tab.onclick = () => switchUser(user.id);
        tab.innerHTML = `<i class="fas fa-user"></i> ${user.displayName || user.name}`;

        tabWrapper.appendChild(tab);
        userTabsContainer.appendChild(tabWrapper);

        const contentArea = document.createElement('div');
        contentArea.id = `stats-${user.id}`;
        contentArea.className = 'user-stats-content' + (isDefault ? ' active' : '');
        statsContainer.appendChild(contentArea);
    });

    // Hall of Fame tab
    const hofWrapper = document.createElement('div');
    hofWrapper.className = 'user-tab-wrapper';
    const hofTab = document.createElement('button');
    hofTab.id = 'hall-of-fame-tab';
    hofTab.className = 'user-tab hof-tab';
    hofTab.onclick = switchToHallOfFame;
    hofTab.innerHTML = `<i class="fas fa-trophy"></i> היכל התהילה`;
    hofWrapper.appendChild(hofTab);
    userTabsContainer.appendChild(hofWrapper);

    const hofContent = document.createElement('div');
    hofContent.id = 'stats-hall-of-fame';
    hofContent.className = 'user-stats-content';
    statsContainer.appendChild(hofContent);

    users.forEach(user => renderUserStats(user.id));
}

function updateHomeNotificationDot() {
    const notificationDot = document.getElementById('home-notification-dot');
    if (!notificationDot) return;
    const userId = localStorage.getItem('currentUser') || 'default';
    const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading', 'abc'];
    let hasSavedGames = false;
    for (const g of gameTypes) {
        const saved = localStorage.getItem(`savedGame_${userId}_${g}`);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if ((Date.now() - state.timestamp) / 3600000 <= 24) { hasSavedGames = true; break; }
            } catch (e) {}
        }
    }
    notificationDot.classList.toggle('show', hasSavedGames);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeStatsPage();
    updateHomeNotificationDot();
});
