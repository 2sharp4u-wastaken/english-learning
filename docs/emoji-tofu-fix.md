# Emoji "tofu" fix (M15)

**Problem:** ~51 vocab words use newer-Unicode emoji (the **U+1FA70–1FAFF** block,
Unicode 12–15: 🪑🪨🫏🫁🩸🪓🪟🪜… + a few 1F9xx). Older **Android** system emoji
fonts don't have these glyphs, so they rendered as blank "tofu" boxes on the
tablet/phone (modern devices were fine). Reported during the live play-test.

**Fix:** a `unicode-range`-scoped web font. `src/styles/fonts/emoji-fix.woff2` is
a **310 KB subset of Noto Color Emoji** containing ONLY those glyphs. The
`@font-face` in `src/styles/globals.css` declares it with a `unicode-range`
limited to exactly those codepoints, and `'EmojiFix'` is appended to
`--font-ui`/`--font-display` (`src/styles/tokens.css`). The browser therefore
uses EmojiFix **only** for those codepoints (on every device) and leaves all
other text + emoji on the system font — **zero render-site/JS changes, no risk to
the ~14 emoji render sites.** Vite content-hashes + bundles the woff2 via the
relative `url('./fonts/emoji-fix.woff2')` (one copy, works in dev + build).

Emoji are rendered as text spans that inherit `--font-ui`/`--font-display`, so
they pick EmojiFix up automatically. New words whose emoji fall in U+1FA70–1FAFF
are covered for free (the whole block is in the subset + range); a new emoji in a
DIFFERENT new block would need its codepoint added to both the subset and the
`unicode-range` (see regen below).

## Regenerating the subset font

If the risky-emoji set changes (new blocks/words), rebuild `emoji-fix.woff2`:

```sh
pip install --break-system-packages fonttools brotli
# full-coverage source (CBDT color bitmaps):
curl -L -o /tmp/noto.ttf \
  https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf
# subset to the block + the specific 1F9xx codepoints the app uses:
python3 -m fontTools.subset /tmp/noto.ttf \
  --unicodes="U+1FA70-1FAFF,U+1F90F,U+1F912,U+1F917,U+1F91D,U+1F922,U+1F924,U+1F929,U+1F92A,U+1F92B,U+1F930,U+1F932,U+1F934,U+1F935,U+1F938,U+1F93A" \
  --flavor=woff2 --no-hinting --desubroutinize \
  --output-file=src/styles/fonts/emoji-fix.woff2
```

To recompute which emoji are "risky" + used, scan `data/**/*.js` for the
`image`/`emoji`/`picture` string fields and keep graphemes with a codepoint
≥ U+1FA70 (or other newer blocks). Keep the `unicode-range` in `globals.css` in
sync with `--unicodes`.
