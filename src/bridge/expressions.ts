import { getSettings } from './settings'
import { getExpressionMeaningOverridesSync } from './customContent'

// ─── Types (the typed contract for data/expressions/*) ───────────────────────

export type ExpressionType = 'idiom' | 'slang' | 'phrasal-verb'
export type Register = 'kid-friendly' | 'casual' | 'edgy'
export type ExpressionDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface Expression {
  /** The English expression, e.g. "give up", "got beef". */
  phrase: string
  type: ExpressionType
  register: Register
  /** Chosen figurative meaning in Hebrew. */
  meaningHe: string
  /** Candidate Hebrew meanings (option 0 = recommended); review-only metadata. */
  meaningHeOptions?: string[]
  /** Literal word-by-word Hebrew, present only when instructive. */
  literalHe?: string
  exampleEn: string
  exampleHe: string
  difficulty: ExpressionDifficulty
  /** Optional cached TTS (unused as of Slice 5.1). */
  audioUrl?: string
}

/**
 * Default register enablement. Mirrors DEFAULT_SETTINGS.expressionRegisters in
 * bridge/settings.ts — kept here too so the filter is safe even if settings are
 * missing the key entirely. kid-friendly on; casual/edgy opt-in (Slice 5.2 UI).
 */
export const DEFAULT_REGISTERS: Record<Register, boolean> = {
  'kid-friendly': true,
  casual: false,
  edgy: false,
}

// ─── Data access (this bridge is the only gateway to window.expressionBank) ───

interface ExpressionGlobals {
  expressionBank?: Expression[]
}

function getRawBank(): Expression[] {
  const bank = (window as unknown as ExpressionGlobals).expressionBank
  return Array.isArray(bank) ? bank : []
}

/**
 * Apply parent meaning overrides (Slice 5.2). Returns a new array; entries with a
 * saved override for their `phrase` get a corrected `meaningHe` (the original stays
 * available in `meaningHeOptions`). Read synchronously so edits apply live.
 */
function withOverrides(list: Expression[]): Expression[] {
  const overrides = getExpressionMeaningOverridesSync()
  if (!overrides || Object.keys(overrides).length === 0) return list
  return list.map((e) =>
    overrides[e.phrase] ? { ...e, meaningHe: overrides[e.phrase] } : e,
  )
}

/** Master on/off — absent setting is treated as enabled. */
function expressionsEnabled(): boolean {
  return getSettings().expressionsEnabled !== false
}

// ─── Public bridge API ───────────────────────────────────────────────────────

/**
 * The set of enabled registers, read from app settings with safe defaults.
 * Slice 5.2 adds the Settings UI that writes `expressionRegisters`; until then
 * this returns DEFAULT_REGISTERS (only kid-friendly enabled).
 */
export function getEnabledRegisters(): Record<Register, boolean> {
  const fromSettings = getSettings().expressionRegisters as
    | Partial<Record<Register, boolean>>
    | undefined
  return { ...DEFAULT_REGISTERS, ...(fromSettings ?? {}) }
}

/**
 * The full expression catalog filtered by the parent's enabled registers, with
 * meaning overrides applied. Empty when the master switch is off. This is the only
 * entry point games should use — never the raw window global.
 */
export function getExpressionBank(): Expression[] {
  if (!expressionsEnabled()) return []
  const enabled = getEnabledRegisters()
  return withOverrides(getRawBank().filter((e) => enabled[e.register]))
}

/** Enabled-register expressions of a single type (idiom / slang / phrasal-verb). */
export function getExpressionsByType(type: ExpressionType): Expression[] {
  return getExpressionBank().filter((e) => e.type === type)
}

/**
 * The FULL bank with meaning overrides applied, ignoring register filtering AND
 * the master switch. Intended for the parent manager / tooling (which must always
 * browse everything); games must use getExpressionBank() instead.
 */
export function getAllExpressions(): Expression[] {
  return withOverrides(getRawBank())
}

/** Count of available (register-filtered) expressions. */
export function getExpressionCount(): number {
  return getExpressionBank().length
}
