// Settings Manager for English Learning Games

class SettingsManager {
    constructor() {
        this.categories = [
            { id: 'animals', name: 'חיות', wordCount: 30 },
            { id: 'colors', name: 'צבעים', wordCount: 15 },
            { id: 'numbers', name: 'מספרים', wordCount: 26 },
            { id: 'food', name: 'אוכל ושתייה', wordCount: 30 },
            { id: 'body', name: 'חלקי גוף', wordCount: 15 },
            { id: 'family', name: 'משפחה', wordCount: 10 },
            { id: 'clothes', name: 'בגדים', wordCount: 15 },
            { id: 'home', name: 'בית וחפצים', wordCount: 30 },
            { id: 'actions', name: 'פעולות', wordCount: 20 },
            { id: 'nature', name: 'טבע', wordCount: 15 },
            { id: 'school', name: 'בית ספר', wordCount: 10 },
            { id: 'minecraft', name: '🎮 Minecraft', wordCount: 25 },
            { id: 'gaming', name: '🎮 משחקים', wordCount: 25 },
            { id: 'roblox', name: '🎮 Roblox', wordCount: 20 },
            { id: 'feelings', name: 'רגשות', wordCount: 22 },
            { id: 'adjectives', name: 'תארים', wordCount: 34 },
            { id: 'places', name: 'מקומות', wordCount: 18 },
            { id: 'time', name: 'זמן', wordCount: 20 },
            { id: 'weather', name: 'מזג אוויר', wordCount: 15 },
            { id: 'sports', name: 'ספורט', wordCount: 29 },
            { id: 'transportation', name: 'תחבורה', wordCount: 26 },
            { id: 'tools', name: 'כלים וציוד', wordCount: 16 },
            { id: 'signs', name: 'שלטים וסמלים', wordCount: 12 },
            { id: 'music', name: 'מוזיקה', wordCount: 11 }
        ];

        this.isPasswordUnlocked = false;

        this.defaultSettings = {
            // Vocabulary categories (recommended 5+ for competitive mode)
            selectedCategories: [
                'animals', 'colors', 'numbers', 'food', 'minecraft',
                'gaming', 'roblox', 'actions', 'nature', 'school'
            ],

            // Game settings
            questionsPerGame: 10,
            clickRepeatCount: 3,
            audioPlaysAllowed: 8,
            hebrewVocalization: true,
            learningPace: 'normal', // 'slow' (3 words) | 'normal' (5 words) | 'fast' (8 words)

            // Advanced settings
            showConfetti: true,
            exitBehavior: 'autosave', // 'autosave' | 'confirmation'
            gameUnlockOverride: false,

            // Display
            showNikud: true,
            lowercaseMode: false,

            // Custom words (Parent)
            claudeApiKey: ''
        };

        this.settings = { ...this.defaultSettings };
        this.init();
    }

    init() {
        console.log('SettingsManager init() started');
        this.loadSettings();
        console.log('Settings loaded:', this.settings);

        this.renderCategoryCheckboxes();
        console.log('Category checkboxes rendered');

        this.bindEvents();
        console.log('Events bound');

        this.updateAllValues();
        console.log('Values updated');

        this.setupPasswordProtection();
        console.log('Password protection setup complete');

        this.setupCustomWordsSection();
        this.initTabs();
    }

    // ── Tab switching ──────────────────────────────────────────

