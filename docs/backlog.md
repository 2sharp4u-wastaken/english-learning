# Backlog — open items (single source of truth)

Consolidated 2026-06-09. This is the **one place** to look for what's left to do.
Everything in Phases 2–5, all game migrations, Slice C1, and Slices 4.0–4.6 is
**shipped** — see `master-plan.md` for that history and the *why* behind each
decision. This doc only tracks what is **not done**.

Legend: 🔴 broken/wrong · 🟡 polish/UX · 🟢 nice-to-have/feature · ⏸ parked on the user.

---

## 1. Ship beyond localhost — **Slice INFRA1** ✅ SHIPPED (live 2026-06-10)

**The app is LIVE at https://lomdim-anglit.netlify.app** (Netlify site `lomdim-anglit`,
account 2sharp4u@gmail.com; this folder is CLI-linked via `.netlify/`, gitignored).
**Redeploy = `netlify deploy --prod`** (builds + publishes; the GitHub repo is NOT
dashboard-connected, so pushing alone does NOT deploy). Remaining: a real-device
play-test over the live HTTPS URL (mic games + PWA install) — see §3.

Chosen path: **public static deploy (Netlify/Vercel) + PWA layer**. A hosted deploy
gives free HTTPS → solves the mic secure-context blocker automatically (no cert
mgmt), reachable on any tablet; PWA adds install-to-home-screen + offline. LAN is
the weakest option (self-signed cert friction) — skip unless offline-LAN is required.
Detail/spec: `master-plan.md` → "Slice INFRA1".

- ✅ **Build-asset prerequisite (2026-06-09, shipped, commit `0520a2d`).** `publicDir:
  false` meant `vite build` dropped every runtime-served asset → a built `dist/`
  404'd on the 5 legacy `<script>` files, `data/*.json`, and `img/`. Fixed with a
  build-only Vite plugin (`infra1-copy-static-assets`) that copies them into `dist`.
  `vite preview` now serves a faithful, deployable copy. **This was the gating blocker
  for ANY deploy.**
- ✅ **PWA layer (2026-06-09, shipped, commit pending).** Hand-rolled (NOT
  vite-plugin-pwa — it fights `publicDir:false` + the copy plugin): `manifest.webmanifest`
  + `sw.js` (network-first nav, stale-while-revalidate assets) + PWA icons + `theme-color`.
  Confetti **self-hosted** at `/vendor/confetti.browser.min.js` (jsdelivr CDN removed) →
  fully offline. SW registered from `src/main.tsx` (PROD only, readyState-guarded).
  **Verified in `vite preview`:** SW controls, offline reload serves the cached app,
  confetti works offline. Static wiring pinned by `src/__tests__/pwa-wiring.test.ts`.
- ✅ **Host hookup (2026-06-10, LIVE).** `netlify login` + `netlify sites:create --name
  lomdim-anglit` + `netlify deploy --prod` → **https://lomdim-anglit.netlify.app**.
  Verified live: `/`, `/sw.js`, `/data/nikud-map.json`, `/vendor/confetti…`, PWA icons
  all 200; `netlify.toml` caching headers confirmed (no-cache on `/sw.js`+`/index.html`).
  Root-domain host (Netlify) chosen over GH Pages because the app fetches the absolute
  path `/data/nikud-map.json`. **Deploys are CLI-driven** (`netlify deploy --prod`) —
  the GitHub repo is not dashboard-connected, so a `git push` alone does not deploy.
- Natural partner to a **human play-test** on a real tablet.

### Recently fixed alongside INFRA1 (2026-06-09 preview play-test)
- ✅ **Dead back button on gate screens (14 games, commits `b4db4ce`+`be58f54`).** Gate/
  terminal screens (learn-first, all-mastered, expr locked/not-enough, blank-fill/grammar
  `total===0`) reused the play header, whose back opens an exit-confirm dialog those
  branches never mount → dead button. Idiom: `header={{ ...headerProps, onBack: () =>
  navigate('/home') }}`. Loading screens keep the play header on purpose. See
  `feedback_gate_screen_back_home` memory.
- ✅ **Phonics case toggle was inert** — it rendered text raw; now honors `caseMode`
  like every other game.
- ✅ **Home encouragement line (commit `ed9445f`)** — progress-aware, gender-neutral
  Hebrew; fills the blank hero a fully-unlocked player used to see. See
  `feedback_gender_neutral_hebrew`.
