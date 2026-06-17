import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { speakHebrew } from '@/bridge/audio'
import { usePlayerPrefs } from '@/hooks/usePlayerPrefs'
import { MASCOTS } from '@/bridge/playerPrefs'

interface HomeMascotProps {
  streakDays: number
  wordsLearned: number
  /** 'lg' (default) is the original hero size; 'sm' is the compact home-band size. */
  size?: 'sm' | 'lg'
}

// A rotating pool of gender-neutral Hebrew encouragements (the mascot says more
// than one line now). Progress-aware lines are added when they apply.
const GENERIC_PHRASES = [
  'יאללה, מתחילים! 🚀',
  'איזה כיף ללמוד! 🌟',
  'כל מילה חדשה היא הצלחה! 💪',
  'כל הכבוד! 🎉',
  'בואו נשחק ונלמד! 🎮',
  'אלופים אמיתיים! ⭐',
  'עוד קצת ונהיה מומחים! 🧠',
  'מצוין! ממשיכים! ✨',
  'אנגלית זה קסם! 🪄',
  'מקשיבים, חוזרים — וזוכרים! 🎤',
  'איזה יופי! עוד מילה? 📚',
  'הדמיון שלכם מדהים! 🌈',
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build the candidate-phrase pool (progress-aware lines + the generic pool). */
function phrasePool(streakDays: number, wordsLearned: number): string[] {
  const pool = [...GENERIC_PHRASES]
  if (streakDays >= 2) pool.push(`כל הכבוד! ${streakDays} ימים ברצף! 🔥`)
  if (wordsLearned >= 1) pool.push(`כבר למדנו ${wordsLearned} מילים! ממשיכים? 🌟`)
  return pool
}

// font-size drives the emoji size. It's an inline style (not a Tailwind class)
// on purpose: `#react-root button { font: inherit }` outspecifies utility
// classes, so a `text-*` class on the button would be ignored and the owl
// would shrink to the inherited base size.
const OWL_SIZE = {
  lg: 'clamp(3.5rem, 9vw, 5.25rem)',
  sm: 'clamp(2.25rem, 6vw, 3rem)',
} as const

const IDLE = {
  y: [0, -6, 0],
  rotate: [0, -3, 3, 0],
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
}

// A few distinct tap reactions so the character doesn't just do the same spin
// every time — it feels alive (beta feedback: "more lively, not just rotating").
// One is picked at random on each tap.
const TAP_REACTIONS = [
  { scale: [1, 1.3, 0.95, 1.12, 1], rotate: [0, -16, 12, -6, 0], y: [0, -18, 0] }, // big cheer
  { scale: [1, 1.18, 1], rotate: [0, 360], y: [0, -10, 0] }, // happy spin
  { y: [0, -22, 0, -12, 0], scale: [1, 1.1, 1, 1.06, 1] }, // double hop
  { rotate: [0, -14, 14, -14, 14, 0], scale: [1, 1.1, 1] }, // excited wiggle
  { scale: [1, 1.28, 0.92, 1.1, 1], rotate: [0, 10, -10, 0] }, // nod + squash
]

const SPARKLES = ['✨', '⭐', '💫', '🌟', '⚡']

function SparkleBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {SPARKLES.map((s, i) => {
        const angle = (i / SPARKLES.length) * Math.PI * 2
        const dist = 48
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 text-lg"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [0, 1, 0],
              scale: 1.2,
            }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
          >
            {s}
          </motion.span>
        )
      })}
    </span>
  )
}

/**
 * Home page mascot. Idle-floats continuously, throws in a spontaneous little
 * wiggle now and then so it feels alive, and on tap does one of several random
 * bouncy reactions with a sparkle burst and *speaks* a fresh encouragement —
 * the lines are rotated (cycled) so consecutive taps never repeat. No on-screen
 * text bubble: the encouragement is spoken aloud only (beta feedback).
 *
 * `prefs.avatarColor` ("צבע הדמות") tints the character's halo + ring so the
 * colour choice has a visible effect on the mascot itself, not just the small
 * profile avatar.
 */
export function HomeMascot({ streakDays, wordsLearned, size = 'lg' }: HomeMascotProps) {
  const { prefs } = usePlayerPrefs()
  const controls = useAnimationControls()
  const cheerControls = useAnimationControls()
  const [cheerKey, setCheerKey] = useState(0)
  const mascotEmoji = MASCOTS[prefs.mascotCharacter] ?? '🦉'
  const accent = prefs.avatarColor || '#63e6c6'

  // Rotated phrase pool: shuffle once per progress snapshot, then cycle through
  // it so we exhaust all lines before any repeats.
  const pool = useMemo(() => shuffle(phrasePool(streakDays, wordsLearned)), [streakDays, wordsLearned])
  const phraseIdx = useRef(0)

  useEffect(() => {
    void controls.start(IDLE)
  }, [controls])

  // Spontaneous idle wiggle every 7–12s so the character looks alive between
  // taps (respecting reduced-motion).
  useEffect(() => {
    if (prefs.reducedMotion) return
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(async () => {
        await cheerControls.start({
          rotate: [0, -8, 8, -8, 0],
          scale: [1, 1.07, 1],
          transition: { duration: 0.9, ease: 'easeInOut' },
        })
        schedule()
      }, 7000 + Math.random() * 5000)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [cheerControls, prefs.reducedMotion])

  const handleTap = useCallback(() => {
    const next = pool[phraseIdx.current % pool.length]
    phraseIdx.current += 1
    setCheerKey((k) => k + 1)
    void speakHebrew(next).catch(() => {})
    const reaction = TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)]
    void (async () => {
      await controls.start({ ...reaction, transition: { duration: 0.7, ease: 'easeInOut' } })
      void controls.start(IDLE) // resume the idle float
    })()
  }, [controls, pool])

  return (
    <div className="relative shrink-0">
      <motion.button
        type="button"
        onClick={handleTap}
        data-testid="home-mascot"
        aria-label="לחצו לעידוד מהדמות"
        animate={cheerControls}
        className={
          size === 'sm'
            ? 'relative flex size-14 items-center justify-center rounded-full shadow-glow sm:size-16'
            : 'relative flex size-24 items-center justify-center rounded-full shadow-glow sm:size-28'
        }
        // Tint the halo with the chosen character colour (falls back to mint).
        style={{ background: `radial-gradient(circle at 35% 30%, ${accent}38, ${accent}0d 70%)` }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
      >
        {/* pulsing glow ring (uses the character colour) */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [`0 0 0 0 ${accent}73`, `0 0 0 16px ${accent}00`],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          aria-hidden
          animate={controls}
          style={{ fontSize: OWL_SIZE[size], lineHeight: 1, display: 'inline-block' }}
        >
          {mascotEmoji}
        </motion.span>
        <AnimatePresence>{cheerKey > 0 ? <SparkleBurst key={cheerKey} /> : null}</AnimatePresence>
      </motion.button>
    </div>
  )
}
