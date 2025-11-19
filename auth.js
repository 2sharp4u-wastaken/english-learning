// Authentication Service for English Learning Games
// Provides user login, session management, and password protection

class AuthService {
    constructor() {
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
        this.ADMIN_PASSWORD = '1234'; // Admin password for user management
        this.sessionCheckInterval = null;
        this.lastActivityTime = Date.now();

        this.init();
    }

    init() {
        // Initialize users database if not exists
        this.initializeUsersDatabase();

        // Check if there's an active session
        this.checkActiveSession();

        // Setup activity tracking for session timeout
        this.setupActivityTracking();

        // Start session timeout checker
        this.startSessionMonitor();
    }

    /**
     * Initialize users database with default users if first time
     */
    initializeUsersDatabase() {
        let users = this.getUsers();

        // If no users exist, create default users and prompt for password setup
        if (!users || Object.keys(users).length === 0) {
            users = {
                'omer': {
                    id: 'omer',
                    name: 'עומר',
                    displayName: 'Omer',
                    initial: 'O',
                    password: null, // Will be set on first login
                    created: new Date().toISOString(),
                    lastLogin: null
                },
                'zohar': {
                    id: 'zohar',
                    name: 'זוהר',
                    displayName: 'Zohar',
                    initial: 'Z',
                    password: null,
                    created: new Date().toISOString(),
                    lastLogin: null
                },
                'idan': {
                    id: 'idan',
                    name: 'עידן',
                    displayName: 'Idan',
                    initial: 'I',
                    password: null,
                    created: new Date().toISOString(),
                    lastLogin: null
                }
            };

            this.saveUsers(users);

            // Migrate existing user data from old format (O, Z, I)
            this.migrateOldUserData();
        }
    }

