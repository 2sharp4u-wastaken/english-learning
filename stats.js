// Stats Page JavaScript

const V2_STORAGE_PREFIX = 'v2_';
const MEMORY_MAX_STARS = 4;

// userId → { displayName, name } — populated at init so renderers can show real names
let _usersMap = {};

const WORD_JOURNEY_STAGES = [
    { id: 'discover', label: 'גילוי', icon: '👀' },
    { id: 'listen-match', label: 'הקשבה', icon: '👂' },
    { id: 'spell-tiles', label: 'כתיבה', icon: '✏️' },
    { id: 'say-word', label: 'דיבור', icon: '🎤' },
    { id: 'recall', label: 'זיכרון', icon: '🧠' }
];

const CATEGORY_META = {
    animals: { name: 'חיות', icon: '🐾' },
    colors: { name: 'צבעים', icon: '🎨' },
    numbers: { name: 'מספרים', icon: '🔢' },
    food: { name: 'אוכל ושתייה', icon: '🍎' },
    body: { name: 'חלקי גוף', icon: '👁️' },
    family: { name: 'משפחה', icon: '👨‍👩‍👧' },
    clothes: { name: 'בגדים', icon: '👕' },
    home: { name: 'בית וחפצים', icon: '🏠' },
    actions: { name: 'פעולות', icon: '🏃' },
    nature: { name: 'טבע', icon: '🌿' },
    school: { name: 'בית ספר', icon: '📚' },
    minecraft: { name: 'Minecraft', icon: '⛏️' },
    gaming: { name: 'משחקים', icon: '🎮' },
    roblox: { name: 'Roblox', icon: '🟥' },
    feelings: { name: 'רגשות', icon: '😊' },
    adjectives: { name: 'תארים', icon: '✨' },
    places: { name: 'מקומות', icon: '📍' },
    time: { name: 'זמן', icon: '⏰' },
    weather: { name: 'מזג אוויר', icon: '☀️' },
    sports: { name: 'ספורט', icon: '⚽' },
    transportation: { name: 'תחבורה', icon: '🚌' },
    tools: { name: 'כלים וציוד', icon: '🧰' },
    signs: { name: 'שלטים וסמלים', icon: '🚸' },
    music: { name: 'מוזיקה', icon: '🎵' },
    custom: { name: 'מותאם אישית', icon: '⭐' }
};

