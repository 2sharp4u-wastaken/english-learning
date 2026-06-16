import { useEffect, useState } from 'react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakHebrew, speakWord } from '@/bridge/audio'
import { getSettings } from '@/bridge/settings'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import type { WJWord } from '@/bridge/word-journey'

/** Listens required before "next" enables. The auto-play on entry counts as the
 *  first; the child must tap the speaker once more to reach it. Replaced a bare
 *  1.4s dwell timer that let kids spam "next" without ever hearing the word. */
const REQUIRED_LISTENS = 2

/** Stage 1 — passive exposure: see the word + picture, hear it (English, then
 *  Hebrew if vocalization is on). Unscored. "Next" stays disabled until the word
 *  has been heard REQUIRED_LISTENS times, so kids actually engage with the audio
 *  instead of breezing through on memory of the pictures. */
export function DiscoverStage({
  words,
  onComplete,
}: {
  words: WJWord[]
  onComplete: () => void
}) {
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [index, setIndex] = useState(0)
  // How many times the word has been heard this question (auto-play = 1).
  const [listens, setListens] = useState(0)
  // Carried-forward Slice 3.0 parity: a visible play button with a per-word
  // listen budget (the auto-play exposure is free; manual replays are capped).
  const [playsLeft, setPlaysLeft] = useState<number>(() => getSettings().audioPlaysAllowed ?? 8)
  const word = words[index]

  useEffect(() => {
    setListens(0)
    setPlaysLeft(getSettings().audioPlaysAllowed ?? 8)
    // Defer the auto-play: React 18 StrictMode mounts→unmounts→remounts effects
    // in dev, so playing immediately fires twice. A deferred timer is cancelled
    // by the intermediate cleanup, leaving exactly one play.
    const playId = window.setTimeout(() => {
      void (async () => {
        try {
          await speakWord(word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
          if (getSettings().hebrewVocalization !== false && word.hebrew) {
            await speakHebrew(word.hebrew)
          }
        } catch {
          /* ignore */
        }
      })()
      setListens((n) => Math.max(n, 1)) // the auto-play is the first listen
    }, 200)
    return () => {
      window.clearTimeout(playId)
      cancelSpeech()
    }
  }, [word])

  // Anti-softlock: if a parent set a tiny audio budget and it runs out before
  // the threshold, let them advance rather than trap them on the word.
  const canAdvance = listens >= REQUIRED_LISTENS || playsLeft <= 0

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
        {nk('פריט')} {index + 1} {nk('מתוך')} {words.length}
      </p>
      <div className="game-twopane flex flex-1 flex-col gap-4">
        <div className="game-twopane-prompt flex flex-col items-center">
          <MediaPromptCard
            prompt={showNikud ? 'הִכִּירוּ אֶת הַמִּלָּה' : 'הכירו את המילה'}
            media={<WordJourneyPicture word={word} />}
            word={displayWord}
            translation={hebrew || undefined}
            onPlayAudio={() => {
              if (playsLeft <= 0) return
              setPlaysLeft((n) => Math.max(0, n - 1))
              setListens((n) => n + 1)
              void speakWord(word.word.toLowerCase(), 'word-journey')
            }}
            audioDisabled={playsLeft <= 0}
            audioLabel="השמע מילה"
            audioHint={playsLeft > 0 ? `השמעות נותרו: ${playsLeft}` : 'נגמרו ההשמעות'}
            audioIconOnly
          />
        </div>
        <div className="game-twopane-interaction flex flex-1 flex-col gap-4">
          {!canAdvance ? (
            <p
              dir="rtl"
              data-testid="wj-discover-listen-hint"
              data-listens={listens}
              className="text-center text-sm font-semibold text-[color:var(--mint-300)]"
            >
              {nk('לחצו על הרמקול כדי לשמוע שוב')} ({listens}/{REQUIRED_LISTENS})
            </p>
          ) : null}
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            data-testid="wj-discover-next"
            className="mx-auto block rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nk(index + 1 < words.length ? 'הבא' : 'בואו נתחיל!')}
          </button>
        </div>
      </div>
    </div>
  )
}
