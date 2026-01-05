// Stats Page JavaScript

const gameNames = {
    vocabulary: { name: 'בונה אוצר מילים', icon: '📚' },
    grammar: { name: 'תרגול דקדוק', icon: '✍️' },
    pronunciation: { name: 'הגייה', icon: '🎤' },
    listening: { name: 'הקשבה', icon: '🎧' },
    reading: { name: 'איות', icon: '🔤' }
};

// Get users dynamically from authService
function getAllUsers() {
    if (typeof authService !== 'undefined' && authService.getUsers) {
        const users = authService.getUsers();
        return Object.values(users);
    }
    // Fallback to legacy users
    return [
        { id: 'omer', name: 'Omer', displayName: 'Omer' },
        { id: 'zohar', name: 'Zohar', displayName: 'Zohar' },
        { id: 'idan', name: 'Idan', displayName: 'Idan' }
    ];
}

function switchUser(userName) {
    // Update active tab
    document.querySelectorAll('.user-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.user === userName);
    });

    // Show corresponding stats content
    document.querySelectorAll('.user-stats-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`stats-${userName}`).classList.add('active');
}

function loadUserProgress(userName) {
    const storageKey = `userProgress_${userName}`;
    const saved = localStorage.getItem(storageKey);

    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error loading user progress:', error);
            return getDefaultProgress();
        }
    }
    return getDefaultProgress();
}

function getDefaultProgress() {
    return {
        hasPlayedBefore: false,
        totalGamesPlayed: 0,
        bestScores: {
            vocabulary: 0,
            grammar: 0,
            pronunciation: 0,
            listening: 0,
            reading: 0
        },
        streakDays: 0,
        lastPlayDate: null,
        totalCorrectAnswers: 0,
        preferredDifficulty: 'beginner',
        gameHistory: {}
    };
}

function calculateAverageScore(userName, gameType) {
    const storageKey = `${userName}_${gameType}_history`;
    const history = localStorage.getItem(storageKey);

    if (!history) return 0;

    try {
        const scores = JSON.parse(history);
        if (scores.length === 0) return 0;

        const sum = scores.reduce((acc, score) => acc + score, 0);
        return Math.round(sum / scores.length);
    } catch (error) {
        return 0;
    }
}

function getGamesPlayed(userName, gameType) {
    const storageKey = `${userName}_${gameType}_history`;
    const history = localStorage.getItem(storageKey);

    if (!history) return 0;

    try {
        const scores = JSON.parse(history);
        return scores.length;
    } catch (error) {
        return 0;
    }
}

function getWordMasteryStats(userName) {
    const progress = loadUserProgress(userName);
    const wordMastery = progress.wordMastery || {};

    const stats = {
        total: 0,
        new: 0,
        struggling: [],
        learning: [],
        mastered: []
    };

    Object.entries(wordMastery).forEach(([wordKey, data]) => {
        stats.total++;
        const mastery = data.masteryLevel || 0;
        const [word] = wordKey.split('_');

        const wordInfo = {
            word,
            mastery,
            attempts: data.totalAttempts,
            accuracy: data.totalAttempts > 0 ? Math.round((data.correctAttempts / data.totalAttempts) * 100) : 0,
            category: data.category || 'Unknown'
        };

        if (mastery === 0) {
            stats.new++;
        } else if (mastery < 0.5) {
            stats.struggling.push(wordInfo);
        } else if (mastery < 0.8) {
            stats.learning.push(wordInfo);
        } else {
            stats.mastered.push(wordInfo);
        }
    });

    // Sort by mastery level
    stats.struggling.sort((a, b) => a.mastery - b.mastery);
    stats.learning.sort((a, b) => a.mastery - b.mastery);
    stats.mastered.sort((a, b) => b.mastery - a.mastery);

    return stats;
}

