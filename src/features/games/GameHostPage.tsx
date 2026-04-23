import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'

export function GameHostPage() {
  const { gameId } = useParams<{ gameId: string }>()

  useEffect(() => {
    if (!gameId) return

    window.scrollTo({ top: 0, behavior: 'auto' })
    launchGame(gameId)
  }, [gameId])

  return null
}