    initTabs() {
        const bar = document.getElementById('settings-tabs-bar');
        if (!bar) return;

        const tabBtns  = bar.querySelectorAll('.stab');
        const panels   = document.querySelectorAll('.stab-panel');
        let _wimReady  = false;

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab         = btn.dataset.tab;
                const isProtected = btn.classList.contains('stab-protected');

                // Show password modal if tab is protected and not yet unlocked
                if (isProtected && !this.isPasswordUnlocked) {
                    const modal      = document.getElementById('password-modal');
                    const pwInput    = document.getElementById('password-input');
                    const errorDiv   = document.getElementById('password-error');
                    if (modal) {
                        modal.classList.add('show');
                        if (pwInput)  { pwInput.value = ''; pwInput.focus(); }
                        if (errorDiv) errorDiv.classList.remove('show');
                    }
                    return;
                }

                // Switch active tab + panel
                tabBtns.forEach(b => b.classList.remove('active'));
                panels.forEach(p  => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(`tab-${tab}`);
                if (panel) panel.classList.add('active');

                // Lazy-init the word image manager on first visit
                if (tab === 'word-images' && !_wimReady) {
                    _wimReady = true;
                    const container = document.getElementById('wim-container');
                    if (container && window.wordImageManager) {
                        window.wordImageManager.init(container);
                    }
                }
            });
        });
    }

    // Called after successful password unlock — updates tab button UI
    _onTabsUnlock() {
        document.querySelectorAll('.stab-protected').forEach(btn => {
            btn.classList.remove('stab-protected');
            const lock = btn.querySelector('.stab-lock');
            if (lock) lock.remove();
        });
    }

    setupPasswordProtection() {
        console.log('setupPasswordProtection() called');
        const modal = document.getElementById('password-modal');
        const passwordInput = document.getElementById('password-input');
        const submitBtn = document.getElementById('password-submit');
        const cancelBtn = document.getElementById('password-cancel');
        const errorDiv = document.getElementById('password-error');
        const unlockBtn = document.getElementById('unlock-protected-btn');

        // Only setup password protection if we're on the settings page
        if (!modal || !passwordInput || !submitBtn || !cancelBtn) {
            console.log('Not on settings page, skipping password protection setup');
            return;
        }

        // Auto-unlock if current user has parent/manager role
        if (this._isCurrentUserAdmin()) {
            console.log('Current user is admin/parent — auto-unlocking settings');
            this.isPasswordUnlocked = true;
            if (unlockBtn) {
                unlockBtn.innerHTML = '<i class="fas fa-unlock"></i> הגדרות פתוחות';
                unlockBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
                unlockBtn.disabled = true;
                unlockBtn.style.opacity = '0.7';
                unlockBtn.style.cursor = 'not-allowed';
            }
            this._onTabsUnlock();
            return; // Skip password gate setup entirely
        }

        console.log('Setting up password protection...');

        // Handle unlock button click
        if (unlockBtn) {
            unlockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!this.isPasswordUnlocked) {
                    modal.classList.add('show');
                    passwordInput.value = '';
                    errorDiv.classList.remove('show');
                    passwordInput.focus();
                }
            });
        }

        // Intercept clicks on protected sections when locked
        document.querySelectorAll('.protected-section').forEach(section => {
            section.addEventListener('click', (e) => {
                if (!this.isPasswordUnlocked) {
                    e.preventDefault();
                    e.stopPropagation();
                    modal.classList.add('show');
                    passwordInput.value = '';
                    errorDiv.classList.remove('show');
                    passwordInput.focus();
                }
            }, true);

            section.addEventListener('change', (e) => {
                if (!this.isPasswordUnlocked) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            section.addEventListener('input', (e) => {
                if (!this.isPasswordUnlocked) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);
        });

        // Submit password
        const checkPassword = () => {
            if (typeof authService !== 'undefined' && authService.verifyAdminPassword(passwordInput.value)) {
                this.isPasswordUnlocked = true;
                modal.classList.remove('show');

                if (unlockBtn) {
                    unlockBtn.innerHTML = '<i class="fas fa-unlock"></i> הגדרות פתוחות';
                    unlockBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
                    unlockBtn.disabled = true;
                    unlockBtn.style.opacity = '0.7';
                    unlockBtn.style.cursor = 'not-allowed';
                }

                this._onTabsUnlock();
            } else {
                errorDiv.classList.add('show');
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        submitBtn.addEventListener('click', checkPassword);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        // Set initial visual state for protected sections
        document.querySelectorAll('.protected-section').forEach(s => {
            s.classList.add('locked');
        });
    }

    /**
     * Check if the currently logged-in user has an admin/parent role.
     * Users with role 'parent' or 'manager' bypass the password gate.
     */
    _isCurrentUserAdmin() {
        const userId = this.getCurrentUserId();
        if (!userId || typeof authService === 'undefined') return false;
        const user = authService.getUser(userId);
        return user && (user.role === 'parent' || user.role === 'manager');
    }

    getCurrentUserId() {
        if (typeof authService !== 'undefined' && authService.getCurrentUserId) {
            return authService.getCurrentUserId();
        }
        return localStorage.getItem('currentUser') || null;
    }

    loadSettings() {
        const saved = localStorage.getItem('englishLearningSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.defaultSettings, ...parsed };
            } catch (error) {
                console.error('Error loading settings:', error);
                this.settings = { ...this.defaultSettings };
            }
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('englishLearningSettings', JSON.stringify(this.settings));
            // Bridge to v2 storage key so GameManager reads the latest settings
            localStorage.setItem('v2_englishLearningSettings', JSON.stringify(this.settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    resetSettings() {
        this.settings = { ...this.defaultSettings };
        this.updateAllValues();
        this.renderCategoryCheckboxes();
    }

    renderCategoryCheckboxes() {
        const container = document.getElementById('category-checkboxes');
        if (!container) return; // Skip if element doesn't exist (not on settings page)

        // Use live vocabularyBank for dynamic counts (includes custom words from localStorage).
        // vocabularyBank.js is a module and runs before DOMContentLoaded, so it is available here.
        const vocab = window.vocabularyBank || [];

        // Build per-category live counts
        const liveCounts = {};
        vocab.forEach(w => {
            if (w.category) liveCounts[w.category] = (liveCounts[w.category] || 0) + 1;
        });

        // Inject any categories not yet in the known list.
        // Prefer vocabularyBank; fall back to localStorage custom words if bank not ready.
        const knownIds = new Set(this.categories.map(c => c.id));
        const wordSource = vocab.length > 0 ? vocab : (() => {
            try { return JSON.parse(localStorage.getItem('customWords_global') || '[]'); } catch (e) { return []; }
        })();
        wordSource.forEach(w => {
            if (w.category && !knownIds.has(w.category)) {
                knownIds.add(w.category);
                this.categories.push({
                    id: w.category,
                    name: w.category === 'custom' ? 'מותאם אישית' : w.category,
                    wordCount: 0
                });
            }
        });

        container.innerHTML = '';

        this.categories.forEach(category => {
            const isChecked = this.settings.selectedCategories.includes(category.id);
            // Use live count when vocabularyBank is loaded; fall back to static wordCount
            const wordCount = vocab.length > 0 ? (liveCounts[category.id] || 0) : category.wordCount;
            const div = document.createElement('div');
            div.className = `checkbox-item ${isChecked ? 'checked' : ''}`;
            div.dataset.categoryId = category.id;

            div.innerHTML = `
                <input type="checkbox"
                       id="cat-${category.id}"
                       value="${category.id}"
                       ${isChecked ? 'checked' : ''}>
                <label for="cat-${category.id}">
                    ${category.name} (${wordCount})
                </label>
            `;

            container.appendChild(div);
        });

        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.settings.selectedCategories.length;
        const total = this.categories.length;
        const countElement = document.getElementById('selected-count');
        countElement.textContent = `${count}/${total}`;
        countElement.style.background = '#48bb78';
    }

    validateCategorySelection() {
        const count = this.settings.selectedCategories.length;
        const warning = document.getElementById('category-warning');

        if (count < 1) {
            warning.classList.add('show');
            return false;
        } else {
            warning.classList.remove('show');
            return true;
        }
    }

    isPracticeMode() {
        return this.settings.selectedCategories.length < 5;
    }

    /**
     * Shows admin password modal and returns a promise.
     * Auto-approves if current user has parent/manager role.
     * @param {string} title - Modal title (e.g., "אפס הגדרות")
     * @returns {Promise<boolean>} - Resolves to true if authorized, false if cancelled
     */
    showAdminPasswordPrompt(title = 'אישור פעולה') {
        // Auto-approve for admin/parent users
        if (this._isCurrentUserAdmin() || this.isPasswordUnlocked) {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            const modal = document.getElementById('password-modal');
            const passwordInput = document.getElementById('password-input');
            const submitBtn = document.getElementById('password-submit');
            const cancelBtn = document.getElementById('password-cancel');
            const errorDiv = document.getElementById('password-error');
            const modalTitle = modal?.querySelector('h3');

            if (!modal || !passwordInput || !submitBtn || !cancelBtn) {
                const password = prompt('הכנס סיסמת מנהל:');
                if (!password) { resolve(false); return; }
                const isValid = typeof authService !== 'undefined' && authService.verifyAdminPassword(password);
                resolve(isValid);
                return;
            }

            if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-lock"></i> ${title}`;
            modal.classList.add('show');
            passwordInput.value = '';
            errorDiv.classList.remove('show');
            passwordInput.focus();

            const handleSubmit = () => {
                const isValid = typeof authService !== 'undefined' && authService.verifyAdminPassword(passwordInput.value);
                if (isValid) {
                    cleanup();
                    modal.classList.remove('show');
                    resolve(true);
                } else {
                    errorDiv.classList.add('show');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            };

            const handleCancel = () => {
                cleanup();
                modal.classList.remove('show');
                resolve(false);
            };

            const handleKeypress = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
                else if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            };

            const cleanup = () => {
                submitBtn.removeEventListener('click', handleSubmit);
                cancelBtn.removeEventListener('click', handleCancel);
                passwordInput.removeEventListener('keypress', handleKeypress);
            };

            submitBtn.addEventListener('click', handleSubmit);
            cancelBtn.addEventListener('click', handleCancel);
            passwordInput.addEventListener('keypress', handleKeypress);
        });
    }

    deleteAllStats() {
        const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading'];

        // Get all users from authService if available
        let userIds = ['O', 'Z', 'I']; // Default users as fallback
        if (typeof authService !== 'undefined' && authService.getUsers) {
            const allUsers = authService.getUsers();
            // getUsers returns an object like { omer: {...}, zohar: {...} }
            userIds = Object.keys(allUsers); // Use keys (usernames) instead of .id
        }

        // Delete user progress (both v2 and legacy keys)
        userIds.forEach(userId => {
            localStorage.removeItem(`v2_userProgress_${userId}`);
            localStorage.removeItem(`userProgress_${userId}`);
        });

        // Delete score history (CORRECT FORMAT: username_gametype_history)
        userIds.forEach(userId => {
            gameTypes.forEach(game => {
                localStorage.removeItem(`${userId}_${game}_history`);
                // Also remove old format if it exists
                localStorage.removeItem(`scoreHistory_${userId}_${game}`);
            });
        });

        // Also clear any other statistics keys that might exist
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('v2_userProgress_') ||
                key.startsWith('userProgress_') ||
                key.startsWith('scoreHistory_') ||
                key.includes('_history') || // Catches username_gametype_history
                key.includes('_score') ||
                key.includes('Stats')
            )) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        alert('כל הסטטיסטיקות נמחקו! ההגדרות נשארו ללא שינוי.');

        // Show success
        const successMsg = document.getElementById('success-message');
        if (successMsg) {
            const msgDiv = successMsg.querySelector('div');
            if (msgDiv) {
                msgDiv.textContent = 'הסטטיסטיקות נמחקו בהצלחה!';
            }
            successMsg.classList.add('show');
            setTimeout(() => {
                if (msgDiv) {
                    msgDiv.textContent = 'ההגדרות נשמרו בהצלחה!';
                }
                successMsg.classList.remove('show');
            }, 3000);
        }
    }

    bindEvents() {
        // Only bind events if we're on the settings page
        // Check for an element that only exists on settings.html
        const categoryCheckboxes = document.getElementById('category-checkboxes');
        if (!categoryCheckboxes) {
            console.log('Not on settings page, skipping event binding');
            return;
        }

        // Category checkboxes
        categoryCheckboxes.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const categoryId = e.target.value;
                const checkbox = e.target;
                const parent = checkbox.closest('.checkbox-item');

                if (checkbox.checked) {
                    if (!this.settings.selectedCategories.includes(categoryId)) {
                        this.settings.selectedCategories.push(categoryId);
                        parent.classList.add('checked');
                    }
                } else {
                    // Must have at least 1 category
                    if (this.settings.selectedCategories.length <= 1) {
                        checkbox.checked = true;
                        alert('חובה לבחור לפחות קטגוריה אחת!');
                        return;
                    }

                    this.settings.selectedCategories = this.settings.selectedCategories.filter(
                        id => id !== categoryId
                    );
                    parent.classList.remove('checked');
                }

                this.updateSelectedCount();
                this.validateCategorySelection();
            }
        });

        // Auto play toggle - REMOVED (no longer in UI)
        // document.getElementById('auto-play').addEventListener('change', (e) => {
        //     this.settings.autoPlay = e.target.checked;
        // });

        // Questions count slider
        document.getElementById('questions-count').addEventListener('input', (e) => {
            this.settings.questionsPerGame = parseInt(e.target.value);
            document.getElementById('questions-value').textContent = this.settings.questionsPerGame;
        });

        // Click count slider
        document.getElementById('click-count').addEventListener('input', (e) => {
            this.settings.clickRepeatCount = parseInt(e.target.value);
            document.getElementById('clicks-value').textContent = this.settings.clickRepeatCount;
        });

        // Audio plays slider
        document.getElementById('audio-plays').addEventListener('input', (e) => {
            this.settings.audioPlaysAllowed = parseInt(e.target.value);
            document.getElementById('plays-value').textContent = this.settings.audioPlaysAllowed;
        });

        // Theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.settings.theme = theme;

                // Update visual state
                document.querySelectorAll('.theme-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
            });
        });

        // Animation speed slider - REMOVED (no longer in UI)
        // document.getElementById('animation-speed').addEventListener('input', (e) => {
        //     this.settings.animationSpeed = parseFloat(e.target.value);
        //     document.getElementById('animation-value').textContent = `${this.settings.animationSpeed.toFixed(1)}x`;
        // });

        // Show pictures toggle - REMOVED (no longer in UI)
        // document.getElementById('show-pictures').addEventListener('change', (e) => {
        //     this.settings.showPictures = e.target.checked;
        // });

        // Show confetti toggle
        document.getElementById('show-confetti').addEventListener('change', (e) => {
            this.settings.showConfetti = e.target.checked;
        });

        // Show nikud toggle
        document.getElementById('show-nikud').addEventListener('change', (e) => {
            this.settings.showNikud = e.target.checked;
        });

        // Lowercase mode toggle — syncs with caseManager's localStorage key
        document.getElementById('show-lowercase')?.addEventListener('change', (e) => {
            this.settings.lowercaseMode = e.target.checked;
            document.body.classList.toggle('lowercase-mode', e.target.checked);
            try {
                localStorage.setItem('globalLetterCase', e.target.checked ? 'lowercase' : 'uppercase');
            } catch (_) {}
        });

        // Hebrew vocalization toggle
        document.getElementById('hebrew-vocalization')?.addEventListener('change', (e) => {
            this.settings.hebrewVocalization = e.target.checked;
        });

        // Learning pace radios
        document.querySelectorAll('input[name="learningPace"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.learningPace = e.target.value;
                document.querySelectorAll('[name="learningPace"]').forEach(r => {
                    r.closest('.radio-item').classList.remove('selected');
                });
                e.target.closest('.radio-item').classList.add('selected');
                this.updateLearningPaceSummary();
            });
        });

        // Exit behavior radio buttons
        document.querySelectorAll('input[name="exitBehavior"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.exitBehavior = e.target.value;

                // Update visual state
                document.querySelectorAll('#exit-behavior-group .radio-item').forEach(item => {
                    item.classList.remove('selected');
                });
                e.target.closest('.radio-item').classList.add('selected');
            });
        });

        // Game unlock override toggle
        document.getElementById('game-unlock-override')?.addEventListener('change', (e) => {
            this.settings.gameUnlockOverride = e.target.checked;
        });

        // Save button (top bar)
        document.getElementById('save-settings-top').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!this.validateCategorySelection()) {
                return;
            }

            if (this.saveSettings()) {
                // Use location.replace to avoid showing intermediate states
                window.location.replace('index.html');
            }
        });

        // Reset button (top bar) - PASSWORD PROTECTED
        const resetBtn = document.getElementById('reset-settings-top');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (!confirm('האם אתה בטוח שברצונך לאפס את כל ההגדרות לברירת המחדל?')) {
                    return;
                }

                // Show password modal
                const isAuthorized = await this.showAdminPasswordPrompt('אפס הגדרות - הזן סיסמת מנהל');
                if (isAuthorized) {
                    this.resetSettings();
                    this.saveSettings();
                    alert('ההגדרות אופסו לברירת המחדל!');
                }
            });
        }

        // Download logs button (top bar)
        const downloadLogsBtn = document.getElementById('download-logs-btn');
        const logCountBadge = document.getElementById('log-count-badge');

        const updateLogBadge = () => {
            if (logCountBadge && window.consoleLogger) {
                const count = window.consoleLogger.getLogCount();
                logCountBadge.textContent = count > 0 ? count : '';
            }
        };

        if (downloadLogsBtn) {
            updateLogBadge();
            downloadLogsBtn.addEventListener('click', () => {
                if (window.consoleLogger && typeof window.consoleLogger.downloadLogs === 'function') {
                    window.consoleLogger.downloadLogs();
                } else {
                    alert('לוגר לא זמין - נסה לרענן את הדף');
                }
            });
        }

        // Clear logs button (top bar)
        const clearLogsBtn = document.getElementById('clear-logs-btn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                if (!confirm('למחוק את כל הלוגים השמורים?')) return;
                if (window.consoleLogger) {
                    window.consoleLogger.clearLogs();
                    updateLogBadge();
                }
            });
        }
    }

    updateAllValues() {
        // Only update values if we're on the settings page
        const questionsCount = document.getElementById('questions-count');
        if (!questionsCount) {
            console.log('Not on settings page, skipping value updates');
            return;
        }

        // Audio settings removed from UI

        // Update game settings
        questionsCount.value = this.settings.questionsPerGame;
        document.getElementById('questions-value').textContent = this.settings.questionsPerGame;

        document.getElementById('click-count').value = this.settings.clickRepeatCount;
        document.getElementById('clicks-value').textContent = this.settings.clickRepeatCount;

        document.getElementById('audio-plays').value = this.settings.audioPlaysAllowed;
        document.getElementById('plays-value').textContent = this.settings.audioPlaysAllowed;

        // Theme settings removed from UI

        // Update advanced settings
        document.getElementById('show-confetti').checked = this.settings.showConfetti;
        document.getElementById('show-nikud').checked = this.settings.showNikud !== false;
        const lowercaseEl = document.getElementById('show-lowercase');
        if (lowercaseEl) {
            // Read from caseManager's storage key as source of truth
            const caseMode = localStorage.getItem('globalLetterCase') || 'uppercase';
            lowercaseEl.checked = caseMode === 'lowercase';
        }

        // Update Hebrew vocalization
        const hebrewVocEl = document.getElementById('hebrew-vocalization');
        if (hebrewVocEl) hebrewVocEl.checked = this.settings.hebrewVocalization !== false;

        // Update learning pace
        const pace = this.settings.learningPace || 'normal';
        const paceEl = document.getElementById(`pace-${pace}`);
        if (paceEl) {
            paceEl.checked = true;
            paceEl.closest('.radio-item').classList.add('selected');
        }
        this.updateLearningPaceSummary();

        // Update exit behavior settings
        const exitBehavior = ['autosave', 'confirmation'].includes(this.settings.exitBehavior)
            ? this.settings.exitBehavior : 'autosave';
        const exitEl = document.getElementById(`exit-${exitBehavior}`);
        if (exitEl) {
            exitEl.checked = true;
            exitEl.closest('.radio-item').classList.add('selected');
        }

        // Update game unlock override
        const unlockOverrideEl = document.getElementById('game-unlock-override');
        if (unlockOverrideEl) unlockOverrideEl.checked = this.settings.gameUnlockOverride === true;

        // Populate API key field
        const apiKeyInput = document.getElementById('claude-api-key');
        if (apiKeyInput && this.settings.claudeApiKey) {
            apiKeyInput.value = this.settings.claudeApiKey;
        }
    }

    updateLearningPaceSummary() {
        const summary = document.getElementById('learning-pace-summary');
        if (!summary) return;

        const pace = this.settings.learningPace || 'normal';
        const wordCount = { slow: 3, normal: 5, fast: 8 }[pace] || 5;
        summary.textContent = `המסע תמיד כולל 5 שלבים. בקצב זה לומדים ${wordCount} מילים בכל מסע.`;
    }

    setupCustomWordsSection() {
        const section = document.getElementById('custom-words-section');
        if (!section) return;

        // Render existing words
        this.renderCustomWordsList();

        // API key show/hide toggle
        const apiKeyInput = document.getElementById('claude-api-key');
        const apiKeyToggle = document.getElementById('api-key-toggle');
        if (apiKeyInput && apiKeyToggle) {
            // Save on change
            apiKeyInput.addEventListener('input', () => {
                this.settings.claudeApiKey = apiKeyInput.value;
            });
            apiKeyToggle.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                apiKeyToggle.innerHTML = isPassword
                    ? '<i class="fas fa-eye-slash"></i>'
                    : '<i class="fas fa-eye"></i>';
            });
        }

        // Import button
        const importBtn = document.getElementById('import-words-btn');
        if (importBtn) {
            importBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.runImport();
            });
        }

        // Save to source files button
        const saveSourceBtn = document.getElementById('save-to-source-btn');
        if (saveSourceBtn) {
            saveSourceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.runSaveToSourceFiles();
            });
        }

        // Clear all custom words button
        const clearBtn = document.getElementById('clear-custom-words-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm('למחוק את כל המילים המותאמות אישית?')) return;
                if (window.wordImporter) {
                    window.wordImporter.clearCustomWords();
                    this.renderCustomWordsList();
                    this.renderCategoryCheckboxes();
                }
            });
        }
    }

    async runSaveToSourceFiles() {
        if (!window.fileSystemWriter) {
            alert('fileSystemWriter לא נטען — רענן את הדף');
            return;
        }
        const words = window.wordImporter ? window.wordImporter.getCustomWords() : [];
        if (words.length === 0) return;

        const btn = document.getElementById('save-to-source-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...'; }

        // Reuse the import console panel so the parent sees per-file results
        this.initImportConsole();

        await window.fileSystemWriter.saveToSourceFiles(words, (progress) => {
            if (progress.status === 'log') {
                this.appendConsoleLine(progress);
            } else if (progress.status === 'cancelled') {
                // user dismissed the picker — just re-enable button
            } else if (progress.status === 'success' || progress.status === 'partial') {
                this.showImportStatus(progress.status === 'success' ? 'success' : 'error', progress.message);
                this.renderCustomWordsList();
                this._rebuildPhoneticIndexInline(progress.words || []);
            } else if (progress.status === 'error') {
                this.showImportStatus('error', progress.message);
            }
        });

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> שמור לקבצי המקור'; }
    }

    async _rebuildPhoneticIndexInline(newWords) {
        if (!newWords.length) return;
        this.appendConsoleLine({ message: '🔄 מעדכן אינדקס פונטי...', type: 'info' });
        try {
            // Load current index
            const r = await fetch('/data/phonetic-index.json');
            const currentIndex = r.ok ? await r.json() : {};

            // Compute entries for new words using full vocabulary bank
            const allWords = window.vocabularyBank || [];
            const updates = {};
            for (const w of newWords) {
                if (!window.computePhoneticEntry) break;
                updates[w.word.toLowerCase()] = window.computePhoneticEntry(w.word, allWords);
            }

            if (!Object.keys(updates).length) {
                this.appendConsoleLine({ message: '⚠️ computePhoneticEntry לא זמין — דלג על עדכון אינדקס', type: 'error' });
                return;
            }

            const updatedIndex = { ...currentIndex, ...updates };
            const wr = await fetch('/api/write-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'data/phonetic-index.json', content: JSON.stringify(updatedIndex, null, 2) })
            });
            if ((await wr.json()).ok) {
                this.appendConsoleLine({ message: `✅ האינדקס הפונטי עודכן (${newWords.length} מילים חדשות)`, type: 'success' });
            }
        } catch (e) {
            this.appendConsoleLine({ message: `⚠️ שגיאה בעדכון אינדקס פונטי: ${e.message}`, type: 'error' });
        }
    }

    async runImport() {
        const importBtn = document.getElementById('import-words-btn');
        const textarea = document.getElementById('custom-words-input');
        const apiKeyInput = document.getElementById('claude-api-key');

        if (!window.wordImporter) {
            this.showImportStatus('error', 'wordImporter לא נטען — רענן את הדף');
            return;
        }

        const apiKey = (apiKeyInput && apiKeyInput.value.trim()) || this.settings.claudeApiKey;
        const wordsText = textarea ? textarea.value.trim() : '';

        // Persist API key before calling (so it survives navigation)
        if (apiKey) {
            this.settings.claudeApiKey = apiKey;
            this.saveSettings();
        }

        // Disable button during import
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מייבא...';
        }

        // Open the console panel immediately
        this.initImportConsole();

        await window.wordImporter.importWords(wordsText, apiKey, (progress) => {
            if (progress.status === 'log') {
                this.appendConsoleLine(progress);
                return;
            }
            if (progress.status === 'processing') {
                this.showImportStatus('processing', progress.message);
            } else if (progress.status === 'success') {
                this.showImportStatus('success', progress.message);
                if (textarea) textarea.value = '';
                this.renderCustomWordsList();
                // Re-render category checkboxes in case new categories appeared
                this.renderCategoryCheckboxes();
                // Auto-add new categories to selectedCategories
                if (progress.words) {
                    // Update in-memory vocabularyBank so duplicate detection works
                    // for any subsequent import within the same settings session
                    if (window.vocabularyBank) {
                        const existingWords = new Set(window.vocabularyBank.map(w => w.word.toLowerCase()));
                        progress.words.forEach(w => {
                            if (!existingWords.has(w.word.toLowerCase())) {
                                window.vocabularyBank.push(w);
                                existingWords.add(w.word.toLowerCase());
                            }
                        });
                    }

                    let changed = false;
                    progress.words.forEach(w => {
                        if (!this.settings.selectedCategories.includes(w.category)) {
                            this.settings.selectedCategories.push(w.category);
                            changed = true;
                        }
                    });
                    if (changed) this.saveSettings();
                }
            } else {
                this.showImportStatus('error', progress.message);
            }
        });

        // Re-enable button
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = '<i class="fas fa-upload"></i> ייבא מילים';
        }
    }

    // Called once at start of import to reset the console panel
    initImportConsole() {
        const container = document.getElementById('import-status');
        const bar = document.getElementById('import-status-bar');
        const logToggle = document.getElementById('import-log-toggle');
        const log = document.getElementById('import-log');
        if (!container) return;

        container.style.display = 'block';
        if (bar) {
            bar.style.cssText = 'background:rgba(102,126,234,0.1);border:2px solid #667eea;color:#3c4fe0;padding:12px 15px;border-radius:10px;font-weight:600;font-size:0.95rem;';
            bar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מייבא מילים...';
        }
        if (log) {
            log.innerHTML = '';
            log.style.cssText = `
                display: block;
                margin-top: 10px;
                padding: 12px 14px;
                background: #1a1a2e;
                border-radius: 10px;
                font-family: 'Courier New', monospace;
                font-size: 0.82rem;
                max-height: 320px;
                overflow-y: auto;
                direction: ltr;
                text-align: left;
                color: #a8b2d8;
                line-height: 1.7;
            `;
        }
        if (logToggle) logToggle.style.display = 'none';
    }

    appendConsoleLine(entry) {
        const log = document.getElementById('import-log');
        if (!log) return;

        const colors = {
            info:     '#a8b2d8',
            api:      '#79b8ff',
            prompt:   '#6a737d',
            response: '#e6db74',
            success:  '#5af78e',
            skip:     '#ffb86c',
            warn:     '#ffb86c',
            error:    '#ff5555'
        };

        const line = document.createElement('div');
        const color = colors[entry.type] || colors.info;

        // Multi-line entries (prompt / raw response) get a slightly different treatment
        if (entry.type === 'prompt' || entry.type === 'response') {
            const label = entry.type === 'prompt' ? '── PROMPT ──' : '── RESPONSE ──';
            const escaped = entry.text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            line.innerHTML =
                `<span style="color:#6a737d;">[${entry.time}]</span> ` +
                `<span style="color:#6a737d;">${label}</span>\n` +
                `<span style="color:${color};white-space:pre-wrap;">${escaped}</span>`;
        } else {
            const escaped = entry.text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            line.innerHTML =
                `<span style="color:#6a737d;">[${entry.time}]</span> ` +
                `<span style="color:${color};">${escaped}</span>`;
        }

        line.style.cssText = 'padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,0.04);';
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }

    showImportStatus(type, message) {
        const bar = document.getElementById('import-status-bar');
        const logToggle = document.getElementById('import-log-toggle');
        if (!bar) return;

        const styles = {
            processing: 'background:rgba(102,126,234,0.1);border:2px solid #667eea;color:#3c4fe0;',
            success:    'background:rgba(72,187,120,0.1);border:2px solid #48bb78;color:#2f855a;',
            error:      'background:rgba(245,101,101,0.1);border:2px solid #f56565;color:#c53030;'
        };
        const icons = {
            processing: 'fa-spinner fa-spin',
            success:    'fa-check-circle',
            error:      'fa-exclamation-circle'
        };
        bar.style.cssText = (styles[type] || styles.error) + 'padding:12px 15px;border-radius:10px;font-weight:600;font-size:0.95rem;';
        bar.innerHTML = `<i class="fas ${icons[type] || icons.error}"></i> ${message}`;

        // Show the toggle once there are log entries
        const log = document.getElementById('import-log');
        if (logToggle && log && log.children.length > 0) {
            logToggle.style.display = 'block';
        }
    }

    renderCustomWordsList() {
        const listContainer = document.getElementById('custom-words-list');
        const listItem = document.getElementById('custom-words-list-item');
        const countBadge = document.getElementById('custom-words-count');
        const clearBtn = document.getElementById('clear-custom-words-btn');
        const saveBtn = document.getElementById('save-to-source-btn');
        if (!listContainer) return;

        const words = window.wordImporter ? window.wordImporter.getCustomWords() : [];
        const count = words.length;

        if (countBadge) countBadge.textContent = count;

        if (count === 0) {
            if (listItem) listItem.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'none';
            return;
        }

        if (listItem) listItem.style.display = 'block';
        if (clearBtn) clearBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'inline-flex';

        listContainer.innerHTML = words.map(w => `
            <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;
                        background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.25);
                        border-radius:20px;font-size:0.9rem;">
                <span>${w.image}</span>
                <span style="font-weight:600;">${w.word}</span>
                <span style="color:#718096;">${w.translation}</span>
                <button onclick="window.settingsManager.removeCustomWord('${w.word.replace(/'/g, "\\'")}')"
                        style="background:none;border:none;cursor:pointer;color:#a0aec0;padding:0;margin-right:2px;font-size:0.85rem;"
                        title="מחק">
                    <i class="fas fa-times"></i>
                </button>
            </div>`
        ).join('');
    }

    removeCustomWord(word) {
        if (!window.wordImporter) return;
        window.wordImporter.deleteCustomWord(word);
        this.renderCustomWordsList();
        this.renderCategoryCheckboxes();
        this.updateSelectedCount();
    }
}

