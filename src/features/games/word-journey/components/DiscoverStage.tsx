import { useEffect, useState } from 'react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakHebrew, speakWord } from '@/bridge/audio'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import type { WJWord } from '@/bridge/word-journey'

const MIN_DWELL_MS = 1400

/** Stage 1 — passive exposure: see the word + picture, hear it (English, then
 *  Hebrew if vocalization is on). Unscored. "Next" enables after the word is
 *  spoken and a short dwell, so kids don't skip before hearing it. */
export function DiscoverStage({
  words,
  onComplete,
}: {
  words: WJWord[]
  onComplete: () => void
}) {
  const { caseMode, showNikud } = useTextPrefs()
  const [index, setIndex] = useState(0)
  const [canAdvance, setCanAdvance] = useState(false)
  // Carried-forward Slice 3.0 parity: a visible play button with a per-word
  // listen budget (the auto-play exposure is free; manual replays are capped).
  const [playsLeft, setPlaysLeft] = useState<number>(() => getSettings().audioPlaysAllowed ?? 8)
  const word = words[index]

  useEffect(() => {
    setCanAdvance(false)
    setPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    let cancelled = false
    const dwell = new Promise((r) => setTimeout(r, MIN_DWELL_MS))
    const speak = (async () => {
      try {
        await speakWord(word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
        if (getSettings().hebrewVocalization !== false && word.hebrew) {
          await speakHebrew(word.hebrew)
        }
      } catch {
        /* ignore */
      }
    })()
    void Promise.all([dwell, speak]).then(() => {
      if (!cancelled) setCanAdvance(true)
    })
    return () => {
      cancelled = true
      cancelSpeech()
    }
  }, [word])

  const next = () => {
    if (index + 1 < words.length) setIndex((i) => i + 1)
    else onComplete()
  }

  const displayWord = caseMode === 'lowercase' ? word.word.toLowerCase() : word.word.toUpperCase()
  const hebrew = showNikud ? word.hebrew : stripNikud(word.hebrew)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p
        dir="rtl"
        data-testid="wj-discover-counter"
        data-item={index + 1}
        className="text-center text-sm font-medium text-[color:var(--slate-300)]"
      >
        פריט {index + 1} מתוך {words.length}
      </p>
      <MediaPromptCard
        prompt={showNikud ? 'הִכִּירוּ אֶת הַמִּלָּה' : 'הכירו את המילה'}
        media={<WordJourneyPicture word={word} />}
        word={displayWord}
        translation={hebrew || undefined}
        onPlayAudio={() => {
          if (playsLeft <= 0) return
          setPlaysLeft((n) => Math.max(0, n - 1))
          void speakWord(word.word.toLowerCase(), 'word-journey')
        }}
        audioDisabled={playsLeft <= 0}
        audioLabel="השמע מילה"
        audioHint={playsLeft > 0 ? `השמעות נותרו: ${playsLeft}` : 'נגמרו ההשמעות'}
        audioIconOnly
      />
      <button
        type="button"
        onClick={next}
        disabled={!canAdvance}
        data-testid="wj-discover-next"
        className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {index + 1 < words.length ? 'הבא' : 'בואו נתחיל!'}
      </button>
    </div>
  )
}