- ✅ **No seeded users on deploy + first-run create-profile (2026-06-10).** The
  hard-coded עומר/זוהר/עידן seeding was removed from `bridge/auth.ts` (a published
  site must start with an empty user DB; existing devices keep their `users` key).
  `LoginPage` now shows a "create first profile" form when the DB is empty
  (`createFirstUser` — the one non-admin-gated creation path), flowing into the
  normal first-login password setup. The parent password constant was also rotated
  to an app-only value (the old one looked personal and ships in the public bundle).

## 2. Learning-flow loose ends (from `learning-path.md`)

- 🔴 **Milestone certs don't fire on React Word Journey completion** —
  `finishWordJourney` doesn't call `checkMilestoneCertificates`. Wire it (gated on
  the recalibration decision below). *This is a real bug, not just a decision.*
- 🟡 **Certificate / level recalibration (product decision — needs the user).**
  Split milestone certificates into "words met" vs "words mastered" tracks and pick
  thresholds. Blocks the cert-firing wire-up above.
- 🟡 **Long words skip spelling** — currently omitted from the spell stage; they
  need a lighter spelling interaction instead.
- 🟢 **Recommendation explicitness** — make the engine clearer about the
  vocab-growth path vs the course/topic path.
- 🟢 **`wordJourneyProgress`** — written but unread; retire it or surface read-only
  in Stats → Words. Harmless either way.

## 3. Test / verification gaps

- 🟡 **Human-verification / E2E gaps** — WJ recall 3D-flip, slot interaction,
  say-word recording, and celebration animation/audio have no E2E.
  **Now partly unblocked:** the `webkitSpeechRecognition` stub
  (`tests/helpers/mockSpeech.js`) exists, so the mic/say-word paths are writable.

## 4. Deferred infra / polish (low urgency)

- 🟢 **FU-4.3-idb** — move image-override blobs from `localStorage` to IndexedDB
  (with boot-time async hydration of `window.wordImageOverrides` *before* any game
  route renders — 8 pages read it synchronously). Do when the ~5 MB quota bites.
  Detail: `master-plan.md` → "Follow-up FU-4.3-idb".
- 🟢 **Pronunciation pre-Hebrew delay** — shrink the ~400 ms delay before the Hebrew
  to ~200 ms so the celebration lands right after the "ding".
- 🟢 **Memory timing** — `FLIP_BACK_MS` 1000→~800 for a snappier wrong-pair flip;
  consider `allowOverlap:false` on tap audio.
- 🟢 **Dedicated coin SFX** — the coin stat-pill currently reuses the victory
  fanfare; synthesize a "cha-ching" or have the pill speak its value.
- 🟢 **Reuse Reading's compact layout** for the Word Journey spell stage (consistency).
- 🟢 **Memory sizing knobs** — `AREA_REM2`/`CHROME_REM`/per-level `columns` in
  `bridge/memory.ts` if cards feel off on any level.
- ✅ **Per-device parent password ("Tier 2") — SHIPPED 2026-06-10.** The
  hard-coded `ADMIN_PASSWORD` constant is gone; `ParentPasswordModal` runs a
  create wizard on first protected access (enter twice → hashed at the
  unprefixed `parentPassword` key), with a "שכחתי סיסמה" reset link. Covers
  existing devices with no migration. Detail: `master-plan.md` → "Slice TIER2".
  Note for the live site: requires a `netlify deploy --prod` to take effect.
  Still NOT security — any client-only gate is devtools-bypassable (§6).

## 5. Bug dump (remainder of `bug-dump-2026-06-07.md`)

The rest of that doc is shipped; only these remain:
- ⏸ 🔴 **C2** — Word Journey "cannon" shows 🎯. Translation `תותח` is correct; needs a
  real picture. Drop-in: `img/icons/gaming/cannon.png` → add
  `imageUrl: "img/icons/gaming/cannon.png"` to the `Cannon` entry in
  `data/categories/gaming.js`. (User said "skip for now" 2026-06-09.)
- ⏸ 🟡 **C3** — `Creeper` (minecraft) shows 💥 (the explosion, not the mob). Translation
  `קריפר` is correct; needs a real picture. Drop-in: `img/icons/minecraft/creeper.png`
  → add `imageUrl` to the `Creeper` entry in `data/categories/minecraft.js`. **Don't
  wire `imageUrl` before the asset exists** (broken image).
