import { useEffect, type ComponentType } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'
import { VocabularyGamePage } from './vocabulary/VocabularyGamePage'
import { ListeningGamePage } from './listening/ListeningGamePage'
import { PictureMatchGamePage } from './picture-match/PictureMatchGamePage'
import { TrueOrNotGamePage } from './true-or-not/TrueOrNotGamePage'
import { ReadingGamePage } from './reading/ReadingGamePage'
import { FillBlanksGamePage } from './fill-blanks/FillBlanksGamePage'
import { SentenceScrambleGamePage } from './sentence-scramble/SentenceScrambleGamePage'
import { GrammarBeginnerGamePage } from './grammar-beginner/GrammarBeginnerGamePage'
import { isReactGame } from './reactGames'

const REACT_GAMES: Record<string, ComponentType> = {
  vocabulary: VocabularyGamePage,
  listening: ListeningGamePage,
  'picture-match': PictureMatchGamePage,
  'true-or-not': TrueOrNotGamePage,
  reading: ReadingGamePage,
  'fill-blanks': FillBlanksGamePage,
  scramble: SentenceScrambleGamePage,
  'grammar-beginner': GrammarBeginnerGamePage,
}

// Retired games → bookmark-safe redirects. Slice 3.7.1 folded word-builder
// into fill-blanks (same data, same UX, single canonical game).
const RETIRED_GAMES: Record<string, string> = {
  'word-builder': 'fill-blanks',
}

export function GameHostPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const redirectTo = gameId ? RETIRED_GAMES[gameId] : undefined
  const ReactGame =
    gameId && !redirectTo && isReactGame(gameId) ? REACT_GAMES[gameId] : undefined

  useEffect(() => {
    if (!gameId || ReactGame || redirectTo) return

    window.scrollTo({ top: 0, behavior: 'auto' })
    launchGame(gameId)
  }, [gameId, ReactGame, redirectTo])

  if (redirectTo) return <Navigate to={`/game/${redirectTo}`} replace />
  if (ReactGame) return <ReactGame />
  return null
}
