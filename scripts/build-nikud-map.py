#!/usr/bin/env python3
"""One-time build script: generates data/nikud-map.json from all category files.
Run: python3 scripts/build-nikud-map.py

Also used at runtime by _loader.js via POST /api/enrich-nikud when new static
words are detected missing from the map.
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).parent.parent
CATEGORIES_DIR = ROOT / 'data' / 'categories'
DATA_DIR = ROOT / 'data'
NIKUD_MAP_PATH = ROOT / 'data' / 'nikud-map.json'
NAKDAN_URL = 'https://nakdan-u1-0.loadbalancer.dicta.org.il/api'
BATCH_SIZE = 50  # translations per API request


def has_nikud(text):
    """Return True if text already contains Hebrew diacritic characters."""
    return bool(re.search(r'[\u05B0-\u05C7]', text))


def extract_translations_from_categories():
    """Extract all unique Hebrew translations from data/categories/*.js files."""
    translations = []
    seen = set()
    for f in sorted(CATEGORIES_DIR.glob('*.js')):
        if f.name == '_index.js':
            continue
        content = f.read_text(encoding='utf-8')
        for m in re.finditer(r'translation:\s*["\']([^"\']+)["\']', content):
            t = m.group(1).strip()
            if t and t not in seen:
                seen.add(t)
                translations.append(t)
    return translations


def extract_grammar_hebrew():
    """Extract Hebrew strings from grammarBeginnerData.js and grammarQuestions.js."""
    translations = []
    seen = set()

    def add(t):
        t = t.strip()
        if t and t not in seen:
            seen.add(t)
            translations.append(t)

    # grammarBeginnerData.js — subjects.hebrew and predicates.hebrew/hebrewFem/hebrewPlural
    beginner_file = DATA_DIR / 'grammarBeginnerData.js'
    if beginner_file.exists():
        content = beginner_file.read_text(encoding='utf-8')
        for field in ('hebrew', 'hebrewFem', 'hebrewPlural'):
            for m in re.finditer(rf'{field}:\s*["\']([^"\']+)["\']', content):
                add(m.group(1))

    # grammarQuestions.js — hebrewSentence and hebrewExplanation
    questions_file = DATA_DIR / 'grammarQuestions.js'
    if questions_file.exists():
        content = questions_file.read_text(encoding='utf-8')
        for field in ('hebrewSentence', 'hebrewExplanation'):
            for m in re.finditer(rf'{field}:\s*"([^"]+)"', content):
                add(m.group(1))
            for m in re.finditer(rf"{field}:\s*'([^']+)'", content):
                add(m.group(1))

    return translations


def fetch_nikud_batch(translations):
    """Send a batch of translations to Nakdan API, return {translation: nikud} map."""
    payload = json.dumps({
        'task': 'nakdan',
        'genre': 'modern',
        'data': '\n'.join(translations)
    }).encode('utf-8')

    req = urllib.request.Request(
        NAKDAN_URL,
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            tokens = json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f'  ⚠️  API error: {e}', file=sys.stderr)
        return {}

    # Split flat token list back into per-translation groups using '\n' separators
    groups = []
    current = []
    for tok in tokens:
        if tok.get('sep') and tok.get('word') == '\n':
            groups.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        groups.append(current)

    result = {}
    for i, (original, group) in enumerate(zip(translations, groups)):
        parts = []
        for tok in group:
            if tok.get('sep'):
                # preserve spaces between words in multi-word translations
                parts.append(tok.get('word', ''))
            elif tok.get('options'):
                parts.append(tok['options'][0].replace('|', ''))
            else:
                parts.append(tok.get('word', ''))
        nikud = ''.join(parts).strip()
        if nikud:
            result[original] = nikud

    return result


def enrich(translations_to_fetch, existing_map=None):
    """Fetch nikud for the given list, merge with existing_map, return updated map."""
    if existing_map is None:
        existing_map = {}

    # Skip translations that already have nikud in the source OR already in map
    needed = [t for t in translations_to_fetch
              if t not in existing_map and not has_nikud(t)]

    if not needed:
        print('✅ All translations already in map.')
        return existing_map

    print(f'Fetching nikud for {len(needed)} translation(s) in batches of {BATCH_SIZE}...')
    updated = dict(existing_map)
    total_batches = (len(needed) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(needed), BATCH_SIZE):
        batch = needed[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f'  Batch {batch_num}/{total_batches} ({len(batch)} words)...', end=' ', flush=True)
        fetched = fetch_nikud_batch(batch)
        updated.update(fetched)
        print(f'got {len(fetched)}/{len(batch)}')
        if batch_num < total_batches:
            time.sleep(0.3)  # be polite to the API

    # Words with nikud in source — use them as-is
    for t in translations_to_fetch:
        if has_nikud(t) and t not in updated:
            updated[t] = t

    return updated


HEBREW_WORD_RE = re.compile(r'[\u05D0-\u05EA]+')

# Directories to skip when scanning source files for UI strings
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', 'scripts', '.claude'}
# Files that are already covered by the specific extractors above
SKIP_FILES = {
    'nikud-map.json', 'phonetic-index.json',
    '_index.js',  # just re-exports
}

def extract_ui_hebrew_words():
    """Extract individual Hebrew words from all JS and HTML source files.

    The runtime DOM scanner does word-by-word replacement, so we need individual
    words (not just phrases) in the map.  This function feeds that requirement.

    Includes .ts/.tsx so React-owned Hebrew chrome (nk() literals like the Word
    Journey / Memory finish screens) is collected — those files are invisible to
    a .js-only scan, which left their words absent from the map (Theme A).
    """
    words = set()

    for ext_glob in ('**/*.js', '**/*.html', '**/*.ts', '**/*.tsx'):
        for f in ROOT.glob(ext_glob):
            # Skip unwanted directories
            if any(part in SKIP_DIRS for part in f.parts):
                continue
            if f.name in SKIP_FILES:
                continue
            try:
                content = f.read_text(encoding='utf-8')
                for m in HEBREW_WORD_RE.finditer(content):
                    w = m.group(0)
                    if len(w) >= 2:  # skip single-letter match noise
                        words.add(w)
            except Exception:
                pass

    return sorted(words)


def main():
    print('🔤 Nikud Map Builder\n' + '=' * 40)

    # Load existing map
    existing = {}
    if NIKUD_MAP_PATH.exists():
        existing = json.loads(NIKUD_MAP_PATH.read_text(encoding='utf-8'))
        print(f'Loaded existing map: {len(existing)} entries')

    # Extract all translations from source files
    category_translations = extract_translations_from_categories()
    grammar_translations = extract_grammar_hebrew()
    ui_words = extract_ui_hebrew_words()

    seen: set = set()
    all_translations = []
    for t in category_translations + grammar_translations + ui_words:
        if t not in seen:
            seen.add(t)
            all_translations.append(t)

    print(f'Found {len(category_translations)} unique translations in category files')
    print(f'Found {len(grammar_translations)} unique Hebrew strings in grammar files')
    print(f'Found {len(ui_words)} unique Hebrew words across all source files')

    missing = [t for t in all_translations if t not in existing and not has_nikud(t)]
    print(f'Missing from map: {len(missing)}\n')

    if not missing:
        print('✅ Map is complete — nothing to do.')
        return

    updated = enrich(missing, existing)

    NIKUD_MAP_PATH.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2, sort_keys=True),
        encoding='utf-8'
    )
    print(f'\n✅ Saved {len(updated)} entries to {NIKUD_MAP_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
