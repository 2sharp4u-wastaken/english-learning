# English Learning Game v2 — Design System Audit

> Pre-overhaul baseline captured before the `ui-overhaul` branch redesign (March 2026).
> Use this as a reference when comparing old vs new design decisions.

---

## Color Palette & Gradients

**Primary Gradient** (main brand):
```css
--primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
```

**Secondary Gradients**:
```css
--secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
--success-gradient:   linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)
--warm-gradient:      linear-gradient(135deg, #fa709a 0%, #fee140 100%)
```

**Semantic Colors**:
```css
--primary-color:   #667eea   /* Purple */
--primary-dark:    #5a67d8
--secondary-color: #f5576c   /* Red */
--success-color:   #48bb78   /* Green */
--warning-color:   #ed8936   /* Orange */
```

**Glass Effect**:
```css
--glass-bg:     rgba(255, 255, 255, 0.15)
--glass-border: rgba(255, 255, 255, 0.25)
--glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37)
```

**Body Background**: Primary gradient with animated floating particles.

---

## Typography

- **Font**: `'Poppins'`, weights 300/400/600/700/800
- **Heading sizes**: 2rem–3.5rem
- **Body**: 1rem–1.2rem
- **English word display**: 3rem

---

## Spacing & Radius Tokens

```css
--spacing-xs: 8px  --spacing-sm: 12px  --spacing-md: 20px
--spacing-lg: 30px --spacing-xl: 40px

--radius-sm: 8px  --radius-md: 12px  --radius-lg: 20px  --radius-xl: 30px
```

---

## Shadow Scale

```css
--shadow-sm: 0 2px 8px rgba(0,0,0,0.1)
--shadow-md: 0 4px 16px rgba(0,0,0,0.12)
--shadow-lg: 0 8px 32px rgba(0,0,0,0.15)
--shadow-xl: 0 16px 48px rgba(0,0,0,0.2)
```

---

## Layout Structure

**Two-column flex layout** (`app-layout`):
- Left: `main-content` (flex: 1) — game area + welcome screen
- Right: `sidebar` (300px) — glassmorphic, user selector + nav

**Sidebar** uses `backdrop-filter: blur(20px)` frosted glass.
**Game area** also uses glassmorphism with `blur(20px)`.

---

## Welcome Screen Components

### Tier Organization
Four tiers, each a `.tier-section[data-tier]`:

| Tier | Badge Color | Games |
|------|-------------|-------|
| `learn` | `rgba(16,185,129,0.7)` — green | Word Journey, ABC |
| `practice` | `rgba(59,130,246,0.7)` — blue | Listening, Picture Match, True/False, Memory, Grammar-Beginner |
| `challenge` | `rgba(245,158,11,0.7)` — amber | Reading, Pronunciation, Fill Blanks, Story Time, Word Builder, Scramble |
| `test` | `rgba(239,68,68,0.7)` — red | Vocabulary |

### Game Card
```css
.game-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
  box-shadow: 0 4px 15px rgba(102,126,234,0.3);
}
/* All tiers use the same purple gradient — no per-tier visual identity */
```

### Continue Hero Card
```css
.continue-hero {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 16px;
  max-width: 700px;
}
```

### Streak Widget
```css
.home-streak-widget {
  background: rgba(255,255,255,0.18);
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 40px;
  /* Glass pill on dark background */
}
```

---

## Component Files

| File | Purpose |
|------|---------|
| `components/top-header.js` | Injects `<header>` — logo, back btn, score, coins, case toggle, nikud toggle, stats/settings links, user info |
| `components/header-score.js` | Score/coin updater for non-home pages |
| `components/practice-indicator.js` | Struggling word count badge on practice button |

### Top Header Modes
- **Hub mode**: logo visible, back button hidden, score/coins/settings visible
- **Game mode**: logo hidden, back button visible, settings hidden (via `.game-active` class)

---

## Animations Inventory

```
float           — body background particles
bounce          — sidebar header icon
shine           — sidebar header glow
spin            — settings icon
chartPulse      — stats icon breathing
wiggle          — active game button
slideUp         — game area entrance
fadeIn/fadeInUp/fadeInDown — content entrances
pulse           — score badge
shimmer         — progress bar shine
soundWave       — play button hover
recordingPulse  — recording button
correctPulse    — correct answer feedback
incorrectShake  — wrong answer feedback
audioHintFocus  — audio hint bounce
micPulse        — microphone icon
gbFlash         — translation box flash
flameFlicker    — streak flame icon
```

---

## CSS Debt Notes

- `styles.css` is ~191KB — significant accumulated CSS
- CSS variables defined in `:root` but **mostly unused** (rules hardcode `#667eea` instead of `var(--primary-color)`)
- All game cards use the same purple gradient regardless of tier
- Compact layout overrides scattered throughout (`.home-compact .x` rules)
- Mixed responsive strategies (explicit `grid-template-columns` + `auto-fill` mixed inconsistently)

---

## Responsive Breakpoints

```css
@media (max-width: 1024px) { /* sidebar adjustments */ }
@media (max-width: 768px)  { /* 2-col grids, font-size: 16px */ }
@media (max-width: 480px)  { /* compact padding, 2-col tiles */ }
```

---

## Key localStorage Keys (for context)

```
currentUser              — active user ID
userProgress_<userId>    — progress, wordMastery, streak, certificates
englishLearningSettings  — app settings
authUsers                — all user accounts
customWords_global       — parent-added custom words
```
