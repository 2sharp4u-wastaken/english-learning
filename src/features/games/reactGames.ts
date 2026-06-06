/**
 * Registry of game IDs that render in React. AppShell and GameHostPage both
 * consult this so the legacy DOM suppression class is applied/removed once,
 * by the parent — avoids the bottom-up useEffect race where the child added
 * the class and the parent removed it a tick later.
 */
export const REACT_GAME_IDS = new Set<string>(['vocabulary', 'listening', 'picture-match', 'true-or-not', 'reading', 'fill-blanks', 'scramble', 'grammar-beginner', 'grammar', 'articles', 'progressive', 'pronunciation', 'practice', 'story-time', 'word-journey', 'memory', 'abc', 'phonics', 'expr-meaning', 'expr-truefalse', 'expr-blank', 'expr-build', 'expr-swap'])

export function isReactGame(gameId: string | undefined | null): boolean {
  return !!gameId && REACT_GAME_IDS.has(gameId)
}