// Static methods for accessing settings from other files
SettingsManager.getSettings = function() {
    const saved = localStorage.getItem('englishLearningSettings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error loading settings:', error);
            return null;
        }
    }
    return null;
};

SettingsManager.isPracticeMode = function() {
    const settings = SettingsManager.getSettings();
    if (settings && settings.selectedCategories) {
        return settings.selectedCategories.length < 5;
    }
    return false;
};

// ========== User Management UI ==========

function initUserManagement() {
    console.log('initUserManagement() called');
    // Only run on settings page
    const userTableBody = document.getElementById('user-table-body');
    console.log('user-table-body element:', !!userTableBody);

    if (!userTableBody) {
        console.log('user-table-body not found, skipping user management init');
        return;
    }

    // Check if authService is available
    console.log('authService available:', typeof authService !== 'undefined');
    if (typeof authService === 'undefined') {
        console.warn('Auth service not loaded');
        return;
    }

    console.log('Populating user table...');
    populateUserTable();

    console.log('Populating reset password dropdown...');
    populateResetPasswordDropdown();

    console.log('Binding user management events...');
    bindUserManagementEvents();

    console.log('User management initialization complete');
}

function populateUserTable() {
    console.log('populateUserTable() called');
    const tbody = document.getElementById('user-table-body');
    console.log('tbody element:', !!tbody);

    if (!tbody) {
        console.warn('tbody not found in populateUserTable');
        return;
    }

    const users = authService.getUsers();
    console.log('Users from authService:', users);

    if (!users) {
        console.warn('No users returned from authService');
        return;
    }

    tbody.innerHTML = '';
    console.log('Cleared tbody, adding users...');

    Object.values(users).forEach((user, index) => {
        console.log(`Adding user ${index + 1}:`, user);
        const hasPassword = user.password !== null;
        const createdDate = user.created ? new Date(user.created).toLocaleDateString('he-IL') : 'N/A';
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('he-IL') : 'לא התחבר';

        const isManager = user.role === 'manager' || user.role === 'parent';

        const isParent = user.role === 'parent' || user.role === 'manager';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.displayName}</td>
            <td>${createdDate}</td>
            <td>${lastLogin}</td>
            <td>
                <span class="user-status-badge ${hasPassword ? 'has-password' : 'no-password'}">
                    ${hasPassword ? '🔒 מוגן בסיסמה' : '🔓 ללא סיסמה'}
                </span>
            </td>
            <td>
                <button class="user-action-btn ${isParent ? 'parent-on' : 'parent-off'}" onclick="toggleParentRole('${user.id}')" title="${isParent ? 'הסר הרשאת הורה' : 'הענק הרשאת הורה'}">
                    <i class="fas ${isParent ? 'fa-user-shield' : 'fa-user'}"></i>
                    ${isParent ? 'הורה' : 'ילד'}
                </button>
            </td>
            <td>
                <button class="user-action-btn reset" onclick="resetUserPassword('${user.id}')" title="אפס סיסמה">
                    <i class="fas fa-redo"></i> אפס
                </button>
            </td>
            <td>
                <button class="user-action-btn reset-practice" onclick="resetUserPractice('${user.id}')" title="אפס נתוני תרגול">
                    <i class="fas fa-dumbbell"></i> אפס
                </button>
            </td>
            <td>
                <button class="user-action-btn reset-stats" onclick="resetUserStats('${user.id}')" title="אפס סטטיסטיקות">
                    <i class="fas fa-chart-bar"></i> אפס
                </button>
            </td>
            <td>
                ${!isManager ? `<button class="user-action-btn delete" onclick="deleteUser('${user.id}')" title="מחק משתמש">
                    <i class="fas fa-trash"></i> מחק
                </button>` : '—'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function toggleParentRole(userId) {
    if (typeof authService === 'undefined') return;
    const users = authService.getUsers();
    if (!users || !users[userId]) return;

    const user = users[userId];
    const isCurrentlyParent = user.role === 'parent' || user.role === 'manager';

    if (isCurrentlyParent) {
        // Remove parent role
        delete user.role;
    } else {
        // Grant parent role
        user.role = 'parent';
    }

    authService.saveUsers(users);
    populateUserTable();
}

// Kept for backwards compatibility but not used
function populateUserList() {
    populateUserTable();
}

function populateUserInfoCards() {
    // No longer used - replaced by table
}

function populateResetPasswordDropdown() {
    const select = document.getElementById('reset-password-user');
    if (!select) return;

    const users = authService.getUsers();
    if (!users) return;

    // Clear existing options except first
    select.innerHTML = '<option value="">בחר משתמש...</option>';

    Object.values(users).forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.displayName} (${user.name})`;
        select.appendChild(option);
    });
}

function bindUserManagementEvents() {
    const resetBtn = document.getElementById('reset-password-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', handlePasswordReset);
    }

    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', addUser);
    }
}

function handlePasswordReset() {
    const userSelect = document.getElementById('reset-password-user');
    const adminPasswordInput = document.getElementById('admin-password');
    const messageDiv = document.getElementById('reset-password-message');

    const userId = userSelect.value;
    const adminPassword = adminPasswordInput.value;

    // Clear previous message
    messageDiv.style.display = 'none';
    messageDiv.className = 'form-message';

    // Validate inputs
    if (!userId) {
        showMessage(messageDiv, 'Please select a user / אנא בחר משתמש', 'error');
        return;
    }

    if (!adminPassword) {
        showMessage(messageDiv, 'Please enter admin password / אנא הכנס סיסמת מנהל', 'error');
        return;
    }

    // Attempt reset
    const result = authService.resetUserPassword(userId, adminPassword);

    if (result.success) {
        showMessage(messageDiv, result.message, 'success');
        adminPasswordInput.value = '';
        userSelect.value = '';

        // Refresh user list
        populateUserList();
        populateUserInfoCards();
    } else {
        showMessage(messageDiv, result.error, 'error');
    }
}

// Global functions for user table actions
function resetUserPassword(userId) {
    if (!confirm('האם אתה בטוח שברצונך לאפס את הסיסמה של משתמש זה?')) {
        return;
    }

    // Check if settings are already unlocked
    const settingsManager = window.settingsManager;
    let adminPassword;

    if (settingsManager && settingsManager.isPasswordUnlocked) {
        // Already unlocked, use the admin password
        adminPassword = authService.ADMIN_PASSWORD;
    } else {
        // Not unlocked, ask for password
        adminPassword = prompt('הכנס סיסמת מנהל:');
        if (!adminPassword) {
            return;
        }
    }

    if (typeof authService !== 'undefined' && authService.resetUserPassword) {
        const result = authService.resetUserPassword(userId, adminPassword);
        if (result.success) {
            alert(result.message || 'הסיסמה אופסה בהצלחה! המשתמש יוכל להגדיר סיסמה חדשה בכניסה הבאה.');
            populateUserTable();
        } else {
            alert('שגיאה באיפוס הסיסמה: ' + (result.message || result.error));
        }
    } else {
        alert('שירות האימות לא זמין');
    }
}

function deleteUser(userId) {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה? פעולה זו תמחק את כל הנתונים והסטטיסטיקות של המשתמש ולא ניתן לבטלה!')) {
        return;
    }

    // Double confirm for safety
    if (!confirm('אישור אחרון: פעולה זו לא ניתנת לביטול. האם להמשיך?')) {
        return;
    }

    // Check if settings are already unlocked
    const settingsManager = window.settingsManager;
    let adminPassword;

    if (settingsManager && settingsManager.isPasswordUnlocked) {
        // Already unlocked, use the admin password
        adminPassword = authService.ADMIN_PASSWORD;
    } else {
        // Not unlocked, ask for password
        adminPassword = prompt('הכנס סיסמת מנהל:');
        if (!adminPassword) {
            return;
        }
    }

    if (typeof authService !== 'undefined' && authService.deleteUser) {
        const result = authService.deleteUser(userId, adminPassword);
        if (result.success) {
            alert(result.message || 'המשתמש נמחק בהצלחה');
            populateUserTable();
        } else {
            alert('שגיאה במחיקת המשתמש: ' + result.message);
        }
    } else {
        alert('שירות האימות לא זמין');
    }
}

function resetUserPractice(userId) {
    if (!confirm('האם אתה בטוח שברצונך לאפס את נתוני התרגול של משתמש זה?\nפעולה זו תמחק את כל נתוני המילים הנאבקות ומונה התרגול יראה 0.')) {
        return;
    }

    const key = `v2_userProgress_${userId}`;
    const progress = JSON.parse(localStorage.getItem(key) || '{}');
    progress.wordMastery = {};
    localStorage.setItem(key, JSON.stringify(progress));

    alert('נתוני התרגול אופסו בהצלחה!');
}

function resetUserStats(userId) {
    if (!confirm('האם אתה בטוח שברצונך לאפס את כל הסטטיסטיקות של משתמש זה?\nפעולה זו תמחק את כל ציוני המשחקים וההיסטוריה ולא ניתן לבטלה!')) {
        return;
    }

    const gameTypes = ['vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening', 'reading', 'abc', 'memory', 'scramble', 'fill-blanks', 'practice', 'true-or-not', 'picture-match', 'word-journey', 'word-builder', 'story-time'];

    // Clear per-game score history
    gameTypes.forEach(game => {
        localStorage.removeItem(`${userId}_${game}_history`);
    });

    // Clear memory personal bests
    localStorage.removeItem(`memoryBest_${userId}`);

    // Reset ALL stats fields in userProgress (keep only version + settings)
    const key = `v2_userProgress_${userId}`;
    const progress = JSON.parse(localStorage.getItem(key) || '{}');
    progress.bestScores = {};
    progress.totalGamesPlayed = 0;
    progress.gameHistory = {};
    progress.streakDays = 0;
    progress.lastPlayDate = null;
    progress.lastLoginDate = new Date().toISOString().split('T')[0]; // prevent daily bonus re-fire on next load
    progress.totalCorrectAnswers = 0;
    progress.totalPoints = 0;
    progress.totalLearningTimeMs = 0;
    progress.coins = 0;
    progress.coinHistory = [];
    progress.certificates = [];
    progress.learnedWords = {};
    progress.wordMastery = {};
    progress.gameUnlocks = {};
    progress.activityDates = [];
    progress.wordJourneyProgress = {};
    localStorage.setItem(key, JSON.stringify(progress));

    alert('כל הסטטיסטיקות אופסו בהצלחה! טען מחדש את הדף לעדכון.');
}

function addUser() {
    // Check max users limit (4 users max)
    if (typeof authService !== 'undefined' && authService.getUsers) {
        const existingUsers = authService.getUsers();
        const userCount = Object.keys(existingUsers).length;
        if (userCount >= 4) {
            alert('הגעת למספר המקסימלי של משתמשים (4). מחק משתמש קיים כדי להוסיף משתמש חדש.');
            return;
        }
    }

    const userId = prompt('הכנס שם משתמש חדש (באנגלית, ללא רווחים):');
    if (!userId) return;

    // Validate username
    if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
        alert('שם משתמש לא חוקי. השתמש באותיות אנגליות, מספרים וקו תחתון בלבד.');
        return;
    }

    const displayName = prompt('הכנס שם תצוגה (בעברית):');
    if (!displayName) return;

    const initial = prompt('הכנס ראשי תיבות (אות אחת באנגלית):');
    if (!initial || initial.length !== 1) {
        alert('יש להכניס אות אחת בלבד');
        return;
    }

    // Check if settings are already unlocked
    const settingsManager = window.settingsManager;
    let adminPassword;

    if (settingsManager && settingsManager.isPasswordUnlocked) {
        // Already unlocked, use the admin password
        adminPassword = authService.ADMIN_PASSWORD;
    } else {
        // Not unlocked, ask for password
        adminPassword = prompt('הכנס סיסמת מנהל:');
        if (!adminPassword) return;
    }

    if (typeof authService !== 'undefined' && authService.addUser) {
        const result = authService.addUser(userId, userId, displayName, initial.toUpperCase(), adminPassword);
        if (result.success) {
            alert(`משתמש נוצר בהצלחה!\nשם משתמש: ${userId}\nהמשתמש יוכל להגדיר סיסמה בכניסה הראשונה.`);
            populateUserTable();
        } else {
            alert('שגיאה ביצירת משתמש: ' + (result.message || result.error));
        }
    } else {
        alert('שירות האימות לא זמין');
    }
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `form-message ${type}`;
    element.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Expose functions to global scope for onclick handlers
window.resetUserPassword = resetUserPassword;
window.resetUserPractice = resetUserPractice;
window.resetUserStats = resetUserStats;
window.deleteUser = deleteUser;
window.addUser = addUser;

// Initialize settings manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();

    // Initialize user management (only on settings page)
    initUserManagement();

    // Update home notification dot (header injected by top-header.js module)
    updateHomeNotificationDot();
});

// Function to update home notification dot on settings/stats pages
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
