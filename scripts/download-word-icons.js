#!/usr/bin/env node
/**
 * Download word icons — Flaticon (API) or Wikimedia Commons (no API key).
 *
 * OPTION A — Flaticon (needs API key, cartoon-style icons):
 *   FLATICON_API_KEY=your_key node scripts/download-word-icons.js
 *   Get key: https://api.flaticon.com or info@flaticon.com
 *
 * OPTION B — Wikimedia Commons (no API key, free):
 *   node scripts/download-word-icons.js --commons
 *   Opens each preview in Chrome (same tab); after you answer y/n/s, next image loads in that tab.
 *
 * OPTION C — No downloads: generate a manual-download guide (links to search pages):
 *   node scripts/download-word-icons.js --manual-guide
 *
 * For A and B: per-word prompt (y/n/s). y = save, n = log to icon-download-not-approved.json, s = skip.
 *   --yes-all    Use first result for all without asking.
 *   --dry-run    Only search and print; no downloads or logs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ICONS_BASE = path.join(PROJECT_ROOT, 'img', 'icons');
const LOG_FILE = path.join(PROJECT_ROOT, 'icon-download-not-approved.json');

// [ word, category, filename ] — only entries that have imageUrl in data
const ENTRIES = [
    ['Table', 'home', 'table'],
    ['Fan', 'home', 'fan'],
    ['Oven', 'home', 'oven'],
    ['Sink', 'home', 'sink'],
    ['Vase', 'home', 'vase'],
    ['Heater', 'home', 'heater'],
    ['Doorbell', 'home', 'doorbell'],
    ['Wardrobe', 'home', 'wardrobe'],
    ['Hanger', 'home', 'hanger'],
    ['Remote control', 'home', 'remote-control'],
    ['Plate', 'home', 'plate'],
    ['Kitchen', 'home', 'kitchen'],
    ['Bathroom', 'home', 'bathroom'],
    ['Living room', 'home', 'living-room'],
    ['Garden', 'home', 'garden'],
    ['Curtain', 'home', 'curtain'],
    ['Toy', 'home', 'toy'],
    ['Open', 'actions', 'open'],
    ['Give', 'actions', 'give'],
    ['Throw', 'actions', 'throw'],
    ['Paint', 'actions', 'paint'],
    ['Drive', 'actions', 'drive'],
    ['Ride', 'actions', 'ride'],
    ['Jump', 'actions', 'jump'],
    ['Eat', 'actions', 'eat'],
    ['Drink', 'actions', 'drink'],
    ['Read', 'actions', 'read'],
    ['Calculator', 'school', 'calculator'],
    ['Library', 'school', 'library'],
    ['Test', 'school', 'test'],
    ['Grade', 'school', 'grade'],
    ['Dirt', 'minecraft', 'dirt'],
    ['Grass', 'minecraft', 'grass'],
    ['Cave', 'minecraft', 'cave'],
    ['Mine', 'minecraft', 'mine'],
    ['Build', 'minecraft', 'build'],
    ['Block', 'minecraft', 'block'],
    ['Lava', 'minecraft', 'lava'],
    ['Coal', 'minecraft', 'coal'],
    ['Villager', 'minecraft', 'villager'],
    ['Blaze', 'minecraft', 'blaze'],
    ['Giant', 'gaming', 'giant'],
    ['Battle', 'gaming', 'battle'],
    ['Attack', 'gaming', 'attack'],
    ['Miner', 'gaming', 'miner'],
    ['Deck', 'gaming', 'deck'],
    ['Bomb Tower', 'gaming', 'bomb-tower'],
    ['Goblin', 'gaming', 'goblin'],
    ['Barbarian', 'gaming', 'barbarian'],
    ['Valkyrie', 'gaming', 'valkyrie'],
    ['Lumberjack', 'gaming', 'lumberjack'],
    ['Team', 'roblox', 'team'],
    ['Prize', 'roblox', 'prize'],
    ['Score', 'roblox', 'score'],
    ['Fun', 'roblox', 'fun'],
    ['Server', 'roblox', 'server'],
    ['Script', 'roblox', 'script'],
    ['VIP', 'roblox', 'vip'],
    ['Cauliflower', 'food', 'cauliflower'],
    ['Roll', 'food', 'roll'],
    ['Mother', 'family', 'mother'],
    ['Father', 'family', 'father'],
    ['Sister', 'family', 'sister'],
    ['Brother', 'family', 'brother'],
    ['Man', 'family', 'man'],
    ['Woman', 'family', 'woman'],
    ['Friend', 'family', 'friend'],
    ['Aunt', 'family', 'aunt'],
    ['Uncle', 'family', 'uncle'],
    ['Cousin', 'family', 'cousin'],
    ['Son', 'family', 'son'],
    ['Daughter', 'family', 'daughter'],
    ['Husband', 'family', 'husband'],
    ['Wife', 'family', 'wife'],
    ['Pet', 'family', 'pet'],
    ['Wrist', 'body', 'wrist'],
    ['Suit', 'clothes', 'suit'],
    ['Tie', 'clothes', 'tie'],
];

const USER_AGENT = 'EnglishLearningApp/1.0 (https://github.com/english-learning; icon download script)';

function httpsGet(url, reqHeaders = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const headers = { 'User-Agent': USER_AGENT, ...reqHeaders };
        const opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers };
        const req = https.request(opts, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.end();
    });
}

function httpsPostForm(url, formData) {
    const body = new URLSearchParams(formData).toString();
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = {
            hostname: u.hostname,
            path: u.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(opts, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function getFlaticonToken(apiKey) {
    const res = await httpsPostForm('https://api.flaticon.com/v3/app/authentication', { apikey: apiKey });
    if (res.statusCode !== 200) {
        const err = res.body.toString();
        throw new Error(`Flaticon auth failed (${res.statusCode}): ${err}`);
    }
    const data = JSON.parse(res.body.toString());
    if (!data.token) throw new Error('Flaticon response missing token');
    return data.token;
}

async function searchFlaticon(token, q, limit = 10) {
    const params = new URLSearchParams({ q, limit, styleShape: 'hand-drawn' });
    const url = `https://api.flaticon.com/v3/search/icons/priority?${params}`;
    const res = await httpsGet(url, { Authorization: `Bearer ${token}`, Accept: 'application/json' });
    if (res.statusCode !== 200) {
        const err = res.body.toString();
        throw new Error(`Flaticon search failed (${res.statusCode}): ${err}`);
    }
    const data = JSON.parse(res.body.toString());
    const list = data.data || [];
    return list;
}

function pickImageUrl(icon) {
    const img = icon.images || {};
    return img['256'] || img['128'] || img['64'] || img['512'] || null;
}

async function downloadToBuffer(url) {
    const res = await httpsGet(url, { Accept: 'image/*' });
    if (res.statusCode !== 200) throw new Error(`Download failed ${res.statusCode}: ${url}`);
    return res.body;
}

// --- Wikimedia Commons (no API key) ---
async function searchWikimedia(searchTerm, limit = 5) {
    const q = encodeURIComponent(searchTerm);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${q}&gsrlimit=${limit}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
    const res = await httpsGet(url, { Accept: 'application/json' });
    if (res.statusCode !== 200) throw new Error(`Commons API failed ${res.statusCode}`);
    const data = JSON.parse(res.body.toString());
    const pages = data.query?.pages || {};
    const urls = [];
    for (const id of Object.keys(pages)) {
        const info = pages[id].imageinfo?.[0];
        if (info?.thumburl || info?.url) urls.push(info.thumburl || info.url);
    }
    return urls;
}

// --- Manual guide (no network) ---
function writeManualGuide() {
    const outPath = path.join(PROJECT_ROOT, 'ICON_MANUAL_DOWNLOAD_GUIDE.md');
    const lines = [
        '# Manual icon download guide',
        '',
        'No API key or auto-download: use these links to find icons, then save as PNG into the paths below.',
        '',
        '**Free sources (no account):**',
        '- Wikimedia Commons: https://commons.wikimedia.org/wiki/Commons:First_steps/Quality_and_description',
        '- Search: https://commons.wikimedia.org/wiki/Special:Search',
        '',
        '**Free with account / limits:**',
        '- Flaticon: https://www.flaticon.com (free tier: limited downloads/day)',
        '- The Noun Project: https://thenounproject.com',
        '',
        '| Word | Category | Save as file | Search hint |',
        '|------|----------|--------------|-------------|'
    ];
    for (const [word, category, filename] of ENTRIES) {
        const saveAs = `img/icons/${category}/${filename}.png`;
        const searchHint = `cartoon ${word} icon`;
        const commonsSearch = `https://commons.wikimedia.org/wiki/Special:Search?search=${encodeURIComponent(searchHint)}`;
        lines.push(`| ${word} | ${category} | \`${saveAs}\` | [Commons](${commonsSearch}) |`);
    }
    lines.push('', 'After saving a file, the app will use it automatically (no code change).');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${outPath}`);
}

function loadNotApprovedLog() {
    try {
        const raw = fs.readFileSync(LOG_FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function appendNotApproved(entry) {
    const log = loadNotApprovedLog();
    log.push(entry);
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * Open URL in Chrome in the same tab; bring Chrome to front.
 * macOS: first time opens Chrome with URL, then reuses active tab via AppleScript.
 * Other platforms: open in default browser (new tab each time).
 */
