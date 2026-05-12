import { useEffect, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'
import { VocabularyGamePage } from './vocabulary/VocabularyGamePage'
import { isReactGame } from './reactGames'

const REACT_GAMES: Record<string, ComponentType> = {
  vocabulary: VocabularyGamePage,
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
