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
            { id: 'sports', name: 'ספורט', wordCount: 18 }
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
            difficulty: 'beginner',

            // Display settings (hidden from UI)
            showPictures: false,

            // Advanced settings
            showConfetti: true,

            // Exit behavior settings
            exitBehavior: 'hybrid', // Options: 'hybrid', 'confirmation', 'autosave', 'smart'
            exitThreshold: 3, // Question number where behavior changes (for hybrid/smart)
            autoSaveProgress: true, // Whether to save incomplete games
            showExitToast: true // Show toast notification on exit
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

    }

    setupPasswordProtection() {
        console.log('setupPasswordProtection() called');
        const modal = document.getElementById('password-modal');
        const passwordInput = document.getElementById('password-input');
        const submitBtn = document.getElementById('password-submit');
        const cancelBtn = document.getElementById('password-cancel');
        const errorDiv = document.getElementById('password-error');
        const unlockBtn = document.getElementById('unlock-protected-btn');

        console.log('Password protection elements:', {
            modal: !!modal,
            passwordInput: !!passwordInput,
            submitBtn: !!submitBtn,
            cancelBtn: !!cancelBtn,
            unlockBtn: !!unlockBtn
        });

        // Only setup password protection if we're on the settings page
        if (!modal || !passwordInput || !submitBtn || !cancelBtn) {
            console.log('Not on settings page, skipping password protection setup');
            return;
        }

        console.log('Setting up password protection...');

        // Handle unlock button click
        if (unlockBtn) {
            console.log('Adding click listener to unlock button');
            unlockBtn.addEventListener('click', (e) => {
                console.log('Unlock button clicked! isPasswordUnlocked:', this.isPasswordUnlocked);
                e.preventDefault();
                e.stopPropagation();

                if (!this.isPasswordUnlocked) {
                    // Show password modal
                    console.log('Showing password modal');
                    modal.classList.add('show');
                    passwordInput.value = '';
                    errorDiv.classList.remove('show');
                    passwordInput.focus();
                } else {
                    // Already unlocked, do nothing
                    console.log('Already unlocked');
                    return;
                }
            });
        } else {
            console.warn('Unlock button not found!');
        }

        // Intercept clicks on protected sections when locked
        document.querySelectorAll('.protected-section').forEach(section => {
            section.addEventListener('click', (e) => {
                if (!this.isPasswordUnlocked) {
                    // Prevent any interaction
                    e.preventDefault();
                    e.stopPropagation();

                    // Show password modal
                    modal.classList.add('show');
                    passwordInput.value = '';
                    errorDiv.classList.remove('show');
                    passwordInput.focus();
                }
            }, true); // Use capture phase to intercept before child elements

            // Also prevent changes to form elements
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

                // Remove visual indication from protected sections
                document.querySelectorAll('.protected-section').forEach(s => {
                    s.classList.remove('locked');
                    s.classList.add('unlocked');
                });

                // Update unlock button
                if (unlockBtn) {
                    unlockBtn.innerHTML = '<i class="fas fa-unlock"></i> הגדרות פתוחות';
                    unlockBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
                    unlockBtn.disabled = true;
                    unlockBtn.style.opacity = '0.7';
                    unlockBtn.style.cursor = 'not-allowed';
                }

                // No alert - just visual feedback from button change
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
        const protectedSections = document.querySelectorAll('.protected-section');
        console.log(`Found ${protectedSections.length} protected sections`);
        protectedSections.forEach((s, index) => {
            console.log(`Locking protected section ${index + 1}`);
            s.classList.add('locked');
        });
        console.log('All protected sections locked');
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
        // Override difficulty from current user's per-user progress
        const userId = this.getCurrentUserId();
        if (userId) {
            try {
                const progress = JSON.parse(localStorage.getItem(`userProgress_${userId}`) || '{}');
                if (progress.preferredDifficulty) {
                    this.settings.difficulty = progress.preferredDifficulty;
                }
            } catch (e) { /* ignore */ }
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('englishLearningSettings', JSON.stringify(this.settings));
            // Also save difficulty to current user's per-user progress
            const userId = this.getCurrentUserId();
            if (userId) {
                const progressKey = `userProgress_${userId}`;
                const progress = JSON.parse(localStorage.getItem(progressKey) || '{}');
                progress.preferredDifficulty = this.settings.difficulty;
                localStorage.setItem(progressKey, JSON.stringify(progress));
            }
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

        container.innerHTML = '';

        this.categories.forEach(category => {
            const isChecked = this.settings.selectedCategories.includes(category.id);
            const div = document.createElement('div');
            div.className = `checkbox-item ${isChecked ? 'checked' : ''}`;
            div.dataset.categoryId = category.id;

            div.innerHTML = `
                <input type="checkbox"
                       id="cat-${category.id}"
                       value="${category.id}"
                       ${isChecked ? 'checked' : ''}>
                <label for="cat-${category.id}">
                    ${category.name} (${category.wordCount})
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

        // Less than 5 = practice mode (orange), 5+ = competitive mode (green)
        if (count < 5) {
            countElement.style.background = '#f59e0b'; // Orange for practice mode
        } else {
            countElement.style.background = '#48bb78'; // Green for competitive mode
        }
    }

    validateCategorySelection() {
        const count = this.settings.selectedCategories.length;
        const warning = document.getElementById('category-warning');

        if (count < 1) {
            warning.textContent = 'חובה לבחור לפחות קטגוריה אחת!';
            warning.classList.add('show');
            return false;
        } else if (count < 5) {
            warning.textContent = `בחרת ${count} קטגוריות - המשחק יהיה במצב אימון (הציונים לא יישמרו).`;
            warning.classList.add('show');
            return true; // Allow but warn
        } else {
            warning.classList.remove('show');
            return true;
        }
    }

    isPracticeMode() {
        return this.settings.selectedCategories.length < 5;
    }

    /**
     * Shows admin password modal and returns a promise
     * @param {string} title - Modal title (e.g., "אפס הגדרות")
     * @returns {Promise<boolean>} - Resolves to true if password correct, false if cancelled
     */
    showAdminPasswordPrompt(title = 'אישור פעולה') {
        return new Promise((resolve) => {
            const modal = document.getElementById('password-modal');
            const passwordInput = document.getElementById('password-input');
            const submitBtn = document.getElementById('password-submit');
            const cancelBtn = document.getElementById('password-cancel');
            const errorDiv = document.getElementById('password-error');
            const modalTitle = modal.querySelector('h3');

            if (!modal || !passwordInput || !submitBtn || !cancelBtn) {
                // Fallback to browser prompt if modal not available
                const password = prompt('הכנס סיסמת מנהל:');
                if (!password) {
                    resolve(false);
                    return;
                }
                const isValid = typeof authService !== 'undefined' && authService.verifyAdminPassword(password);
                resolve(isValid);
                return;
            }

            // Update modal title
            modalTitle.innerHTML = `<i class="fas fa-lock"></i> ${title}`;

            // Show modal and clear previous state
            modal.classList.add('show');
            passwordInput.value = '';
            errorDiv.classList.remove('show');
            passwordInput.focus();

            // Create new handler functions to avoid duplicates
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
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
            };

            // Cleanup function to remove listeners
            const cleanup = () => {
                submitBtn.removeEventListener('click', handleSubmit);
                cancelBtn.removeEventListener('click', handleCancel);
                passwordInput.removeEventListener('keypress', handleKeypress);
            };

            // Add event listeners
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

        // Delete user progress
        userIds.forEach(userId => {
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

        // Difficulty radio buttons
        document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.difficulty = e.target.value;

                // Update visual state
                document.querySelectorAll('.radio-item').forEach(item => {
                    item.classList.remove('selected');
                });
                e.target.closest('.radio-item').classList.add('selected');
            });
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

        // Exit threshold slider
        document.getElementById('exit-threshold').addEventListener('input', (e) => {
            this.settings.exitThreshold = parseInt(e.target.value);
            document.getElementById('exit-threshold-value').textContent = this.settings.exitThreshold;
        });

        // Auto save progress toggle
        document.getElementById('auto-save-progress').addEventListener('change', (e) => {
            this.settings.autoSaveProgress = e.target.checked;
        });

        // Show exit toast toggle
        document.getElementById('show-exit-toast').addEventListener('change', (e) => {
            this.settings.showExitToast = e.target.checked;
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

        // Update difficulty
        document.getElementById(`diff-${this.settings.difficulty}`).checked = true;
        document.querySelector(`input[value="${this.settings.difficulty}"]`).closest('.radio-item').classList.add('selected');

        // Theme settings removed from UI

        // Update advanced settings
        document.getElementById('show-confetti').checked = this.settings.showConfetti;

        // Update exit behavior settings
        const exitBehavior = this.settings.exitBehavior || 'hybrid';
        document.getElementById(`exit-${exitBehavior}`).checked = true;
        document.querySelector(`input[value="${exitBehavior}"]`).closest('.radio-item').classList.add('selected');

        const exitThreshold = this.settings.exitThreshold || 3;
        document.getElementById('exit-threshold').value = exitThreshold;
        document.getElementById('exit-threshold-value').textContent = exitThreshold;

        document.getElementById('auto-save-progress').checked = this.settings.autoSaveProgress !== false;
        document.getElementById('show-exit-toast').checked = this.settings.showExitToast !== false;
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

    const key = `userProgress_${userId}`;
    const progress = JSON.parse(localStorage.getItem(key) || '{}');
    progress.wordMastery = {};
    localStorage.setItem(key, JSON.stringify(progress));

    alert('נתוני התרגול אופסו בהצלחה!');
}

function resetUserStats(userId) {
    if (!confirm('האם אתה בטוח שברצונך לאפס את כל הסטטיסטיקות של משתמש זה?\nפעולה זו תמחק את כל ציוני המשחקים וההיסטוריה ולא ניתן לבטלה!')) {
        return;
    }

    const gameTypes = ['vocabulary', 'grammar', 'grammar-beginner', 'pronunciation', 'listening', 'reading', 'abc', 'memory', 'scramble', 'fill-blanks', 'practice'];

    // Clear per-game score history
    gameTypes.forEach(game => {
        localStorage.removeItem(`${userId}_${game}_history`);
    });

    // Clear memory personal bests
    localStorage.removeItem(`memoryBest_${userId}`);

    // Reset aggregate fields in userProgress but keep wordMastery + settings
    const key = `userProgress_${userId}`;
    const progress = JSON.parse(localStorage.getItem(key) || '{}');
    progress.bestScores = {};
    progress.totalGamesPlayed = 0;
    progress.gameHistory = {};
    progress.streakDays = 0;
    progress.lastPlayDate = null;
    progress.totalCorrectAnswers = 0;
    localStorage.setItem(key, JSON.stringify(progress));

    alert('הסטטיסטיקות אופסו בהצלחה!');
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
