# Backlog — open items (single source of truth)

Consolidated 2026-06-09. This is the **one place** to look for what's left to do.
Everything in Phases 2–5, all game migrations, Slice C1, and Slices 4.0–4.6 is
**shipped** — see `master-plan.md` for that history and the *why* behind each
decision. This doc only tracks what is **not done**.

Legend: 🔴 broken/wrong · 🟡 polish/UX · 🟢 nice-to-have/feature · ⏸ parked on the user.

---

## 1. Ship beyond localhost — **Slice INFRA1** (spike, never started) 🟢

The biggest untouched item. Investigate + recommend a path; no commit until chosen.
Detail/spec: `master-plan.md` → "Slice INFRA1".
- **LAN access** — Vite `--host`; **blocker:** mic games (Pronunciation, Practice) +
  Web Speech need a *secure context*, so LAN needs the `server.crt`/`server.key`
  HTTPS path, not plain HTTP.
- **PWA** — manifest + service worker (installable + offline). Lowest-friction fit
  for a static SPA → recommended first.
- **Public deploy** — `npm run build` → static `dist/` to Netlify/Vercel/Pages. App
  is already Python-free (progress in `localStorage`), so it mostly stands alone.
- Natural partner to a **human play-test** on a real tablet.

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

---

### Suggested order
INFRA1 spike + a tablet play-test together (surfaces real-user issues) → the
milestone-cert bug (clear fix, but needs the recalibration decision first) → E2E
backfill for the mic/WJ paths (stub now exists) → polish grab-bag as time allows.
C2/C3 unblock the moment you drop the two images; G1 unblocks the moment you paste
the profiler numbers.