const gameNames = {
    'word-journey': { name: 'מסע המילים', icon: '🗺️' },
    vocabulary: { name: 'מבחן מילים', icon: '📚' },
    grammar: { name: 'תרגול דקדוק', icon: '✍️' },
    'grammar-beginner': { name: 'דקדוק מתחילים', icon: '📝' },
    pronunciation: { name: 'הגייה', icon: '🎤' },
    listening: { name: 'הקשבה', icon: '🎧' },
    reading: { name: 'איות', icon: '🔤' },
    abc: { name: 'ABC אותיות', icon: '🔠' },
    memory: { name: 'משחק זיכרון', icon: '🧠' },
    'picture-match': { name: 'מילה לתמונה', icon: '🖼️' },
    scramble: { name: 'סידור משפטים', icon: '🔀' },
    'fill-blanks': { name: 'השלם את המשפט', icon: '✏️' },
    'true-or-not': { name: 'נכון או לא?', icon: '✅' },
    'word-builder': { name: 'בונה משפטים', icon: '🔨' },
    'story-time': { name: 'זמן סיפור', icon: '📖' }
};

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function safeParse(raw, fallback = null) {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function buildWordKey(word, category) {
    return `${String(word || '').toLowerCase()}_${category || ''}`;
}

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

function getDefaultProgress() {
    return {
        hasPlayedBefore: false,
        totalGamesPlayed: 0,
        totalPoints: 0,
        totalLearningTimeMs: 0,
        bestScores: {
            'word-journey': 0,
            vocabulary: 0,
            grammar: 0,
            'grammar-beginner': 0,
            pronunciation: 0,
            listening: 0,
            reading: 0,
            abc: 0,
            memory: 0,
            'picture-match': 0,
            scramble: 0,
            'fill-blanks': 0
        },
        streakDays: 0,
        lastPlayDate: null,
        totalCorrectAnswers: 0,
        wordMastery: {},
        learnedWords: {},
        wordJourneyProgress: {},
        gameUnlocks: {},
        coins: 0,
        totalCoinsEarned: 0,
        coinHistory: [],
        activityDates: [],
        gameHistory: {}
    };
}

function normalizeProgress(progress) {
    const defaults = getDefaultProgress();
    return {
        ...defaults,
        ...(progress || {}),
        bestScores: { ...defaults.bestScores, ...((progress || {}).bestScores || {}) },
        wordMastery: { ...((progress || {}).wordMastery || {}) },
        learnedWords: { ...((progress || {}).learnedWords || {}) },
        wordJourneyProgress: { ...((progress || {}).wordJourneyProgress || {}) },
        gameUnlocks: { ...((progress || {}).gameUnlocks || {}) },
        coinHistory: Array.isArray((progress || {}).coinHistory) ? progress.coinHistory : [],
        activityDates: Array.isArray((progress || {}).activityDates) ? progress.activityDates : []
    };
}

function loadUserProgress(userId) {
    const v2Saved = safeParse(localStorage.getItem(`${V2_STORAGE_PREFIX}userProgress_${userId}`));
    if (v2Saved) return normalizeProgress(v2Saved);

    const legacySaved = safeParse(localStorage.getItem(`userProgress_${userId}`));
    if (legacySaved) return normalizeProgress(legacySaved);

    return getDefaultProgress();
}

function calculateAverageScore(userId, gameType) {
    const history = localStorage.getItem(`${userId}_${gameType}_history`);
    if (!history) return 0;
    try {
        const scores = JSON.parse(history);
        if (!scores.length) return 0;
        const avg = Math.round(scores.reduce((a, s) => a + s, 0) / scores.length);
        return Math.min(100, avg);
    } catch (e) {
        return 0;
    }
}

function calculateBestScore(userId, gameType) {
    const history = localStorage.getItem(`${userId}_${gameType}_history`);
    if (!history) return 0;
    try {
        const scores = JSON.parse(history);
        if (!scores.length) return 0;
        return Math.min(100, Math.max(...scores));
    } catch (e) {
        return 0;
    }
}

function getGamesPlayed(userId, gameType) {
    const history = localStorage.getItem(`${userId}_${gameType}_history`);
    if (!history) return 0;
    try {
        return JSON.parse(history).length;
    } catch (e) {
        return 0;
    }
}

function getCategoryMeta(category) {
    return CATEGORY_META[category] || { name: category || 'ללא קטגוריה', icon: '📘' };
}

function getVocabularyIndex() {
    const bank = Array.isArray(window.vocabularyBank) ? window.vocabularyBank : [];
    const byKey = {};
    const categoryTotals = {};

    bank.forEach(word => {
        const key = buildWordKey(word.word, word.category);
        if (!byKey[key]) byKey[key] = word;
        categoryTotals[word.category] = (categoryTotals[word.category] || 0) + 1;
    });

    return { bank, byKey, categoryTotals };
}

function getWordDisplayInfo(wordKey, vocabIndex) {
    const raw = vocabIndex.byKey[wordKey];
    const parts = wordKey.split('_');
    const fallbackWord = parts[0] || '';
    const fallbackCategory = parts.slice(1).join('_') || raw?.category || 'custom';
    const categoryMeta = getCategoryMeta(raw?.category || fallbackCategory);

    return {
        word: raw?.word || fallbackWord,
        translation: raw?.translation || '',
        category: raw?.category || fallbackCategory,
        categoryLabel: categoryMeta.name,
        categoryIcon: categoryMeta.icon
    };
}

function normalizeStageIds(stageIds = []) {
    const stageSet = new Set(stageIds);
    return WORD_JOURNEY_STAGES.map(stage => stage.id).filter(stageId => stageSet.has(stageId));
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDurationCompact(ms) {
    if (!ms || ms <= 0) return '0 דק׳';
    const totalMinutes = Math.max(1, Math.round(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${totalMinutes} דק׳`;
    if (minutes === 0) return `${hours} ש׳`;
    return `${hours}ש ${minutes}ד`;
}

function getLearningVelocity(progress) {
    const learnedEntries = Object.values(progress.learnedWords || {});
    const weekThreshold = new Date(Date.now() - (6 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const wordsThisWeek = learnedEntries.filter(entry => entry?.graduatedDate && entry.graduatedDate >= weekThreshold).length;

    return {
        wordsThisWeek,
        label: `${wordsThisWeek} מילים בשבוע`
    };
}

function getWordMasteryStats(progress) {
    const wordMastery = progress.wordMastery || {};
    const stats = { total: 0, struggling: [], learning: [], mastered: [] };

    Object.entries(wordMastery).forEach(([wordKey, data]) => {
        if (!data || typeof data !== 'object') return;
        stats.total++;

        const mastery = data.masteryLevel || 0;
        const totalAttempts = data.totalAttempts || 0;
        const correctAttempts = data.correctAttempts || 0;
        const categoryMeta = getCategoryMeta(data.category);
        const word = data.word || wordKey.split('_')[0];
        const info = {
            word,
            mastery,
            attempts: totalAttempts,
            accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
            category: data.category || 'custom',
            categoryLabel: categoryMeta.name
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

function loadMemoryBestRecords(userId) {
    try {
        const raw = localStorage.getItem(`memoryBest_${userId}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

        return Object.fromEntries(
            Object.entries(parsed)
                .filter(([, record]) => record && typeof record === 'object' && !Array.isArray(record))
                .map(([levelKey, record]) => {
                    const numericStars = Number(record.stars);
                    const stars = Number.isFinite(numericStars)
                        ? Math.max(0, Math.min(MEMORY_MAX_STARS, Math.floor(numericStars)))
                        : 0;

                    return [levelKey, { ...record, stars }];
                })
        );
    } catch (e) {
        return {};
    }
}

function loadWordJourneySave(userId) {
    const raw = localStorage.getItem(`savedGame_${userId}_word-journey`);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        return ageHours <= 24 ? parsed : null;
    } catch (e) {
        return null;
    }
}

function buildJourneyStatusRows(userId, progress) {
    const vocabIndex = getVocabularyIndex();
    const learnedWords = progress.learnedWords || {};
    const journeyProgress = progress.wordJourneyProgress || {};
    const rowsMap = new Map();
    const allStageIds = WORD_JOURNEY_STAGES.map(stage => stage.id);

    const upsertRow = (key, patch = {}) => {
        const display = getWordDisplayInfo(key, vocabIndex);
        const existing = rowsMap.get(key) || {
            key,
            ...display,
            completedStages: [],
            startedDate: null,
            lastUpdated: null,
            graduatedDate: null,
            journeyScore: null,
            journeyCompletions: 0,
            reinforcedCount: 0,
            isLearned: false,
            isCurrentJourney: false,
            currentStageId: null
        };

        const mergedStages = normalizeStageIds([
            ...existing.completedStages,
            ...((patch.completedStages || []).filter(Boolean))
        ]);

        const next = {
            ...existing,
            ...patch,
            ...display,
            completedStages: mergedStages
        };

        rowsMap.set(key, next);
    };

    Object.entries(journeyProgress).forEach(([key, entry]) => {
        const learnedEntry = learnedWords[key];
        upsertRow(key, {
            completedStages: entry.completedStages || [],
            startedDate: entry.startedDate || learnedEntry?.graduatedDate || null,
            lastUpdated: entry.lastUpdated || entry.completedDate || learnedEntry?.lastPracticed || null,
            graduatedDate: learnedEntry?.graduatedDate || entry.completedDate || null,
            journeyScore: learnedEntry?.journeyScore ?? null,
            journeyCompletions: learnedEntry?.journeyCompletions || 0,
            reinforcedCount: (learnedEntry?.reinforcedIn || []).length,
            isLearned: Boolean(learnedEntry)
        });
    });

    Object.entries(learnedWords).forEach(([key, entry]) => {
        upsertRow(key, {
            completedStages: allStageIds,
            startedDate: entry.graduatedDate || null,
            lastUpdated: entry.lastPracticed || entry.graduatedDate || null,
            graduatedDate: entry.graduatedDate || null,
            journeyScore: entry.journeyScore ?? null,
            journeyCompletions: entry.journeyCompletions || 0,
            reinforcedCount: (entry.reinforcedIn || []).length,
            isLearned: true
        });
    });

    const savedJourney = loadWordJourneySave(userId);
    const stageDescriptors = Array.isArray(savedJourney?.shuffledQuestions) ? savedJourney.shuffledQuestions : [];
    const currentStageIndex = Math.max(0, Math.min(savedJourney?.currentQuestionIndex || 0, stageDescriptors.length));
    const completedFromSave = stageDescriptors.slice(0, currentStageIndex).map(stage => stage.stageId).filter(Boolean);
    const currentStageId = stageDescriptors[currentStageIndex]?.stageId || null;
    const currentWords = stageDescriptors.find(stage => Array.isArray(stage.words))?.words || [];

    currentWords.forEach(word => {
        const key = buildWordKey(word.word, word.category);
        upsertRow(key, {
            completedStages: completedFromSave,
            isCurrentJourney: true,
            currentStageId,
            startedDate: rowsMap.get(key)?.startedDate || new Date(savedJourney.timestamp).toISOString().slice(0, 10),
            lastUpdated: rowsMap.get(key)?.lastUpdated || new Date(savedJourney.timestamp).toISOString().slice(0, 10)
        });
    });

    const rows = Array.from(rowsMap.values());
    const rank = row => {
        if (row.isCurrentJourney && !row.isLearned) return 0;
        if (!row.isLearned && row.completedStages.length > 0) return 1;
        if (row.isLearned) return 2;
        return 3;
    };

    rows.sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;

        const aDate = a.graduatedDate || a.lastUpdated || a.startedDate || '';
        const bDate = b.graduatedDate || b.lastUpdated || b.startedDate || '';
        if (aDate !== bDate) return bDate.localeCompare(aDate);

        return a.word.localeCompare(b.word);
    });

    return rows;
}

