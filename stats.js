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

// Initialize stats for all users on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeStatsPage();
});
