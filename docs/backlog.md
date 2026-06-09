# Backlog — open items (single source of truth)

Consolidated 2026-06-09. This is the **one place** to look for what's left to do.
Everything in Phases 2–5, all game migrations, Slice C1, and Slices 4.0–4.6 is
**shipped** — see `master-plan.md` for that history and the *why* behind each
decision. This doc only tracks what is **not done**.

Legend: 🔴 broken/wrong · 🟡 polish/UX · 🟢 nice-to-have/feature · ⏸ parked on the user.

---

## 1. Ship beyond localhost — **Slice INFRA1** (spike done; path chosen: Deploy + PWA) 🟢

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
- 🟡 **Host hookup (NEXT, needs the user's account auth).** `netlify.toml` is **written
  and committed** (build `npm run build` → publish `dist`, Node 20, SPA fallback,
  immutable `/assets/*` caching, no-cache `/sw.js`+`/index.html`). All that remains is the
  live deploy, which needs the user's login: either connect the GitHub repo in the Netlify
  dashboard (auto-deploys on push) or run `netlify deploy --prod` in-session. Root-domain
  host (Netlify) chosen over GH Pages because the app fetches the absolute path
  `/data/nikud-map.json` (a `/repo/` subpath would need a Vite `base` + rewrites). PWA
  install + offline + mic games all activate once served over the host's HTTPS.
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
- 🟢 **Per-device parent password ("Tier 2", design agreed 2026-06-10).** Replace
  the hard-coded `ADMIN_PASSWORD` constant in `bridge/auth.ts` with a wizard on
  **first protected access**: no stored parent password → `ParentPasswordModal`
  opens in "create" mode (enter twice), stores it hashed in localStorage (same
  scheme as kid passwords), `verifyAdminPassword` checks the hash. One modal +
  one bridge change covers every protected surface AND existing devices (no
  first-run step, no migration). Include a **"שכחתי סיסמה" reset link** that wipes
  only the parent password (wizard re-runs next open) — a kid *could* tap it, but
  the gate is against wandering, not attack, and a no-reset design risks permanent
  lockout. Small slice: modal create-mode, bridge, gender-neutral copy + nikud,
  Playwright specs seed the stored hash instead of typing the constant (3 places).
  Buys hygiene/UX, NOT security — any client-only gate is devtools-bypassable
  (see §6 for the real fix).

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
- 🔴 **G1** — confetti animation jank + mouse-freeze on the voice-recording games.
  Known unsolved; 3 fixes tried & reverted. **Instrumented 2026-06-09:** a DEV-only
  profiler logs frame-timing + longtask data per burst when
  `window.__PROFILE_CONFETTI__ = true` (`src/bridge/confettiProfiler.ts`; labels on
  the 5 mic games + a `vocabulary` baseline). **Next:** capture numbers on a real
  device (vocabulary baseline vs a mic game), compare `worstFrameMs`/`jankyFrames`/
  `longTasks`; clean numbers + visible jank ⇒ cost is below frame-timing (OS audio
  device) ⇒ mitigate with a lighter/shorter burst on mic games, *not* another
  rendering-path change. Full analysis: `project_confetti_first_burst_lag` memory.
- 🧹 **Cleanup (post-G1):** once G1 is resolved, decide whether to strip the
  `__PROFILE_CONFETTI__` profiler + the `triggerConfetti(label)` labels or keep them
  as a permanent dev tool.

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

### Suggested order
INFRA1 spike + a tablet play-test together (surfaces real-user issues) → the
milestone-cert bug (clear fix, but needs the recalibration decision first) → E2E
backfill for the mic/WJ paths (stub now exists) → polish grab-bag as time allows.
C2/C3 unblock the moment you drop the two images; G1 unblocks the moment you paste
the profiler numbers.
