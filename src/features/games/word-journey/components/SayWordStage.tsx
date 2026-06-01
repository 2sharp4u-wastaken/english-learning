import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { MediaPromptCard } from '@/features/games/shared/MediaPromptCard'
import { FeedbackBanner } from '@/features/games/shared/FeedbackBanner'
import { WordJourneyPicture } from './WordJourneyPicture'
import { cancelSpeech, speakWord } from '@/bridge/audio'
import { getGameFeedback, getShowConfetti, playAnswerSfx, triggerConfetti } from '@/bridge/feedback'
import { stripNikud, useTextPrefs } from '@/bridge/textPrefs'
import {
  isCurrentlyRecording,
  isSpeechRecognitionAvailable,
  startPronunciationRecording,
  stopPronunciationRecording,
} from '@/bridge/pronunciation'
import { useMicPlayback } from '@/features/games/shared/useMicPlayback'
import { cn } from '@/lib/cn'
import { POINTS, type WJWord } from '@/bridge/word-journey'

const ADVANCE_MS = 1400

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

interface Props {
  words: WJWord[]
  onAnswer: (word: WJWord, isCorrect: boolean, points: number) => void
  onComplete: () => void
}

/** Stage 4 — say the word (pronunciation-game shape). Compares the transcript
 *  to the target and records the attempt under word-journey. */
export function SayWordStage({ words, onAnswer, onComplete }: Props) {
  const { caseMode, showNikud } = useTextPrefs()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'awaiting' | 'recording' | 'answered'>('awaiting')
  const [transcript, setTranscript] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [feedback, setFeedback] = useState<{ variant: 'correct' | 'incorrect'; text: string } | null>(null)
  // Object URL for the captured mic blob — kids tap "שמע את עצמך" to replay it.
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const supported = isSpeechRecognitionAvailable()
  const advanceTimer = useRef<number | null>(null)
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
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
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
    const said = (result.transcript || '').toLowerCase().trim()
    const expected = word.word.toLowerCase()
    const correct =
      said.length > 0 &&
      (said.includes(expected) || expected.includes(said) || levenshtein(said, expected) <= 2)
    setTranscript(result.transcript || '(לא זוהה)')
    setIsCorrect(correct)
    setPhase('answered')
    const fb = getGameFeedback('word-journey', correct ? 'correct' : 'incorrect')
    setFeedback({ variant: correct ? 'correct' : 'incorrect', text: fb.text })
    onAnswer(word, correct, correct ? POINTS.say : 0)
    playAnswerSfx(correct ? 'correct' : 'incorrect')
    if (correct) {
      if (getShowConfetti()) triggerConfetti()
      advanceTimer.current = window.setTimeout(advance, ADVANCE_MS)
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
      <p dir="rtl" className="text-center text-sm font-medium text-[color:var(--slate-300)]">
        פריט {index + 1} מתוך {words.length}
      </p>
      <MediaPromptCard
        prompt="לחצו על המיקרופון ואמרו את המילה"
        media={<WordJourneyPicture word={word} />}
        word={displayWord}
        translation={hebrew || undefined}
        onPlayAudio={() => void speakWord(word.word.toLowerCase(), 'word-journey')}
        audioDisabled={recording}
        audioLabel="השמע מילה"
        audioIconOnly
      />
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => (recording ? void stop() : void record())}
          disabled={phase === 'answered' || !supported}
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
          {recording
            ? 'מקליט… לחצו שוב לעצירה'
            : phase === 'answered'
              ? 'התוצאה מוכנה'
              : supported
                ? 'לחצו על המיקרופון'
                : 'הדפדפן אינו תומך בזיהוי דיבור'}
        </p>
      </div>
      {phase === 'answered' && transcript !== null ? (
        <section className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border border-white/10 bg-[color:var(--ink-900)]/70 p-4 backdrop-blur">
          <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
            <span>המילה</span>
            <span dir="ltr" className="font-display text-lg font-bold text-white">
              {displayWord}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-[color:var(--slate-300)]">
            <span>אמרת</span>
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
              השמע שוב
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
                שמע את עצמך
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {phase === 'answered' && !isCorrect ? (
        <button
          type="button"
          onClick={advance}
          data-testid="wj-say-next"
          className="mx-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--mint-400)] to-[color:var(--blue-400)] px-8 py-3 text-base font-bold text-[color:var(--ink-950)] shadow-md transition hover:brightness-110"
        >
          <Volume2 className="size-4" aria-hidden />
          הבא
        </button>
      ) : null}
      {feedback ? <FeedbackBanner variant={feedback.variant} message={feedback.text} visible /> : null}
    </div>
  )
}