function buildCategoryCompletion(progress) {
    const vocabIndex = getVocabularyIndex();
    const learnedWords = progress.learnedWords || {};
    const wordMastery = progress.wordMastery || {};
    const learnedByCategory = {};
    const practicedByCategory = {};

    Object.keys(learnedWords).forEach(key => {
        const category = getWordDisplayInfo(key, vocabIndex).category;
        learnedByCategory[category] = (learnedByCategory[category] || 0) + 1;
    });

    Object.values(wordMastery).forEach(entry => {
        const category = entry?.category;
        if (!category) return;
        practicedByCategory[category] = (practicedByCategory[category] || 0) + 1;
    });

    const categoryIds = new Set([
        ...Object.keys(vocabIndex.categoryTotals),
        ...Object.keys(learnedByCategory),
        ...Object.keys(practicedByCategory)
    ]);

    const rows = Array.from(categoryIds).map(categoryId => {
        const meta = getCategoryMeta(categoryId);
        const total = vocabIndex.categoryTotals[categoryId] || 0;
        const learned = learnedByCategory[categoryId] || 0;
        const practiced = practicedByCategory[categoryId] || 0;
        const pct = total > 0 ? Math.round((learned / total) * 100) : 0;

        return {
            id: categoryId,
            name: meta.name,
            icon: meta.icon,
            total,
            learned,
            practiced,
            pct
        };
    }).sort((a, b) => {
        if (b.learned !== a.learned) return b.learned - a.learned;
        if (b.pct !== a.pct) return b.pct - a.pct;
        return a.name.localeCompare(b.name);
    });

    const startedCount = rows.filter(row => row.learned > 0 || row.practiced > 0).length;
    const completedCount = rows.filter(row => row.total > 0 && row.learned >= row.total).length;

    return { rows, startedCount, completedCount };
}

