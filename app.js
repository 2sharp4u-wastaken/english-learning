// Main Application File - English Learning Games

// Import Manager Classes
import { ScoreManager } from './managers/ScoreManager.js';
import { ProgressManager } from './managers/ProgressManager.js';
import { GameRegistry, gameRegistry } from './managers/GameRegistry.js';
import { CourseManager } from './managers/CourseManager.js';
import { CertificateManager } from './managers/CertificateManager.js';
import { CoinManager } from './managers/CoinManager.js';

// Import Course Data
import { allCourses } from './data/courses/index.js';

// Import Game Classes
import { MemoryGame } from './games/memory-game.js';
import { SentenceScrambleGame } from './games/sentence-scramble-game.js';
import { FillBlanksGame } from './games/fill-blanks-game.js';
import { WordJourneyGame } from './games/word-journey-game.js?t=1773001200';

class AppManager {
    constructor() {
        // Wait for auth to be ready before initializing
        this.currentUser = null;
        this.userProgress = null;
        this.settings = this.loadSettings();
        this.achievements = [];

        // Manager instances (will be initialized after userProgress is loaded)
        this.scoreManager = null;
        this.progressManager = null;
        this.courseManager = null;
        this.certificateManager = null;
        this.coinManager = null;

        this.initializeApp();
    }

    initializeApp() {
        // MUST be first: create game instances before auth check so that
        // initializeManagers() (called inside setupWithAuth) can safely inject managers.
        this.initializeGameInstances();

        // Check if authService is ready
        if (typeof authService !== 'undefined') {
            this.setupWithAuth();
        } else {
            // Fallback if auth.js not loaded (shouldn't happen)
            console.warn('Auth service not found, using legacy mode');
            this.setupLegacyMode();
        }

        this.setupGlobalEventListeners();
        this.checkBrowserCompatibility();
        this.loadAchievements();
        this.updatePracticeModeIndicator();

        // Wire language toggle if present
        const langToggle = document.getElementById('lang-toggle');
        if (langToggle) {
            langToggle.addEventListener('click', () => {
                if (typeof gameManager !== 'undefined' && gameManager?.toggleLanguage) {
                    gameManager.toggleLanguage();
                }
            });
        }
    }

    setupWithAuth() {
        // Get current authenticated user
        const userId = authService.getCurrentUserId();

        if (userId) {
            this.currentUser = userId;
            this.userProgress = this.loadUserProgress();
            this.initializeManagers();
            console.log(`App initialized for user: ${userId}`);
        } else {
            console.log('No authenticated user, waiting for login');
            // User will login, then we'll reload
        }
    }

    setupLegacyMode() {
        // Old user selector logic (fallback)
        this.setupUserSelector();
        this.userProgress = this.loadUserProgress();
        this.initializeManagers();
    }

    initializeGameInstances() {
        // Create game instances — they act as UI renderers, state is owned by GameManager
        this.memoryGame = new MemoryGame();
        this.scrambleGame = new SentenceScrambleGame();
        this.fillBlanksGame = new FillBlanksGame();

        window.memoryGame = this.memoryGame;
        window.scrambleGame = this.scrambleGame;
        window.fillBlanksGame = this.fillBlanksGame;

        this.wordJourneyGame = new WordJourneyGame();
        window.wordJourneyGame = this.wordJourneyGame;

        console.log('[AppManager] Game instances created');
    }

    // ============================================================
    // PHASE 3 - Screen Navigation
    // ============================================================

