# CLAUDE.md — English Learning Game

Behavioral rules for Claude Code in this project. These override defaults.

## Project Identity
- Hebrew-speaking kids, ages 5–8, learning English
- RTL interface (`dir="rtl"`, `lang="he"`)
- No build system — plain ES6 modules, runs via `python3 server.py`
- **Start the app:** `python3 server.py` (sends no-cache headers; avoids module caching bugs)

## Rules

### Never auto-commit or auto-push
Always ask before committing or pushing. Show the diff summary and wait for explicit approval.

### Read before modifying
Read every file you plan to change before touching it. Do not suggest changes to code you haven't read.

### Keep the logger lean
`utils/consoleLogger.js` must use an in-memory array only — never localStorage persistence per log call, as it causes severe UI slowdown. The committed version is the correct one.

### Cache-busting
CSS/JS files use `?t=<timestamp>` query strings for cache busting. Update the timestamp when changing a file that needs it.

## Architecture Quick Reference

### Word object schema
```js
{ word, translation, category, image, imageUrl? }
```
Category is an explicit string field — not inferred from location.

### Data tiers
- `data/_loader.js` — feeds active game instances (filtered by category)
- `data/vocabularyBank.js` — feeds settings/stats UI (full word list)
- Custom words live at `localStorage.customWords_global` and must be injected into both tiers at load time

### localStorage keys
- `currentUser` — active user ID
- `userProgress_<userId>` — progress, wordMastery, streak, certificates
- `englishLearningSettings` — app settings
- `authUsers` — all user accounts (sanitized: no plaintext passwords in logs)
- `customWords_global` — parent-added custom words (shared across all users)

### Managers (all in `managers/`)
ScoreManager, ProgressManager, GameRegistry, CourseManager, CertificateManager, CoinManager
All are initialized after user auth in `app.js → AppManager.setupWithAuth()`.

### Game types
`vocabulary`, `grammar`, `grammar-beginner`, `pronunciation`, `listening`, `reading`, `practice`, `abc`, `memory`, `scramble`, `fill-blanks`

### Pages
- `index.html` — main game shell (user hub, game area, welcome screen)
- `settings.html` — parent-protected settings (password-gated sections use `data-protected="true"`)
- `stats.html` — statistics view
- `words.html` — word browser
