/**
 * Nikud (Hebrew diacritics) utilities.
 *
 * Sets window._showNikud at module-load time from persisted settings.
 * Exposes window.getHebrew + window.setHebrew so non-module game scripts
 * can call them without an explicit import.
 */

const NIKUD_RE = /[\u05B0-\u05C7]/g;

// ── Initialise _showNikud synchronously (no await) ──────────────────────────
try {
    const s = JSON.parse(localStorage.getItem('englishLearningSettings') || '{}');
    window._showNikud = s.showNikud !== false; // default true
} catch (_) {
    window._showNikud = true;
}

// ── Core render helpers ──────────────────────────────────────────────────────

export function stripNikud(text) {
    return text ? text.replace(NIKUD_RE, '') : '';
}

/** Return text with or without nikud based on current user preference. */
export function getHebrew(text) {
    if (!text) return '';
    return window._showNikud === false ? text.replace(NIKUD_RE, '') : text;
}

/**
 * Set a Hebrew text element, storing the source (nikud version) as a
 * data attribute so nikud-changed events can re-render it in-place.
 */
export function setHebrew(el, text) {
    if (!el) return;
    el.dataset.hebrewSource = text || '';
    el.textContent = getHebrew(text);
}

// Make helpers globally available for non-module game scripts
window.getHebrew = getHebrew;
window.setHebrew = setHebrew;

// ── Nikud persistence helpers ────────────────────────────────────────────────

/** Load data/nikud-map.json; returns {} on failure. */
export async function loadNikudMap() {
    try {
        const r = await fetch('/data/nikud-map.json');
        if (!r.ok) throw new Error(r.status);
        return await r.json();
    } catch (e) {
        console.warn('[nikud] Could not load nikud-map.json:', e.message);
        return {};
    }
}

/**
 * Fetch nikud from the Nakdan API for an array of plain Hebrew translations.
 * Returns { translation: nikudVersion, ... } for each successful result.
 */
export async function fetchNikudFromAPI(translations) {
    if (!translations.length) return {};
    try {
        // Proxy via local server to avoid browser CORS restrictions on the external Nakdan API
        const r = await fetch('/api/enrich-nikud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: 'nakdan', genre: 'modern', data: translations.join('\n') })
        });
        if (!r.ok) throw new Error(r.status);
        const tokens = await r.json();

        // Rebuild per-translation groups by splitting on '\n' separator tokens
        const groups = [];
        let current = [];
        for (const tok of tokens) {
            if (tok.sep && tok.word === '\n') { groups.push(current); current = []; }
            else current.push(tok);
        }
        if (current.length) groups.push(current);

        const result = {};
        for (let i = 0; i < translations.length && i < groups.length; i++) {
            const nikud = groups[i]
                .map(tok => (!tok.sep && tok.options?.length)
                    ? tok.options[0].replace(/\|/g, '')
                    : (tok.word || ''))
                .join('').trim();
            if (nikud) result[translations[i]] = nikud;
        }
        return result;
    } catch (e) {
        console.warn('[nikud] API fetch failed:', e.message);
        return {};
    }
}

/** Merge newEntries into existingMap and write to data/nikud-map.json via server. */
export async function persistNikudEntries(existingMap, newEntries) {
    const updated = { ...existingMap, ...newEntries };
    try {
        await fetch('/api/write-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: 'data/nikud-map.json',
                content: JSON.stringify(updated, null, 2)
            })
        });
    } catch (e) {
        console.warn('[nikud] Could not persist nikud map:', e.message);
    }
    return updated;
}

/**
 * Set w.hebrew on every word object using nikudMap.
 * For words missing from the map, fetch from Nakdan API and persist the results.
 * Returns the (possibly updated) nikudMap.
 */
export async function enrichVocabularyBank(vocabularyBank, nikudMap) {
    const missing = [];
    for (const w of vocabularyBank) {
        if (nikudMap[w.translation]) {
            w.hebrew = nikudMap[w.translation];
        } else if (NIKUD_RE.test(w.translation)) {
            // Source already has nikud — use as-is
            w.hebrew = w.translation;
        } else {
            w.hebrew = w.translation; // fallback while we fetch
            missing.push(w.translation);
        }
    }

    const uniqueMissing = [...new Set(missing)];
    if (uniqueMissing.length > 0) {
        console.log(`[nikud] Fetching nikud for ${uniqueMissing.length} new word(s)...`);
        const fetched = await fetchNikudFromAPI(uniqueMissing);
        if (Object.keys(fetched).length > 0) {
            for (const w of vocabularyBank) {
                if (fetched[w.translation]) w.hebrew = fetched[w.translation];
            }
            await persistNikudEntries(nikudMap, fetched);
            Object.assign(nikudMap, fetched);
        }
    }

    return nikudMap;
}
