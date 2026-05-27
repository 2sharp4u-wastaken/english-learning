import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { speakHebrew } from '@/bridge/audio'

interface HomeMascotProps {
  streakDays: number
  wordsLearned: number
}

/** Pick a Hebrew encouragement based on the child's current progress. */
function buildMessage(streakDays: number, wordsLearned: number): string {
  if (streakDays >= 2) return `כל הכבוד! ${streakDays} ימים ברצף! 🔥`
  if (wordsLearned >= 1) return `כבר למדת ${wordsLearned} מילים! ממשיכים? 🌟`
  return 'יאללה, בוא נלמד מילים חדשות! 🚀'
}

// font-size drives the emoji size. It's an inline style (not a Tailwind class)
// on purpose: `#react-root button { font: inherit }` outspecifies utility
// classes, so a `text-*` class on the button would be ignored and the owl
// would shrink to the inherited base size.
const OWL_SIZE = 'clamp(3.5rem, 9vw, 5.25rem)'

const IDLE = {
  y: [0, -6, 0],
  rotate: [0, -3, 3, 0],
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
}

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
 * Home page owl mascot. Idle-floats continuously; on tap it does a bouncy
 * cheer with a sparkle burst, pops an encouragement bubble keyed to the
 * child's streak/words, and speaks it aloud — a reactive mascot, not a static
 * emoji.
 */
export function HomeMascot({ streakDays, wordsLearned }: HomeMascotProps) {
  const controls = useAnimationControls()
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const [cheerKey, setCheerKey] = useState(0)
  const bubbleTimer = useRef<number | null>(null)
  const message = buildMessage(streakDays, wordsLearned)

  useEffect(() => {
    void controls.start(IDLE)
    return () => {
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    }
  }, [controls])

  const handleTap = useCallback(() => {
    setBubbleVisible(true)
    setCheerKey((k) => k + 1)
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubbleVisible(false), 3800)
    void speakHebrew(message).catch(() => {})
    void (async () => {
      await controls.start({
        scale: [1, 1.3, 0.95, 1.12, 1],
        rotate: [0, -16, 12, -6, 0],
        y: [0, -18, 0],
        transition: { duration: 0.7, ease: 'easeInOut' },
      })
      void controls.start(IDLE) // resume the idle float
    })()
  }, [controls, message])

  return (
    <div className="relative shrink-0">
      <motion.button
        type="button"
        onClick={handleTap}
        data-testid="home-mascot"
        aria-label="לחץ לעידוד מהינשוף"
        className="relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-white/15 to-white/5 shadow-glow sm:size-28"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
      >
        {/* pulsing glow ring */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(99,230,198,0.45)',
              '0 0 0 16px rgba(99,230,198,0)',
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <motion.span
          aria-hidden
          animate={controls}
          style={{ fontSize: OWL_SIZE, lineHeight: 1, display: 'inline-block' }}
        >
          🦉
        </motion.span>
        <AnimatePresence>{cheerKey > 0 ? <SparkleBurst key={cheerKey} /> : null}</AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {bubbleVisible ? (
          <motion.div
            dir="rtl"
            data-testid="home-mascot-bubble"
            initial={{ opacity: 0, y: -6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="absolute start-0 top-full z-10 mt-2 w-max max-w-[min(15rem,75vw)] rounded-2xl border border-white/10 bg-surface px-4 py-2 text-center text-sm font-semibold text-text shadow-panel"
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
