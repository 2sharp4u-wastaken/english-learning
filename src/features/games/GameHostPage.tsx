import { useEffect, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { launchGame } from '@/bridge/games'
import { VocabularyGamePage } from './vocabulary/VocabularyGamePage'

const REACT_GAMES: Record<string, ComponentType> = {
  vocabulary: VocabularyGamePage,
}

export function GameHostPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const ReactGame = gameId ? REACT_GAMES[gameId] : undefined

  useEffect(() => {
    if (!gameId || ReactGame) return

    window.scrollTo({ top: 0, behavior: 'auto' })
    launchGame(gameId)
  }, [gameId, ReactGame])

  // For React-driven games we need the same legacy-DOM suppression that
  // AppShell applies to non-game routes — otherwise the legacy welcome-screen
  // and top-header bleed through underneath the React game UI. AppShell turns
  // that off for `/game/...` because legacy launchGame normally runs there.
  useEffect(() => {
    if (!ReactGame) return
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) return

    document.body.classList.add('react-shell-active')
    reactRoot.style.position = 'fixed'
    reactRoot.style.inset = '0'
    reactRoot.style.zIndex = '20'
    reactRoot.style.overflowY = 'auto'
    reactRoot.style.background = 'var(--color-canvas)'

    return () => {
      document.body.classList.remove('react-shell-active')
      reactRoot.style.position = ''
      reactRoot.style.inset = ''
      reactRoot.style.zIndex = ''
      reactRoot.style.overflowY = ''
      reactRoot.style.background = ''
    }
  }, [ReactGame])

  if (ReactGame) return <ReactGame />
  return null
}