- ✅ **G1 — SOLVED 2026-06-11 (cure: `src/bridge/micHold.ts`), pending one final
  visual verify.** Root cause proven on the user's machine: in-page rAF perfectly
  clean on BOTH vocabulary and pronunciation bursts (worst frame 9.4ms, 0 janky,
  0 longTasks @120Hz) while a screen recording showed **175–524ms pixel freezes**
  on the mic burst ⇒ macOS reconfigures the audio device every time a capture
  closes, freezing system frame delivery — below the page, which is why all 3
  rendering-path fixes failed. **Live experiment confirmed the cure:** holding an
  extra `getUserMedia` stream made the burst smooth (built-in mic — no Bluetooth
  involved). Shipped: `ensureMicHold()` acquires one keep-alive stream at
  recording start (pronunciation/abc/phonics bridges + `useMicPlayback`);
  `scheduleMicRelease()` releases it on an **8s linger timer after capture
  end** — refreshed by the next recording — so the celebration plays against a
  warm device and the reconfiguration lands on a quiet screen. All-mic games
  (Pronunciation/Practice) stay warm end-to-end; mixed games (ABC/Phonics/WJ)
  drop the mic dot seconds after a say-question. Hard release on leaving
  `/game/*` (hashchange) + pagehide. The interim light-burst mitigation was
  reverted (didn't help — the freeze is load-independent); bursts are identical
  everywhere again. Unit-pinned: `src/bridge/__tests__/micHold.test.ts`.
- 🧹 **Cleanup (post-G1):** decide whether to strip the `__PROFILE_CONFETTI__`
  profiler + the `triggerConfetti(label)` labels or keep them as a permanent
  dev tool.

## 6. Architecture horizon — backend / accounts ("Tier 3") 🟢

Everything today is client-only: each browser's localStorage is its own island
(users, progress, settings), and the static deploy (INFRA1) keeps it that way on
purpose — free hosting, zero ops, fully offline-capable. A backend redesign only
makes sense when a feature **needs** shared state, and then several wants land
together in one architecture change:

- **Cross-device progress sync** — the kid plays on the tablet and the laptop and
  it's the same profile. This is the feature most likely to motivate the change.
- **Real parent-password secrecy** — server-side auth is the only non-bypassable
  gate (every client-only check, incl. the §4 Tier-2 item, can be defeated via
  devtools).
- **Family accounts / multi-device user management**, remote content updates,
  usage analytics for the parent.

Cost class: weeks, not a slice — accounts, server-side auth, a data-sync model
(localStorage ⇄ server reconciliation), paid-or-managed hosting, privacy posture
(it's kids' data), and migration of existing local progress. **Decision rule:
don't start this for security alone; start it if/when cross-device sync becomes a
real want, and fold the parent-password fix in.**

---

## 7. MOBILE1 — small-phone & Android play-test findings (2026-06-11)

From the first real-device play-test of the live site (Android tablet + small
Android phone). Planned with the user 2026-06-11; product decisions inline.

### M1 🔴 Android mic: recognition records silence (tablet + phone)
**Fix implemented 2026-06-11 (pending on-device verify + deploy):**
`src/lib/platform.ts` `isAndroid()` no-ops both `ensureMicHold()` and
`useMicPlayback.start()` on Android (the hear-yourself button self-hides —
it's gated on the captured URL). Unit-pinned in `micHold.test.ts`. **Verify on
the tablet AND phone after the next `netlify deploy --prod`** — if recognition
is still silent with our streams gone, see the fallback suspects below.

Original finding: permission granted, green mic dot on, but nothing gets picked up. Prime suspect
(code-level, not yet device-verified): the app holds EXTRA `getUserMedia`
streams open while `webkitSpeechRecognition` runs — `useMicPlayback`'s
hear-yourself recorder (Slice 3.11; Pronunciation/Practice/WJ say-word) and the
`micHold` keep-alive (2026-06-11, ALL recording bridges). Desktop Chrome shares
the mic between consumers; Android Chrome's recognition (Google service) gets
silence while a page stream holds the device — the green dot is OUR stream, not
recognition. Explains phone-never-worked (the playback stream predates micHold)
AND tablet-worked-once-then-broke (the micHold deploy landed in between).
micHold cures a macOS-only quirk (audio-device reconfigure freeze) — pointless
on Android anyway. **Fix:** platform-gate BOTH off on Android (hide the
"שמע את עצמך" button there); verify on both devices. If still silent after
that, next suspects: recognition `lang`, Google-app speech service settings.

### M2 🔴 Hebrew player names mangled (עידן→עדן, זוהר→זהר)
`utils/nikudDOM.js` still walks the non-game React pages and replaces the name
text with its nikud-map form, which drops matres lectionis (same mechanism as
the `testing_legacy_nikud_injection` memory). **Fix: names are NEVER
nikud-ized** — add a skip marker (e.g. `data-nikud-skip`) to nikudDOM and wrap
every name render site (home greeting, TopNav, profile, login user cards,
stats). Original spelling exactly as the parent typed it; no nikud on names.

### M3 🟡 Small-phone game layout (one shared fix, all games)
All games already use `GameScreenShell fitViewport` (footer pinned, only
`<main>` scrolls) — but on a small phone the pinned chrome (GameHeader +
GameHero + QuestionProgress) eats so much height that `<main>` overflows: the
question top scrolls away, and the scroll offset persists into the next
question. Plan:
- **Compact chrome below a height breakpoint** in `GameScreenShell`: collapse
  `GameHero` (game name moves as small text into the header row), slim the
  header, thin progress strip. One change → every game inherits it. Static
  compact mode, not scroll-triggered auto-hide (predictable for kids); iterate
  visually on the device. **Confirmed worst case (2026-06-11 device test):
  phone LANDSCAPE — chrome fills almost the whole ~350–400px height, leaving a
  sliver of scrollable `<main>`. The breakpoint must be on viewport HEIGHT
  (e.g. `@media (max-height: ~480px)` + a milder ~600px tier), which covers
  portrait small phones and landscape with the same mechanism.**
- **Scroll reset on question change**: reset `<main>` scrollTop when the
  question index advances (shared mechanism in the shell).
- **WJ stage indicator**: compact dots-only variant of `WJStageBar` on narrow
  screens (currently unreadable at phone width).
- **Content-fit audit** at ~360×640: shrink paddings/fonts on the biggest
  offenders (AnswerGrid media cards, MediaPromptCard) so `<main>` stops
  overflowing at all — scrolling mid-question is the failure mode to eliminate.
- **Memory game (decision: rotate hint)**: portrait phone on big-grid levels
  shows a friendly rotate-the-device hint; landscape gets a wider grid via the
  existing `bridge/memory.ts` sizing knobs (no Screen-Orientation lock — only
  works installed/fullscreen).

### M4 🟡 First-run parent onboarding wizard
Replace the bare create-first-profile form with a friendly first-run flow
(Hebrew, **no nikud** — adult-facing; beautiful, not wordy): welcome / what the
app is → create player profile(s) → set the parent password (reuse the
ParentPasswordModal wizard) → pointer to the parent area + link to the guide.
**Guide (decision): in-app `/parent-guide` route** — offline-capable, app-styled,
linked from the wizard and from the parent area.

### M5 🟢 Custom words without a parent API key (decision: server-assisted + share-back)
Today `CustomWordsPanel` requires the parent's own Anthropic key
(browser-direct call). Decision — Netlify Function with the project key, plus
central word-sharing:
- (a) `/.netlify/functions/word-import` proxy holding the project's Anthropic
  key (Netlify env var) — parents never need a key; drop the key field from the
  panel. Needs basic abuse guarding (rate limit, word-count cap) since usage
  bills to the project key.
- (b) The function also **logs each submission** (input words + generated
  entries) to a central store (Netlify Blobs) so the project owner sees what
  parents add — not just on that device.
- (c) Review pipeline (future): owner reviews the queue → approves → bakes into
  `data/categories/*` via the existing maintainer flow → next
  `netlify deploy --prod` ships the words to all users. Automate only if volume
  ever justifies it.
This is the first real backend seam — keep it tiny; full accounts/sync remain §6.

### M6 ✅ Settings header buttons → parent area (SHIPPED 2026-06-11)
Both buttons moved off the kid-visible settings header into a "תחזוקה"
SectionCard in the protected כלי הורה tab (`AdvancedToolsTab`): **הורדת
לוגים** (downloads the in-memory console log — the bug-report-from-the-tablet
tool, e.g. for M1/M9) and **איפוס הגדרות** (inline confirm; the tab unlock is
the password gate now — the old header-button password plumbing was removed
from `SettingsPage`). Tests repointed (`reset settings flow` + advanced-tools
render assertions in `react-routes.spec.js`); nikud map regenerated (+7).
- ⏸ Parked: make the captured log more verbose/descriptive (scope what
  consoleLogger records) — user flagged it may not be useful enough yet.

### M7 🟡 שלום-{name} greeting TTS flaky on tablet — ROOT CAUSE FOUND (device, not code)
**Tablet log 2026-06-11 20:54Z: `Available voices: 1` — the device exposes ONLY
"אנגלית ארצות הברית (en_US)"; `Selected Hebrew voice: undefined`. There is NO
Hebrew TTS voice installed on the tablet — no code can speak Hebrew there.**
User action: Android Settings → Text-to-speech output → Google Speech
Recognition & Synthesis → ⚙ → Install voice data → עברית. The code half
(speak-time voice re-resolution) shipped with M9 and will pick the voice up
as soon as it exists.

### M8 🟢 In-app PWA install button
Chrome's automatic install banner is heuristic (engagement threshold; 90-day
suppression after a dismissal) — the tablet got it, the phone didn't. Add an
"התקינו את האפליקציה" button in the parent area: capture the
`beforeinstallprompt` event (suppress default, stash it), show the button only
while the stashed prompt exists and the app isn't already standalone
(`display-mode: standalone` media query), call `prompt()` on tap. Hide on
iOS/unsupported browsers (no event) — optionally show the manual
add-to-home-screen instructions there instead.

### M9 🔴 Android PWA audio/TTS wedge (tablet, 2026-06-11)
**Fix implemented 2026-06-11 (pending on-device verify + deploy)** — all in
`speechSynthesis.js`, Android-gated via `SPEECH_IS_ANDROID` (mirrors
`src/lib/platform.ts`):
- busy-queue → `cancel()` + proceed on Android (desktop keeps skip-forever);
- utterance watchdogs: never-started (3s; Android cancel+retry once;
  desktop skips while engine legitimately busy) + never-ended
  (text-scaled cap ≤15s) so a `speak()` promise can never hang; live
  utterance ref kept against the Chrome GC-drops-onend bug;
- recognition watchdog: no result/error/end within 15s → `abort()` → the
  game's retry path (cures "green dot on, app stuck, can't progress");
- `cancelSpeech()` now actually cancels on Android only;
- **M9b (2nd tablet log, 20:54Z — new bundle confirmed live):** the wedge
  fixes work (queue unwedges, watchdogs recover, recognitions DO succeed
  now), but recognition still sometimes ends ~2.5s in with NO result and NO
  error (fail-fail-fail-success pattern, kid retapping). Added a one-shot
  silent-end auto-retry in `startRecording` (Android-only, skipped on
  manual `_manualStop`, re-arms the 15s watchdog) so the service hiccup is
  absorbed before the kid sees a failure.
**Log evidence (tablet, 2026-06-11 20:43Z, OLD bundle — captured pre-update):
diagnosis CONFIRMED.** 10× consecutive "Queue full - skipping" (wedged TTS
queue eating every sound) + repeated recognition signature "starting → ~2.6s →
onend with NO result/error" right after a no-op (disabled) cancelSpeech() —
i.e. recognition launched while TTS still spoke and got no audio. Both are
exactly the paths the fix targets. NOTE the SW serves legacy scripts
stale-while-revalidate: after a deploy, launch → full close → launch again
(or reinstall the PWA) before judging. New-bundle marker in the logs:
"[Speech] cancelSpeech() — Android: cancelling" (old prints "DISABLED").
Verbosity follow-up (parked item below): log the deploy/build id in the
console-log header so stale-bundle confusion is visible at a glance.
Repro that motivated it (tablet PWA, post-M1): ABC recording worked a couple
of questions then stopped (green dot on, no pickup, no progress); hero sounds
intermittently dead (owl/greeting/score effects). Original analysis:
- **TTS queue wedge:** `speechSynthesis.js` skips every `speak()` while
  `synthesis.pending` is true, and `cancel()` is deliberately NEVER called
  (desktop-Chrome corruption workaround, see comments at ~198/414). Android's
  speech engine is known to stick mid-utterance → `pending` true forever →
  every later utterance silently skipped ("[Speech] Queue full - skipping").
  Likely fix: Android-only watchdog — if pending/speaking persists >Xs with no
  onstart/onend events, call `cancel()` (the corruption bug the workaround
  guards against is desktop Chrome; re-verify on Android) and retry once.
- **Audio-focus cascade:** a wedged speech service can cost the WebAPK process
  its audio focus → `AudioContext.resume()` hangs → every Web-Audio effect
  awaits forever (audio-effects.js awaits resume() before each play — add a
  timeout). Mic recognition failing at the same moment fits the same wedge.
**Evidence to collect (user):** force-stop + reopen the PWA — does everything
recover? When wedged, download לוגים and check for repeated queue-full lines.
Related: M7 (greeting flakiness may be an early/mild form of the same wedge).

---

### Suggested order
**MOBILE1 first — it's what the live play-test surfaced:** M1 (mic — core
feature broken on the target devices) → M2 (names — personal and visible) → M3
(layout) → M4 (onboarding) → M6 (quick) → M7 (tablet TTS) → M5 (needs the
Netlify function + key setup). Then the milestone-cert bug (clear fix, but
needs the recalibration decision first) → E2E backfill for the mic/WJ paths
(stub now exists) → polish grab-bag as time allows. C2/C3 unblock the moment
you drop the two images.