function buildUserStatsModel(userId) {
    const progress = loadUserProgress(userId);
    const totalGamesPlayed = Object.keys(gameNames).reduce((total, gameType) => total + getGamesPlayed(userId, gameType), 0);
    const playedTypes = Object.keys(gameNames).filter(gameType => getGamesPlayed(userId, gameType) > 0);
    const overallAverage = playedTypes.length > 0
        ? Math.round(playedTypes.reduce((sum, gameType) => sum + calculateAverageScore(userId, gameType), 0) / playedTypes.length)
        : 0;
    const masteryStats = getWordMasteryStats(progress);
    const memoryBestRecords = loadMemoryBestRecords(userId);
    const journeyRows = buildJourneyStatusRows(userId, progress);
    const categoryCompletion = buildCategoryCompletion(progress);
    const learningVelocity = getLearningVelocity(progress);
    const learnedCount = Object.keys(progress.learnedWords || {}).length;
    const inProgressCount = journeyRows.filter(row => !row.isLearned).length;

    return {
        userId,
        progress,
        totalGamesPlayed: Math.max(progress.totalGamesPlayed || 0, totalGamesPlayed),
        overallAverage,
        masteryStats,
        memoryBestRecords,
        hasMemory: Object.keys(memoryBestRecords).length > 0,
        journeyRows,
        learnedCount,
        inProgressCount,
        categoryRows: categoryCompletion.rows,
        categoriesStartedCount: categoryCompletion.startedCount,
        categoriesCompletedCount: categoryCompletion.completedCount,
        learningVelocity,
        totalLearningTimeMs: progress.totalLearningTimeMs || 0
    };
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

    const gameTypes = Object.keys(gameNames);
    localStorage.removeItem(`${V2_STORAGE_PREFIX}userProgress_${userId}`);
    localStorage.removeItem(`userProgress_${userId}`);
    localStorage.removeItem(`memoryBest_${userId}`);

    gameTypes.forEach(gameType => {
        localStorage.removeItem(`${userId}_${gameType}_history`);
        localStorage.removeItem(`scoreHistory_${userId}_${gameType}`);
        localStorage.removeItem(`savedGame_${userId}_${gameType}`);
    });

    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
            key.startsWith(`${V2_STORAGE_PREFIX}userProgress_${userId}`) ||
            key.startsWith(`userProgress_${userId}`) ||
            key.startsWith(`${userId}_`) ||
            key.startsWith(`memoryBest_${userId}`) ||
            key.startsWith(`savedGame_${userId}_`)
        ) {
            toRemove.push(key);
        }
    }

    toRemove.forEach(key => localStorage.removeItem(key));
    alert(`הנתונים של ${displayName} נמחקו בהצלחה!`);
    setTimeout(() => location.reload(), 400);
}

// ---------------------------------------------------------------------------
// Content tab switching
// ---------------------------------------------------------------------------

