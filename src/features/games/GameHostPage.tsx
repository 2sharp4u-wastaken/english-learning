import { useEffect, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'
import { VocabularyGamePage } from './vocabulary/VocabularyGamePage'
import { ListeningGamePage } from './listening/ListeningGamePage'
import { PictureMatchGamePage } from './picture-match/PictureMatchGamePage'
import { TrueOrNotGamePage } from './true-or-not/TrueOrNotGamePage'
import { ReadingGamePage } from './reading/ReadingGamePage'
import { WordBuilderGamePage } from './word-builder/WordBuilderGamePage'
import { isReactGame } from './reactGames'

const REACT_GAMES: Record<string, ComponentType> = {
  vocabulary: VocabularyGamePage,
  listening: ListeningGamePage,
  'picture-match': PictureMatchGamePage,
  'true-or-not': TrueOrNotGamePage,
  reading: ReadingGamePage,
  'word-builder': WordBuilderGamePage,
}

export function GameHostPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const ReactGame = gameId && isReactGame(gameId) ? REACT_GAMES[gameId] : undefined

  useEffect(() => {
    if (!gameId || ReactGame) return

    window.scrollTo({ top: 0, behavior: 'auto' })
    launchGame(gameId)
  }, [gameId, ReactGame])

  if (ReactGame) return <ReactGame />
  return null
}
