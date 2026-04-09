// Word Image Manager — lets parents assign images to vocabulary words
// Storage: localStorage('wordImageOverrides') → { "category:Word": imageUrl }
// imageUrl can be a remote URL or a data: URI (file upload → base64)
// "Save to Source Files" writes the image to img/icons/<category>/ and
// updates the relevant data/categories/<category>.js file.

const STORAGE_KEY = 'wordImageOverrides';
const TRANS_STORAGE_KEY = 'wordTranslationOverrides';
    let _overrides = {};
    let _transOverrides = {};

    // ── Storage helpers ──────────────────────────────────────

    function _load() {
        try { _overrides = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch (e) { _overrides = {}; }
        window.wordImageOverrides = _overrides;
    }

    function _save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_overrides));
        window.wordImageOverrides = { ..._overrides };
    }

    function setOverride(category, word, imageUrl) {
        _overrides[`${category}:${word}`] = imageUrl;
        _save();
    }

    function removeOverride(category, word) {
        delete _overrides[`${category}:${word}`];
        _save();
    }

    function getOverrides() { return { ..._overrides }; }

    function _loadTrans() {
        try { _transOverrides = JSON.parse(localStorage.getItem(TRANS_STORAGE_KEY) || '{}'); }
        catch (e) { _transOverrides = {}; }
    }

    function _saveTrans() {
        localStorage.setItem(TRANS_STORAGE_KEY, JSON.stringify(_transOverrides));
    }

    function setTransOverride(category, word, translation) {
        _transOverrides[`${category}:${word}`] = translation;
        _saveTrans();
    }

    function removeTransOverride(category, word) {
        delete _transOverrides[`${category}:${word}`];
        _saveTrans();
    }

    function getTransOverrides() { return { ..._transOverrides }; }

    // ── UI state ─────────────────────────────────────────────

    let _allWords = [];
    let _filterCategory = '';
    let _filterSearch = '';
    let _container = null;

    function init(container) {
        _container = container;
        _load();
        _loadTrans();
        _allWords = (window.vocabularyBank || []).filter(w => w.word && w.category);
        // Apply stored translation overrides into the in-memory word objects
        _allWords.forEach(w => {
            const t = _transOverrides[`${w.category}:${w.word}`];
            if (t) w.translation = t;
        });
        _render();
    }

    // ── Main render ──────────────────────────────────────────

    function _render() {
        if (!_container) return;
        const categories = [...new Set(_allWords.map(w => w.category))].sort();
        const overrideCount = Object.keys(_overrides).length + Object.keys(_transOverrides).length;

        _container.innerHTML = `
            <div class="wim-toolbar">
                <div class="wim-filters-row">
                    <select id="wim-cat-filter" class="wim-select">
                        <option value="">כל הקטגוריות (${_allWords.length})</option>
                        ${categories.map(c => {
                            const n = _allWords.filter(w => w.category === c).length;
                            return `<option value="${_esc(c)}" ${_filterCategory === c ? 'selected' : ''}>${_esc(c)} (${n})</option>`;
                        }).join('')}
                    </select>
                    <input type="text" id="wim-search" class="wim-search-input"
                           placeholder="חפש מילה..."
                           value="${_esc(_filterSearch)}"
                           dir="ltr">
                </div>
                <div class="wim-toolbar-right">
                    <span class="wim-override-count" id="wim-override-count">
                        ${overrideCount > 0
                            ? `<span class="category-count">${overrideCount}</span>&nbsp;תמונות מותאמות`
                            : 'אין תמונות מותאמות'}
                    </span>
                    <button id="wim-save-source" class="btn btn-primary" ${overrideCount === 0 ? 'disabled' : ''}>
                        <i class="fas fa-save"></i> שמור לקבצי המקור
                    </button>
                    <button id="wim-clear-all" class="btn btn-danger" ${overrideCount === 0 ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i> נקה הכל
                    </button>
                </div>
            </div>
            <div id="wim-grid" class="wim-grid"></div>

            <!-- Console panel (shown during / after "שמור לקבצי המקור") -->
            <div id="wim-console" style="display:none;margin-top:20px;">
                <div id="wim-console-bar"
                     style="padding:12px 15px;border-radius:10px;font-weight:600;font-size:0.95rem;"></div>
                <div id="wim-console-toggle"
                     style="margin-top:8px;cursor:pointer;color:#667eea;font-size:0.9rem;display:none;"
                     onclick="(function(t){
                         const l=document.getElementById('wim-console-log');
                         const open=l.style.display!=='none';
                         l.style.display=open?'none':'block';
                         t.querySelector('i').className='fas fa-chevron-'+(open?'down':'up');
                         t.querySelector('span').textContent=open?'פרטים':'הסתר';
                     })(this)">
                    <i class="fas fa-chevron-up"></i>&nbsp;<span>הסתר</span>
                </div>
                <div id="wim-console-log"
                     style="display:block;margin-top:8px;padding:12px 14px;
                            background:#1a1a2e;border-radius:10px;
                            font-family:'Courier New',monospace;font-size:0.82rem;
                            max-height:320px;overflow-y:auto;
                            direction:ltr;text-align:left;
                            color:#a8b2d8;line-height:1.7;"></div>
            </div>
        `;

        document.getElementById('wim-cat-filter').addEventListener('change', e => {
            _filterCategory = e.target.value;
            _renderGrid();
        });
        document.getElementById('wim-search').addEventListener('input', e => {
            _filterSearch = e.target.value.toLowerCase();
            _renderGrid();
        });
        document.getElementById('wim-save-source').addEventListener('click', _saveToSource);
        document.getElementById('wim-clear-all').addEventListener('click', () => {
            if (!confirm('למחוק את כל התמונות והתרגומים המותאמים?')) return;
            _overrides = {};
            _transOverrides = {};
            _save();
            _saveTrans();
            // Restore in-memory translations to original vocabularyBank values
            const bank = window.vocabularyBank || [];
            _allWords.forEach(w => {
                const orig = bank.find(b => b.category === w.category && b.word === w.word);
                if (orig) w.translation = orig.translation;
            });
            _render();
        });

        _renderGrid();
    }

    // ── Grid render ──────────────────────────────────────────

    function _renderGrid() {
        const grid = document.getElementById('wim-grid');
        if (!grid) return;

        let words = _allWords;
        if (_filterCategory) words = words.filter(w => w.category === _filterCategory);
        if (_filterSearch)   words = words.filter(w =>
            w.word.toLowerCase().includes(_filterSearch) ||
            (w.translation || '').includes(_filterSearch)
        );

        if (words.length === 0) {
            grid.innerHTML = '<div class="wim-empty">לא נמצאו מילים</div>';
            return;
        }

        grid.innerHTML = words.map(w => _cardHTML(w)).join('');
        words.forEach(w => {
            const key = `${w.category}:${w.word}`;
            const card = grid.querySelector(`[data-wim-key="${_escAttr(key)}"]`);
            if (card) {
                _bindCard(card, w);
                _bindTranslationEdit(card, w);
            }
        });
    }

    function _cardHTML(w) {
        const key = `${w.category}:${w.word}`;
        const override = _overrides[key];
        const effectiveUrl = override || w.imageUrl || '';
        const isBase64  = override && override.startsWith('data:');
        const displayUrl = (effectiveUrl && !isBase64) ? effectiveUrl : '';

        return `
            <div class="wim-card ${override ? 'wim-has-override' : ''}" data-wim-key="${_escAttr(key)}">
                <div class="wim-preview">
                    ${effectiveUrl
                        ? `<img src="${_esc(effectiveUrl)}" alt="${_esc(w.word)}" class="wim-img"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                           <span class="wim-emoji-fb" style="display:none">${_esc(w.image || '?')}</span>`
                        : `<span class="wim-emoji">${_esc(w.image || '?')}</span>`
                    }
                    ${override ? '<div class="wim-badge-custom" title="תמונה מותאמת"><i class="fas fa-star"></i></div>' : ''}
                </div>
                <div class="wim-word-info">
                    <div class="wim-word-en">${_esc(w.word)}</div>
                    <div class="wim-translation-row">
                        <span class="wim-word-he${_transOverrides[key] ? ' wim-trans-overridden' : ''}">${_esc(w.translation || '')}</span>
                        <button class="wim-edit-trans-btn" title="ערוך תרגום"><i class="fas fa-pencil-alt"></i></button>
                    </div>
                    <div class="wim-cat-tag">${_esc(w.category)}</div>
                </div>
                <div class="wim-controls">
                    <input type="url" class="wim-url-input"
                           placeholder="הדבק URL של תמונה..."
                           value="${_esc(displayUrl)}"
                           dir="ltr">
                    <label class="wim-upload-btn" title="העלה קובץ מהמחשב">
                        <i class="fas fa-folder-open"></i> העלה קובץ
                        <input type="file" class="wim-file-input" accept="image/*" style="display:none">
                    </label>
                    <div class="wim-card-actions">
                        <button class="wim-btn wim-btn-save"><i class="fas fa-check"></i> שמור</button>
                        <button class="wim-btn wim-btn-reset ${!override ? 'wim-btn-dimmed' : ''}">
                            <i class="fas fa-undo"></i> אפס
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Card event binding ────────────────────────────────────

    function _bindCard(card, w) {
        const urlInput  = card.querySelector('.wim-url-input');
        const fileInput = card.querySelector('.wim-file-input');
        const preview   = card.querySelector('.wim-preview');
        const saveBtn   = card.querySelector('.wim-btn-save');
        const resetBtn  = card.querySelector('.wim-btn-reset');

        // Live URL preview with load feedback
        urlInput.addEventListener('input', () => {
            delete urlInput.dataset.base64;
            delete urlInput.dataset.loadOk;
            urlInput.placeholder = 'הדבק URL של תמונה...';
            const url = urlInput.value.trim();
            if (url) {
                _previewWithFeedback(preview, urlInput, url, w);
            } else {
                _updatePreview(preview, null, w);
                _setUrlStatus(urlInput, '');
            }
        });

        // If a URL is already in the input on render, validate it silently
        if (urlInput.value) {
            _previewWithFeedback(preview, urlInput, urlInput.value, w);
        }

        // File upload → base64
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                urlInput.value = '';
                urlInput.dataset.base64 = ev.target.result;
                urlInput.placeholder = `קובץ: ${file.name}`;
                _updatePreview(preview, ev.target.result, w);
            };
            reader.readAsDataURL(file);
        });

        // Save
        saveBtn.addEventListener('click', () => {
            const url = urlInput.dataset.base64 || urlInput.value.trim();
            if (!url) { urlInput.focus(); return; }

            // Warn if the URL hasn't confirmed as loaded yet
            if (!urlInput.dataset.base64 && urlInput.dataset.loadOk !== 'true') {
                if (urlInput.dataset.loadOk === 'false') {
                    if (!confirm('התמונה לא נטענה בהצלחה. לשמור בכל זאת?')) return;
                }
                // loadOk undefined = still loading or not yet triggered; save anyway
            }

            setOverride(w.category, w.word, url);
            card.classList.add('wim-has-override');
            resetBtn.classList.remove('wim-btn-dimmed');
            _flashCard(card, 'success');
            _setUrlStatus(urlInput, 'saved');
            _updateToolbarCount();
        });

        // Reset
        resetBtn.addEventListener('click', () => {
            removeOverride(w.category, w.word);
            delete urlInput.dataset.base64;
            urlInput.value = (w.imageUrl && !w.imageUrl.startsWith('data:')) ? w.imageUrl : '';
            urlInput.placeholder = 'הדבק URL של תמונה...';
            _updatePreview(preview, w.imageUrl || null, w);
            card.classList.remove('wim-has-override');
            resetBtn.classList.add('wim-btn-dimmed');
            _flashCard(card, 'reset');
            _updateToolbarCount();
        });
    }

    // ── Translation edit ──────────────────────────────────────

    function _bindTranslationEdit(card, w) {
        const transRow = card.querySelector('.wim-translation-row');
        if (!transRow) return;

        function showView() {
            const hasOverride = !!_transOverrides[`${w.category}:${w.word}`];
            transRow.innerHTML = `
                <span class="wim-word-he${hasOverride ? ' wim-trans-overridden' : ''}">${_esc(w.translation || '')}</span>
                <button class="wim-edit-trans-btn" title="ערוך תרגום"><i class="fas fa-pencil-alt"></i></button>
            `;
            transRow.querySelector('.wim-edit-trans-btn').addEventListener('click', showEdit);
        }

        function showEdit() {
            transRow.innerHTML = `
                <input type="text" class="wim-trans-input" value="${_escAttr(w.translation || '')}" dir="rtl">
                <button class="wim-save-trans-btn wim-btn" title="שמור"><i class="fas fa-check"></i></button>
                <button class="wim-cancel-trans-btn wim-btn" title="בטל"><i class="fas fa-times"></i></button>
            `;
            const input = transRow.querySelector('.wim-trans-input');
            input.focus();
            input.select();

            transRow.querySelector('.wim-save-trans-btn').addEventListener('click', () => {
                const newTrans = input.value.trim();
                if (!newTrans) return;
                w.translation = newTrans;
                const idx = _allWords.findIndex(x => x.category === w.category && x.word === w.word);
                if (idx !== -1) _allWords[idx].translation = newTrans;
                setTransOverride(w.category, w.word, newTrans);
                _flashCard(card, 'success');
                _updateToolbarCount();
                showView();
            });

            transRow.querySelector('.wim-cancel-trans-btn').addEventListener('click', showView);

            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') transRow.querySelector('.wim-save-trans-btn').click();
                if (e.key === 'Escape') showView();
            });
        }

        transRow.querySelector('.wim-edit-trans-btn').addEventListener('click', showEdit);
    }

    // Show URL load status on the input field border + a small icon next to it
    function _setUrlStatus(input, status) {
        // status: '' | 'loading' | 'ok' | 'error' | 'saved'
        const colors = { '': '#e2e8f0', loading: '#a3b1f8', ok: '#48bb78', error: '#f56565', saved: '#48bb78' };
        input.style.borderColor = colors[status] || '#e2e8f0';

        let badge = input.parentElement.querySelector('.wim-url-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'wim-url-badge';
            badge.style.cssText = 'position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:0.85rem;pointer-events:none;';
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(badge);
        }
        const icons = { '': '', loading: '<i class="fas fa-spinner fa-spin" style="color:#667eea"></i>', ok: '<i class="fas fa-check-circle" style="color:#48bb78"></i>', error: '<i class="fas fa-times-circle" style="color:#f56565"></i>', saved: '<i class="fas fa-check-circle" style="color:#48bb78"></i>' };
        badge.innerHTML = icons[status] || '';
    }

    // Load image from URL, update preview, and mark the input field green/red
    function _previewWithFeedback(previewEl, urlInput, url, word) {
        _setUrlStatus(urlInput, 'loading');
        const testImg = new Image();
        testImg.onload = () => {
            urlInput.dataset.loadOk = 'true';
            _setUrlStatus(urlInput, 'ok');
            _updatePreview(previewEl, url, word);
        };
        testImg.onerror = () => {
            urlInput.dataset.loadOk = 'false';
            _setUrlStatus(urlInput, 'error');
            // Still update the preview so the onerror handler shows the emoji fallback
            _updatePreview(previewEl, url, word);
        };
        testImg.src = url;
    }

    function _updatePreview(previewEl, url, word) {
        let imgEl = previewEl.querySelector('.wim-img');

        if (!url) {
            if (word.imageUrl) {
                if (!imgEl) {
                    previewEl.innerHTML = `<img src="${_esc(word.imageUrl)}" class="wim-img"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                        <span class="wim-emoji-fb" style="display:none">${_esc(word.image || '?')}</span>`;
                } else {
                    imgEl.src = word.imageUrl;
                    imgEl.style.display = '';
                    const fb = previewEl.querySelector('.wim-emoji-fb');
                    if (fb) fb.style.display = 'none';
                }
            } else {
                previewEl.innerHTML = `<span class="wim-emoji">${_esc(word.image || '?')}</span>`;
            }
            return;
        }

        if (imgEl) {
            imgEl.src = url;
            imgEl.style.display = '';
            const fb = previewEl.querySelector('.wim-emoji-fb');
            if (fb) fb.style.display = 'none';
        } else {
            previewEl.innerHTML = `<img src="${_esc(url)}" alt="${_esc(word.word)}" class="wim-img"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <span class="wim-emoji-fb" style="display:none">${_esc(word.image || '?')}</span>
                ${_overrides[`${word.category}:${word.word}`] ? '<div class="wim-badge-custom"><i class="fas fa-star"></i></div>' : ''}`;
        }
    }

    function _flashCard(card, type) {
        const cls = type === 'success' ? 'wim-flash-success' : 'wim-flash-reset';
        card.classList.add(cls);
        setTimeout(() => card.classList.remove(cls), 900);
    }

    function _updateToolbarCount() {
        const n = Object.keys(_overrides).length + Object.keys(_transOverrides).length;
        const el = document.getElementById('wim-override-count');
        if (el) {
            el.innerHTML = n > 0
                ? `<span class="category-count">${n}</span>&nbsp;תמונות מותאמות`
                : 'אין תמונות מותאמות';
        }
        ['wim-save-source', 'wim-clear-all'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = (n === 0);
        });
    }

    // ── Console panel ─────────────────────────────────────────

    function _initConsole() {
        const panel  = document.getElementById('wim-console');
        const bar    = document.getElementById('wim-console-bar');
        const log    = document.getElementById('wim-console-log');
        const toggle = document.getElementById('wim-console-toggle');
        if (!panel) return;

        panel.style.display = 'block';
        if (bar) {
            bar.style.cssText = 'background:rgba(102,126,234,0.1);border:2px solid #667eea;' +
                                'color:#3c4fe0;padding:12px 15px;border-radius:10px;' +
                                'font-weight:600;font-size:0.95rem;';
            bar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר תמונות לקבצי המקור...';
        }
        if (log)    { log.innerHTML = ''; log.style.display = 'block'; }
        if (toggle) toggle.style.display = 'none';
    }

    function _logLine(type, text) {
        const log = document.getElementById('wim-console-log');
        if (!log) return;

        const colors = {
            info:    '#a8b2d8',
            success: '#5af78e',
            error:   '#ff5555',
            warn:    '#ffb86c',
            api:     '#79b8ff',
            step:    '#bd93f9',
        };
        const now  = new Date();
        const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
                        .map(n => String(n).padStart(2, '0')).join(':');
        const esc  = String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        const line = document.createElement('div');
        line.style.cssText = 'padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.04);';
        line.innerHTML = `<span style="color:#6a737d;">[${time}]</span> ` +
                         `<span style="color:${colors[type] || colors.info};">${esc}</span>`;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;

        // Reveal the toggle after first log entry
        const toggle = document.getElementById('wim-console-toggle');
        if (toggle) toggle.style.display = 'block';
    }

    function _setConsoleStatus(type, message) {
        const bar = document.getElementById('wim-console-bar');
        if (!bar) return;
        const styles = {
            processing: 'background:rgba(102,126,234,0.1);border:2px solid #667eea;color:#3c4fe0;',
            success:    'background:rgba(72,187,120,0.1);border:2px solid #48bb78;color:#2f855a;',
            error:      'background:rgba(245,101,101,0.1);border:2px solid #f56565;color:#c53030;',
        };
        const icons = {
            processing: 'fa-spinner fa-spin',
            success:    'fa-check-circle',
            error:      'fa-exclamation-circle',
        };
        bar.style.cssText = (styles[type] || '') +
                            'padding:12px 15px;border-radius:10px;font-weight:600;font-size:0.95rem;';
        bar.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
    }

    // ── Save to Source (via local dev server API) ─────────────
    // server.py exposes POST /api/write-text, /api/write-image, /api/fetch-image

    async function _saveToSource() {
        const entries      = Object.entries(_overrides);
        const transEntries = Object.entries(_transOverrides);
        if (entries.length === 0 && transEntries.length === 0) { alert('אין שינויים לשמור.'); return; }

        // Disable the button while running
        const saveBtn = document.getElementById('wim-save-source');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...'; }

        _initConsole();
        const parts = [];
        if (entries.length)      parts.push(`${entries.length} תמונה/ות`);
        if (transEntries.length) parts.push(`${transEntries.length} תרגום/ים`);
        _logLine('info', `מתחיל שמירה: ${parts.join(' + ')} לקבצי המקור`);

        let savedImages = 0, savedTranslations = 0, failed = 0;
        const persisted = [];

        for (const [key, imageUrl] of entries) {
            const colonIdx = key.indexOf(':');
            const category = key.slice(0, colonIdx);
            const word     = key.slice(colonIdx + 1);
            let finalUrl   = imageUrl;

            const isBase64 = imageUrl.startsWith('data:');
            const isExtUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');

            _logLine('step', `── ${word}  (${category})`);

            // Step 1: save the image file locally
            if (isBase64 || isExtUrl) {
                try {
                    let savedPath;

                    if (isBase64) {
                        const ext     = imageUrl.startsWith('data:image/png')  ? 'png'
                                      : imageUrl.startsWith('data:image/jpeg') ? 'jpg'
                                      : imageUrl.startsWith('data:image/webp') ? 'webp'
                                      : imageUrl.startsWith('data:image/gif')  ? 'gif'
                                      : 'png';
                        const imgPath = `img/icons/${category}/${word.toLowerCase()}.${ext}`;
                        _logLine('api', `POST /api/write-image  →  ${imgPath}`);
                        const res  = await fetch('/api/write-image', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: imgPath, base64: imageUrl })
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || res.statusText);
                        savedPath = json.path;
                    } else {
                        const imgPath = `img/icons/${category}/${word.toLowerCase()}`;
                        const displayUrl = imageUrl.length > 70 ? imageUrl.slice(0, 70) + '…' : imageUrl;
                        _logLine('api', `POST /api/fetch-image  ←  ${displayUrl}`);
                        const res  = await fetch('/api/fetch-image', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: imageUrl, path: imgPath })
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || res.statusText);
                        savedPath = json.path;
                    }

                    _logLine('success', `✅ Image saved  →  ${savedPath}`);
                    finalUrl = savedPath;
                } catch (e) {
                    const hint = e.message.includes('404') || e.message.includes('fetch')
                        ? ' (restart server.py?)'
                        : '';
                    _logLine('error', `❌ Image save failed: ${e.message}${hint}`);
                    failed++;
                    continue;
                }
            }

            // Step 2: fetch the JS source, patch imageUrl, write it back
            try {
                const jsPath = `data/categories/${category}.js`;
                _logLine('api', `GET  /${jsPath}`);
                const srcRes = await fetch(`/${jsPath}?nocache=${Date.now()}`);
                if (!srcRes.ok) throw new Error(`cannot fetch ${jsPath} (${srcRes.status})`);
                const content = await srcRes.text();
                const patched = _patchImageUrlInJs(content, word, finalUrl);

                _logLine('api', `POST /api/write-text  →  ${jsPath}`);
                const writeRes = await fetch('/api/write-text', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: jsPath, content: patched })
                });
                if (!writeRes.ok) throw new Error((await writeRes.json()).error || writeRes.statusText);

                _logLine('success', `✅ ${jsPath}  updated  imageUrl: "${finalUrl}"`);
                persisted.push(key);
                savedImages++;
            } catch (e) {
                _logLine('error', `❌ JS update failed: ${e.message}`);
                failed++;
            }
        }

        // Translation overrides
        if (transEntries.length > 0) {
            const persistedTrans = [];
            for (const [key, translation] of transEntries) {
                const colonIdx = key.indexOf(':');
                const category = key.slice(0, colonIdx);
                const word     = key.slice(colonIdx + 1);
                _logLine('step', `── תרגום: ${word}  (${category}) → "${translation}"`);
                try {
                    const jsPath = `data/categories/${category}.js`;
                    _logLine('api', `GET  /${jsPath}`);
                    const srcRes = await fetch(`/${jsPath}?nocache=${Date.now()}`);
                    if (!srcRes.ok) throw new Error(`cannot fetch ${jsPath} (${srcRes.status})`);
                    const content = await srcRes.text();
                    const patched = _patchTranslationInJs(content, word, translation);
                    _logLine('api', `POST /api/write-text  →  ${jsPath}`);
                    const writeRes = await fetch('/api/write-text', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: jsPath, content: patched })
                    });
                    if (!writeRes.ok) throw new Error((await writeRes.json()).error || writeRes.statusText);
                    _logLine('success', `✅ תרגום נשמר: "${translation}"`);
                    persistedTrans.push(key);
                    savedTranslations++;
                } catch (e) {
                    _logLine('error', `❌ שגיאה בשמירת תרגום: ${e.message}`);
                    failed++;
                }
            }
            persistedTrans.forEach(key => delete _transOverrides[key]);
            _saveTrans();
        }

        const savedTotal = savedImages + savedTranslations;
        const doneParts = [];
        if (savedImages)      doneParts.push(`${savedImages} תמונות`);
        if (savedTranslations) doneParts.push(`${savedTranslations} תרגומים`);
        _logLine('info', `סיום — ${doneParts.join(' + ') || '0'} נשמרו, ${failed} נכשלו`);

        // Remove persisted overrides from localStorage
        persisted.forEach(key => delete _overrides[key]);
        _save();

        // Update card badges in-place (don't re-render — keeps console visible)
        persisted.forEach(key => {
            const card = document.querySelector(`[data-wim-key="${_escAttr(key)}"]`);
            if (card) {
                card.classList.remove('wim-has-override');
                const badge = card.querySelector('.wim-badge-custom');
                if (badge) badge.remove();
            }
        });
        _updateToolbarCount();

        // Re-enable the button
        if (saveBtn) {
            saveBtn.disabled = Object.keys(_overrides).length === 0 && Object.keys(_transOverrides).length === 0;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> שמור לקבצי המקור';
        }

        // Final status in console bar
        if (savedTotal === 0 && failed > 0) {
            _setConsoleStatus('error', 'כתיבה נכשלה — הפעל מחדש את server.py ונסה שוב.');
        } else if (failed === 0) {
            const successParts = [];
            if (savedImages)       successParts.push(`${savedImages} תמונות`);
            if (savedTranslations) successParts.push(`${savedTranslations} תרגומים`);
            _setConsoleStatus('success', `${successParts.join(' + ')} נשמרו בקבצי המקור בהצלחה!`);
        } else {
            _setConsoleStatus('error', `${savedTotal} נשמרו, ${failed} נכשלו`);
        }
    }

    // Patch imageUrl in a category JS file for a specific word
    function _patchImageUrlInJs(content, word, imageUrl) {
        // Try exact match, then capitalized
        const wordToFind = content.includes(`word: "${word}"`) ? word
                         : content.includes(`word: "${_cap(word)}"`) ? _cap(word)
                         : null;
        if (!wordToFind) return content;

        const startIdx = content.indexOf(`word: "${wordToFind}"`);
        if (startIdx === -1) return content;

        const closeIdx = content.indexOf('}', startIdx);
        if (closeIdx === -1) return content;

        const entry = content.slice(startIdx, closeIdx + 1);

        let newEntry;
        if (entry.includes('imageUrl:')) {
            // Replace existing value
            newEntry = entry.replace(/,?\s*imageUrl:\s*"[^"]*"/, `, imageUrl: "${imageUrl}"`);
        } else {
            // Insert before closing brace
            newEntry = entry.replace(/(\s*})$/, `, imageUrl: "${imageUrl}"$1`);
        }

        return content.slice(0, startIdx) + newEntry + content.slice(closeIdx + 1);
    }

    // Patch translation in a category JS file for a specific word
    function _patchTranslationInJs(content, word, translation) {
        const wordToFind = content.includes(`word: "${word}"`) ? word
                         : content.includes(`word: "${_cap(word)}"`) ? _cap(word)
                         : null;
        if (!wordToFind) return content;

        const startIdx = content.indexOf(`word: "${wordToFind}"`);
        if (startIdx === -1) return content;

        const closeIdx = content.indexOf('}', startIdx);
        if (closeIdx === -1) return content;

        const entry = content.slice(startIdx, closeIdx + 1);

        let newEntry;
        if (entry.includes('translation:')) {
            newEntry = entry.replace(/translation:\s*"[^"]*"/, `translation: "${translation}"`);
        } else {
            newEntry = entry.replace(/(\s*})$/, `, translation: "${translation}"$1`);
        }

        return content.slice(0, startIdx) + newEntry + content.slice(closeIdx + 1);
    }

    // ── Helpers ──────────────────────────────────────────────

    function _cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

    function _esc(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function _escAttr(s) {
        return _esc(s).replace(/"/g, '&quot;');
    }

// Initialize override cache on script load
_load();

window.wordImageManager = { init, getOverrides, setOverride, removeOverride, getTransOverrides, setTransOverride, removeTransOverride };

export { init, getOverrides, setOverride, removeOverride, getTransOverrides, setTransOverride, removeTransOverride };