    /**
     * Navigate to a named screen.
     * Valid ids: 'welcome-screen', 'user-hub-screen', 'topics-screen',
     *            or any game content id (e.g. 'vocabulary-game').
     */
    showScreen(screenId) {
        document.querySelectorAll('.game-content').forEach(el => {
            el.style.display = 'none';
        });
        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = 'block';
        }
        this.currentScreenId = screenId;
    }

    setupScreenNavigation() {
        // User-info pill → open user hub (profile tab)
        const userInfoPill = document.getElementById('header-user-info');
        if (userInfoPill) {
            userInfoPill.addEventListener('click', () => {
                this.renderUserHub();
                this.showScreen('user-hub-screen');
            });
        }

        // Back from user hub → welcome
        const hubBackBtn = document.getElementById('user-hub-back-btn');
        if (hubBackBtn) {
            hubBackBtn.addEventListener('click', () => {
                this.showScreen('welcome-screen');
            });
        }

        // Hub tab buttons
        document.querySelectorAll('.hub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchHubTab(btn.dataset.tab);
            });
        });

        // Back from topics → user hub (courses tab)
        const topicsBackBtn = document.getElementById('topics-back-btn');
        if (topicsBackBtn) {
            topicsBackBtn.addEventListener('click', () => {
                this.renderCoursesScreen();
                this.switchHubTab('courses');
                this.showScreen('user-hub-screen');
            });
        }

        // Certificate modal close
        const certContinueBtn = document.getElementById('cert-continue-btn');
        if (certContinueBtn) {
            certContinueBtn.addEventListener('click', () => {
                this.hideCertificateModal();
            });
        }
    }

    // ============================================================
    // PHASE 3 - Course Selection Screen
    // ============================================================

    renderCoursesScreen() {
        const grid = document.getElementById('courses-grid');
        if (!grid || !this.courseManager) return;

        // Update coin balance
        const coinEl = document.getElementById('hub-coin-balance');
        if (coinEl) coinEl.textContent = this.userProgress?.coins || 0;

        const courses = this.courseManager.getAllCourses();
        if (courses.length === 0) {
            grid.innerHTML = '<div style="text-align:center;color:#a0aec0;padding:40px;">אין קורסים זמינים</div>';
            return;
        }

        grid.innerHTML = courses.map(course => {
            const unlocked = this.courseManager.isCourseUnlocked(course.id);
            const progress = this.courseManager.getCourseProgress(course.id);
            const diffClass = course.difficulty || 'beginner';
            const diffLabel = { beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' }[diffClass] || diffClass;

            return `
                <div class="course-row" data-course-id="${course.id}">
                    <div class="course-card ${unlocked ? 'expandable' : 'locked'}">
                        <div class="course-card-top">
                            <div class="course-card-icon">${course.icon || '📚'}</div>
                            <div class="course-card-info">
                                <h3 class="course-card-name">${course.nameHebrew || course.name}</h3>
                                <p class="course-card-desc">${course.descriptionHebrew || course.description || ''}</p>
                            </div>
                            <div class="course-card-lock">
                                ${unlocked
                                    ? '<i class="fas fa-chevron-down course-expand-icon"></i>'
                                    : '🔒'}
                            </div>
                        </div>
                        <div class="course-difficulty-badge ${diffClass}">${diffLabel}</div>
                        <div class="course-progress-row">
                            <div class="course-progress-bar">
                                <div class="course-progress-fill" style="width:${progress}%"></div>
                            </div>
                            <span class="course-progress-pct">${progress}%</span>
                        </div>
                    </div>
                    <div class="course-detail-panel" id="course-detail-${course.id}"></div>
                </div>
            `;
        }).join('');

        // Wire click handlers for expandable cards
        grid.querySelectorAll('.course-card.expandable').forEach(card => {
            card.addEventListener('click', () => {
                const courseId = card.closest('.course-row').dataset.courseId;
                this.toggleCourseDetail(courseId, card);
            });
        });
    }

    toggleCourseDetail(courseId, cardEl) {
        const panel = document.getElementById(`course-detail-${courseId}`);
        if (!panel) return;

        const isOpen = panel.classList.contains('open');

        // Close all open panels and reset their expand icons
        document.querySelectorAll('.course-detail-panel.open').forEach(p => {
            p.classList.remove('open');
            p.previousElementSibling?.classList.remove('card-open');
            p.previousElementSibling?.querySelector('.course-expand-icon')?.classList.remove('rotated');
        });

        if (!isOpen) {
            // (Re-)render fresh so mastery/completion state is current
            panel.innerHTML = this.buildCourseDetailHTML(courseId);
            panel.classList.add('open');
            cardEl.classList.add('card-open');
            cardEl.querySelector('.course-expand-icon')?.classList.add('rotated');

            // Wire topic click handlers
            panel.querySelectorAll('.topic-card:not(.locked)').forEach(topicCard => {
                topicCard.addEventListener('click', () => {
                    const topicId = topicCard.dataset.topicId;
                    this.showTopicActivityPicker(topicId, courseId, topicCard);
                });
            });
        }
    }

    buildCourseDetailHTML(courseId) {
        const course = this.courseManager?.getCourse(courseId);
        if (!course) return '';

        const progress = this.courseManager.getCourseProgress(courseId);

        let html = `
            <div class="course-detail-progress">
                <div class="topics-progress-bar">
                    <div class="topics-progress-fill" style="width:${progress}%"></div>
                </div>
                <span class="topics-progress-label">${progress}% הושלם</span>
            </div>
        `;

        (course.units || []).forEach(unit => {
            html += `<div class="topic-unit-divider">${unit.nameHebrew || unit.name} ${unit.icon || ''}</div>`;

            (unit.topics || []).forEach(topic => {
                const unlocked = this.courseManager.isTopicUnlocked(topic.id);
                const completed = this.courseManager.isTopicCompleted(topic.id);
                const mastery = this.courseManager.getTopicMastery(topic.id);
                const topicProgress = this.userProgress?.topicProgress?.[topic.id];
                const completedActivities = topicProgress?.completedActivities || [];

                const activitiesBadges = (topic.activities || []).map(act => {
                    const done = completedActivities.includes(act);
                    const labels = {
                        vocabulary: 'אוצר מילים', listening: 'הקשבה', memory: 'זיכרון',
                        scramble: 'סידור', 'fill-blanks': 'השלמה', grammar: 'דקדוק',
                        pronunciation: 'הגייה', reading: 'קריאה', abc: 'ABC'
                    };
                    return `<span class="activity-badge ${done ? 'done' : ''}">${labels[act] || act}</span>`;
                }).join('');

                const rightIcon = completed
                    ? `<span class="topic-check-icon">✅</span>`
                    : unlocked
                        ? `<i class="fas fa-chevron-left topic-arrow-icon"></i>`
                        : `<span class="topic-lock-icon">🔒</span>`;

                html += `
                    <div class="topic-card ${unlocked ? '' : 'locked'} ${completed ? 'completed' : ''}"
                         data-topic-id="${topic.id}" data-course-id="${courseId}">
                        <div class="topic-card-icon">${topic.icon || '📖'}</div>
                        <div class="topic-card-body">
                            <div class="topic-card-name">${topic.nameHebrew || topic.name}</div>
                            <div class="topic-card-activities">${activitiesBadges}</div>
                            ${mastery > 0 ? `
                            <div class="topic-mastery-row">
                                <div class="topic-mastery-bar">
                                    <div class="topic-mastery-fill" style="width:${mastery}%"></div>
                                </div>
                                <span class="topic-mastery-pct">${mastery}%</span>
                            </div>` : ''}
                        </div>
                        <div class="topic-card-right">${rightIcon}</div>
                    </div>
                `;
            });
        });

        return html;
    }

    // ============================================================
    // PHASE 3 - Topic Selection Screen
    // ============================================================

    renderTopicsScreen(courseId) {
        this.currentCourseId = courseId;
        const course = this.courseManager?.getCourse(courseId);
        if (!course) return;

        // Update header
        const titleEl = document.getElementById('topics-course-title');
        if (titleEl) titleEl.textContent = course.nameHebrew || course.name;
        const iconEl = document.getElementById('topics-course-icon');
        if (iconEl) iconEl.textContent = course.icon || '📚';

        // Course progress bar
        const progress = this.courseManager.getCourseProgress(courseId);
        const progressFill = document.getElementById('topics-progress-fill');
        if (progressFill) progressFill.style.width = progress + '%';
        const progressLabel = document.getElementById('topics-progress-label');
        if (progressLabel) progressLabel.textContent = `${progress}% הושלם`;

        // Update coin balance
        const coinEl = document.getElementById('topics-coin-balance');
        if (coinEl) coinEl.textContent = this.userProgress?.coins || 0;

        // Render topics grouped by unit
        const list = document.getElementById('topics-list');
        if (!list) return;

        let html = '';
        (course.units || []).forEach(unit => {
            html += `<div class="topic-unit-divider">${unit.nameHebrew || unit.name} ${unit.icon || ''}</div>`;

            (unit.topics || []).forEach(topic => {
                const unlocked = this.courseManager.isTopicUnlocked(topic.id);
                const completed = this.courseManager.isTopicCompleted(topic.id);
                const mastery = this.courseManager.getTopicMastery(topic.id);
                const topicProgress = this.userProgress?.topicProgress?.[topic.id];
                const completedActivities = topicProgress?.completedActivities || [];

                const activitiesBadges = (topic.activities || []).map(act => {
                    const done = completedActivities.includes(act);
                    const labels = {
                        vocabulary: 'אוצר מילים', listening: 'הקשבה', memory: 'זיכרון',
                        scramble: 'סידור', 'fill-blanks': 'השלמה', grammar: 'דקדוק',
                        pronunciation: 'הגייה', reading: 'קריאה', abc: 'ABC'
                    };
                    return `<span class="activity-badge ${done ? 'done' : ''}">${labels[act] || act}</span>`;
                }).join('');

                const rightIcon = completed
                    ? `<span class="topic-check-icon">✅</span>`
                    : unlocked
                        ? `<i class="fas fa-chevron-left topic-arrow-icon"></i>`
                        : `<span class="topic-lock-icon">🔒</span>`;

                html += `
                    <div class="topic-card ${unlocked ? '' : 'locked'} ${completed ? 'completed' : ''}"
                         data-topic-id="${topic.id}" data-course-id="${courseId}">
                        <div class="topic-card-icon">${topic.icon || '📖'}</div>
                        <div class="topic-card-body">
                            <div class="topic-card-name">${topic.nameHebrew || topic.name}</div>
                            <div class="topic-card-activities">${activitiesBadges}</div>
                            ${mastery > 0 ? `
                            <div class="topic-mastery-row">
                                <div class="topic-mastery-bar">
                                    <div class="topic-mastery-fill" style="width:${mastery}%"></div>
                                </div>
                                <span class="topic-mastery-pct">${mastery}%</span>
                            </div>` : ''}
                        </div>
                        <div class="topic-card-right">${rightIcon}</div>
                    </div>
                `;
            });
        });

        list.innerHTML = html;

        // Wire click handlers for unlocked topics
        list.querySelectorAll('.topic-card:not(.locked)').forEach(card => {
            card.addEventListener('click', () => {
                const topicId = card.dataset.topicId;
                this.showTopicActivityPicker(topicId, courseId, card);
            });
        });
    }

    showTopicActivityPicker(topicId, courseId, cardEl) {
        // Remove existing picker if any
        document.querySelectorAll('.topic-activity-picker').forEach(el => el.remove());

        const topicData = this.courseManager?.getTopic(topicId);
        if (!topicData) return;
        const { topic } = topicData;

        const activityIcons = {
            vocabulary: '📚', listening: '👂', memory: '🃏',
            scramble: '🔀', 'fill-blanks': '✍️', grammar: '✏️',
            pronunciation: '🎤', reading: '📖', abc: '🔤'
        };
        const activityLabels = {
            vocabulary: 'אוצר מילים', listening: 'הקשבה', memory: 'זיכרון',
            scramble: 'סידור משפטים', 'fill-blanks': 'השלמת משפט',
            grammar: 'דקדוק', pronunciation: 'הגייה', reading: 'קריאה', abc: 'ABC'
        };

        const picker = document.createElement('div');
        picker.className = 'topic-activity-picker show';
        picker.innerHTML = `
            <div class="topic-activity-picker-title">בחר פעילות: ${topic.nameHebrew || topic.name}</div>
            <div class="activity-picker-grid">
                ${(topic.activities || []).map(act => `
                    <button class="activity-picker-btn" data-activity="${act}" data-topic="${topicId}">
                        <span class="activity-icon">${activityIcons[act] || '🎮'}</span>
                        ${activityLabels[act] || act}
                    </button>
                `).join('')}
            </div>
        `;

        cardEl.insertAdjacentElement('afterend', picker);

        // Wire activity buttons
        picker.querySelectorAll('.activity-picker-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const activity = btn.dataset.activity;
                picker.remove();
                this.startTopicActivity(topicId, activity, topic);
            });
        });

        // Close picker when clicking elsewhere
        const closeHandler = (e) => {
            if (!picker.contains(e.target) && !cardEl.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 100);
    }

    startTopicActivity(topicId, activityType, topic) {
        // Mark topic as started
        this.courseManager?.startTopic(topicId);

        // Navigate to the appropriate game
        // gameManager.startGame() handles showing the correct screen
        if (typeof gameManager !== 'undefined') {
            // For games that need a category, use the topic's words
            if (['vocabulary', 'listening', 'pronunciation', 'reading', 'grammar'].includes(activityType)) {
                // Start game with topic words if available
                if (topic.words && topic.words.length > 0) {
                    gameManager.currentTopicId = topicId;
                    gameManager.startGame(activityType, topic.words);
                } else {
                    gameManager.startGame(activityType);
                }
            } else {
                gameManager.currentTopicId = topicId;
                gameManager.startGame(activityType);
            }
        }
    }

    // ============================================================
    // PHASE 3 - Profile / Dashboard Screen
    // ============================================================

    renderProfileScreen() {
        // Avatar
        const avatarEl = document.getElementById('profile-avatar-large');
        if (avatarEl) {
            const name = this.currentUser || 'U';
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }

        // Name
        const nameEl = document.getElementById('profile-student-name');
        if (nameEl) {
            nameEl.textContent = this.userProgress?.studentName || this.currentUser || 'לומד';
        }

        // Coins (profile hero)
        const coinsEl = document.getElementById('profile-coin-count');
        if (coinsEl) coinsEl.textContent = this.userProgress?.coins || 0;

        // Streak
        const streakEl = document.getElementById('profile-streak');
        if (streakEl) streakEl.textContent = this.userProgress?.streakDays || 0;

        // Topics done (from CourseManager stats)
        const topicsDoneEl = document.getElementById('profile-topics-done');
        if (topicsDoneEl && this.courseManager) {
            const stats = this.courseManager.getStats();
            topicsDoneEl.textContent = stats.completedTopics;
        }

        // Words mastered – use ProgressManager mastery stats when available
        const wordsMasteredEl = document.getElementById('profile-words-mastered');
        if (wordsMasteredEl) {
            let masteredCount = 0;

            if (this.progressManager?.getMasteryStats) {
                const masteryStats = this.progressManager.getMasteryStats();
                masteredCount = masteryStats.mastered || 0;
            } else {
                // Fallback to legacy userProgress.wordMastery structure
                masteredCount = Object.values(this.userProgress?.wordMastery || {})
                    .filter(w => (w.masteryLevel ?? w.mastery ?? 0) >= 0.8).length;
            }

            wordsMasteredEl.textContent = masteredCount;
        }

        // Certificates count
        const certsEl = document.getElementById('profile-certs-count');
        if (certsEl) certsEl.textContent = (this.userProgress?.certificates || []).length;

        // Recommended next step (next topic to work on)
        const nextActionContainer = document.getElementById('profile-next-action');
        const nextActionBtn = document.getElementById('profile-next-btn');
        if (nextActionContainer && nextActionBtn && this.courseManager) {
            const recommendation = this.courseManager.getNextRecommendedTopic();

            if (recommendation && recommendation.topic && recommendation.course) {
                const { topic, course } = recommendation;
                const courseName = course.nameHebrew || course.name || '';
                const topicName = topic.nameHebrew || topic.name || '';

                nextActionBtn.textContent = `${courseName} • ${topicName}`;
                nextActionBtn.onclick = () => {
                    const activities = topic.activities || [];
                    const defaultActivity = activities[0] || 'vocabulary';
                    this.startTopicActivity(topic.id, defaultActivity, topic);
                };

                nextActionContainer.style.display = 'block';
            } else {
                nextActionContainer.style.display = 'none';
                nextActionBtn.onclick = null;
            }
        }

        // Certificates gallery
        this.renderCertificateGallery();
    }

    renderCertificateGallery() {
        const grid = document.getElementById('profile-certificates-grid');
        if (!grid) return;

        const certs = this.userProgress?.certificates || [];
        if (certs.length === 0) {
            grid.innerHTML = '<div class="no-certs-msg">עוד אין תעודות. סיים נושא כדי לקבל תעודה! 🎓</div>';
            return;
        }

        grid.innerHTML = certs.map(cert => `
            <div class="mini-cert-card" title="${cert.topicName}">
                <span class="mini-cert-icon">🏅</span>
                <div class="mini-cert-name">${cert.topicName}</div>
                <div class="mini-cert-date">${cert.earnedDate || ''}</div>
            </div>
        `).join('');
    }

    // ============================================================
    // PHASE 3 - User Hub (Profile + Courses unified screen)
    // ============================================================

    renderUserHub(defaultTab = 'profile') {
        this.renderProfileScreen();
        this.renderCoursesScreen();
        this.switchHubTab(defaultTab);
        // Initialize chime selector after DOM is updated
        setTimeout(() => {
            if (typeof window.initChimeSelector === 'function') window.initChimeSelector();
        }, 50);
    }

    switchHubTab(tabName) {
        document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.hub-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${tabName}`)?.classList.add('active');
        document.getElementById(`hub-panel-${tabName}`)?.classList.add('active');
    }

    // ============================================================
    // PHASE 3 - Certificate Modal
    // ============================================================

    showCertificateModal(topicName, score) {
        const modal = document.getElementById('certificate-modal');
        if (!modal) return;

        document.getElementById('cert-topic-name').textContent = topicName || 'נושא';
        document.getElementById('cert-score').textContent = score || 100;
        const today = new Date().toLocaleDateString('he-IL');
        document.getElementById('cert-date').textContent = today;

        modal.style.display = 'flex';

        // Fire confetti
        if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        }
    }

    hideCertificateModal() {
        const modal = document.getElementById('certificate-modal');
        if (modal) modal.style.display = 'none';
    }

    // ============================================================
    // END PHASE 3
    // ============================================================

    initializeManagers() {
        if (!this.userProgress) {
            console.error('Cannot initialize managers: userProgress not loaded');
            return;
        }

        console.log('[AppManager] Initializing managers...');

        // Initialize managers in dependency order
        this.scoreManager = new ScoreManager(); // ScoreManager doesn't need userProgress
        this.progressManager = new ProgressManager(this.userProgress);
        this.courseManager = new CourseManager(this.userProgress, this.progressManager);
        this.certificateManager = new CertificateManager(this.userProgress);
        this.coinManager = new CoinManager(this.userProgress);

        // Initialize each manager
        this.scoreManager.initialize();
        this.progressManager.initialize(this.userProgress);
        this.courseManager.initialize();
        this.certificateManager.initialize();
        this.coinManager.initialize();

        // Register all courses
        allCourses.forEach(course => {
            this.courseManager.registerCourse(course);
        });

        // Inject real managers into already-created game instances
        // (instances were created unconditionally in initializeGameInstances())
        if (this.memoryGame) {
            this.memoryGame.scoreManager = this.scoreManager;
            this.memoryGame.progressManager = this.progressManager;
        }
        if (this.scrambleGame) {
            this.scrambleGame.scoreManager = this.scoreManager;
            this.scrambleGame.progressManager = this.progressManager;
        }
        if (this.fillBlanksGame) {
            this.fillBlanksGame.scoreManager = this.scoreManager;
            this.fillBlanksGame.progressManager = this.progressManager;
        }

        // Export managers globally for access from other modules
        window.scoreManager = this.scoreManager;
        window.progressManager = this.progressManager;
        window.courseManager = this.courseManager;
        window.certificateManager = this.certificateManager;
        window.coinManager = this.coinManager;
        window.gameRegistry = gameRegistry;
        window.showCertificateModal = (topicName, score) => this.showCertificateModal(topicName, score);
        window.showScreen = (id) => this.showScreen(id);

        // Setup Phase 3 screen navigation
        this.setupScreenNavigation();

        console.log('[AppManager] All managers initialized successfully');
    }

    updatePracticeModeIndicator() {
        const badge = document.getElementById('practice-badge');
        if (badge && typeof SettingsManager !== 'undefined' && SettingsManager.isPracticeMode()) {
            badge.style.display = 'inline-block';
        }
    }

    setupUserSelector() {
        // Load saved user or default to 'O'
        this.currentUser = localStorage.getItem('currentUser') || 'O';

        // Set active state on load
        const userButtons = document.querySelectorAll('.user-btn');
        userButtons.forEach(btn => {
            if (btn.dataset.user === this.currentUser) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            // Add click listener
            btn.addEventListener('click', (e) => {
                const selectedUser = e.currentTarget.dataset.user;
                this.switchUser(selectedUser);
            });
        });

        console.log(`Current user: ${this.currentUser}`);
    }

    switchUser(userName) {
        this.currentUser = userName;
        localStorage.setItem('currentUser', userName);

        // Update UI
        document.querySelectorAll('.user-btn').forEach(btn => {
            if (btn.dataset.user === userName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reload user progress
        this.userProgress = this.loadUserProgress();

        // Reinitialize managers with new user's progress
        this.initializeManagers();

        // Refresh game manager references/data for the new user.
        if (window.gameManager?.refreshPracticeDataContext) {
            window.gameManager.refreshPracticeDataContext();
        }

        // Refresh practice badge after user switch.
        if (window.gamificationManager?.updatePracticeModeCard) {
            window.gamificationManager.updatePracticeModeCard();
        }

        console.log(`Switched to user: ${userName}`);

        // Show a nice notification
        this.showUserSwitchNotification(userName);
    }

    showUserSwitchNotification(userName) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 50%;
            transform: translateX(50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 1.2rem;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
            z-index: 10000;
            animation: slideDown 0.5s ease, fadeOut 0.5s ease 2.5s;
        `;
        notification.textContent = `שלום ${userName}! 👋`;

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    setupGlobalEventListeners() {
        // Hamburger menu removed - sidebar always visible on mobile via CSS

        // Re-initialize for the logged-in user whenever auth completes.
        // This handles the case where the page loads unauthenticated (after logout)
        // and the user logs in via the UI — setupWithAuth() was a no-op at DOMContentLoaded.
        window.addEventListener('user-logged-in', () => {
            this.setupWithAuth();
            setTimeout(() => {
                // Wire GameManager's manager references now that they are exported.
                if (window.gameManager?.initializeManagers) {
                    window.gameManager.initializeManagers();
                }
                if (window.gameManager?.refreshPracticeDataContext) {
                    window.gameManager.refreshPracticeDataContext();
                }
                if (window.gamificationManager?.updatePracticeModeCard) {
                    window.gamificationManager.updatePracticeModeCard();
                }
            }, 100);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const isSpace = e.code === 'Space' || e.key === ' ';
            const tag = (e.target.tagName || '').toUpperCase();
            const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
            if (isSpace && !isTyping) {
                e.preventDefault();
                this.handleSpacebarPress();
            }
            if (e.key === 'Enter' && e.target.classList.contains('option-btn')) {
                e.preventDefault();
                e.target.click();
            }
        });

        // Prevent context menu on game elements for better mobile experience
        document.querySelectorAll('.game-area').forEach(area => {
            area.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        // Handle visibility change (pause when tab is not active)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseGame();
            } else {
                this.resumeGame();
            }
        });
    }

    handleSpacebarPress() {
        const currentGame = gameManager.currentGame;
        const byGame = {
            vocabulary: '#vocab-audio',
            grammar: '',
            pronunciation: '#pronunciation-listen',
            listening: '#listening-audio',
            reading: '#reading-audio',
        };
        const selector = byGame[currentGame];
        if (!selector) return;
        const audioBtn = document.querySelector(selector);
        if (audioBtn && audioBtn.style.display !== 'none') audioBtn.click();
    }

    checkBrowserCompatibility() {
        const warnings = [];
        
        if (!speechManager.isSpeechSynthesisSupported()) {
            warnings.push('Speech synthesis not supported - audio features will be limited');
        }
        
        if (!speechManager.isSpeechRecognitionSupported()) {
            warnings.push('Speech recognition not supported - pronunciation practice will be limited');
        }
        
        if (warnings.length > 0) {
            this.showCompatibilityWarning(warnings);
        }
    }

    showCompatibilityWarning(warnings) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'compatibility-warning';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <h4>⚠️ Browser Compatibility Notice</h4>
                <ul>
                    ${warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
                <p>For the best experience, use Chrome, Firefox, or Safari.</p>
                <button onclick="this.parentElement.parentElement.remove()">Got it</button>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
            }
        }, 10000);
    }

    pauseGame() {
        if (speechManager.isRecording) {
            speechManager.stopRecording();
        }
        // DON'T cancel - it corrupts Chrome's speech engine
        // Let speech finish naturally
    }

    resumeGame() {
        // Game will resume naturally when user interacts
    }

    loadUserProgress() {
        // Get current user from auth service if available
        let userId = this.currentUser;

        if (typeof authService !== 'undefined' && !userId) {
            userId = authService.getCurrentUserId();
        }

        // Fallback to old format or 'O'
        if (!userId) {
            userId = localStorage.getItem('currentUser') || 'O';
        }

        const storageKey = `userProgress_${userId}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const progress = JSON.parse(saved);
                return this.migrateUserProgress(progress);
            } catch (error) {
                console.error('Error loading user progress:', error);
                return this.getDefaultProgress();
            }
        }
        return this.getDefaultProgress();
    }

    migrateUserProgress(oldProgress) {
        // Migrate to latest version (version 3 - with course system)
        if (oldProgress.version === 3) {
            // Patch missing fields added after v3 was released
            if (typeof oldProgress.totalPoints !== 'number') {
                oldProgress.totalPoints = 0;
            }
            return oldProgress;
        }

        console.log(`Migrating user progress from v${oldProgress.version || 1} to v3...`);

        // Start with existing data
        let migratedProgress = { ...oldProgress };

        // Migrate v1 → v2 (word mastery)
        if (!migratedProgress.version || migratedProgress.version < 2) {
            migratedProgress.wordMastery = migratedProgress.wordMastery || {};
        }

        // Migrate v2 → v3 (course system)
        if (migratedProgress.version < 3) {
            migratedProgress.courses = migratedProgress.courses || {};
            migratedProgress.topicProgress = migratedProgress.topicProgress || {};
            migratedProgress.certificates = migratedProgress.certificates || [];
            migratedProgress.coins = migratedProgress.coins || 0;
            migratedProgress.totalCoinsEarned = migratedProgress.totalCoinsEarned || 0;
            migratedProgress.coinHistory = migratedProgress.coinHistory || [];
            migratedProgress.lastLoginDate = migratedProgress.lastLoginDate || null;
            migratedProgress.studentName = migratedProgress.studentName || null;
        }

        migratedProgress.version = 3;

        // Save migrated progress
        this.userProgress = migratedProgress;
        this.saveUserProgress();

        console.log('Migration complete to v3');
        return migratedProgress;
    }

    getDefaultProgress() {
        return {
            hasPlayedBefore: false,
            totalGamesPlayed: 0,
            bestScores: {
                vocabulary: 0,
                grammar: 0,
                pronunciation: 0,
                listening: 0,
                reading: 0,
                memory: 0
            },
            streakDays: 0,
            lastPlayDate: null,
            totalCorrectAnswers: 0,
            preferredDifficulty: 'beginner',
            wordMastery: {},  // Track mastery per word: { "Dog": { totalAttempts, correctAttempts, ... } }
            lastSessionWordKeys: {},  // { gameType: ['word_category', ...] } - words shown in last session per game type

            // Course system (v3)
            courses: {},  // { courseId: { unlocked, startedDate, currentUnit, currentTopic } }
            topicProgress: {},  // { topicId: { unlocked, started, mastery, completedActivities, certificateEarned } }
            certificates: [],  // [{ id, topicId, topicName, earnedDate, score }]

            // Score totals
            totalPoints: 0,  // All-time accumulated raw score across all games

            // Coins economy
            coins: 0,
            totalCoinsEarned: 0,
            coinHistory: [],  // [{ amount, reason, timestamp, date, balance }]
            lastLoginDate: null,

            // User profile
            studentName: null,

            version: 3  // Data structure version for migrations
        };
    }

    saveUserProgress() {
        // Get current user from auth service if available
        let userId = this.currentUser;

        if (typeof authService !== 'undefined' && !userId) {
            userId = authService.getCurrentUserId();
        }

        // Fallback to old format or 'O'
        if (!userId) {
            userId = localStorage.getItem('currentUser') || 'O';
        }

        const storageKey = `userProgress_${userId}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.userProgress));
        } catch (error) {
            console.error('Error saving user progress:', error);
        }
    }

    getWordStats(word, category) {
        // Get statistics for a specific word
        if (!this.userProgress || !this.userProgress.wordMastery) {
            return null;
        }

        const wordKey = `${word}_${category}`;  // Use compound key to handle same word in different categories
        return this.userProgress.wordMastery[wordKey] || null;
    }

    saveWordStats(word, category, stats) {
        // Save statistics for a specific word
        if (!this.userProgress) {
            console.warn('Cannot save word stats: userProgress not initialized');
            return;
        }

        if (!this.userProgress.wordMastery) {
            this.userProgress.wordMastery = {};
        }

        const wordKey = `${word}_${category}`;
        this.userProgress.wordMastery[wordKey] = stats;

        // Save to localStorage immediately
        this.saveUserProgress();
    }

    calculateMastery(wordStats) {
        // Calculate mastery level (0-1) based on performance
        // Criteria: 3 attempts, 90% accuracy, 2 consecutive correct
        if (!wordStats || wordStats.totalAttempts === 0) {
            return 0;
        }

        const accuracy = wordStats.correctAttempts / wordStats.totalAttempts;
        const hasMinAttempts = wordStats.totalAttempts >= 3;
        const hasHighAccuracy = accuracy >= 0.90;
        const hasConsecutive = wordStats.consecutiveCorrect >= 2;

        // Mastery is a weighted combination
        let masteryLevel = accuracy;  // Base on accuracy

        // Bonus for meeting all criteria
        if (hasMinAttempts && hasHighAccuracy && hasConsecutive) {
            masteryLevel = Math.min(1.0, masteryLevel + 0.1);  // Cap at 1.0
        }

        return Math.round(masteryLevel * 100) / 100;  // Round to 2 decimals
    }

    loadSettings() {
        const saved = localStorage.getItem('englishLearningSettings');
        return saved ? JSON.parse(saved) : {
            soundEnabled: true,
            speechRate: 0.9,
            autoPlayAudio: true,
            showPhonetics: true,
            language: 'en'
        };
    }

    saveSettings() {
        localStorage.setItem('englishLearningSettings', JSON.stringify(this.settings));
        window.gameManager?.applySettings(this.settings);
    }

    updateProgress(gameType, score) {
        // Safety check - ensure userProgress exists
        if (!this.userProgress) {
            console.warn('Cannot update progress: userProgress not initialized');
            return;
        }

        this.userProgress.totalGamesPlayed++;

        if (score > this.userProgress.bestScores[gameType]) {
            this.userProgress.bestScores[gameType] = score;
            this.showAchievement(`New ${gameType} high score: ${score}!`);
        }

        // Update streak
        const today = new Date().toDateString();
        if (this.userProgress.lastPlayDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (this.userProgress.lastPlayDate === yesterday.toDateString()) {
                this.userProgress.streakDays++;
            } else {
                this.userProgress.streakDays = 1;
            }

            this.userProgress.lastPlayDate = today;
        }

        // Award topic certificate if game was launched from a topic
        const topicId = window.gameManager?.currentTopicId;
        if (topicId && this.certificateManager && this.courseManager) {
            this._checkAndAwardTopicCertificate(topicId, gameType, score);
            window.gameManager.currentTopicId = null;
        }

        this.saveUserProgress();
        this.checkAchievements();
    }

    _checkAndAwardTopicCertificate(topicId, gameType, score) {
        const topicData = this.courseManager.getTopic(topicId);
        if (!topicData) return;
        const { topic, unit } = topicData;

        const threshold = topic.milestone?.scoreThreshold ?? 70;
        if (score < threshold) return;

        // Award certificate if not already earned
        if (topic.certificateId && !this.certificateManager.hasCertificate(topic.certificateId)) {
            this.certificateManager.awardCertificate({
                id: topic.certificateId,
                topicId,
                topicName: topic.nameHebrew || topic.name,
                score
            });

            this.coinManager?.awardTopicComplete();

            // Show cert modal after the game completion screen has settled
            setTimeout(() => this.showCertificateModal(topic.nameHebrew || topic.name, score), 2000);

            this.renderCertificateGallery();
        }

        // Unlock the next topic in the unit
        this._unlockNextTopic(topicId, unit);
    }

    _unlockNextTopic(topicId, unit) {
        if (!unit?.topics) return;
        const idx = unit.topics.findIndex(t => t.id === topicId);
        if (idx !== -1 && idx < unit.topics.length - 1) {
            this.courseManager.unlockTopic(unit.topics[idx + 1].id);
        }
    }

    loadAchievements() {
        this.achievements = [
            {
                id: 'first_game',
                name: 'First Steps',
                description: 'Complete your first game',
                condition: () => this.userProgress.totalGamesPlayed >= 1,
                unlocked: false
            },
            {
                id: 'perfect_score',
                name: 'Perfect!',
                description: 'Get a perfect score in any game',
                condition: () => Object.values(this.userProgress.bestScores).some(score => score === 100),
                unlocked: false
            },
            {
                id: 'streak_week',
                name: 'Week Warrior',
                description: 'Play for 7 days in a row',
                condition: () => this.userProgress.streakDays >= 7,
                unlocked: false
            },
            {
                id: 'vocabulary_master',
                name: 'Vocabulary Master',
                description: 'Score 80+ in vocabulary game',
                condition: () => this.userProgress.bestScores.vocabulary >= 80,
                unlocked: false
            },
            {
                id: 'grammar_guru',
                name: 'Grammar Guru',
                description: 'Score 80+ in grammar game',
                condition: () => this.userProgress.bestScores.grammar >= 80,
                unlocked: false
            }
        ];
    }

    checkAchievements() {
        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.condition()) {
                achievement.unlocked = true;
                this.showAchievement(`🏆 Achievement Unlocked: ${achievement.name}!`);
            }
        });
    }

    showAchievement(message) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // Adaptive difficulty based on performance
    getAdaptiveDifficulty(gameType) {
        const recentScores = this.getRecentScores(gameType);
        const averageScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        
        if (averageScore >= 80) return 'advanced';
        if (averageScore >= 60) return 'intermediate';
        return 'beginner';
    }

    getRecentScores(gameType) {
        // This would be implemented with more detailed score tracking
        return [this.userProgress.bestScores[gameType]];
    }

    // Export progress for sharing or backup
    exportProgress() {
        const data = {
            progress: this.userProgress,
            settings: this.settings,
            achievements: this.achievements.filter(a => a.unlocked),
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'english-learning-progress.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Initialize app manager
let appManager;
function initAppManager() {
    if (appManager) return; // prevent double-init
    appManager = new AppManager();
    // Make it accessible as window.app for gameLogic.js
    window.app = appManager;

    // Initialize gamification features after a short delay to ensure all data is loaded
    setTimeout(() => {
        if (window.gamificationManager) {
            window.gamificationManager.init();
        }
    }, 500);
}

// Guard: if DOMContentLoaded has already fired (can happen when _loader.js top-level
// await causes the event to fire before this module's listener is registered), call
// directly. Otherwise register normally.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppManager);
} else {
    initAppManager();
}

// When the parent imports words from settings.html (another tab), sync them into
// this tab's in-memory gameData without requiring a page reload.
window.addEventListener('storage', (e) => {
    if (e.key === 'customWords_global' && window.refreshCustomWords) {
        window.refreshCustomWords();
    }
});
