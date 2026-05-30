/** @type {import('@fullhuman/postcss-purgecss').UserDefinedOptions} */
module.exports = {
  content: [
    'index.html',
    '*.js',
    'managers/*.js',
    'components/*.js',
    'data/*.js',
    'utils/*.js',
  ],
  css: ['styles.css'],
  output: './purged/',

  // Keep FontAwesome externally — it's loaded from CDN, don't touch it
  // Keep all dynamically added classes found via JS audit
  safelist: {
    standard: [
      // Visibility / state
      'active', 'show', 'hidden', 'open', 'disabled', 'selected',
      'locked', 'checked', 'used', 'filled', 'flipped', 'matched',
      'rotated', 'recording', 'dragging', 'drag-over',

      // Feedback / validation
      'correct', 'incorrect', 'success', 'error',

      // Game states
      'card-open', 'game-active', 'game-complete',
      'fade-out', 'correct-anim', 'wrong-anim', 'shake',
      'animate-click', 'story-highlight-active', 'story-play-btn-active',
      'reveal-correct', 'match', 'mismatch',
      'memory-summary-active', 'memory-card-translation',
      'listening-option-hidden', 'abc-option-hidden', 'vocab-option-hidden',
      'gb-flash', 'wb-filled',

      // Layout modes
      'lowercase-mode', 'stab-protected',
      'has-words',
    ],

    // Dynamic patterns (e.g. mastery-level-0, mastery-level-1, user-tab-active)
    greedy: [
      /^mastery-level-/,
      /^game-card/,
      /^game-complete/,
      /^game-header/,
      /^hub-tab/,
      /^hub-panel/,
      /^auth-/,
      /^profile-/,
      /^cert-/,
      /^chime-/,
      /^topics-/,
      /^home-/,
      /^header-/,
      /^sidebar-/,
      /^user-/,           // user-btn, user-selector, user-info, user-avatar, user-name, user-meta…
      /^word-/,
      /^fill-/,
      /^wj-/,             // Word Journey (short prefix)
      /^wb-/,             // Word Builder (short prefix)
      /^st-/,             // Story Time (short prefix)
      /^achievement-/,
      /^story-/,
      /^memory-/,
      /^scramble-/,
      /^abc-/,
      /^vocab-/,
      /^grammar-/,
      /^listening-/,
      /^reading-/,
      /^pronunciation-/,
      /^picture-/,
      /^true-or-/,
      /^score-/,
      /^progress-/,
      /^toast/,
      /^exit-/,
      /^login-/,
      /^password-/,
      /^feedback/,
      /^next-btn/,
      /^play-/,
      /^record-/,
      /^option-btn/,
      /^subject-/,
      /^sentence-/,
      /^predicate-/,
      /^context-/,
      /^verb-/,
      /^modal-/,
      /^letter-/,
      /^built-word/,
      /^card-pattern/,
      /^match-/,
      /^completion-/,
      /^practice-/,
      /^courses-/,
      /^settings-link/,
      /^stats-link/,
      /^top-screen/,
      /^topic-/,
      /^current-user/,
      /^slide-/,
      /^fade-/,
      /^gb-/,             // Grammar Beginner (gb-flash, gb-translation…)
      /^instruction-/,   // instruction-area, instruction-hebrew
      /^english-/,       // english-sentence-display
      /^reset-/,         // reset-mastery-btn
      /^wu-/,            // our namespaced overhaul animation classes
    ],
  },

  // Don't strip keyframe animations referenced in CSS
  keyframes: true,

  // Keep CSS variables
  variables: true,
};
