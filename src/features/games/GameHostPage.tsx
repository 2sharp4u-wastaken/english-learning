import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'
import { GameScreenShell } from './shared/GameScreenShell'
import { isReactGame } from './reactGames'

// Each game is its own lazy chunk so a first-visit user only downloads the one
// game they open (Slice 4.0). Pages are named exports, so map them to `default`
// for React.lazy. Keep this record in sync with REACT_GAME_IDS in reactGames.ts.
const REACT_GAMES: Record<string, ComponentType> = {
  vocabulary: lazy(() =>
    import('./vocabulary/VocabularyGamePage').then((m) => ({ default: m.VocabularyGamePage })),
  ),
  listening: lazy(() =>
    import('./listening/ListeningGamePage').then((m) => ({ default: m.ListeningGamePage })),
  ),
  'picture-match': lazy(() =>
    import('./picture-match/PictureMatchGamePage').then((m) => ({
      default: m.PictureMatchGamePage,
    })),
  ),
  'true-or-not': lazy(() =>
    import('./true-or-not/TrueOrNotGamePage').then((m) => ({ default: m.TrueOrNotGamePage })),
  ),
  reading: lazy(() =>
    import('./reading/ReadingGamePage').then((m) => ({ default: m.ReadingGamePage })),
  ),
  'fill-blanks': lazy(() =>
    import('./fill-blanks/FillBlanksGamePage').then((m) => ({ default: m.FillBlanksGamePage })),
  ),
  scramble: lazy(() =>
    import('./sentence-scramble/SentenceScrambleGamePage').then((m) => ({
      default: m.SentenceScrambleGamePage,
    })),
  ),
  'grammar-beginner': lazy(() =>
    import('./grammar-beginner/GrammarBeginnerGamePage').then((m) => ({
      default: m.GrammarBeginnerGamePage,
    })),
  ),
  grammar: lazy(() =>
    import('./grammar/GrammarGamePage').then((m) => ({ default: m.GrammarGamePage })),
  ),
  articles: lazy(() =>
    import('./articles/ArticlesGamePage').then((m) => ({ default: m.ArticlesGamePage })),
  ),
  progressive: lazy(() =>
    import('./progressive/ProgressiveGamePage').then((m) => ({ default: m.ProgressiveGamePage })),
  ),
  pronunciation: lazy(() =>
    import('./pronunciation/PronunciationGamePage').then((m) => ({
      default: m.PronunciationGamePage,
    })),
  ),
  practice: lazy(() =>
    import('./practice/PracticeGamePage').then((m) => ({ default: m.PracticeGamePage })),
  ),
  'story-time': lazy(() =>
    import('./story-time/StoryTimeGamePage').then((m) => ({ default: m.StoryTimeGamePage })),
  ),
  'word-journey': lazy(() =>
    import('./word-journey/WordJourneyGamePage').then((m) => ({ default: m.WordJourneyGamePage })),
  ),
  memory: lazy(() =>
    import('./memory/MemoryGamePage').then((m) => ({ default: m.MemoryGamePage })),
  ),
  abc: lazy(() => import('./abc/ABCGamePage').then((m) => ({ default: m.ABCGamePage }))),
  phonics: lazy(() =>
    import('./phonics/PhonicsGamePage').then((m) => ({ default: m.PhonicsGamePage })),
  ),
}

// Retired games → bookmark-safe redirects. Slice 3.7.1 folded word-builder
// into fill-blanks (same data, same UX, single canonical game).
const RETIRED_GAMES: Record<string, string> = {
  'word-builder': 'fill-blanks',
}

export function GameHostPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const redirectTo = gameId ? RETIRED_GAMES[gameId] : undefined
  const ReactGame =
    gameId && !redirectTo && isReactGame(gameId) ? REACT_GAMES[gameId] : undefined

  useEffect(() => {
    if (!gameId || ReactGame || redirectTo) return

    window.scrollTo({ top: 0, behavior: 'auto' })
    launchGame(gameId)
  }, [gameId, ReactGame, redirectTo])

  if (redirectTo) return <Navigate to={`/game/${redirectTo}`} replace />
  if (ReactGame) {
    // `data-react-nikud-owned` marks this whole subtree as React-managed for
    // nikud: `utils/nikudDOM.js` skips anything inside it, so React (via
    // `useNikud`) is the sole owner of vowel points here. This removes the
    // nikudDOM↔React shared-DOM conflict that crashed the game on a mid-game
    // toggle (FU-4.4-nikud). `display:contents` keeps the wrapper layout-inert.
    // The marker covers every game uniformly (custom shells + LearnFirst/
    // AllMastered sub-screens included), not just GameScreenShell.
    return (
      <div data-react-nikud-owned="true" style={{ display: 'contents' }}>
        <Suspense
          fallback={
            <GameScreenShell
              header={{ title: 'טוען…', icon: '⏳', score: 0, onBack: () => navigate('/home') }}
            >
              טוען…
            </GameScreenShell>
          }
        >
          <ReactGame />
        </Suspense>
      </div>
    )
  }
  return null
}
