// Word Importer — calls Claude API to translate and categorize custom words
// Stores results in localStorage.customWords_global
// Attaches to window.wordImporter for use by settings.js

(function () {
    const STORAGE_KEY = 'customWords_global';
    const API_URL = 'https://api.anthropic.com/v1/messages';
    const MODEL = 'claude-haiku-4-5-20251001';

    const VALID_CATEGORIES = [
        'animals', 'colors', 'numbers', 'food', 'body', 'family',
        'clothes', 'home', 'actions', 'nature', 'school', 'minecraft',
        'gaming', 'roblox', 'feelings', 'adjectives', 'places',
        'time', 'weather', 'sports', 'custom'
    ];

    function getCustomWords() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveCustomWords(words) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    }

    function deleteCustomWord(word) {
        const words = getCustomWords().filter(
            w => w.word.toLowerCase() !== word.toLowerCase()
        );
        saveCustomWords(words);
    }

    function clearCustomWords() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function parseWords(text) {
        return text
            .split(',')
            .map(w => w.trim())
            .filter(w => w.length > 0 && /^[a-zA-Z\s'-]+$/.test(w))
            .map(w => w.toLowerCase());
    }

    function buildPrompt(words) {
        return `You are a vocabulary assistant for an English learning app for Hebrew-speaking children ages 5–8.

For each English word provided, return a JSON array. Each item must have:
- "word": the English word (lowercase, trimmed)
- "translation": the Hebrew translation appropriate for children ages 5–8
- "category": choose the BEST match from this list: ${VALID_CATEGORIES.join(', ')}
- "image": a single emoji that best represents the word

Return ONLY a valid JSON array — no explanation, no markdown, no code block. Just raw JSON.

Example: [{"word":"cat","translation":"חתול","category":"animals","image":"🐱"}]

Words to process: ${words.join(', ')}`;
    }

    async function callClaudeAPI(prompt, apiKey) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 2048,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            let detail = '';
            try { detail = JSON.parse(errText).error?.message || ''; } catch (e) { /* ignore */ }
            console.error('Anthropic API error', response.status, errText);
            if (response.status === 401) throw new Error(`מפתח API שגוי (401)${detail ? ': ' + detail : ''}`);
            if (response.status === 400 && detail.includes('credit')) throw new Error('אין מספיק קרדיטים — הוסף תשלום ב-platform.claude.com/settings/billing');
            if (response.status === 429) throw new Error(`חריגה ממגבלת השימוש (429)${detail ? ': ' + detail : ''}`);
            throw new Error(`שגיאת שרת (${response.status})${detail ? ': ' + detail : ''}`);
        }

        const data = await response.json();
        return data.content[0].text.trim();
    }

    function parseAPIResponse(text) {
        // Strip markdown code blocks if present
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(stripped);

        if (!Array.isArray(parsed)) throw new Error('התגובה אינה מערך JSON');

        return parsed
            .filter(item => item && typeof item.word === 'string' && item.word.trim())
            .map(item => ({
                word: item.word.toLowerCase().trim(),
                translation: String(item.translation || '').trim(),
                category: VALID_CATEGORIES.includes(item.category) ? item.category : 'custom',
                image: String(item.image || '📝').trim()
            }));
    }

    function ts() {
        return new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    async function importWords(wordsText, apiKey, onProgress) {
        // Helper: emit a console log line
        const log = (type, text) => onProgress({ status: 'log', type, text, time: ts() });

        if (!apiKey || !apiKey.trim()) {
            onProgress({ status: 'error', message: 'חסר מפתח API — הכנס מפתח Claude API בהגדרות' });
            return;
        }

        // ── Step 1: parse input ───────────────────────────────────────────
        log('info', `📝 קלט גולמי: "${wordsText.trim()}"`);
        const words = parseWords(wordsText);
        if (words.length === 0) {
            onProgress({ status: 'error', message: 'לא נמצאו מילים תקינות — הכנס מילים באנגלית מופרדות בפסיק' });
            return;
        }
        log('info', `🔤 מילים שזוהו (${words.length}): ${words.join(', ')}`);

        // ── Step 2: deduplicate ───────────────────────────────────────────
        log('info', '🔍 בודק כפילויות מול מאגר המילים הקיים...');
        const existing = getCustomWords();
        const existingSet = new Set(existing.map(w => w.word.toLowerCase()));
        const builtinSet = new Set((window.vocabularyBank || []).map(w => w.word.toLowerCase()));

        const skippedCustom  = words.filter(w => existingSet.has(w));
        const skippedBuiltin = words.filter(w => !existingSet.has(w) && builtinSet.has(w));
        const newWords       = words.filter(w => !existingSet.has(w) && !builtinSet.has(w));

        skippedCustom.forEach(w  => log('skip', `⏭️  "${w}" — כבר קיים במילים המותאמות`));
        skippedBuiltin.forEach(w => log('skip', `⏭️  "${w}" — כבר קיים במאגר הראשי`));

        const skipped = skippedCustom.length + skippedBuiltin.length;

        if (newWords.length === 0) {
            log('warn', `⚠️  כל ${words.length} המילים כבר קיימות — אין מה לייבא`);
            onProgress({ status: 'error', message: `כל ${words.length} המילים כבר קיימות במאגר — אין מה לייבא` });
            return;
        }
        log('info', `✳️  מילים חדשות לייבוא (${newWords.length}): ${newWords.join(', ')}`);

        // ── Step 3: build prompt ──────────────────────────────────────────
        onProgress({ status: 'processing', message: `מייבא ${newWords.length} מילים...` });
        const prompt = buildPrompt(newWords);
        log('api',  `🤖 מודל: ${MODEL}`);
        log('api',  `📡 שולח בקשה ל: ${API_URL}`);
        log('prompt', prompt);

        // ── Step 4: call API ──────────────────────────────────────────────
        log('info', '⏳ ממתין לתגובה מ-Claude...');

        try {
            const responseText = await callClaudeAPI(prompt, apiKey.trim());

            // ── Step 5: raw response ──────────────────────────────────────
            log('response', responseText);

            // ── Step 6: parse results ─────────────────────────────────────
            log('info', '📊 מפענח תגובה...');
            const imported = parseAPIResponse(responseText);
            imported.forEach(w =>
                log('success', `✅  ${w.word}  →  ${w.translation}  |  קטגוריה: ${w.category}  |  ${w.image}`)
            );

            // ── Step 7: save ──────────────────────────────────────────────
            const merged = [...existing];
            const mergedSet = new Set(existing.map(w => w.word.toLowerCase()));
            let addedCount = 0;
            for (const item of imported) {
                if (!mergedSet.has(item.word)) {
                    merged.push(item);
                    mergedSet.add(item.word);
                    addedCount++;
                }
            }
            saveCustomWords(merged);
            log('success', `💾 נשמר ב-localStorage (customWords_global) — סה"כ ${merged.length} מילים מותאמות`);
            log('success', `🎉 סיום: ${addedCount} מילים יובאו בהצלחה${skipped > 0 ? `, ${skipped} נדלגו` : ''}`);

            onProgress({
                status: 'success',
                words: imported,
                added: addedCount,
                skipped,
                message: `יובאו ${addedCount} מילים בהצלחה${skipped > 0 ? ` (${skipped} כבר קיימות)` : ''}`
            });

        } catch (err) {
            const msg = err instanceof SyntaxError
                ? 'לא ניתן לפענח את התגובה מה-API — נסה שוב'
                : (err.message || 'שגיאה לא ידועה');
            log('error', `❌ שגיאה: ${msg}`);
            onProgress({ status: 'error', message: msg });
        }
    }

    window.wordImporter = {
        importWords,
        getCustomWords,
        deleteCustomWord,
        clearCustomWords,
        parseWords
    };
})();
