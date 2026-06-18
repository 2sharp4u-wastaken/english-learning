import { useCallback, useEffect, useState } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, playAnswerSfx, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import { useNikud } from '@/bridge/nikud'
import {
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  normalizeSpokenNumerals,
  startPronunciationRecording,
  stopPronunciationRecording,
} from '@/bridge/pronunciation'
import { useMicPlayback } from '@/features/games/shared/useMicPlayback'
import { isBalancedSpeechMatch } from '@/lib/speechMatch'
import { cn } from '@/lib/cn'
import { POINTS, type WJWord } from '@/bridge/word-journey'

interface Props {
  words: WJWord[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 4 — say the word (pronunciation-game shape). Compares the transcript
 *  to the target and records the attempt under word-journey. */
export function SayWordStage({ words, onAnswer, onComplete }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const nk = useNikud()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'awaiting' | 'recording' | 'answered'>('awaiting')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [feedback, setFeedback] = useState<{ variant: 'correct' | 'incorrect'; text: string } | null>(null)
  // Object URL for the captured mic blob — kids tap "שמע את עצמך" to replay it.
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const supported = isSpeechRecognitionAvailable()
  const mic = useMicPlayback()
  const word = words[index]

  useEffect(() => {
    setPhase('awaiting')
    setTranscript(null)
    setIsCorrect(false)
    setFeedback(null)
    setRecordingUrl(null)
    mic.release()
    // Deferred auto-play (StrictMode-safe — see DiscoverStage).
    const playId = window.setTimeout(() => {
      void speakWord(word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
    }, 200)
    return () => {
      window.clearTimeout(playId)
      cancelSpeech()
      if (isCurrentlyRecording()) void stopPronunciationRecording()
    }
  }, [word, mic])

  const advance = useCallback(() => {
    if (index + 1 < words.length) setIndex((i) => i + 1)
    else onComplete()
  }, [index, words.length, onComplete])

  const record = async () => {
    if (!supported || phase !== 'awaiting') return
    cancelSpeech()
    mic.release()
    setRecordingUrl(null)
    setPhase('recording')
    // Capture the mic in parallel with recognition so the child can replay their
    // voice. Silent if unsupported/denied — recognition still drives scoring.
    await mic.start()
    let result: { transcript: string }
    try {
      result = await startPronunciationRecording()
    } catch {
      void mic.stop()
      setPhase('awaiting')
      return
    }
    setRecordingUrl(await mic.stop())
    // Balanced match (M10): the first-letter gate stops a near-homophone like
    // "bat" passing for "cat"; numeral folding (19↔nineteen) is built in.
    const correct = isBalancedSpeechMatch(word.word, result.transcript || '')
    // Show the numeral-normalized form ("19" → "nineteen") so the "אמרת" line
    // reads consistently with how the answer was scored.
    const said = normalizeSpokenNumerals((result.transcript || '').toLowerCase().trim())
    setTranscript(said.length > 0 ? said : '(לא זוהה)')
    setIsCorrect(correct)
    setPhase('answered')
    const fb = getGameFeedback('word-journey', correct ? 'correct' : 'incorrect')
    setFeedback({ variant: correct ? 'correct' : 'incorrect', text: fb.text })
    onAnswer(word, correct, correct ? POINTS.say : 0)
    playAnswerSfx(correct ? 'correct' : 'incorrect')
    // Do NOT auto-advance on a correct answer: the child taps "הבא" when ready, so
    // they always get the chance to replay their recording ("שמע את עצמך") first —
    // for a right answer just as much as a wrong one.
    if (correct) {
      if (getShowConfetti()) triggerConfetti('wj-say-word')
    } else {
      void speakWord(word.word.toLowerCase(), 'word-journey', { allowOverlap: true })
    }
  }

  const stop = async () => {
    if (isCurrentlyRecording()) {
      try {
        await stopPronunciationRecording()
      } catch {
        /* ignore */
      }
    }
  }

  const hebrew = showNikud ? word.hebrew : stripNikud(word.hebrew)
  const displayWord = caseMode === 'lowercase' ? word.word.toLowerCase() : word.word.toUpperCase()
  const recording = phase === 'recording'

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p dir="rtl" className="wj-stage-counter text-center text-sm font-medium text-[color:var(--slate-300)]">
        {nk('פריט')} {index + 1} {nk('מתוך')} {words.length}
      </p>
      <div className="game-twopane flex flex-1 flex-col gap-4">
        <div className="game-twopane-prompt flex flex-col items-center">
          <MediaPromptCard
            prompt={phase === 'answered' ? undefined : 'לחצו על המיקרופון ואמרו את המילה'}
            media={<WordJourneyPicture word={word} />}
            word={displayWord}
            translation={hebrew || undefined}
            onPlayAudio={() => void speakWord(word.word.toLowerCase(), 'word-journey')}
            audioDisabled={recording}
            audioLabel="השמע מילה"
            audioIconOnly
          />
        </div>
        <div className="game-twopane-interaction flex flex-1 flex-col gap-4">
      {/* Once answered the mic is disabled (no re-record until "next"), so the big
       * size-20 button + status line are dead weight that pushed the result card +
       * "next" below the fold on short/narrow phones (issue #29). Hide them then —
       * the result card carries replay/next. */}
      {phase !== 'answered' ? (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => (recording ? void stop() : void record())}
          disabled={!supported}
          data-testid="wj-say-record"
          aria-label={recording ? 'עצור הקלטה' : 'התחל הקלטה'}
          className={cn(
            'flex size-20 items-center justify-center rounded-full font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50',
            recording
              ? 'animate-pulse bg-gradient-to-br from-rose-500 to-rose-700'
              : 'bg-gradient-to-br from-[color:var(--blue-400)] to-[color:var(--mint-400)] text-[color:var(--ink-950)] hover:brightness-110',
          )}
        >
          {recording ? <MicOff className="size-8" aria-hidden /> : <Mic className="size-8" aria-hidden />}
        </button>
        <p dir="rtl" className="text-sm font-medium text-[color:var(--slate-300)]">
          {nk(
            recording
              ? 'מקליט… לחצו שוב לעצירה'
              : supported
                ? 'לחצו על המיקרופון'
                : 'הדפדפן אינו תומך בזיהוי דיבור',
          )}
        </p>
      </div>
      ) : null}
      {phase === 'answered' && transcript !== null ? (
        <section
          data-testid="wj-say-result"
          className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-4 backdrop-blur"
        >
          <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
            <span>{nk('המילה')}</span>
            <span dir="ltr" className="font-display text-lg font-bold text-white">
              {displayWord}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
            <span>{nk('אמרת')}</span>
            <span
              dir="ltr"
              className={cn('font-display text-lg font-bold', isCorrect ? 'text-emerald-300' : 'text-rose-300')}
            >
              {transcript}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void speakWord(word.word.toLowerCase(), 'word-journey')}
              aria-label="השמע מילה שוב"
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--blue-400)] to-[color:var(--mint-400)] px-4 py-2 text-sm font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
            >
              <Volume2 className="size-4" aria-hidden />
              {nk('השמע שוב')}
            </button>
            {recordingUrl ? (
              <button
                type="button"
                onClick={() => {
                  if (!recordingUrl) return
                  cancelSpeech()
                  const audio = new Audio(recordingUrl)
                  audio.play().catch(() => {})
                }}
                data-testid="wj-say-hear-self"
                aria-label="שמע את עצמך"
                className="flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-white/15"
              >
                <Mic className="size-4" aria-hidden />
                {nk('שמע את עצמך')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
          {phase === 'answered' ? (
            <button
              type="button"
              onClick={advance}
              data-testid="wj-say-next"
              className="mx-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
            >
              <Volume2 className="size-4" aria-hidden />
              {nk('הבא')}
            </button>
          ) : null}
        </div>
      </div>
      {feedback ? <FeedbackBanner variant={feedback.variant} message={feedback.text} visible /> : null}
    </div>
  )
}