    /**
     * Migrate user progress from old single-letter format to new user IDs
     */
    migrateOldUserData() {
        const migrations = [
            { oldKey: 'O', newKey: 'omer' },
            { oldKey: 'Z', newKey: 'zohar' },
            { oldKey: 'I', newKey: 'idan' }
        ];

        migrations.forEach(({ oldKey, newKey }) => {
            // Migrate user progress
            const oldProgressKey = `userProgress_${oldKey}`;
            const oldProgress = localStorage.getItem(oldProgressKey);

            if (oldProgress) {
                const newProgressKey = `userProgress_${newKey}`;
                // Only migrate if new key doesn't exist
                if (!localStorage.getItem(newProgressKey)) {
                    localStorage.setItem(newProgressKey, oldProgress);
                    console.log(`Migrated progress for ${oldKey} → ${newKey}`);
                }
            }

            // Migrate game history
            const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading'];
            gameTypes.forEach(gameType => {
                const oldHistoryKey = `${oldKey}_${gameType}_history`;
                const oldHistory = localStorage.getItem(oldHistoryKey);

                if (oldHistory) {
                    const newHistoryKey = `${newKey}_${gameType}_history`;
                    if (!localStorage.getItem(newHistoryKey)) {
                        localStorage.setItem(newHistoryKey, oldHistory);
                        console.log(`Migrated ${gameType} history for ${oldKey} → ${newKey}`);
                    }
                }
            });
        });

        // Migrate current user if it's using old format
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser && ['O', 'Z', 'I'].includes(currentUser)) {
            const mapping = { 'O': 'omer', 'Z': 'zohar', 'I': 'idan' };
            localStorage.removeItem('currentUser'); // Will be set after login
            console.log(`Old current user (${currentUser}) will need to login`);
        }
    }

    /**
     * Get all users from localStorage
     */
    getUsers() {
        const usersData = localStorage.getItem('users');
        if (usersData) {
            try {
                return JSON.parse(usersData);
            } catch (e) {
                console.error('Error parsing users data:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Save users to localStorage
     */
    saveUsers(users) {
        try {
            localStorage.setItem('users', JSON.stringify(users));
        } catch (e) {
            console.error('Error saving users:', e);
        }
    }

    /**
     * Get user by ID
     */
    getUser(userId) {
        const users = this.getUsers();
        return users ? users[userId] : null;
    }

    /**
     * Hash password (simple implementation for client-side)
     * Note: This is not cryptographically secure, but sufficient for local parental controls
     */
    hashPassword(password) {
        // Simple base64 encoding with salt for basic obfuscation
        const salt = 'englishlearning2024';
        return btoa(salt + password + salt);
    }

    /**
     * Verify password
     */
    verifyPassword(password, hashedPassword) {
        return this.hashPassword(password) === hashedPassword;
    }

    /**
     * Set password for a user (first-time setup or password change)
     */
    setUserPassword(userId, password) {
        const users = this.getUsers();
        if (users && users[userId]) {
            users[userId].password = this.hashPassword(password);
            this.saveUsers(users);
            return true;
        }
        return false;
    }

    /**
     * Check if user needs password setup
     */
    needsPasswordSetup(userId) {
        const user = this.getUser(userId);
        return user && user.password === null;
    }

    /**
     * Login user with password
     */
    login(userId, password) {
        const user = this.getUser(userId);

        if (!user) {
            return { success: false, error: 'משתמש לא קיים / User not found' };
        }

        // If user hasn't set password yet, any password works (first-time setup)
        if (user.password === null) {
            // Set the password they entered as their password
            this.setUserPassword(userId, password);
            console.log(`Password set for user: ${userId}`);
        } else {
            // Verify password
            if (!this.verifyPassword(password, user.password)) {
                return { success: false, error: 'סיסמה שגויה / Incorrect password' };
            }
        }

        // Create session
        const session = {
            userId: userId,
            userName: user.name,
            displayName: user.displayName,
            initial: user.initial,
            loginTime: Date.now(),
            lastActivity: Date.now(),
            authenticated: true
        };

        // Save session
        localStorage.setItem('currentSession', JSON.stringify(session));
        localStorage.setItem('currentUser', userId); // For backward compatibility

        // Update user's last login
        const users = this.getUsers();
        users[userId].lastLogin = new Date().toISOString();
        this.saveUsers(users);

        // Reset activity timer
        this.lastActivityTime = Date.now();

        console.log(`User ${userId} logged in successfully`);

        // Dispatch event for welcome screen
        window.dispatchEvent(new CustomEvent('user-logged-in', { detail: { userId, user } }));

        return { success: true, user: user, session: session };
    }

    /**
     * Logout current user
     */
    logout() {
        // Clear session
        localStorage.removeItem('currentSession');

        // Don't remove currentUser for now (for backward compatibility)
        // localStorage.removeItem('currentUser');

        console.log('User logged out');

        // Redirect to login page
        window.location.reload();
    }

    /**
     * Get current session
     */
    getCurrentSession() {
        const sessionData = localStorage.getItem('currentSession');
        if (sessionData) {
            try {
                return JSON.parse(sessionData);
            } catch (e) {
                console.error('Error parsing session data:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const session = this.getCurrentSession();
        if (!session || !session.authenticated) {
            return false;
        }

        // Check if session has expired
        const now = Date.now();
        const timeSinceActivity = now - (session.lastActivity || session.loginTime);

        if (timeSinceActivity > this.SESSION_TIMEOUT) {
            console.log('Session expired');
            this.logout();
            return false;
        }

        return true;
    }

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        const session = this.getCurrentSession();
        if (session && this.isAuthenticated()) {
            return this.getUser(session.userId);
        }
        return null;
    }

    /**
     * Get current user ID
     */
    getCurrentUserId() {
        const session = this.getCurrentSession();
        return session ? session.userId : null;
    }

    /**
     * Check if there's an active session on page load
     */
    checkActiveSession() {
        if (!this.isAuthenticated()) {
            // No active session, show login screen
            return false;
        }

        // Active session exists
        const session = this.getCurrentSession();
        console.log(`Active session found for user: ${session.userId}`);
        return true;
    }

    /**
     * Update last activity time
     */
    updateActivity() {
        this.lastActivityTime = Date.now();

        // Update session in localStorage
        const session = this.getCurrentSession();
        if (session) {
            session.lastActivity = this.lastActivityTime;
            localStorage.setItem('currentSession', JSON.stringify(session));
        }
    }

    /**
     * Setup activity tracking (mouse, keyboard, touch)
     */
    setupActivityTracking() {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        events.forEach(event => {
            document.addEventListener(event, () => {
                if (this.isAuthenticated()) {
                    this.updateActivity();
                }
            }, { passive: true });
        });
    }

    /**
     * Start session monitor (check for timeout every minute)
     */
    startSessionMonitor() {
        this.sessionCheckInterval = setInterval(() => {
            if (this.isAuthenticated()) {
                const timeSinceActivity = Date.now() - this.lastActivityTime;

                // Show warning 2 minutes before timeout
                if (timeSinceActivity > this.SESSION_TIMEOUT - (2 * 60 * 1000) &&
                    timeSinceActivity < this.SESSION_TIMEOUT) {
                    this.showTimeoutWarning();
                }

                // Check if session expired
                if (timeSinceActivity > this.SESSION_TIMEOUT) {
                    this.handleSessionTimeout();
                }
            }
        }, 60 * 1000); // Check every minute
    }

    /**
     * Show warning before session timeout
     */
    showTimeoutWarning() {
        // Only show once
        if (this.warningShown) return;
        this.warningShown = true;

        const notification = document.createElement('div');
        notification.className = 'session-timeout-warning';
        notification.innerHTML = `
            <div class="timeout-content">
                <i class="fas fa-clock"></i>
                <p>Your session will expire soon due to inactivity.</p>
                <p>המושב שלך יפוג בקרוב בגלל חוסר פעילות.</p>
                <button onclick="authService.updateActivity(); this.parentElement.parentElement.remove();">
                    I'm still here / אני עדיין כאן
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
                this.warningShown = false;
            }
        }, 30000);
    }

    /**
     * Handle session timeout
     */
    handleSessionTimeout() {
        alert('Session expired due to inactivity. Please log in again.\nהמושב פג בגלל חוסר פעילות. אנא התחבר שוב.');
        this.logout();
    }

    /**
     * Stop session monitor (cleanup)
     */
    stopSessionMonitor() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }

    /**
     * Verify admin password
     */
    verifyAdminPassword(password) {
        return password === this.ADMIN_PASSWORD;
    }

    /**
     * Add a new user (admin only)
     */
    addUser(userId, name, displayName, initial, adminPassword) {
        if (!this.verifyAdminPassword(adminPassword)) {
            return { success: false, error: 'Incorrect admin password' };
        }

        const users = this.getUsers();

        if (users[userId]) {
            return { success: false, error: 'User already exists' };
        }

        users[userId] = {
            id: userId,
            name: name,
            displayName: displayName,
            initial: initial,
            password: null, // Will be set on first login
            created: new Date().toISOString(),
            lastLogin: null
        };

        this.saveUsers(users);

        return { success: true, message: `User ${displayName} created successfully` };
    }

    /**
     * Reset user password (admin only)
     */
    resetUserPassword(userId, adminPassword) {
        if (!this.verifyAdminPassword(adminPassword)) {
            return { success: false, error: 'Incorrect admin password' };
        }

        const users = this.getUsers();

        if (!users[userId]) {
            return { success: false, error: 'User not found' };
        }

        users[userId].password = null; // Reset to null - will be set on next login
        this.saveUsers(users);

        return { success: true, message: `Password reset for ${users[userId].displayName}. They will set a new password on next login.` };
    }

    /**
     * Delete user (admin only)
     */
    deleteUser(userId, adminPassword) {
        if (!this.verifyAdminPassword(adminPassword)) {
            return { success: false, message: 'Incorrect admin password' };
        }

        const users = this.getUsers();

        if (!users[userId]) {
            return { success: false, message: 'User not found' };
        }

        // Don't allow deleting the manager account
        if (userId === 'manager') {
            return { success: false, message: 'Cannot delete manager account' };
        }

        // Delete user from users object
        delete users[userId];
        this.saveUsers(users);

        // Delete user's data from localStorage
        localStorage.removeItem(`userProgress_${userId}`);
        const gameTypes = ['vocabulary', 'grammar', 'pronunciation', 'listening', 'reading'];
        gameTypes.forEach(game => {
            localStorage.removeItem(`scoreHistory_${userId}_${game}`);
        });

        return { success: true, message: `User deleted successfully` };
    }
}

// ========== UI Controller for Login Modal ==========

class AuthUIController {
    constructor(authService) {
        this.authService = authService;
        this.selectedUserId = null;

        // DOM elements
        this.loginModal = null;
        this.userSelectionScreen = null;
        this.passwordEntryScreen = null;
        this.userSelectionGrid = null;
        this.loginForm = null;
        this.passwordInput = null;
        this.authError = null;
        this.passwordHint = null;
        this.userDisplay = null;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initDOM());
        } else {
            this.initDOM();
        }
    }

    initDOM() {
        // Get DOM elements
        this.loginModal = document.getElementById('login-modal');
        this.userSelectionScreen = document.getElementById('user-selection-screen');
        this.passwordEntryScreen = document.getElementById('password-entry-screen');
        this.userSelectionGrid = document.getElementById('user-selection-grid');
        this.loginForm = document.getElementById('login-form');
        this.passwordInput = document.getElementById('password-input');
        this.authError = document.getElementById('auth-error');
        this.passwordHint = document.getElementById('password-hint');
        this.userDisplay = document.getElementById('user-display');

        if (!this.loginModal) {
            // Login modal doesn't exist - this is okay for pages like settings.html and stats.html
            // These pages don't need the login flow, they just need auth checking
            console.log('Login modal not found - not on main game page');

            // If user is NOT authenticated, redirect to main page
            if (!this.authService.isAuthenticated()) {
                console.log('User not authenticated, redirecting to main page');
                window.location.href = 'index.html';
            }
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        // Check if user is already authenticated
        if (this.authService.isAuthenticated()) {
            this.hideLoginModal();
            this.updateUserDisplay();
        } else {
            this.showLoginModal();
            this.populateUserSelection();
        }
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('back-to-selection');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showUserSelection());
        }

        // Login form submission
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Toggle password visibility
        const togglePasswordBtn = document.getElementById('toggle-password');
        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', () => this.togglePasswordVisibility());
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    populateUserSelection() {
        if (!this.userSelectionGrid) return;

        const users = this.authService.getUsers();
        if (!users) return;

        this.userSelectionGrid.innerHTML = '';

        Object.values(users).forEach(user => {
            const card = document.createElement('button');
            card.className = 'user-select-card';
            card.innerHTML = `
                <div class="user-select-avatar">${user.initial}</div>
                <span>${user.name}</span>
            `;

            card.addEventListener('click', () => this.selectUser(user.id));

            this.userSelectionGrid.appendChild(card);
        });
    }

    selectUser(userId) {
        this.selectedUserId = userId;
        const user = this.authService.getUser(userId);

        if (!user) return;

        // Update password screen UI
        document.getElementById('login-avatar').textContent = user.initial;
        document.getElementById('login-user-name').textContent = user.name;

        // Check if user needs password setup
        if (this.authService.needsPasswordSetup(userId)) {
            this.passwordHint.style.display = 'block';
        } else {
            this.passwordHint.style.display = 'none';
        }

        // Show password screen
        this.showPasswordEntry();
    }

    showUserSelection() {
        this.userSelectionScreen.style.display = 'block';
        this.passwordEntryScreen.style.display = 'none';
        this.selectedUserId = null;
        this.clearPasswordInput();
        this.hideError();
    }

    showPasswordEntry() {
        this.userSelectionScreen.style.display = 'none';
        this.passwordEntryScreen.style.display = 'block';

        // Focus password input
        setTimeout(() => {
            if (this.passwordInput) {
                this.passwordInput.focus();
            }
        }, 100);
    }

    async handleLogin() {
        if (!this.selectedUserId) {
            this.showError('Please select a user first / אנא בחר משתמש תחילה');
            return;
        }

        const password = this.passwordInput.value.trim();

        if (!password) {
            this.showError('Please enter a password / אנא הכנס סיסמה');
            return;
        }

        // Attempt login
        const result = this.authService.login(this.selectedUserId, password);

        if (result.success) {
            // Login successful
            this.hideError();
            this.clearPasswordInput();
            this.hideLoginModal();
            this.updateUserDisplay();

            // Show welcome message
            this.showWelcomeNotification(result.user.name);

            // Reload app with new user context (if appManager exists)
            if (typeof appManager !== 'undefined' && appManager.userProgress) {
                appManager.userProgress = appManager.loadUserProgress();
            }
        } else {
            // Login failed
            this.showError(result.error);
            this.passwordInput.select();
        }
    }

    handleLogout() {
        const confirmed = confirm('Are you sure you want to logout?\nבטוח שאתה רוצה להתנתק?');
        if (confirmed) {
            this.authService.logout();
        }
    }

    showLoginModal() {
        if (this.loginModal) {
            this.loginModal.classList.remove('hidden');
            this.showUserSelection();
        }
    }

    hideLoginModal() {
        if (this.loginModal) {
            this.loginModal.classList.add('hidden');
        }
    }

    updateUserDisplay() {
        const user = this.authService.getCurrentUser();

        if (user && this.userDisplay) {
            document.getElementById('user-avatar').textContent = user.initial;
            document.getElementById('user-display-name').textContent = user.name;
            this.userDisplay.style.display = 'block';
        } else if (this.userDisplay) {
            this.userDisplay.style.display = 'none';
        }
    }

    togglePasswordVisibility() {
        const toggleBtn = document.getElementById('toggle-password');
        const icon = toggleBtn.querySelector('i');

        if (this.passwordInput.type === 'password') {
            this.passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            this.passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    showError(message) {
        if (this.authError) {
            this.authError.textContent = message;
            this.authError.style.display = 'block';
        }
    }

    hideError() {
        if (this.authError) {
            this.authError.style.display = 'none';
            this.authError.textContent = '';
        }
    }

    clearPasswordInput() {
        if (this.passwordInput) {
            this.passwordInput.value = '';
        }
    }

    showWelcomeNotification(userName) {
        const notification = document.createElement('div');
        notification.className = 'session-timeout-warning';
        notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        notification.innerHTML = `
            <div class="timeout-content">
                <i class="fas fa-check-circle"></i>
                <p><strong>Welcome back, ${userName}!</strong></p>
                <p><strong>!שלום, ${userName}</strong></p>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// Create global instances
const authService = new AuthService();
const authUIController = new AuthUIController(authService);
