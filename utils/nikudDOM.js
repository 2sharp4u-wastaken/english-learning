/**
 * utils/nikudDOM.js — Runtime Hebrew nikud enrichment for the whole DOM.
 *
 * Automatically applies vowel points (nikud) to any Hebrew text that appears
 * in the DOM, including static labels, button text, counter strings, hint
 * elements, and dynamically rendered game content.
 *
 * Strategy:
 *  1. Fetch (or reuse) nikud-map.json.
 *  2. Walk all text nodes; replace each Hebrew word run with its nikud version.
 *  3. Store the enriched string in data-hebrew-source (or update data-hebrew-hint)
 *     so the nikud-changed listener can toggle without a re-scan.
 *  4. MutationObserver watches both element AND text-node additions (so
 *     `element.textContent = "שאלה 1 מתוך 10"` is caught automatically).
 *  5. requestAnimationFrame batching — enrichment runs before the next paint,
 *     eliminating the flash of un-enriched text.
 *
 * Safe to import from any page — no dependency on _loader.js or gameLogic.js.
 */

const NIKUD_RE    = /[\u05B0-\u05C7]/g;
const HEBREW_CHAR = /[\u05D0-\u05EA]/;
const HEBREW_WORD = /[\u05D0-\u05EA]+/g;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'INPUT', 'TEXTAREA', 'CODE', 'PRE']);

// Subtrees marked `data-react-nikud-owned` are managed by React (see
// src/bridge/nikud.ts + GameHostPage). nikudDOM must NOT walk or mutate them:
// structurally editing React-owned nodes here crashed the game subtree on a
// mid-game nikud toggle (FU-4.4-nikud). React renders nikud directly there.
const REACT_NIKUD_OWNED = '[data-react-nikud-owned]';

function isReactNikudOwned(el) {
    return !!(el && el.closest && el.closest(REACT_NIKUD_OWNED));
}

// Subtrees marked `data-nikud-skip` hold user-entered text that must keep its
// EXACT spelling — player names (M2). The nikud map is word-keyed and drops
// matres lectionis (עידן→עדן, זוהר→זהר), which silently rewrites a name the
// parent chose. Names are never vocalized; mark just the name node so
// surrounding chrome ("שלום") still gets nikud.
const NIKUD_SKIP = '[data-nikud-skip]';

function isNikudSkipped(el) {
    return !!(el && el.closest && el.closest(NIKUD_SKIP));
}

// ---------------------------------------------------------------------------
// Local helpers — self-contained for pages that don't load _loader.js
// ---------------------------------------------------------------------------

function stripNikud(s) { return s.replace(NIKUD_RE, ''); }

function localGetHebrew(text) {
    if (!text) return '';
    return window._showNikud === false ? stripNikud(text) : text;
}

if (!window.getHebrew) window.getHebrew = localGetHebrew;

// ---------------------------------------------------------------------------
// nikudMap
// ---------------------------------------------------------------------------

let nikudMap = null;

async function loadMap() {
    if (nikudMap) return nikudMap;
    if (window.nikudMap) { nikudMap = window.nikudMap; return nikudMap; }
    try {
        const resp = await fetch('data/nikud-map.json');
        nikudMap = await resp.json();
    } catch (_) { nikudMap = {}; }
    window.nikudMap = nikudMap;
    return nikudMap;
}

// ---------------------------------------------------------------------------
// Enrichment helper
// ---------------------------------------------------------------------------

function enrichString(text, map) {
    const enriched = text.replace(HEBREW_WORD, w => map[w] || w);
    return enriched !== text ? enriched : null;
}

// ---------------------------------------------------------------------------
// Text-node processor
//
// Handles four cases:
//  A. parent has data-hebrew-source with nikud → already correct, skip
//  B. parent has data-hebrew-source WITHOUT nikud → lazy-enrich stored value
//  C. parent has data-hebrew-hint (hint elements) → lazy-enrich stored hint
//  D. no attribute yet, leaf parent → set data-hebrew-source on parent
//  E. no attribute yet, mixed-content parent → wrap text node in a new span
// ---------------------------------------------------------------------------

