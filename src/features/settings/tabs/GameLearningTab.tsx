import { CategoriesTab } from './CategoriesTab'
import { GameTab } from './GameTab'
import { AdvancedTab } from './AdvancedTab'

/**
 * "משחק ולמידה" — the consolidated gameplay/learning tab (settings redesign,
 * 2026-06-21). Replaces the former separate קטגוריות / משחק / מתקדם tabs, in
 * the order a parent reasons about a session: WHICH content (categories) →
 * HOW it plays (mechanics, pace, peek, word display, voice) → power overrides
 * (exit behavior, open-all). Each block is an existing self-contained tab body
 * (its own `space-y-4` card stack), composed here so nothing was rewritten.
 */
export function GameLearningTab() {
  return (
    <div className="space-y-4">
      <CategoriesTab />
      <GameTab />
      <AdvancedTab />
    </div>
  )
}
