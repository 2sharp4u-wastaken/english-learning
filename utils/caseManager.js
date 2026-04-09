/**
 * Global Letter Case Manager
 * Controls whether English text in games displays as UPPERCASE (default) or lowercase.
 * Persists across sessions via localStorage.
 */

const STORAGE_KEY = 'globalLetterCase';
const DEFAULT = 'uppercase';

export function getMode() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT;
}

export function isUppercase() {
    return getMode() === 'uppercase';
}

export function isLowercase() {
    return getMode() === 'lowercase';
}

/** Apply the stored mode to <body> class and update toggle button visual. */
export function applyToBody() {
    const lower = isLowercase();
    document.body.classList.toggle('lowercase-mode', lower);

    // Update the header toggle button visual state (if present)
    const btn = document.getElementById('global-case-toggle');
    if (btn) {
        btn.classList.toggle('lowercase-mode', lower);
    }
}

/** Toggle between uppercase and lowercase, persist, and dispatch event. */
export function toggle() {
    const newMode = isUppercase() ? 'lowercase' : 'uppercase';
    localStorage.setItem(STORAGE_KEY, newMode);
    applyToBody();
    window.dispatchEvent(new CustomEvent('caseModeChanged', { detail: { mode: newMode } }));
    return newMode;
}

/** Call once on page load to restore persisted mode. */
export function init() {
    applyToBody();
}
