# ROADMAP.md — Feature Backlog & Session Plan

Approved and pending features, organized into dedicated sessions.

> **Model notes are instructions for you (Eran), not for Claude.**
> Set the model with `/model` before starting each session. Claude cannot switch models itself.

---

## Session 0 — Housekeeping (do first)
**Model: Sonnet | Priority: Immediate**

- [x] Review all uncommitted changes (app.js, settings.js, index.html, styles.css, audio-effects.js, data/vocabularyBank.js, stats.html, settings.html)
- [x] Commit in logical groups with meaningful messages
- [x] Push to remote

---

## Session 1 — Parent Custom Words (Claude API) ✅ DONE
**Model: Sonnet | Priority: High**

Parent pastes comma-separated English words into a textarea on the settings page (parent-protected section). Claude API auto-translates and categorizes each word in batch. Results are saved to `localStorage.customWords_global` and immediately available in all games.

### UI (minimal)
- Single textarea: "הוסף מילים באנגלית (מופרדות בפסיק)"
- "Import" button
- Collapsible progress log — non-intrusive, parent can click to expand
- Background processing — parent can navigate away or hand the device back to the child; status persists in localStorage and the import continues on next settings page load

### Architecture
- New file: `utils/wordImporter.js`
  - Calls Claude API with a structured prompt
  - Parses JSON response: `[{ word, translation, category, emoji }]`
  - Falls back gracefully if API unreachable (queues for retry)
- `settings.html` / `settings.js` — wire UI into parent-protected section
- `data/_loader.js` and `data/vocabularyBank.js` — inject `customWords_global` at load time
- New categories surface automatically in game category filters (no other code changes needed)
- Shared across all users (global, not per-child)

### Requirements
- Hebrew translation: required, provided by Claude API
- Category mapping: Claude API maps to existing game categories; unmapped words go to a `custom` category
- API key: stored in `englishLearningSettings.claudeApiKey` (parent enters once in settings)

---

## Session 2 — Certification & Course Flow
**Model: Sonnet | Priority: High**

Wire the already-built managers and data structures into a working progression system.

### What exists
- `managers/CertificateManager.js`, `managers/CoinManager.js`, `managers/CourseManager.js`
- `data/courses/` — course + topic data structure
- `#profile-certificates-grid` in index.html (already in DOM)
- Certificate modal HTML (already exists)

### What needs wiring
- [ ] Define topic milestone rules in `data/courses/` (game type + category + score threshold + min plays)
- [ ] `gameLogic.js` game-end hook → `CertificateManager.checkAndAward(userId, gameType, score, category)`
- [ ] Populate `#profile-certificates-grid` from `userProgress_<userId>.certificates` on hub render
- [ ] Award coins per certificate via `CoinManager`
- [ ] `CourseManager.isTopicUnlocked()` gates topic list (locked topics shown greyed out)

---

## Session 3 — UI Overhaul (Glassmorphism)
**Model: Sonnet | Priority: Medium**

CSS-only changes in `styles.css`. No JS changes. Backwards compatible.

| Element | Current | Proposed |
|---------|---------|----------|
| Cards | `rgba(255,255,255,0.95)` flat | `backdrop-filter: blur(12px); background: rgba(255,255,255,0.5)` |
| Background | Static body gradient | Animated soft mesh gradient (`@keyframes` shifting hue) |
| Buttons | Solid gradient pill | Glass pill with colored glow on hover |
| Top bar | Solid purple gradient | `rgba(30,20,60,0.7)` + `backdrop-filter: blur(16px)` |
| Game cards | White box-shadow | Glass cards with colored gradient border |

Key constraint: must remain readable for kids ages 5–8. Prioritize contrast on text and button labels.

---

## Session 4 — PWA (Offline / Installable)
**Model: Haiku | Priority: Low**

3 new files, 2 lines in index.html. Zero risk. Works immediately over `localhost`.

- [ ] `manifest.json` — app name, icons, `"display": "standalone"`
- [ ] `service-worker.js` — Cache-First strategy for all HTML/JS/CSS/audio
- [ ] Register service worker in `index.html` (2 lines)
- [ ] Add icon assets (192px, 512px PNG)

Result: app works 100% offline and can be "installed" from the browser on desktop/iOS/Android.
Electron packaging (true `.app`/`.exe`) is a later option if needed.

---

## Future / Not Yet Scoped

- **YouTube lesson integration** (Phase 6 of overhaul plan) — video clips per topic
- **Electron packaging** — wrap in a native .dmg/.exe using electron + electron-serve
- **Real image assets** — replace emoji/placeholder images with illustrated art (Phase 5)
- **Additional sentence data** — expand beyond the current 90 sentences
