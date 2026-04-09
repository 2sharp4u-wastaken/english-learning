// File System Writer — saves custom words into the repo's source JS files
// Uses the File System Access API (Chrome/Edge desktop only).
// Persists the chosen directory handle in IndexedDB so the user only picks once.
// Exposes window.fileSystemWriter

(function () {
    const DB_NAME  = 'englishLearningFS';
    const DB_STORE = 'handles';
    const HANDLE_KEY = 'categoriesDir';

    // ── IndexedDB helpers ─────────────────────────────────────────────────

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
            req.onsuccess  = e => resolve(e.target.result);
            req.onerror    = e => reject(e.target.error);
        });
    }

    async function persistHandle(handle) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
            tx.oncomplete = resolve;
            tx.onerror    = e => reject(e.target.error);
        });
    }

    async function loadPersistedHandle() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
            req.onsuccess = e => resolve(e.target.result || null);
            req.onerror   = e => reject(e.target.error);
        });
    }

    // ── Directory handle (with persistence + permission re-check) ─────────

    async function getDirectoryHandle(forceNew = false) {
        if (!forceNew) {
            try {
                const saved = await loadPersistedHandle();
                if (saved) {
                    const status = await saved.queryPermission({ mode: 'readwrite' });
                    if (status === 'granted') return saved;
                    const requested = await saved.requestPermission({ mode: 'readwrite' });
                    if (requested === 'granted') return saved;
                }
            } catch (e) {
                // Stale handle — fall through to pick a fresh one
            }
        }

        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await persistHandle(handle);
        return handle;
    }

    // ── JS source file injection ──────────────────────────────────────────

    function buildEntry(w) {
        const esc = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        return `    { word: "${esc(cap(w.word))}", translation: "${esc(w.translation)}", category: "${esc(w.category)}", image: "${esc(w.image || '📝')}" }`;
    }

    function injectIntoContent(content, words) {
        const entries = words.map(buildEntry);

        // Empty array ( [] ) — replace with multi-line array
        if (/\[\s*\]/.test(content)) {
            return content.replace(/\[\s*\]/, `[\n${entries.join(',\n')}\n]`);
        }

        // Normal case — insert after the last closing brace of the last item
        const lastBrace = content.lastIndexOf('}');
        if (lastBrace === -1) return content; // malformed file, bail

        return (
            content.slice(0, lastBrace + 1) +
            ',\n' +
            entries.join(',\n') +
            content.slice(lastBrace + 1)
        );
    }

    async function writeCategory(dirHandle, category, words) {
        const filename = `${category}.js`;
        let fileHandle;
        let content;

        try {
            fileHandle = await dirHandle.getFileHandle(filename, { create: false });
            content    = await (await fileHandle.getFile()).text();
        } catch (e) {
            if (category === 'custom') {
                // Bootstrap custom.js if it somehow doesn't exist yet
                content    = `// Custom parent-added words (managed via Settings → Import Words → Save to Source Files)\nexport const customWords = [\n];\n`;
                fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            } else {
                throw new Error(`הקובץ ${filename} לא נמצא בתיקייה שנבחרה`);
            }
        }

        const writable = await fileHandle.createWritable();
        await writable.write(injectIntoContent(content, words));
        await writable.close();
    }

    // ── Public API ────────────────────────────────────────────────────────

    async function saveToSourceFiles(words, onProgress) {
        if (!('showDirectoryPicker' in window)) {
            onProgress({ status: 'error', message: 'דפדפן זה אינו תומך בכתיבה לקבצים — השתמש ב-Chrome או Edge.' });
            return;
        }

        // Group by category
        const byCategory = {};
        for (const w of words) {
            (byCategory[w.category] = byCategory[w.category] || []).push(w);
        }

        onProgress({ status: 'picking' });

        let dirHandle;
        try {
            dirHandle = await getDirectoryHandle();
        } catch (e) {
            if (e.name === 'AbortError') {
                onProgress({ status: 'cancelled' });
                return;
            }
            onProgress({ status: 'error', message: `שגיאה בפתיחת התיקייה: ${e.message}` });
            return;
        }

        onProgress({ status: 'writing' });

        const failed = [];
        let saved = 0;

        for (const [category, catWords] of Object.entries(byCategory)) {
            try {
                await writeCategory(dirHandle, category, catWords);
                saved += catWords.length;
                onProgress({
                    status: 'log',
                    type: 'success',
                    text: `✅  data/categories/${category}.js  ←  ${catWords.map(w => w.word).join(', ')}`
                });
            } catch (e) {
                failed.push(category);
                console.error(`[fileSystemWriter] ${category}:`, e);
                onProgress({
                    status: 'log',
                    type: 'error',
                    text: `❌  data/categories/${category}.js  —  ${e.message}`
                });
            }
        }

        if (saved > 0) {
            // Remove successfully saved words from localStorage — they now live in source files
            const savedSet = new Set(
                words
                    .filter(w => !failed.includes(w.category))
                    .map(w => w.word.toLowerCase())
            );
            const remaining = (window.wordImporter?.getCustomWords() || [])
                .filter(w => !savedSet.has(w.word.toLowerCase()));
            localStorage.setItem('customWords_global', JSON.stringify(remaining));
        }

        const allOk = failed.length === 0;
        onProgress({
            status:  allOk ? 'success' : 'partial',
            saved,
            failed,
            message: allOk
                ? `${saved} מילים נשמרו בקבצי המקור`
                : `${saved} מילים נשמרו — נכשלו: ${failed.join(', ')}`
        });
    }

    window.fileSystemWriter = { saveToSourceFiles };
})();
