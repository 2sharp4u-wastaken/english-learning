# Backlog — open items (single source of truth)

Consolidated 2026-06-09. This is the **one place** to look for what's left to do.
Everything in Phases 2–5, all game migrations, Slice C1, and Slices 4.0–4.6 is
**shipped** — see `master-plan.md` for that history and the *why* behind each
decision. This doc only tracks what is **not done**.

Legend: 🔴 broken/wrong · 🟡 polish/UX · 🟢 nice-to-have/feature · ⏸ parked on the user.

> **RESUME HERE (updated end of session 2026-06-17).** All work committed + pushed
> to `v3-react-migration` (latest `1c08aea`); **NOT merged to `main`.**
> **Cloudflare Workers is the SOLE host** (Netlify retired): 
> https://english-learning.2sharp4u.workers.dev/ — Git-connected, **push auto-deploys
> ~2-4 min**; fast path **`npm run cf-deploy`** (wrangler authenticated on this
> machine). Login screen shows a `v<ver> · <sha>` build stamp to confirm the live
> bundle (SW serves cached first → close+reopen to pick up a deploy). Deploy
> gotchas: `docs/cloudflare-deploy.md`; bug-report triage (gh IS authed now):
> `[[project_bug_report_feature]]`.
>
> **This session (2026-06-17) shipped THREE big things — all live except where noted:**
> 1. **M12 Slice B + M4 — parent admin account.** First-run wizard (`FirstRunWizard`,
>    parent picks name+password = the device parent credential, `createParentAccount`);
>    **one-unlock parent mode** (`src/bridge/parentMode.ts`, role OR password, 15-min
>    timeout, survives nav); kids see ONLY the unprotected "המשחק שלי" settings tab
>    (parent tabs hidden until elevated, one "הגדרות הורה" unlock button); `categories`
>    gated; in-app `/parent-guide`; "פתיחת כל התכנים" expose-all toggle. **Issue #10:**
>    standard admin password model (VERIFY-only, NO unauthenticated reset; change via
>    כלי הורה → "סיסמת הורה" `changeParentPassword`; factory-reset "התחלה מחדש" in
>    כלי הורה; recover-forgotten = clear app data) + all player copy says שחקן/ית
>    never ילד. **Issue #11:** auth modal scrollable on short phones.
>    See `[[project_m12b_m4_parent_account]]`.
> 2. **Per-kid customization "המשחק שלי"** — per-user `playerPrefs` blob
>    (`v2_playerPrefs_<userId>`, `usePlayerPrefs`, distinct from global AppSettings):
>    5 themes, 15 distinct sounds (icon-only grid + preview; FIXED the bell/chord
>    fell-through-to-arpeggio bug), login + logout sounds, 12 mascot animals + many
>    rotating phrases, score-pill sound packs, motion/celebration, avatar color,
>    bigText/contrast. See `[[project_player_customization]]`.
> 3. **Cloud backend Tier-3 Phase A — LIVE.** Cloudflare D1 `english-learning-db` +
>    Worker `/api/auth/*` + `/api/players` (PBKDF2 + JWT, `worker/auth.ts`) +
>    offline-first `src/bridge/cloudAccount.ts` + "חשבון בענן וגיבוי" card in כלי הורה.
>    Provisioned, deployed, verified live. See `[[project_cloud_backend]]` +
>    `docs/cloud-backend.md`. **121 unit tests + the settings/auth/customization
>    Playwright specs green.**
>
> **NEXT (pick up here):**
> (1) **Cloud Phase B** — back up + sync each profile's progress (`v2_userProgress_<id>`)
>     + `playerPrefs` blobs to the cloud account (push on change, pull on a fresh
>     device); map local user ids ↔ cloud player ids at link time. This is what makes
>     "same profile on tablet + laptop" real. Roadmap in `docs/cloud-backend.md`.
> (2) **Cloud guardrails BEFORE any public launch of the cloud layer** — sign-up is
>     currently OPEN (anyone can register a family on the public URL): add rate-limiting
>     + email verification + a data export/delete path (it's kids' data). Noted in
>     `docs/cloud-backend.md` "Privacy".
> (3) **Deferred customization:** coin-earned cosmetic unlocks (tie themes/avatars/
>     sound-packs to `CoinManager`); nikud/case becoming per-kid (still global).
> (4) **Leaderboard** (§ LB — now has the D1 seam), **M8** PWA install button,
>     **M5/M13** parent word/image submission (reuse the D1/Worker backend; `manager`
>     role reserved for these), milestone-cert WJ bug (needs cert-recalibration decision).
> GitHub issues #10/#11 left OPEN for the user to close after on-device verification.
> Waiting on the user: cert recalibration; install Hebrew TTS voice on the tablet
> (M7); C2/C3 images.

---

## 0. Beta bug/feedback report — ✅ LIVE END-TO-END 2026-06-16

A floating "דיווח על תקלה" report button on **every page** (hub + games) →
modal with screenshot upload (downscaled client-side) + Hebrew/English
description + submit. Full design + ops: **`docs/bug-report.md`**.
- ✅ **Frontend LIVE** (`src/features/feedback/BugReportWidget.tsx` mounted in
  `AppShell` both branches; `src/bridge/bugReport.ts`). POSTs to `/api/report`
  AND always writes a capped `bugReports_local` localStorage buffer (belt-and-
  suspenders). Adult-utility chrome → plain Hebrew, whole subtree
  `data-nikud-skip` (nikudDOM leaves it alone).