function renderUserStats(userName) {
    const progress = loadUserProgress(userName);
    const container = document.getElementById(`stats-${userName}`);

    // Calculate overall stats
    const totalGamesPlayed = Object.keys(gameNames).reduce((total, gameType) => {
        return total + getGamesPlayed(userName, gameType);
    }, 0);

    const overallTopScore = Math.max(...Object.values(progress.bestScores));

    const overallAverage = Math.round(
        Object.keys(gameNames).reduce((sum, gameType) => {
            return sum + calculateAverageScore(userName, gameType);
        }, 0) / Object.keys(gameNames).length
    );

    // Get word mastery stats
    const masteryStats = getWordMasteryStats(userName);

    // Build HTML
    let html = '';

    // Overview Cards
    html += `
        <div class="stats-overview">
            <div class="stat-card">
                <i class="fas fa-gamepad"></i>
                <h3>סה"כ משחקים</h3>
                <div class="stat-value">${totalGamesPlayed}</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-trophy"></i>
                <h3>שיא כללי</h3>
                <div class="stat-value top-score">${overallTopScore}</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-chart-bar"></i>
                <h3>ממוצע כללי</h3>
                <div class="stat-value average-score">${overallAverage}</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-fire"></i>
                <h3>רצף ימים</h3>
                <div class="stat-value">${progress.streakDays}</div>
            </div>
        </div>
    `;

    // Games Stats Table
    html += `
        <div class="games-stats-table">
            <h2><i class="fas fa-list"></i> סטטיסטיקות לפי משחק</h2>
    `;

    if (totalGamesPlayed === 0) {
        html += `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>עדיין לא שיחקת אף משחק</p>
                <p>התחל לשחק כדי לראות את הסטטיסטיקות שלך!</p>
            </div>
        `;
    } else {
        html += `
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>משחק</th>
                        <th>משחקים ששוחקו</th>
                        <th>ממוצע</th>
                        <th>שיא</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.keys(gameNames).forEach(gameType => {
            const gamesPlayed = getGamesPlayed(userName, gameType);
            const average = calculateAverageScore(userName, gameType);
            const topScore = progress.bestScores[gameType] || 0;

            html += `
                <tr>
                    <td class="game-icon">${gameNames[gameType].icon}</td>
                    <td class="game-name">${gameNames[gameType].name}</td>
                    <td>${gamesPlayed}</td>
                    <td class="score average-score">${average}</td>
                    <td class="score top-score">${topScore}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;
    }

    html += `</div>`;

    // Word Mastery Section
    if (masteryStats.total > 0) {
        html += `
            <div class="games-stats-table">
                <h2><i class="fas fa-brain"></i> מצב שליטה במילים</h2>
                <div class="stats-overview" style="margin-top: 20px;">
                    <div class="stat-card">
                        <i class="fas fa-book"></i>
                        <h3>סה"כ מילים</h3>
                        <div class="stat-value">${masteryStats.total}</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-star-half-alt" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <h3>נאבקים</h3>
                        <div class="stat-value" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${masteryStats.struggling.length}</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-chart-line" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <h3>בתהליך למידה</h3>
                        <div class="stat-value" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${masteryStats.learning.length}</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-check-circle" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <h3>שליטה מלאה</h3>
                        <div class="stat-value" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${masteryStats.mastered.length}</div>
                    </div>
                </div>
        `;

        // Show top struggling words
        if (masteryStats.struggling.length > 0) {
            html += `
                <h3 style="margin-top: 30px; margin-bottom: 15px; color: #f59e0b;">
                    <i class="fas fa-exclamation-triangle"></i> מילים הדורשות תשומת לב (${masteryStats.struggling.length})
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th>מילה</th>
                            <th>קטגוריה</th>
                            <th>ניסיונות</th>
                            <th>דיוק</th>
                            <th>רמת שליטה</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            masteryStats.struggling.slice(0, 10).forEach(word => {
                html += `
                    <tr>
                        <td class="game-name"><strong>${word.word}</strong></td>
                        <td>${word.category}</td>
                        <td>${word.attempts}</td>
                        <td>${word.accuracy}%</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 20px; overflow: hidden;">
                                    <div style="width: ${word.mastery * 100}%; background: linear-gradient(90deg, #f59e0b, #d97706); height: 100%;"></div>
                                </div>
                                <span style="font-weight: 600; color: #f59e0b;">${Math.round(word.mastery * 100)}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        }

        // Show recently mastered words
        if (masteryStats.mastered.length > 0) {
            html += `
                <h3 style="margin-top: 30px; margin-bottom: 15px; color: #10b981;">
                    <i class="fas fa-trophy"></i> מילים בשליטה מלאה (${masteryStats.mastered.length})
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th>מילה</th>
                            <th>קטגוריה</th>
                            <th>ניסיונות</th>
                            <th>דיוק</th>
                            <th>רמת שליטה</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            masteryStats.mastered.slice(0, 10).forEach(word => {
                html += `
                    <tr>
                        <td class="game-name"><strong>${word.word}</strong></td>
                        <td>${word.category}</td>
                        <td>${word.attempts}</td>
                        <td>${word.accuracy}%</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 20px; overflow: hidden;">
                                    <div style="width: ${word.mastery * 100}%; background: linear-gradient(90deg, #10b981, #059669); height: 100%;"></div>
                                </div>
                                <span style="font-weight: 600; color: #10b981;">${Math.round(word.mastery * 100)}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        }

        html += `</div>`;
    }

    // Overall Summary Row
    const totalOverall = Object.keys(gameNames).reduce((sum, gameType) => {
        return sum + (progress.bestScores[gameType] || 0);
    }, 0);

    html += `
        <div class="games-stats-table">
            <h2><i class="fas fa-calculator"></i> סיכום כללי</h2>
            <table>
                <thead>
                    <tr>
                        <th>משחק</th>
                        <th>שיא</th>
                        <th>ממוצע</th>
                        <th>משחקים</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background: rgba(255, 215, 0, 0.1); font-weight: 800;">
                        <td class="game-name">סה"כ</td>
                        <td class="score top-score">${totalOverall}</td>
                        <td class="score average-score">${overallAverage}</td>
                        <td>${totalGamesPlayed}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// Initialize user tabs and stats dynamically
function initializeStatsPage() {
    const users = getAllUsers();
    const userTabsContainer = document.querySelector('.user-tabs');
    const statsContainer = document.querySelector('.stats-container');

    if (!userTabsContainer || !statsContainer) return;

    // Clear existing tabs and content areas
    userTabsContainer.innerHTML = '';

    // Remove old stats content areas (but keep the header and delete button)
    const oldStatsContent = document.querySelectorAll('.user-stats-content');
    oldStatsContent.forEach(el => el.remove());

    // Create tabs and content areas for each user
    users.forEach((user, index) => {
        // Create tab button
        const tab = document.createElement('button');
        tab.className = 'user-tab' + (index === 0 ? ' active' : '');
        tab.dataset.user = user.id;
        tab.onclick = () => switchUser(user.id);
        tab.innerHTML = `<i class="fas fa-user"></i> ${user.displayName || user.name}`;
        userTabsContainer.appendChild(tab);

        // Create stats content area
        const contentArea = document.createElement('div');
        contentArea.id = `stats-${user.id}`;
        contentArea.className = 'user-stats-content' + (index === 0 ? ' active' : '');
        statsContainer.appendChild(contentArea);
    });

    // Render stats for all users
    users.forEach(user => {
        renderUserStats(user.id);
    });
}

// Function to update home notification dot
function updateHomeNotificationDot() {
    const notificationDot = document.getElementById('home-notification-dot');
    if (!notificationDot) return;

    const userId = localStorage.getItem('currentUser') || 'default';
    const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading'];
    let hasSavedGames = false;

    for (const gameType of gameTypes) {
        const saved = localStorage.getItem(`savedGame_${userId}_${gameType}`);
        if (saved) {
            try {
                const gameState = JSON.parse(saved);
                const ageHours = (Date.now() - gameState.timestamp) / (1000 * 60 * 60);
                if (ageHours <= 24) {
                    hasSavedGames = true;
                    break;
                }
            } catch (error) {
                console.error('Error checking saved game:', error);
            }
        }
    }

    if (hasSavedGames) {
        notificationDot.classList.add('show');
    } else {
        notificationDot.classList.remove('show');
    }
}

// Initialize stats for all users on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeStatsPage();
    updateHomeNotificationDot();
});
