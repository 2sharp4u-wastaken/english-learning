#!/usr/bin/env node
/**
 * Download word icons — Flaticon (API) or Wikimedia Commons (no API key).
 * * Full Version: Includes previously approved words + remaining approved words from original list.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ICONS_BASE = path.join(PROJECT_ROOT, 'img', 'icons');
const LOG_FILE = path.join(PROJECT_ROOT, 'icon-download-not-approved.json');

// [ word, category, filename ]
const ENTRIES = [
    ['Table fan FT-1201', 'home', 'fan'],
];

const USER_AGENT = 'EnglishLearningApp/1.0 (https://github.com/english-learning; icon download script)';

// --- Helper Functions (Identical to original) ---

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
    return data.data || [];
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

function writeManualGuide() {
    const outPath = path.join(PROJECT_ROOT, 'ICON_MANUAL_DOWNLOAD_GUIDE.md');
    const lines = [
        '# Manual icon download guide',
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
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`Wrote ${outPath}`);
}

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
            continue;
        }

        const previewUrl = urls[0];
        if (!previewUrl) {
            console.log(`No result: ${word}`);
            continue;
        }

        const outPath = path.join(ICONS_BASE, category, `${filename}.png`);
        console.log(`\n--- ${word} ---`);

        if (dryRun) { console.log('[dry-run] would save to', outPath); continue; }

        if (!yesAll) openInChromeSameTab(previewUrl, chromeSameTabFirst);
        chromeSameTabFirst = false;

        const choice = yesAll ? 'y' : (await askOne('Use this image? (y/n/s=skip): ')).trim().toLowerCase();
        if (choice === 'y') {
            const dir = path.dirname(outPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const buf = await downloadToBuffer(previewUrl);
            fs.writeFileSync(outPath, buf);
            console.log(`Saved: ${outPath}`);
        }
    }
    rl.close();
}

async function runFlaticon(token, yesAll, dryRun) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const askOne = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    for (const [word, category, filename] of ENTRIES) {
        const searchQ = `cartoon ${word}`.toLowerCase();
        const icons = await searchFlaticon(token, searchQ, 5);
        const icon = icons[0];
        if (!icon) continue;

        const previewUrl = pickImageUrl(icon);
        const outPath = path.join(ICONS_BASE, category, `${filename}.png`);

        if (dryRun) { console.log('[dry-run] would save to', outPath); continue; }

        const choice = yesAll ? 'y' : (await askOne('Use this icon? (y/n/s=skip): ')).trim().toLowerCase();
        if (choice === 'y') {
            const dir = path.dirname(outPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const buf = await downloadToBuffer(previewUrl);
            fs.writeFileSync(outPath, buf);
            console.log(`Saved: ${outPath}`);
        }
    }
    rl.close();
}

async function main() {
    const useCommons = process.argv.includes('--commons');
    const manualGuide = process.argv.includes('--manual-guide');
    const yesAll = process.argv.includes('--yes-all');
    const dryRun = process.argv.includes('--dry-run');
    const apiKey = process.env.FLATICON_API_KEY;

    if (manualGuide) { writeManualGuide(); return; }
    if (useCommons) { await runCommons(yesAll, dryRun); return; }
    if (apiKey) {
        const token = await getFlaticonToken(apiKey);
        await runFlaticon(token, yesAll, dryRun);
        return;
    }
    console.error('No API key and no --commons. Try --manual-guide or --commons.');
}

main().catch(console.error);