function openInChromeSameTab(url, isFirst) {
    try {
        if (process.platform === 'darwin') {
            if (isFirst) {
                spawnSync('open', ['-a', 'Google Chrome', url], { stdio: 'ignore' });
            } else {
                const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const script = `tell application "Google Chrome" to set URL of active tab of front window to "${escaped}"`;
                execSync(`osascript -e ${JSON.stringify(script)}`, { stdio: 'ignore' });
                execSync('osascript -e \'tell application "Google Chrome" to activate\'', { stdio: 'ignore' });
            }
        } else {
            const cmd = process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
            execSync(cmd, { stdio: 'ignore' });
        }
    } catch (e) {
        console.warn('Could not open browser:', e.message);
    }
}

async function runCommons(yesAll, dryRun) {
    const notApproved = [];
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askOne = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
    let chromeSameTabFirst = true;

    for (const [word, category, filename] of ENTRIES) {
        const searchQ = `${word} icon`.toLowerCase();
        let urls;
        try {
            urls = await searchWikimedia(searchQ, 5);
        } catch (e) {
            console.error(`Commons search failed for "${word}": ${e.message}`);
            notApproved.push({ word, category, filename, reason: 'search_failed', error: e.message });
            await new Promise((r) => setTimeout(r, 300));
            continue;
        }

        const previewUrl = urls[0];
        if (!previewUrl) {
            console.log(`No result: ${category}/${filename} (${word})`);
            notApproved.push({ word, category, filename, reason: 'no_results', search: searchQ });
            continue;
        }

        const outPath = path.join(ICONS_BASE, category, `${filename}.png`);
        console.log(`\n--- ${word} (${category}/${filename}) ---`);
        console.log(`Search: "${searchQ}"`);
        console.log(`Preview: ${previewUrl}`);

        if (dryRun) {
            console.log('[dry-run] would save to', outPath);
            continue;
        }

        if (!yesAll) {
            openInChromeSameTab(previewUrl, chromeSameTabFirst);
            chromeSameTabFirst = false;
        }

        const choice = yesAll ? 'y' : (await askOne('Use this image? (y/n/s=skip): ')).trim().toLowerCase();
        if (choice === 's') continue;
        if (choice === 'y') {
            try {
                const dir = path.dirname(outPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const buf = await downloadToBuffer(previewUrl);
                fs.writeFileSync(outPath, buf);
                console.log(`Saved: ${outPath}`);
            } catch (e) {
                console.error(`Download failed: ${e.message}`);
                notApproved.push({ word, category, filename, reason: 'download_failed', error: e.message, previewUrl });
            }
        } else {
            appendNotApproved({ word, category, filename, search: searchQ, previewUrl });
            console.log(`Logged to ${LOG_FILE}`);
        }
        await new Promise((r) => setTimeout(r, 300));
    }

    rl.close();
    if (notApproved.length > 0) {
        const logPath = path.join(PROJECT_ROOT, 'icon-download-failures.json');
        fs.writeFileSync(logPath, JSON.stringify(notApproved, null, 2), 'utf8');
        console.log(`\nNo/failed results written to: ${logPath}`);
    }
}

async function runFlaticon(token, yesAll, dryRun) {
    const notApproved = [];
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askOne = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    for (const [word, category, filename] of ENTRIES) {
        const searchQ = `cartoon ${word}`.toLowerCase();
        let icons;
        try {
            icons = await searchFlaticon(token, searchQ, 5);
        } catch (e) {
            console.error(`Search failed for "${word}": ${e.message}`);
            notApproved.push({ word, category, filename, reason: 'search_failed', error: e.message });
            continue;
        }

        const icon = icons[0];
        if (!icon) {
            console.log(`No result: ${category}/${filename} (${word})`);
            notApproved.push({ word, category, filename, reason: 'no_results', search: searchQ });
            continue;
        }

        const previewUrl = pickImageUrl(icon);
        if (!previewUrl) {
            console.log(`No image URL: ${category}/${filename} (${word})`);
            notApproved.push({ word, category, filename, reason: 'no_image_url', id: icon.id });
            continue;
        }

        const outPath = path.join(ICONS_BASE, category, `${filename}.png`);
        const previewPage = `https://www.flaticon.com/free-icon/_${icon.id}`;

        console.log(`\n--- ${word} (${category}/${filename}) ---`);
        console.log(`Search: "${searchQ}"`);
        console.log(`Preview: ${previewUrl}`);
        console.log(`Page:   ${previewPage}`);

        if (dryRun) {
            console.log('[dry-run] would save to', outPath);
            continue;
        }

        const choice = yesAll ? 'y' : (await askOne('Use this icon? (y/n/s=skip): ')).trim().toLowerCase();
        if (choice === 's') continue;
        if (choice === 'y') {
            try {
                const dir = path.dirname(outPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const buf = await downloadToBuffer(previewUrl);
                fs.writeFileSync(outPath, buf);
                console.log(`Saved: ${outPath}`);
            } catch (e) {
                console.error(`Download failed: ${e.message}`);
                notApproved.push({ word, category, filename, reason: 'download_failed', error: e.message, previewUrl });
            }
        } else {
            appendNotApproved({ word, category, filename, search: searchQ, previewUrl, previewPage });
            console.log(`Logged to ${LOG_FILE}`);
        }
    }

    rl.close();
    if (notApproved.length > 0) {
        const logPath = path.join(PROJECT_ROOT, 'icon-download-failures.json');
        fs.writeFileSync(logPath, JSON.stringify(notApproved, null, 2), 'utf8');
        console.log(`\nNo/failed results written to: ${logPath}`);
    }
}

async function main() {
    const useCommons = process.argv.includes('--commons');
    const manualGuide = process.argv.includes('--manual-guide');
    const yesAll = process.argv.includes('--yes-all');
    const dryRun = process.argv.includes('--dry-run');
    const apiKey = process.env.FLATICON_API_KEY;

    if (manualGuide) {
        writeManualGuide();
        return;
    }

    if (useCommons) {
        console.log('Using Wikimedia Commons (no API key). Search: "<word> icon"\n');
        await runCommons(yesAll, dryRun);
        console.log('\nDone.');
        return;
    }

    if (apiKey) {
        let token;
        try {
            token = await getFlaticonToken(apiKey);
        } catch (e) {
            console.error(e.message);
            process.exit(1);
        }
        await runFlaticon(token, yesAll, dryRun);
        console.log('\nDone.');
        return;
    }

    // No API key and no --commons
    console.error('No API key and no --commons. Alternatives:');
    console.error('');
    console.error('  1. Wikimedia Commons (free, no key):');
    console.error('     node scripts/download-word-icons.js --commons');
    console.error('');
    console.error('  2. Generate a manual-download guide (links + save paths):');
    console.error('     node scripts/download-word-icons.js --manual-guide');
    console.error('');
    console.error('  3. Flaticon (needs API key):');
    console.error('     FLATICON_API_KEY=your_key node scripts/download-word-icons.js');
    console.error('     Get key: https://api.flaticon.com or info@flaticon.com');
    process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
