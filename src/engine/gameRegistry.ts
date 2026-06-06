/**
 * src/engine/gameRegistry.ts — static game catalog.
 *
 * Slice 4.4.b1: the legacy `managers/GameRegistry.js` instance (populated by
 * `gameLogic.registerGames()`) was the source of the Hebrew display names + icons
 * shown on Home/Profile via `bridge/games.getGameCatalog()`. Those consumers read
 * only `displayNameHebrew` + `icon` (everything else falls back to React-side
 * GAME_ORDER constants), so this port keeps just the display metadata, byte-faithful
 * to the legacy registration, so the live UI names/icons do not change.
 *
 * `boot.ts` publishes this as `window.gameRegistry` (the shape `bridge/games.ts`
 * expects: `getAllGames()` → `{ type, displayName, displayNameHebrew, icon, config }`).
 */

export interface GameRegistryEntry {
  type: string
  displayName: string
  displayNameHebrew: string
  icon: string
  config: {
    questionsPerGame: number
    pointsPerCorrect: number
    categories: string[]
  }
}

const DEFAULT_CONFIG = { questionsPerGame: 10, pointsPerCorrect: 10, categories: [] as string[] }

// Display metadata exactly as legacy `gameLogic.registerGames()` registered it.
const ENTRIES: Array<Pick<GameRegistryEntry, 'type' | 'displayName' | 'displayNameHebrew' | 'icon'>> = [
  { type: 'vocabulary', displayName: 'Vocabulary', displayNameHebrew: 'אוצר מילים', icon: '📚' },
  { type: 'grammar', displayName: 'Grammar', displayNameHebrew: 'דקדוק', icon: '✏️' },
  { type: 'grammar-beginner', displayName: 'Grammar (Beginner)', displayNameHebrew: 'דקדוק למתחילים', icon: '🔊' },
  { type: 'articles', displayName: 'Articles', displayNameHebrew: 'a / an / the', icon: '📝' },
  { type: 'progressive', displayName: 'Progressive', displayNameHebrew: 'זמן מתמשך', icon: '🏃' },
  { type: 'pronunciation', displayName: 'Pronunciation', displayNameHebrew: 'הגייה', icon: '🎤' },
  { type: 'listening', displayName: 'Listening', displayNameHebrew: 'הקשבה', icon: '👂' },
  { type: 'reading', displayName: 'Reading', displayNameHebrew: 'קריאה', icon: '📖' },
  { type: 'practice', displayName: 'Practice', displayNameHebrew: 'מצב תרגול', icon: '🎯' },
  { type: 'abc', displayName: 'ABC', displayNameHebrew: 'ABC אותיות', icon: '🔤' },
  { type: 'phonics', displayName: 'Phonics', displayNameHebrew: 'משחק צלילים', icon: '🔡' },
  { type: 'memory', displayName: 'Memory', displayNameHebrew: 'משחק זיכרון', icon: '🃏' },
  { type: 'scramble', displayName: 'Sentence Scramble', displayNameHebrew: 'סידור משפטים', icon: '🔀' },
  { type: 'fill-blanks', displayName: 'Fill in the Blanks', displayNameHebrew: 'השלם את המשפט', icon: '✍️' },
  { type: 'word-journey', displayName: 'Word Journey', displayNameHebrew: 'מסע המילים', icon: '🗺️' },
  { type: 'picture-match', displayName: 'Picture Match', displayNameHebrew: 'מילה לתמונה', icon: '🖼️' },
  { type: 'true-or-not', displayName: 'True or Not', displayNameHebrew: 'נכון או לא?', icon: '✅' },
  { type: 'story-time', displayName: 'Story Time', displayNameHebrew: 'זמן סיפור', icon: '📖' },
  // Phase 5 (Slice 5.3) expression games — dedicated "ביטויים" surface.
  { type: 'expr-meaning', displayName: 'Expression Meaning', displayNameHebrew: 'התאמת משמעות', icon: '🧩' },
  { type: 'expr-truefalse', displayName: 'Expression True or Not', displayNameHebrew: 'נכון או לא?', icon: '✅' },
  { type: 'expr-blank', displayName: 'Complete the Expression', displayNameHebrew: 'השלימו את הביטוי', icon: '✍️' },
  { type: 'expr-build', displayName: 'Build the Expression', displayNameHebrew: 'בנו את הביטוי', icon: '🧱' },
]

const GAMES: GameRegistryEntry[] = ENTRIES.map((e) => ({ ...e, config: { ...DEFAULT_CONFIG } }))

export const gameRegistry = {
  getAllGames(): GameRegistryEntry[] {
    return GAMES
  },
  getGame(type: string): GameRegistryEntry | null {
    return GAMES.find((g) => g.type === type) ?? null
  },
}