function processTextNode(node, map) {
    const raw = node.textContent;
    if (!raw || !HEBREW_CHAR.test(raw)) return;

    const parent = node.parentElement;
    if (!parent) return;
    if (SKIP_TAGS.has(parent.tagName)) return;
    if (isReactNikudOwned(parent)) return; // React owns nikud in this subtree
    if (isNikudSkipped(parent)) return; // never nikud-ize names (M2)

    // Case C — hint element (data-hebrew-hint set by game code)
    if (parent.dataset.hebrewHint !== undefined) {
        if (window._showNikud === false) return;
        const stored = parent.dataset.hebrewHint;
        if (!stored || NIKUD_RE.test(stored)) return; // already enriched
        const enriched = stored.replace(HEBREW_WORD, w => map[w] || w);
        if (enriched !== stored) {
            parent.dataset.hebrewHint = enriched;
            parent.textContent = `🇮🇱 ${enriched}`;
        }
        return;
    }

    // Cases A & B — data-hebrew-source already set (by setHebrew, template literal, etc.)
    if (parent.dataset.hebrewSource !== undefined) {
        const stored = parent.dataset.hebrewSource;
        const storedBase = stripNikud(stored);

        // If the DOM text no longer matches what was stored, the element's content was replaced
        // externally (e.g. a new game question set a different instruction). Re-enrich and update.
        if (raw !== stored && raw !== storedBase) {
            const enriched = enrichString(raw, map);
            if (enriched) {
                parent.dataset.hebrewSource = enriched;
                parent.textContent = window._showNikud !== false ? enriched : raw;
            } else {
                parent.dataset.hebrewSource = raw;
                // textContent is already raw — nothing to change
            }
            return;
        }

        if (NIKUD_RE.test(stored)) {
            // Case A — stored already enriched; restore display if textContent drifted back to plain
            // (happens when game code sets plain text that matches the stored base string)
            if (window._showNikud !== false && !NIKUD_RE.test(raw)) {
                parent.textContent = stored;
            }
            return;
        }
        // Case B — lazy enrich plain stored value
        const enriched = stored.replace(HEBREW_WORD, w => map[w] || w);
        if (enriched !== stored) {
            parent.dataset.hebrewSource = enriched;
            parent.textContent = window._showNikud !== false ? enriched : stripNikud(enriched);
        }
        return;
    }

    // Cases D & E — not yet managed; enrich the raw text
    if (NIKUD_RE.test(raw)) return; // already has nikud from another source
    const enriched = enrichString(raw, map);
    if (!enriched) return;

    // Only treat the parent as a simple leaf when this text node is its ONLY
    // child. If there are siblings — element nodes (e.g. "<span>6</span>") OR
    // other text nodes (React renders `סיפור {n} מתוך {m}` as several adjacent
    // text nodes) — overwriting parent.textContent would wipe the siblings and
    // drop interpolated numbers. In that case wrap just this node instead.
    const isLoneTextNode = parent.childNodes.length === 1;

    if (isLoneTextNode) {
        // Case D — leaf parent (button label, span, div with only text)
        parent.dataset.hebrewSource = enriched;
        parent.textContent = window._showNikud !== false ? enriched : stripNikud(enriched);
    } else {
        // Case E — mixed-content parent (sibling elements and/or text nodes).
        // Wrap just this text node in a span to preserve every sibling.
        const span = document.createElement('span');
        span.dataset.hebrewSource = enriched;
        span.textContent = window._showNikud !== false ? enriched : stripNikud(enriched);
        parent.replaceChild(span, node);
    }
}

// ---------------------------------------------------------------------------
// Tree walker
// ---------------------------------------------------------------------------

export function applyNikudToTree(root, map) {
    if (!root || !map) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (const node of nodes) processTextNode(node, map);
}

// ---------------------------------------------------------------------------
// nikud-changed handler
// ---------------------------------------------------------------------------

function onNikudChanged() {
    const map  = nikudMap || {};
    const show = window._showNikud !== false;
    const hasMap = Object.keys(map).length > 0;

    // Update all data-hebrew-source elements; lazy-enrich if source is plain
    document.querySelectorAll('[data-hebrew-source]').forEach(el => {
        if (isReactNikudOwned(el)) return;
        if (isNikudSkipped(el)) return;
        let src = el.dataset.hebrewSource;
        if (show && hasMap && !NIKUD_RE.test(src)) {
            const enriched = src.replace(HEBREW_WORD, w => map[w] || w);
            if (enriched !== src) { el.dataset.hebrewSource = src = enriched; }
        }
        el.textContent = show ? src : stripNikud(src);
    });

    // Update all data-hebrew-hint elements; lazy-enrich if hint is plain
    document.querySelectorAll('[data-hebrew-hint]').forEach(el => {
        if (isReactNikudOwned(el)) return;
        if (isNikudSkipped(el)) return;
        let src = el.dataset.hebrewHint;
        if (show && hasMap && !NIKUD_RE.test(src)) {
            const enriched = src.replace(HEBREW_WORD, w => map[w] || w);
            if (enriched !== src) { el.dataset.hebrewHint = src = enriched; }
        }
        el.textContent = `🇮🇱 ${show ? src : stripNikud(src)}`;
    });

    // Re-scan for any elements added while nikud was off (or not yet scanned)
    if (show && hasMap) applyNikudToTree(document.body, map);
}

// ---------------------------------------------------------------------------
// MutationObserver — rAF-batched
//
// Watches both element additions (innerHTML = ...) and text-node additions
// (element.textContent = "שאלה 1 מתוך 10") so all dynamic Hebrew is caught.
// requestAnimationFrame means enrichment runs before the browser paints →
// zero visible flash of un-enriched text.
// ---------------------------------------------------------------------------

let rafId = null;
const pendingRoots = new Set();

function scheduleProcess(root) {
    pendingRoots.add(root);
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        const map = nikudMap;
        if (!map) return;
        for (const r of pendingRoots) applyNikudToTree(r, map);
        pendingRoots.clear();
    });
}

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------

export async function initNikudDOM() {
    const map = await loadMap();

    // Initial full-page scan
    applyNikudToTree(document.body, map);

    // Watch for new content (element additions AND text-node replacements)
    new MutationObserver(mutations => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    scheduleProcess(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    const p = node.parentElement;
                    if (p && !SKIP_TAGS.has(p.tagName)) scheduleProcess(p);
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('nikud-changed', onNikudChanged);
}
