/**
 * Thin per-mode wrappers so the 4 expression games can be lazy-registered in
 * GameHostPage like every other game (the record maps id → prop-less component).
 * All four import this one module, so they share a single code-split chunk.
 */
import { ExpressionGamePage } from './ExpressionGamePage'

export function ExpressionMeaningPage() {
  return <ExpressionGamePage mode="meaning" />
}

export function ExpressionTrueFalsePage() {
  return <ExpressionGamePage mode="truefalse" />
}

export function ExpressionBlankPage() {
  return <ExpressionGamePage mode="blank" />
}

export function ExpressionBuildPage() {
  return <ExpressionGamePage mode="build" />
}