- ✅ **Backend LIVE** (`worker/index.ts`, wired in `wrangler.jsonc`): `main`
  Worker with ASSETS + REPORTS_BUCKET (R2 bucket `english-learning-reports`) +
  `GITHUB_REPO` var + `GITHUB_TOKEN` secret (no-expiry fine-grained PAT, Issues
  RW). `/api/report` → screenshot to R2 + GitHub Issue (label `beta-report`);
  `/api/report-image/:k` serves it back; else `env.ASSETS`. Verified live
  (issue #1 created + screenshot served). Account `2sharp4u@gmail.com`.
- **Queue = GitHub Issues** (`2sharp4u-wastaken/english-learning`): triage in the
  Issues tab or `gh issue list --label beta-report`. R2 holds the image (Issues
  API can't attach binaries). Chat-webhook was the runner-up (fast phone ping)
  but isn't readable from a Claude session.
- ✅ **Version + device + logs on every report (2026-06-16b, user ask).** The
  report context now carries an injected **build stamp** — `appVersion`
  (package version), `gitSha`, `buildTime` via Vite `define`
  (`__APP_VERSION__`/`__GIT_SHA__`/`__BUILD_TIME__`, declared in
  `src/vite-env.d.ts`) — plus a coarse `platform` (Android/iOS/desktop from UA)
  and the **tail of the in-memory console log** (`window.consoleLogger.getLogs()`,
  last 60 lines / 8 KB cap). The Worker renders version+platform into the **issue
  title** (`[beta] (Android v3.0.0+cb179bf) …`), adds version/built/platform rows
  to the table, and drops the logs into a collapsed `<details>`. The widget shows
  `v<version> · <sha>` so a tester can read it aloud. (device info — UA/viewport/
  language — was already captured; the gap was a real version + logs.)
- ⬜ Optional follow-ups: a private admin list page to triage in-app (vs the
  Issues tab); set up `gh auth login` so a Claude session can triage directly.
  (✅ stray `img/.DS_Store` removed from the build copy plugin; ✅ QR committed at
  `docs/beta-qr.png`.)

## 1. Ship beyond localhost — **Slice INFRA1** ✅ SHIPPED (live 2026-06-10)

**The app is LIVE at https://english-learning.2sharp4u.workers.dev/** on **Cloudflare
Workers — the SOLE host (Netlify retired 2026-06-17).** Static-assets Worker via
committed `wrangler.jsonc` (`assets=./dist`, SPA `not_found_handling`);
`cloudflare/_headers` ships caching (NO `_redirects` — Cloudflare rejects the SPA
catch-all). Git-connected to `english-learning` @ `v3-react-migration`, so **a push
auto-deploys in ~2-4 min** (CI runs `npm run build` + `npx wrangler deploy`); the
**`npm run cf-deploy`** fast path (~30s) publishes the current tree without waiting for
CI. Auto-deploy is via the GitHub App (no classic repo webhook — expected). Chose
Workers over Pages/Vercel (future-facing; native Functions for the M5/M13 backend; no
commercial restriction; unlimited static serving). Full setup + the hard-won gotchas
(C3 plugin injection, branch pinning, `_redirects` loop, v2 repo) in
**`docs/cloudflare-deploy.md`**. Remaining: a real-device play-test over the live HTTPS
URL (mic games + PWA install) — see §3. Shorter URL (custom domain) deferred — user
rolled with a QR of the workers.dev URL for the beta.

**RETIRED — Netlify (`lomdim-anglit.netlify.app`).** Was the first host (CLI-linked,
manual `netlify deploy --prod`, never git-connected); retired 2026-06-17 because it
drifted from Cloudflare and the dual-host story confused which build was live.
`netlify.toml` deleted; the dashboard site still serves a stale build — delete/unpublish
it there when convenient. The local `.netlify/` link folder is gitignored and harmless.

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

- ✅ **PROG1 — Stats "0 מילים נלמדו" vs Home 31 — SHIPPED (Steps 1–4, commit `a6b7ebf`), 2026-06-14/15.**
  ✅ Step1 `src/engine/lifecycle.ts` (the single pure rule) + `ProgressManager`
  delegates to it + `lifecycle.test.ts` (11) — engine tests prove Home/Profile/gates
  unchanged. ✅ Step2 `bridge/stats.ts` `learnedCount`→introduced, new `masteredCount`,
  cross-user `isWordDue` guard; `StatsPage` shows both "מילים נלמדו"(introduced) +
  "מילים בשליטה"(mastered) in Overview + Words tab; HoF leaderboard auto-fixed. ✅ Step3
  velocity: `firstSeen` stamp in `recordWordAttempt`/`createDefaultWordStats`,
  `getLearningVelocity` rewritten (new words met/week, forward-only). ✅ Step4
  `getUnlockRemainingText()` (`bridge/progress.ts`) → Home shows only UNMET unlock
  requirements + ABC progress (Reading is gated on ABC<60%, not words). Regression
  `stats-lifecycle.test.ts` reproduces the exact bug. See
  `[[project_prog1_lifecycle_single_source]]`.
  ⬜ Optional follow-up only: snapshot-based `isWordDue` so OTHER users' Words-tab due
  flags work (current guard just hides them for non-current users — correct, not wrong).
- 🔴 **PROG1 (original) — Stats shows "0 מילים נלמדו" while Home shows 31 (design notes).**
  Root cause: the V3 model derives "learned" from `wordMastery`, but the **Stats**
  surface (`bridge/stats.ts`) still reads the legacy `learnedWords` stamp, which is
  written *only* by full Word-Journey graduation (`graduateWord`) → ~always 0. One
  field, `model.learnedCount`, feeds 6 broken sites (Overview tile `:196`, both
  Words-tab tiles `:283/:410`, Hall-of-Fame leaderboard + totals `:539/:549/:611/:618`,
  + `getLearningVelocity`). Home/Profile/gates are already correct (Profile is the
  reference: `נלמדו`=introduced, `שליטה`=derived-Learned). Design intent
  (`learning-path.md` L97-98, L111): **"words learned" = introduced (≥1 attempt);
  "words mastered" = derived Learned; both exclude `category:'abc'`.** There are
  currently **4 conflicting "learned" definitions** in code; collapse to **2**.
  Plan (decisions locked with the user):
  - **A. Pure module `src/engine/lifecycle.ts`** = single source of truth for the
    per-word status + counts from a PLAIN progress snapshot (mastery ∪ grandfathered,
    abc-excluded, sticky `reachedLearned`). WHY pure: Stats renders ANY selected user
    from `loadUserProgress(userId)`, so it can't use the current-user `getApp()` PM.
  - **B.** `ProgressManager.getWordStatus`/`_isDerivedLearned` delegate to it (no
    behavior change — Home/Profile/gates provably untouched; that's the safety net).
  - **C.** `bridge/stats.ts`: `learnedCount` → introduced; add `masteredCount` =
    derived-Learned; fix the cross-user `isWordDue` PM call (compute from the snapshot).
  - **D.** `StatsPage`: Overview shows BOTH tiles (introduced + mastered, distinct
    labels); Words-tab "mastered" tile → canonical Learned (not the loose `≥0.8`);
    **HoF "מילים נלמדו" leaderboard ranks introduced** (design L195).
  - **E.** Velocity: add `firstSeen` in `recordWordAttempt` (+ `createDefaultWordStats`);
    velocity = new words MET in last 7 days. Forward-only (existing entries lack the
    date → ramps from 0); **no `lastSeen` fallback** (would conflate practiced with
    newly-learned and inflate). Semantic: "קצב למידה" = new words met/week.
  - **F.** Reading-gate copy (Home): show only UNMET requirements + ABC progress
    (`ABC 45%→60%`); drop the already-met "10 מלים". (Reading is locked purely on
    ABC<60%; introduced=31 already satisfies the word half.)
  - **G.** Standardize labels to Profile's pair everywhere: introduced=`נלמדו`/
    `מילים שנלמדו`, mastered=`שליטה`/`בשליטה`. Re-run `build-nikud-map.py` for new copy.
  - **Tests:** unit-test `lifecycle.ts` (new/learning/learned, abc-exclusion,
    grandfathered, sticky); regression asserting `Home.wordsLearned ===
    Stats.introducedCount` for the same user + per-user isolation in the selector.
  - **Sequence:** Step1 = A+B+tests (zero UI risk) → Step2 = C+D → Step3 = E → Step4 = F+G.
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

> **UPDATE 2026-06-17: Phase A LIVE.** The cloud-account backend is provisioned
> and deployed — `worker/auth.ts` (Cloudflare D1 `english-learning-db` + `/api/auth/*`
> + `/api/players`, PBKDF2 + JWT) + offline-first `src/bridge/cloudAccount.ts` + the
> "חשבון בענן וגיבוי" card in כלי הורה. Verified live (register/login/me/players, 401
> on bad password). Roadmap (A done → B progress/prefs backup → C bidirectional sync
> → D leaderboards) + runbook in **`docs/cloud-backend.md`**. See
> `[[project_cloud_backend]]`. **NEXT: Phase B** — push/pull the per-user progress +
> `playerPrefs` blobs (map local user ids ↔ cloud player ids at link time).


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

### LB 🟢 Leaderboards — family + global (plan only, 2026-06-14; build after M3)
User wants a **family** and a **global** leaderboard. The client-only architecture
(§6 — each browser's localStorage is its own island) splits this cleanly into two
very different cost classes:

- **Family (this device) — buildable NOW, no backend.** A board ranking the
  profiles already on one device. Source: `bridge/auth.ts` `users` + per-user
  `v2_userProgress_<uid>` (score/coins/learnedWords/streak — pick the metric).
  New `bridge/leaderboard.ts` reads all local users → sorted rows; a
  `LeaderboardPage`/card (RTL, names marked `data-nikud-skip` per M2). Picks to
  confirm when building: ranking metric (total score? coins? words learned?),
  where it lives (Home tier / Stats tab / own route).
- **Family across devices + Global — needs a backend (Tier-3, §6).** Both require
  shared server state. Two paths: (1) fold into the full §6 backend (accounts +
  sync) when that happens; or (2) a **lighter standalone** ride on the same
  Netlify-Function seam M5/M13 introduce — a tiny function + store (Netlify Blobs)
  that accepts `{displayName, score, …}` and returns top-N. Caveats: it's kids'
  data (privacy posture — pseudonymous handles, no PII), and client-submitted
  scores are trivially spoofable (devtools) without server-side validation, so a
  global board is "fun, not authoritative." Decision rule mirrors §6: don't stand
  up a backend for the leaderboard alone — bundle it with M5/M13 or the sync work.

**Recommendation:** ship the **family/local** board after M3 (small, self-contained,
no backend); design global into the M5/M13 backend seam rather than a bespoke server.

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

### M2 ✅ Hebrew player names mangled (עידן→עדן, זוהר→זהר) — SHIPPED 2026-06-14
Fixed: new `data-nikud-skip` marker in `utils/nikudDOM.js` (mirrors
`data-react-nikud-owned` — `isNikudSkipped()` early-returns in `processTextNode`
+ both `onNikudChanged` loops). Marked every name-render site (home greeting —
name wrapped so "שלום" still vocalizes; profile heading; login cards; stats
selector; UsersTab rows). Name keeps the parent's exact spelling, no nikud
added. Regression test: `tests/nikud-case-toggle.spec.js` "M2". Convention
recorded in CLAUDE.md — any NEW name display needs the marker.

Original finding:
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
- ✅ **Compact threshold raised 600→700 (2026-06-16, beta reports #3/#4):** a
  320×680 portrait phone sat above the 600 cutoff, so Word Journey's chrome +
  prompt + Next button overflowed and needed a scroll. Bumped
  `useCompactViewport` default to 700 (+ WJ picture-shrink media queries) so
  phones (browser innerHeight ≤~700) get compact while the 720 laptop/test
  default keeps the full hero. Verified live at 320×680: compact, zero overflow,
  Next in view.
- ✅ **Compact chrome on short viewports (SHIPPED 2026-06-14):**
  `useCompactViewport()` (`matchMedia('(max-height: 700px)')` — keyed on HEIGHT
  so it catches landscape phones, which are wide but short) drives a compact
  mode in `GameScreenShell`: `GameHero` collapses to a single slim line (small
  inline icon + title, no big icon block, no divider), shell `gap`/`pt`/footer
  padding tighten, and `QuestionProgress` slims its padding. One shared change →
  every game inherits it. Verified at 720×360 landscape (Listening shows all 4
  options without scrolling) + 360×600 small portrait. `data-compact` on the
  shell for tests/debug.
- ✅ **Scroll reset on question change (SHIPPED 2026-06-14):** `GameScreenShell`
  resets `<main>` scrollTop on `progress.current` change, so a prior question's
  scroll offset never hides the next question's top.
- ✅ **WJ stage indicator (SHIPPED 2026-06-14):** was squeezed into the
  `QuestionProgress` `center` slot (~80px on a phone → illegible blob). Moved to
  a new full-width `below` slot under the fill bar; `WJStageBar` made responsive
  — per-icon Hebrew labels + arrow connectors are `sm:`-only, narrow screens get
  icons-only + the current stage named once (`wj-stage-current`). Verified at
  360px.
- 🔶 **Landscape two-pane layout (IN PROGRESS 2026-06-14 — user agreed to the
  plan).** Chrome compaction alone can't fix the single tall column that
  overflows short-wide landscape; the agreed systemic fix is a `prompt` slot on
  `GameScreenShell` → `<main>` splits into two columns (prompt | interaction)
  via `@media (orientation: landscape) and (max-height: 600px)` (`.game-twopane`
  in globals.css). Portrait/no-prompt unchanged. See
  `feedback_landscape_needs_real_layout`.
  - ✅ **Done (batch 1):** shell `prompt` slot + CSS; migrated the clean
    "MediaPromptCard + AnswerGrid" family — **Vocabulary, Listening,
    Picture-Match, True-or-Not**. Verified at 800×370 (prompt right / options
    left, no scroll). Per-game change is ~mechanical: move the prompt card to
    the `prompt` prop, keep AnswerGrid as children.
  - ✅ **2-column options in landscape (commit 35f4b17):** the half-width
    interaction pane forced the AnswerGrid to 2 cols (2×2) via
    `.game-twopane-interaction [data-testid='answer-grid']` in globals.css —
    a 4-across row was cramped.
  - ✅ **Batch 2 — text-prompt family (DONE 2026-06-14):** Grammar, Fill-Blanks,
    BlankFill (Articles + Progressive) — moved the sentence/question card into
    the `prompt` slot (key stays on it), AnswerGrid + WordTable as children.
    Tests green (Grammar 5, Fill-Blanks 2, Articles/Progressive 2).
  - ✅ **Batch 3 + 4 — special layouts (DONE 2026-06-16): M3 landscape two-pane
    is now COMPLETE across EVERY game.**
    - ✅ **Reading, Sentence Scramble, ABC, Phonics, Story Time (DONE
      2026-06-16):** all reduced to the same `prompt`-slot split — the
      MediaPromptCard / hint / instruction card moves to the `prompt` prop, the
      interaction (LetterSlots+actions / answer-zone+word-bank / mic-or-AnswerGrid)
      stays as children. **Story Time:** only the QUIZ phase splits — the
      `StoryQuizPrompt` (title+question) goes to the `prompt` slot, `StoryQuizPhase`
      is now AnswerGrid-only; the READ phase passes no `prompt` so it stays a
      full-width single column (it's a reading experience, not a prompt+answers
      screen). Typecheck clean; interaction assertions green (the only failures
      are the pre-existing Dicta-Nakdan CORS console-error check, reproduced on
      baseline).
    - ✅ **Word Journey (DONE 2026-06-16):** the 4 prompt+interaction stages
      (Discover/ListenMatch/Spell/SayWord) wrap their prompt|interaction in the
      SAME `.game-twopane`/`-prompt`/`-interaction` class names on an INNER div —
      the globals.css selectors aren't scoped to GameScreenShell's `<main>`, so
      the row-split works on any element. WJ stages are self-contained, so they
      can't use the parent's `prompt` slot. Recall (memory grid) stays
      single-column (already compact). Verified `flex-direction: row` in short
      landscape; wj-step1 tests green. (Footer-pinning of the action buttons was
      not needed — the interaction pane scrolls independently in landscape, and
      the compact-chrome work covers small portrait.)
  - ✅ **Hide the decorative chrome in short landscape (DONE 2026-06-16b — user
    follow-up: "on mobile landscape I still can't see most of the question/answer
    area, remove the top parts — progress and bars").** Even with the two-pane,
    the STACKED chrome above `<main>` (GameHero title + QuestionProgress bar +
    WJ's per-stage `פריט N מתוך M` counter) ate too much of a ~360px-tall
    landscape phone. Fix is ONE globals.css rule under the existing
    `(orientation: landscape) and (max-height: 600px)` query: `display:none` the
    `[data-testid='game-hero']` + `[data-testid='question-progress']` (+ the new
    `.wj-stage-counter` class on the 4 WJ stage counters) inside the
    `[data-compact='true']` game shell, so `<main>` (flex-1) expands to fill the
    height. The control header (back/toggles/score) stays — it's the only in-game
    nav. Systemic (one rule, every game), per `feedback_landscape_needs_real_layout`.
    Verified at 740×360: ABC/WJ now show header-bar-only + a full-height two-pane.
    Caveat: tablet-landscape (height >600) is unaffected by design — it has the
    room for the full chrome.
  - ✅ **Compact the prompt CARD in short landscape (DONE 2026-06-16, beta #6 +
    #7 — Word Journey on a ~320px-tall landscape phone still needed to scroll to
    reach the audio button; #7 is a re-report of the same Discover-stage card
    overflow against the not-yet-deployed build).** Even with the chrome hidden, the shared `MediaPromptCard`
    vertical stack (instruction + media + word + translation + audio) was taller
    than the half-height prompt pane, so the speaker + "plays remaining" hint sat
    below the fold. Fix is CSS only, in the SAME landscape query: shrink the card's
    gap/padding, cap `[data-testid='media-prompt-media'] img` at 3.5rem + emoji at
    2.5rem, and notch the prompt/word/translation type down — scoped to
    `.game-twopane-prompt [data-testid='media-prompt-card']`, so it fixes every
    two-pane game's prompt at once. Verified at 680×320: card height 310→233px, the
    audio button bottom 321px (off-screen) → 261px (on-screen), pane scroll = 0.
  - ✅ **Shrink the INTERACTION pane's letter builder in short landscape (DONE
    2026-06-16, beta #8 — once the prompt card fit, the spell stage's left pane
    was now the overflow: big `size-14` tiles + slot row pushed the נקה/בדוק
    buttons below the fold).** Same landscape query: shrink shared `LetterSlots`
    `[data-testid='letter-tile']` to 2.5rem (was size-14/56px), `letter-slot` to
    2.5rem height (overrides the inline `height:3.25rem` with `!important`) +
    tighter gaps — so the action buttons stay on-screen. Shared → Reading's
    builder benefits too. Verified at 680×320 via a playthrough to the spell
    stage: בדוק button bottom 427px (off-screen) → 253px (on-screen).
  - ✅ **Fit the say-word stage + pin the two-pane row (DONE 2026-06-16, beta #9
    — at a ~300px-tall landscape the densest stage still needed scrolling).** Two
    parts, both in the landscape query: (a) `.game-twopane` lacked `min-height:0`,
    so the flex-col row grew to its content and the whole PAGE scrolled instead of
    the panes — pinned it so each `overflow-y:auto` pane keeps its own content
    in-bounds; (b) the say-word answered state (size-20 mic + result comparison +
    Next) is the heaviest pane, so shrink `[data-testid='wj-say-record']` to 3rem,
    slim `[data-testid='wj-say-result']` padding/gaps, and tighten the result/Next
    button padding. Verified via playthrough to the answered state at 680×300: Next
    button bottom 328px (off-screen) → 296px (on-screen), page scroll = 0.
    **Not a bug — Android "hear yourself":** the report also asked why there's no
    replay of the recording. `useMicPlayback` no-ops on Android by design (M1 — a
    parallel capture starves Android speech recognition), so the "שמע את עצמך"
    button (gated on the recording URL) never shows on Android; Pronunciation uses
    the same hook so it's identical. Desktop-only by the documented invariant.
- **Memory game (decision: rotate hint)**: portrait phone on big-grid levels
  shows a friendly rotate-the-device hint; landscape gets a wider grid via the
  existing `bridge/memory.ts` sizing knobs (no Screen-Orientation lock — only
  works installed/fullscreen). (May be reframed once landscape two-pane lands —
  Memory's grid benefits from landscape width.)

### M4 ✅ First-run parent onboarding wizard — SHIPPED 2026-06-17
Done with M12 Slice B (one slice). `src/features/auth/FirstRunWizard.tsx` replaces
the bare create-first-profile form on an empty DB: welcome → **create the parent/
admin account** (name + password = the device parent credential) → **create player
profile(s)** (up to 3, parent + 3 = the 4-user cap) → finish (pointer to the parent
area + link to the in-app guide). Adult-facing, **no nikud** (`data-nikud-skip`),
reuses the `.auth-*` styles. Guide = in-app **`/parent-guide`** route
(`ParentGuidePage`, offline, app-styled), opened as an overlay from the wizard
finish and as a route from כלי הורה. See `[[project_m12b_m4_parent_account]]`.

<details><summary>Original plan</summary>

Replace the bare create-first-profile form with a friendly first-run flow
(Hebrew, **no nikud** — adult-facing; beautiful, not wordy): welcome / what the
app is → **create the parent/admin account (M12)** → create player profile(s) →
set the parent password (= the parent account's credential) → pointer to the
parent area + link to the guide. **Guide (decision): in-app `/parent-guide`
route** — offline-capable, app-styled, linked from the wizard and parent area.
**Now coupled to M12** — the wizard is where the parent account is born; build
M12's model first (or together) so the wizard creates a real account, not just
a device password.

</details>

### M12 ✅ Slice B SHIPPED 2026-06-17 — Parent/Admin account is the access model
**Slice A** (QA panel) shipped 2026-06-16; **Slice B + M4** shipped together
2026-06-17. The latent `parent` role is now the real access model: one-unlock
parent mode (`src/bridge/parentMode.ts` — role OR password elevation, 15-min
timeout, survives navigation, drops on logout), the parent account is born in the
M4 wizard (`createParentAccount` — its password IS the `parentPassword`), kids get
only the unprotected תצוגה tab, and the `gameUnlockOverride` toggle is the
parent-facing "פתיחת כל התכנים" (opens Home tiles + expression tier read-time).
**Migration:** existing devices keep working via the password elevation path — we
do NOT fabricate a named parent on them (no name source without the wizard); the
device `parentPassword` stays the credential. **Decisions resolved with the user:**
elevation (not profile-switch); QA panel ships public; **`manager` deferred to
M5/M13**; create the parent account now but let the parent choose name+password
(the wizard). See `[[project_m12b_m4_parent_account]]`.

<details><summary>Original design (2026-06-14)</summary>

### M12 🟢 Parent/Admin account — own the protected "backend" area (design 2026-06-14)
**Goal (user, 2026-06-14):** promote the protected/parent area from a bare
per-device *password* into a first-class **parent/admin account** that owns all
the "backend" functions — everything currently password-gated — created in the
M4 setup wizard. The original trigger was wanting a parent-side "unlock games
for testing" affordance (see sub-item below); that belongs on this account.

**Big realisation — most of the model already exists, just isn't wired to
access.** `src/bridge/auth.ts` users already carry a `role`
(`student` | `parent` | `manager`), there's an `isParentOrManager()` helper, and
`UsersTab` can already flag a profile as `parent`. But **today's gating ignores
role** — `useParentPassword`/`SettingsPage` only check the per-device
`parentPassword` hash (Tier 2). So this is "promote the latent role into the
real access model," not build-from-scratch.

**Proposed model (client-only — NOT §6 security; recommended defaults, forks
flagged):**
- **One parent/admin account per device**, role `parent`, created by the M4
  wizard (name + password). Its password IS the `parentPassword` hash — one
  credential, no second secret. `manager` stays **reserved** for the future
  project-owner/global admin that the M5 word-review pipeline needs (don't
  conflate the two).
- **Access = password-elevation tied to the account, NOT profile-switching.**
  Kids and parent share the device; entering the parent password elevates the
  *current* session into "parent mode" for a timeout window, without logging the
  kid out. (Recommended over "log in as the parent user" — far less friction on
  a shared tablet. Fork: if you'd rather a hard profile switch, say so.)
- **What the account owns (the whole protected surface, in one place):** all
  parent-gated Settings tabs (game / advanced / expressions / users / כלי הורה),
  the M6 תחזוקה card (logs + reset), the M5 custom-words submission, the
  `/parent-guide`, and the **QA/testing panel** below. Single "parent area"
  entry point, role-gated.
- **Migration (no lockout):** existing devices have a `parentPassword` hash but
  no parent *user*. On first parent-mode entry post-update, if a hash exists and
  no `parent` user does, auto-create one wrapping it (or treat the device
  password as the account credential). Untouched for devices that re-run the
  wizard. Mirror the Tier-2 "covers existing devices, no migration step" promise.
- **Still client-only:** every check is devtools-bypassable; this is
  organisation/UX, not real secrecy. Real multi-device parent identity + true
  enforcement = the §6 Tier-3 backend (fold in there if/when it happens).

**Sub-item (the original ask) — ✅ QA / "unlock for testing" panel — SHIPPED
2026-06-16 (M12 Slice A).** `QATestingPanel` in the parent-gated כלי הורה tab
(`AdvancedToolsTab`), driven by new `src/bridge/qa.ts`. Levers, all on the CURRENT
user's live engine progress: **seed +10/+30/+50/all learned words** (3 correct
`recordWordAttempt`s each → derived-learned, which also fills the word POOL so
gated vocab games are actually playable), **פתיחת טירת ביטויים** (seeds to the
50-word `getExpressionUnlock` gate — there is NO flag, the gate is derived), and
**פתיחת כל המשחקים** (force-flips every `gameUnlocks` entry, the only way past the
topic-gated fill-blanks/scramble/grammar). A live readout shows introduced /
learned / bank / expressions-state; **ניקוי** undoes the seed (keeps ABC + scores).
Ships to the **public site** (decision 2026-06-16), gated by the parent password.
GOTCHA fixed along the way: `ProgressManager.initialize` only shares
`wordMastery`/`learnedWords`/`gameUnlocks` with `userProgress` *by reference* when
the key already exists, and `migrateUserProgress` (v4 path) doesn't ensure
`wordMastery` — so `bridge/qa.ts` `commit()` re-points the three collections onto
`userProgress` before `saveUserProgress()`. Tests: `src/bridge/__tests__/qa.test.ts`
(6) + `react-routes.spec.js` "QA panel seeds…". See `[[project_qa_testing_panel]]`.
Slice A is the standalone first step; Slice B = M12 role-as-access + migration,
Slice C = M4 wizard + `/parent-guide`.

**Decisions still needed from the user:** (a) elevation vs hard profile-switch
(recommended: elevation); (b) does the QA panel ship to the public site or only
a dev build; (c) whether `manager`/project-owner is in scope now or deferred
with M5. **Cost:** a medium slice — touches auth gating, the wizard (M4), the
settings entry point, and a migration; no backend. Sequence: design M12 → build
with M4 → the QA panel can land first as a thin standalone if you want the
testing unlock sooner.

</details>

### M5 🟢 Custom words without a parent API key (decision: server-assisted + share-back)
> ⚠️ **PLATFORM UPDATE (2026-06-17): host is now Cloudflare Workers (Netlify retired).**
> The "Netlify Function / Netlify Blobs" wording in M5/M13 below predates that — read it
> as the generic serverless pattern and implement on **Cloudflare Workers + R2/KV**
> instead (the bug-report backend already runs as a Worker + R2 bucket — reuse that seam).

Today `CustomWordsPanel` requires the parent's own Anthropic key
(browser-direct call). Decision — a serverless function with the project key, plus
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

### M13 🟢 Parent picture upload → review → ship to everyone (design 2026-06-14)
The image twin of M5 — crowdsource the missing/wrong vocab pictures (the C2/C3
class) from parents, owner-reviewed before they reach prod. **What already
exists:** `WordImagesPanel` + `bridge/customContent.setImageOverride` let a
parent set a per-word image **locally** (base64 data-URL or URL → the
`wordImageOverrides` map → `window.wordImageOverrides`, read synchronously by
the render path). So local upload + live preview is DONE; only the share-back
pipeline is missing. Proposed flow (shares M5's backend seam):
- (a) **Upload UI:** add a file-pick + client-side downscale/crop (e.g. ≤256px,
  re-encode to a small JPEG/WebP base64) to `WordImagesPanel` so a parent picks
  a photo for a word; it applies locally immediately (today's override path).
- (b) **Submit-to-owner:** a "שתפו את התמונה" button POSTs `{category, word,
  imageBase64, device/profile id}` to `/.netlify/functions/image-submit`, which
  stores it to **Netlify Blobs** (one entry per submission) for review. Cap
  size + rate-limit (bills/stores to the project). Parent keeps the local
  override regardless of submission state.
- (c) **Owner review:** a private list (Netlify Blobs listing — minimal admin
  page or just the dashboard/a script) shows pending images by word; approve →
  the asset is written to `img/icons/<category>/<word>.<ext>` and `imageUrl`
  added to the word in `data/categories/*` (the exact C2/C3 drop-in), then
  `netlify deploy --prod` ships it to ALL users. Reject → discard.
- (d) Automate the bake step only if volume justifies it; manual review first
  (it's kids' content + a public bundle — keep a human gate).
**Ties to M12:** the review/admin surface is `manager`-role (project owner), the
same role M5 reserves — build both review queues (words + images) on one
backend seam. Still client-trust on the parent side; not §6 security.

### M14 ✅ Word Journey Discover spam-through (SHIPPED 2026-06-14)
Stage 1 (Discover) only gated "next" behind a 1.4s dwell timer — kids who
remember the pictures tapped through without listening/reading. Replaced the
timer with a **listen-gate** (mirrors Vocabulary's `REQUIRED_PLAYS_BEFORE_REVEAL`
idea): `REQUIRED_LISTENS = 2` — the auto-play on entry is listen #1, the child
taps the speaker once more to enable "next". Friendly progress hint
(`wj-discover-listen-hint`, `nk()`-wrapped) shows what to do; anti-softlock
fallback advances if a tiny `audioPlaysAllowed` budget runs out first. User
picked "listen twice" (over 3× / one-tap). Reading can't be machine-verified;
the dwell-to-listen is the proxy. Test updated in `wj-step1.spec.js`; nikud map
+3.

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
- **M9c diagnostics (phone log 21:29Z, M9b bundle):** the PHONE never gets a
  single result — every attempt (and its M9b retry) ends silently ~2.5s in
  with NO error event at all, which points at the device's Google speech
  service failing internally (our green dot only proves the browser opened
  the mic). Added permanent recognition lifecycle logging
  (audiostart/soundstart/speechstart/nomatch/…) so the next log shows WHERE
  the pipeline dies. User checks: does Google voice search itself work in
  Chrome on the phone? Google app → Permissions → Microphone; update
  "Speech Recognition & Synthesis" from Play Store.
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

### M10 ✅ Say-it games accepted wrong words (SHIPPED 2026-06-14)
ABC say-letter, Phonics say-sound, and Word Journey say-word all shared one
over-lenient matcher — `said.includes(target) || target.includes(said) ||
levenshtein ≤ 2` — which accepted whole wrong words ("beach" for "peach": the
two are even sibling words under the same `ea` sound), bare fragments ("ee"
for the letter B), and nearly any short utterance against the tiny ABC
phonetics ("see"/C scored as "bee"/B). **Audit result: those 3 were broken;
Pronunciation + Practice were already fine** (they use
`speechManager.comparePronunciation` — exact short-circuit, first-letter gate,
short-word scaling, 0.7 bar). Fix: new pure `src/lib/speechMatch.ts`
`isBalancedSpeechMatch()` mirroring comparePronunciation's principles
(first-letter gate is what kills beach/peach + bee/see; numeral fold built in
for WJ), wired into `bridge/abc.ts` (aliases=[bare letter]), `bridge/phonics.ts`,
and `SayWordStage.tsx`; per-game local `levenshtein` helpers deleted. User
picked the **Balanced** calibration (reject wrong words, still forgive ASR
noise; an occasional real attempt may need a retry). Pinned:
`src/lib/__tests__/speechMatch.test.ts` (9 cases incl. the exact reported
false-accepts). FOLLOW-UP: converge comparePronunciation (legacy JS) onto this
module so there's one matcher; left separate for now to avoid disturbing the
on-device-proven Pronunciation/Practice path.

### M11 ✅ TTS read emojis aloud (SHIPPED 2026-06-14)
The owl mascot encouragement bubbles end with an emoji (🔥/🌟/🚀); the bubble
keeps it visually but `speakHebrew(message)` voiced the whole string, so TTS
read the emoji name ("...ממשיכים star"). Fixed at the speak boundary: new
`src/lib/stripEmoji.ts` `stripSpeechEmoji()` (Extended_Pictographic + keycap/
ZWJ/skin-tone/variation-selector handling) applied in `bridge/audio.ts`
`speak`/`speakHebrew`, with a mirrored safety-net strip in `speechSynthesis.js`
`speak()` (legacy chokepoint can't import the TS module — keep the two regexes
in sync). Display text untouched. Tests: `src/lib/__tests__/stripEmoji.test.ts`.

### M15 ✅ "Blank images" = newer emoji tofu — FIXED 2026-06-16
**Cure shipped: a `unicode-range`-scoped web font** (chose a variant of option (b),
NOT the per-word images of (a)). `src/styles/fonts/emoji-fix.woff2` = a 310 KB
subset of Noto Color Emoji holding ONLY the risky glyphs; `@font-face` in
`globals.css` scopes it with `unicode-range` (U+1FA70–1FAFF + the used 1F9xx), and
`'EmojiFix'` is appended to `--font-ui`/`--font-display` (`tokens.css`). The
browser uses it for exactly those codepoints on every device, leaving all other
emoji/text on the system font — **zero changes to the ~14 emoji render sites, no
logic risk**, and the whole U+1FA70–1FAFF block is covered so future words in it
just work. Verified: font loads, covers the in-range glyphs (chair/donkey),
EmojiFix is in the `#react-root` stack. Vite content-hashes the woff2 (one copy,
dev + build). Full how/regen: **`docs/emoji-tofu-fix.md`**. (The earlier Picture
Match `onError`→emoji fallback still stands for broken image *files* — a different
case.)

<details><summary>Original diagnosis (2026-06-14)</summary>

Reported: some answer tiles show as blank images. **Audited the whole catalog:**
- All 95 unique `imageUrl` paths in `data/` exist on disk **with correct case**
  (checked case-sensitively because Netlify/Linux is case-sensitive — a common
  "works locally, blank on deploy" trap; clean here). So it's NOT broken asset paths.
- **Zero** words lack both `image` and `imageUrl` — so no true 🔤-fallback cases.
- **50 words use a Unicode-12+ emoji** (block U+1FA70–1FAFF: 🪑🪨🫏🫁🩸🫘🪓🪟…).
  Older **Android** system emoji fonts can't render these → they show as blank
  "tofu" boxes. **This is the most likely cause of the device-only blank tiles.**
  Full list generated by the audit (in this session's transcript) — e.g. chair/desk
  🪑, stone/gravel 🪨, donkey 🫏, lung 🫁, blood 🩸, axe 🪓, window/curtain 🪟,
  ladder 🪜, accordion 🪗, parachute 🪂, etc., across ~20 category files.

Done this session:
- ✅ **`onError`→emoji fallback in Picture Match** (`OptionPicture`, the only game
  whose *answers* are images) so a broken image **file** never shows blank. NOTE:
  this does NOT cure the emoji-tofu case (emoji is text, not an `<img>`). The other
  6 games render the picture as the *prompt*, not the answer — same `onError` is a
  cheap follow-up there if wanted.

The real cure for the emoji tofu (decision needed):
- **(a) Replace the 50 risky emoji with real images** — add `imageUrl` PNGs (e.g.
  Twemoji's freely-licensed PNGs are tiny) for those words; deterministic across all
  devices, ships via the existing build asset copy. Most reliable; ~50 small assets.
- **(b) Bundle an emoji webfont** (Twemoji/Noto subset) so ALL emoji render
  identically regardless of system font — broad fix but Noto Color Emoji is ~10 MB
  (need a subset/SVG strategy); heavier.
- **(c) Swap each risky emoji for an older-Unicode near-equivalent** — cheapest but
  changes the picture's meaning; not recommended for a vocab app.
Recommended: **(a)** — bounded, deterministic, reuses the C2/C3 / M13 image path.

</details>

### Pre-existing (NOT MOBILE1) — unrelated smoke failures
`smoke.spec.js` "continue CTA target is stable across loads (FU-HOME-continue)"
+ "10 learned words + ABC mastery: unlocks Reading" fail on the baseline
(confirmed by stashing — independent of M10/M11). Likely a test session-expiry-
on-reload timing issue, not a product regression. Worth a separate look.

---

### Suggested order
**MOBILE1 first — it's what the live play-test surfaced:** M1✅ → M6✅ → M9✅ →
M10✅ → M11✅ → M2✅ → M3✅ done. **M12 Slice A (QA panel)✅**, **M12 Slice B + M4
(parent account + wizard + one-unlock + expose-all + kid settings + guide)✅** done.
Remaining: M7 (tablet TTS — likely just the device Hebrew-voice install)
→ M8 (PWA install button) → M5 (needs the Netlify function + project key, and
its `manager` role overlaps M12). Then the milestone-cert bug (clear fix, but
needs the recalibration decision first) → E2E backfill for the mic/WJ paths
(stub now exists) → polish grab-bag as time allows. C2/C3 unblock the moment
you drop the two images.