function switchUser(userId) {
    document.querySelectorAll('.user-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.user === userId));
    document.getElementById('hall-of-fame-tab')?.classList.remove('active');
    document.querySelectorAll('.user-stats-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`stats-${userId}`)?.classList.add('active');
}

function switchContentTab(userId, tabId) {
    const container = document.getElementById(`stats-${userId}`);
    if (!container) return;

    container.querySelectorAll('.content-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
    container.querySelectorAll('.content-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabId));
}

// ---------------------------------------------------------------------------
// Panel renderers
// ---------------------------------------------------------------------------

function renderOverviewPanel(userId, model) {
    const progress = model.progress;
    const streakDays = progress.streakDays || 0;
    const totalPoints = progress.totalPoints || 0;
    const streakColor = streakDays >= 14 ? '#f97316' : streakDays >= 7 ? '#f59e0b' : '#667eea';
    const userInfo = _usersMap[userId] || {};
    const displayName = userInfo.displayName || userInfo.name || userId;
    const avatarLetter = displayName.charAt(0).toUpperCase();

    return `
        <div class="metric-tiles">
            <div class="metric-tile primary">
                <i class="fas fa-star"></i>
                <div class="metric-value">${totalPoints.toLocaleString()}</div>
                <div class="metric-label">ניקוד כולל</div>
            </div>
            <div class="metric-tile">
                <i class="fas fa-gamepad"></i>
                <div class="metric-value">${model.totalGamesPlayed}</div>
                <div class="metric-label">משחקים שוחקו</div>
            </div>
            <div class="metric-tile green">
                <i class="fas fa-seedling"></i>
                <div class="metric-value">${model.learnedCount}</div>
                <div class="metric-label">מילים נלמדו</div>
            </div>
            <div class="metric-tile">
                <i class="fas fa-clock"></i>
                <div class="metric-value">${formatDurationCompact(model.totalLearningTimeMs)}</div>
                <div class="metric-label">זמן למידה</div>
            </div>
            <div class="metric-tile ${streakDays >= 7 ? 'orange' : ''}">
                <i class="fas fa-fire"></i>
                <div class="metric-value">${streakDays}</div>
                <div class="metric-label">רצף ימים</div>
            </div>
        </div>

        <div class="overview-insights">
            <div class="insight-card">
                <div class="insight-title"><i class="fas fa-bolt"></i> קצב למידה</div>
                <div class="insight-value">${model.learningVelocity.wordsThisWeek}</div>
                <div class="insight-subtitle">מילים שנלמדו ב-7 הימים האחרונים</div>
            </div>
            <div class="insight-card">
                <div class="insight-title"><i class="fas fa-layer-group"></i> נושאים בתהליך</div>
                <div class="insight-value">${model.categoriesStartedCount}/${model.categoryRows.length}</div>
                <div class="insight-subtitle">קטגוריות שכבר תורגלו או נלמדו</div>
            </div>
            <div class="insight-card">
                <div class="insight-title"><i class="fas fa-route"></i> מסע מילים</div>
                <div class="insight-value">${model.inProgressCount}</div>
                <div class="insight-subtitle">מילים עם מסע פעיל או חלקי</div>
            </div>
            <div class="insight-card">
                <div class="insight-title"><i class="fas fa-chart-bar"></i> ממוצע כללי</div>
                <div class="insight-value">${model.overallAverage}%</div>
                <div class="insight-subtitle">ממוצע המשחקים ששוחקו עד עכשיו</div>
            </div>
        </div>

        <div class="delete-zone">
            <div class="delete-zone-header">
                <i class="fas fa-shield-alt"></i> אזור מנהל
            </div>
            <p class="delete-zone-desc">מחיקת הנתונים תמחק את כל ההיסטוריה, מסע המילים, הזמן שנצבר והמטבעות של ${displayName}. פעולה זו אינה הפיכה.</p>
            <button class="delete-user-btn" onclick="deleteUserStats('${userId}', '${displayName}')">
                <i class="fas fa-trash-alt"></i> מחק את כל הנתונים של ${displayName}
            </button>
        </div>
    `;
}

function renderGamesPanel(userId, model) {
    const totalPoints = model.progress.totalPoints || 0;

    if (model.totalGamesPlayed === 0) {
        return `<div class="no-data"><i class="fas fa-inbox"></i><p>עדיין לא שיחקת אף משחק</p><p>התחל לשחק כדי לראות את הסטטיסטיקות שלך!</p></div>`;
    }

    let rows = '';
    Object.keys(gameNames).forEach(gameType => {
        const played = getGamesPlayed(userId, gameType);
        if (played === 0) return;

        const avg = calculateAverageScore(userId, gameType);
        const best = calculateBestScore(userId, gameType);
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
                ${words.map(word => `
                    <tr>
                        <td class="game-name"><strong>${word.word}</strong></td>
                        <td>${word.categoryLabel}</td>
                        <td>${word.attempts}</td>
                        <td>${word.accuracy}%</td>
                        <td>
                            <div class="mastery-bar-row">
                                <div class="mastery-bar-track">
                                    <div class="mastery-bar-fill" style="width:${word.mastery * 100}%; background: linear-gradient(90deg, ${color}, ${color}cc);"></div>
                                </div>
                                <span class="mastery-pct" style="color:${color}">${Math.round(word.mastery * 100)}%</span>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderJourneyStagePills(row) {
    return `
        <div class="journey-stage-strip">
            ${WORD_JOURNEY_STAGES.map(stage => {
                const isDone = row.completedStages.includes(stage.id);
                const isCurrent = !isDone && row.currentStageId === stage.id;
                const cls = `journey-stage-pill${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`;
                return `<span class="${cls}">${stage.icon} ${stage.label}</span>`;
            }).join('')}
        </div>
    `;
}

function getJourneyStatusText(row) {
    if (row.isLearned) {
        const scoreText = row.journeyScore != null ? ` • ${row.journeyScore}%` : '';
        return { text: `נלמדה${scoreText}`, cls: 'learned' };
    }
    if (row.isCurrentJourney) {
        return { text: `במסע עכשיו • ${row.completedStages.length}/${WORD_JOURNEY_STAGES.length}`, cls: 'active' };
    }
    if (row.completedStages.length > 0) {
        return { text: `${row.completedStages.length}/${WORD_JOURNEY_STAGES.length} שלבים הושלמו`, cls: 'partial' };
    }
    return { text: 'עוד לא התחיל', cls: '' };
}

function renderJourneyTable(rows) {
    return `
        <table>
            <thead>
                <tr>
                    <th>מילה</th>
                    <th>קטגוריה</th>
                    <th>שלבי מסע</th>
                    <th>סטטוס</th>
                    <th>עודכן</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => {
                    const status = getJourneyStatusText(row);
                    const updatedDate = row.graduatedDate || row.lastUpdated || row.startedDate;
                    return `
                        <tr>
                            <td class="game-name">
                                <strong>${row.word}</strong>
                                ${row.translation ? `<div class="word-meta-translation">${row.translation}</div>` : ''}
                            </td>
                            <td>${row.categoryIcon} ${row.categoryLabel}</td>
                            <td>${renderJourneyStagePills(row)}</td>
                            <td><span class="journey-status-badge ${status.cls}">${status.text}</span></td>
                            <td>${formatDate(updatedDate)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderWordsPanel(model) {
    if (model.masteryStats.total === 0 && model.journeyRows.length === 0) {
        return `<div class="no-data"><i class="fas fa-book-open"></i><p>עדיין לא נלמדו מילים</p><p>שחק כדי לבנות שליטה במילים!</p></div>`;
    }

    let html = `
        <div class="mastery-overview">
            <div class="mastery-tile mastered">
                <div class="mastery-count">${model.learnedCount}</div>
                <div class="mastery-label">מילים נלמדו</div>
            </div>
            <div class="mastery-tile learning">
                <div class="mastery-count">${model.inProgressCount}</div>
                <div class="mastery-label">מסעות בתהליך</div>
            </div>
            <div class="mastery-tile total-words">
                <div class="mastery-count">${model.masteryStats.total}</div>
                <div class="mastery-label">מילים שתורגלו</div>
            </div>
            <div class="mastery-tile struggling">
                <div class="mastery-count">${model.learningVelocity.wordsThisWeek}</div>
                <div class="mastery-label">מילים השבוע</div>
            </div>
        </div>
    `;

    if (model.journeyRows.length > 0) {
        html += `
            <div class="games-stats-table">
                <h3 class="words-section-title" style="color:#667eea">
                    <i class="fas fa-route"></i> סטטוס מסע המילים לפי מילה
                </h3>
                ${renderJourneyTable(model.journeyRows)}
            </div>
        `;
    }

    if (model.masteryStats.total > 0) {
        html += `
            <div class="mastery-overview">
                <div class="mastery-tile struggling">
                    <div class="mastery-count">${model.masteryStats.struggling.length}</div>
                    <div class="mastery-label">דורשות חיזוק</div>
                </div>
                <div class="mastery-tile learning">
                    <div class="mastery-count">${model.masteryStats.learning.length}</div>
                    <div class="mastery-label">בלמידה</div>
                </div>
                <div class="mastery-tile mastered">
                    <div class="mastery-count">${model.masteryStats.mastered.length}</div>
                    <div class="mastery-label">בשליטה מלאה</div>
                </div>
                <div class="mastery-tile total-words">
                    <div class="mastery-count">${model.masteryStats.total}</div>
                    <div class="mastery-label">סה"כ מילים</div>
                </div>
            </div>
        `;
    }

    if (model.masteryStats.struggling.length > 0) {
        html += `
            <div class="games-stats-table">
                <h3 class="words-section-title" style="color:#f59e0b">
                    <i class="fas fa-exclamation-triangle"></i> דורשות תשומת לב (${model.masteryStats.struggling.length})
                </h3>
                ${renderWordTable(model.masteryStats.struggling.slice(0, 10), '#f59e0b')}
            </div>
        `;
    }

    if (model.masteryStats.mastered.length > 0) {
        html += `
            <div class="games-stats-table">
                <h3 class="words-section-title" style="color:#10b981">
                    <i class="fas fa-trophy"></i> שליטה מלאה (${model.masteryStats.mastered.length})
                </h3>
                ${renderWordTable(model.masteryStats.mastered.slice(0, 10), '#10b981')}
            </div>
        `;
    }

    return html;
}

function renderCategoryPanel(model) {
    if (model.categoryRows.length === 0) {
        return `<div class="no-data"><i class="fas fa-layer-group"></i><p>אין עדיין נתוני קטגוריות להצגה</p></div>`;
    }

    return `
        <div class="mastery-overview">
            <div class="mastery-tile total-words">
                <div class="mastery-count">${model.categoriesStartedCount}</div>
                <div class="mastery-label">קטגוריות שהתחילו</div>
            </div>
            <div class="mastery-tile mastered">
                <div class="mastery-count">${model.categoriesCompletedCount}</div>
                <div class="mastery-label">קטגוריות שהושלמו</div>
            </div>
            <div class="mastery-tile learning">
                <div class="mastery-count">${model.learnedCount}</div>
                <div class="mastery-label">מילים נלמדו</div>
            </div>
            <div class="mastery-tile struggling">
                <div class="mastery-count">${model.learningVelocity.wordsThisWeek}</div>
                <div class="mastery-label">מילים השבוע</div>
            </div>
        </div>

        <div class="category-progress-grid">
            ${model.categoryRows.map(category => `
                <div class="category-progress-card">
                    <div class="category-progress-head">
                        <span class="category-progress-name">${category.icon} ${category.name}</span>
                        <strong>${category.learned}/${category.total || '—'}</strong>
                    </div>
                    <div class="mastery-bar-track">
                        <div class="mastery-bar-fill" style="width:${category.pct}%; background: linear-gradient(90deg, #667eea, #10b981);"></div>
                    </div>
                    <div class="category-progress-meta">
                        <span>${category.pct}% הושלמו</span>
                        <span>${category.practiced} מילים תורגלו</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderMemoryPanel(memoryBestRecords) {
    const levels = Object.keys(memoryBestRecords).sort((a, b) => Number(a) - Number(b));

    if (levels.length === 0) {
        return `<div class="no-data"><i class="fas fa-brain"></i><p>עדיין לא שיחקת משחק זיכרון</p></div>`;
    }

    const rows = levels.map(levelKey => {
        const record = memoryBestRecords[levelKey];
        if (!record) return '';
        const starsCount = Math.max(0, Math.min(MEMORY_MAX_STARS, Math.floor(Number(record.stars) || 0)));
        const stars = starsCount > 0
            ? '★'.repeat(starsCount) + '☆'.repeat(MEMORY_MAX_STARS - starsCount)
            : '—';
        return `
            <tr>
                <td>רמה ${levelKey}</td>
                <td class="score top-score">${record.score ?? 0}</td>
                <td>${record.timeSeconds != null ? `${record.timeSeconds} שנ'` : '—'}</td>
                <td>${record.moves ?? '—'}</td>
                <td class="memory-stars">${stars}</td>
                <td>${record.date || '—'}</td>
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
        .filter(entry => entry && entry.date === today && (entry.amount || 0) > 0)
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);

    const reasonLabels = {
        'daily login': 'כניסה יומית',
        'correct answer': 'תשובה נכונה',
        'perfect answer': 'תשובה מושלמת',
        'activity complete': 'סיום פעילות',
        'topic complete': 'סיום נושא',
        'perfect game': 'משחק מושלם'
    };

    const historyRows = history.map(entry => {
        const label = reasonLabels[entry.reason] || entry.reason;
        const sign = entry.amount >= 0 ? '+' : '';
        const color = entry.amount >= 0 ? '#10b981' : '#ef4444';
        const gameMeta = entry.gameType ? gameNames[entry.gameType] : null;
        const gameCell = gameMeta
            ? `${gameMeta.icon} ${gameMeta.name}`
            : '—';
        return `
            <tr>
                <td>${entry.date || '—'}</td>
                <td>${label}</td>
                <td>${gameCell}</td>
                <td style="color:${color};font-weight:700">${sign}${entry.amount}</td>
                <td>${entry.balance}</td>
            </tr>
        `;
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
                        <tr><th>תאריך</th><th>סיבה</th><th>משחק</th><th>סכום</th><th>יתרה</th></tr>
                    </thead>
                    <tbody>${historyRows}</tbody>
                </table>
            </div>
        ` : `<div class="no-data"><i class="fas fa-coins"></i><p>עדיין לא נצברו מטבעות</p><p>שחק כדי לצבור מטבעות!</p></div>`}
    `;
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function renderUserStats(userId) {
    const container = document.getElementById(`stats-${userId}`);
    if (!container) return;

    try {
        const model = buildUserStatsModel(userId);

        container.innerHTML = `
            <nav class="content-tabs">
                <button class="content-tab active" data-tab="overview" onclick="switchContentTab('${userId}', 'overview')">
                    <i class="fas fa-home"></i> סקירה
                </button>
                <button class="content-tab" data-tab="games" onclick="switchContentTab('${userId}', 'games')">
                    <i class="fas fa-gamepad"></i> משחקים
                </button>
                <button class="content-tab" data-tab="words" onclick="switchContentTab('${userId}', 'words')">
                    <i class="fas fa-book"></i> מילים
                </button>
                <button class="content-tab" data-tab="categories" onclick="switchContentTab('${userId}', 'categories')">
                    <i class="fas fa-layer-group"></i> קטגוריות
                </button>
                <button class="content-tab${model.hasMemory ? '' : ' disabled'}" data-tab="memory"
                    onclick="${model.hasMemory ? `switchContentTab('${userId}', 'memory')` : 'void(0)'}"
                    ${model.hasMemory ? '' : 'disabled title="עדיין לא שיחקת משחק זיכרון"'}>
                    <i class="fas fa-brain"></i> זיכרון
                </button>
                <button class="content-tab" data-tab="coins" onclick="switchContentTab('${userId}', 'coins')">
                    <i class="fas fa-coins"></i> מטבעות
                </button>
            </nav>

            <div class="content-panel active" data-panel="overview">
                ${renderOverviewPanel(userId, model)}
            </div>
            <div class="content-panel" data-panel="games">
                ${renderGamesPanel(userId, model)}
            </div>
            <div class="content-panel" data-panel="words">
                ${renderWordsPanel(model)}
            </div>
            <div class="content-panel" data-panel="categories">
                ${renderCategoryPanel(model)}
            </div>
            <div class="content-panel" data-panel="memory">
                ${renderMemoryPanel(model.memoryBestRecords)}
            </div>
            <div class="content-panel" data-panel="coins">
                ${renderCoinsPanel(model.progress)}
            </div>
        `;
    } catch (err) {
        console.error(`[stats] Error rendering stats for ${userId}:`, err);
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-exclamation-circle" style="color:#f59e0b"></i>
                <p>שגיאה בטעינת הסטטיסטיקות</p>
                <p style="font-size:0.9rem; color:#a0aec0">${err.message || ''}</p>
            </div>
        `;
    }
}

// ---------------------------------------------------------------------------
// Hall of Fame
// ---------------------------------------------------------------------------

function renderHallOfFame() {
    const users = getAllUsers();

    const userData = users.map(user => {
        const model = buildUserStatsModel(user.id);
        return {
            id: user.id,
            name: user.displayName || user.name || user.id,
            totalPoints: model.progress.totalPoints || 0,
            totalGamesPlayed: model.totalGamesPlayed,
            wordsLearned: model.learnedCount,
            learningVelocity: model.learningVelocity.wordsThisWeek,
            streakDays: model.progress.streakDays || 0,
            coins: model.progress.coins || 0
        };
    });

    const medals = ['🥇', '🥈', '🥉'];

    function buildLeaderboard(title, icon, key, color, formatter = value => value.toLocaleString()) {
        const sorted = [...userData].sort((a, b) => b[key] - a[key]);
        const rows = sorted.map((user, index) => {
            const medal = medals[index] || `${index + 1}.`;
            const isFirst = index === 0;
            return `
                <tr style="${isFirst ? 'background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.08));' : ''}">
                    <td style="font-size:1.4rem; width:48px">${medal}</td>
                    <td style="font-weight:700; font-size:1.1rem; text-align:right">${user.name}</td>
                    <td style="font-weight:800; font-size:1.3rem; color:${color}">${formatter(user[key])}</td>
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

    const totalPoints = userData.reduce((sum, user) => sum + user.totalPoints, 0);
    const totalGames = userData.reduce((sum, user) => sum + user.totalGamesPlayed, 0);
    const totalLearned = userData.reduce((sum, user) => sum + user.wordsLearned, 0);

    return `
        <div class="hero-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 8px 28px rgba(245,158,11,0.4)">
            <div class="hero-avatar" style="font-size:2.2rem">🏆</div>
            <div class="hero-info">
                <div class="hero-name">היכל התהילה</div>
                <div class="hero-streak" style="color:rgba(255,255,255,0.9)">${users.length} שחקנים · ${totalGames} משחקים · ${totalLearned} מילים נלמדו</div>
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
                <i class="fas fa-seedling"></i>
                <div class="metric-value">${totalLearned}</div>
                <div class="metric-label">מילים נלמדו בסה"כ</div>
            </div>
        </div>

        ${buildLeaderboard('ניקוד כולל', 'fas fa-star', 'totalPoints', '#667eea')}
        ${buildLeaderboard('משחקים שוחקו', 'fas fa-gamepad', 'totalGamesPlayed', '#10b981')}
        ${buildLeaderboard('מילים נלמדו', 'fas fa-seedling', 'wordsLearned', '#3b82f6')}
        ${buildLeaderboard('קצב למידה שבועי', 'fas fa-bolt', 'learningVelocity', '#8b5cf6', value => `${value} מילים`)}
        ${buildLeaderboard('רצף ימים', 'fas fa-fire', 'streakDays', '#f97316', value => `${value} ימים`)}
        ${buildLeaderboard('מטבעות', 'fas fa-coins', 'coins', '#f59e0b')}
    `;
}

function switchToHallOfFame() {
    document.querySelectorAll('.user-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById('hall-of-fame-tab')?.classList.add('active');
    document.querySelectorAll('.user-stats-content').forEach(content => content.classList.remove('active'));
    const hallOfFame = document.getElementById('stats-hall-of-fame');
    if (hallOfFame) {
        hallOfFame.innerHTML = renderHallOfFame();
        hallOfFame.classList.add('active');
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
    const defaultUserId = (currentUserId && users.find(user => user.id === currentUserId))
        ? currentUserId
        : (users[0]?.id || null);

    _usersMap = {};
    users.forEach(user => {
        _usersMap[user.id] = { displayName: user.displayName, name: user.name };
    });

    userTabsContainer.innerHTML = '';
    document.querySelectorAll('.user-stats-content').forEach(element => element.remove());

    users.forEach(user => {
        const isDefault = user.id === defaultUserId;
        const tabWrapper = document.createElement('div');
        tabWrapper.className = 'user-tab-wrapper';

        const tab = document.createElement('button');
        tab.className = `user-tab${isDefault ? ' active' : ''}`;
        tab.dataset.user = user.id;
        tab.onclick = () => switchUser(user.id);
        tab.innerHTML = `<i class="fas fa-user"></i> ${user.displayName || user.name}`;

        tabWrapper.appendChild(tab);
        userTabsContainer.appendChild(tabWrapper);

        const contentArea = document.createElement('div');
        contentArea.id = `stats-${user.id}`;
        contentArea.className = `user-stats-content${isDefault ? ' active' : ''}`;
        statsContainer.appendChild(contentArea);
    });

    const hallOfFameWrapper = document.createElement('div');
    hallOfFameWrapper.className = 'user-tab-wrapper';

    const hallOfFameTab = document.createElement('button');
    hallOfFameTab.id = 'hall-of-fame-tab';
    hallOfFameTab.className = 'user-tab hof-tab';
    hallOfFameTab.onclick = switchToHallOfFame;
    hallOfFameTab.innerHTML = '<i class="fas fa-trophy"></i> היכל התהילה';
    hallOfFameWrapper.appendChild(hallOfFameTab);
    userTabsContainer.appendChild(hallOfFameWrapper);

    const hallOfFameContent = document.createElement('div');
    hallOfFameContent.id = 'stats-hall-of-fame';
    hallOfFameContent.className = 'user-stats-content';
    statsContainer.appendChild(hallOfFameContent);

    users.forEach(user => renderUserStats(user.id));
}

function updateHomeNotificationDot() {
    const notificationDot = document.getElementById('home-notification-dot');
    if (!notificationDot) return;

    const userId = localStorage.getItem('currentUser') || 'default';
    const gameTypes = Object.keys(gameNames);
    let hasSavedGames = false;

    for (const gameType of gameTypes) {
        const saved = localStorage.getItem(`savedGame_${userId}_${gameType}`);
        if (!saved) continue;

        try {
            const state = JSON.parse(saved);
            if ((Date.now() - state.timestamp) / 3600000 <= 24) {
                hasSavedGames = true;
                break;
            }
        } catch (e) {
            // Ignore malformed saved states
        }
    }

    notificationDot.classList.toggle('show', hasSavedGames);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeStatsPage();
    updateHomeNotificationDot();
});
