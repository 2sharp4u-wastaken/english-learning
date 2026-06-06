import { useEffect, useMemo, useState } from 'react'
import { Check, Undo2, Volume2, Pencil, X } from 'lucide-react'
import {
  getAllExpressions,
  type Expression,
  type ExpressionType,
  type Register,
} from '@/bridge/expressions'
import {
  getExpressionMeaningOverrides,
  setExpressionMeaningOverride,
  removeExpressionMeaningOverride,
  type OverrideMap,
} from '@/bridge/customContent'
import { speakWord } from '@/bridge/audio'

/**
 * Parent-facing expression manager (Slice 5.2). Browse the full bank and fix each
 * Hebrew meaning by picking one of the authored options or typing a custom value.
 * Edits persist as per-browser overrides (customContent.expressionMeaningOverrides)
 * and apply live (the bridge reads them synchronously). Reset restores the source.
 *
 * Lives in the password-gated ביטויים settings tab. Superseded the dev-only
 * inspector from Slice 5.1.
 */

const TYPE_LABEL: Record<ExpressionType, string> = {
  idiom: 'ניב',
  'phrasal-verb': 'פועל מורכב',
  slang: 'סלנג',
}
const REGISTER_LABEL: Record<Register, string> = {
  'kid-friendly': 'ידידותי',
  casual: 'יומיומי',
  edgy: 'נועז',
}
const TYPE_BADGE: Record<ExpressionType, string> = {
  idiom: 'bg-learn/15 text-learn',
  'phrasal-verb': 'bg-practice/15 text-practice',
  slang: 'bg-challenge/15 text-challenge',
}
const REGISTER_BADGE: Record<Register, string> = {
  'kid-friendly': 'bg-learn/15 text-learn',
  casual: 'bg-challenge/15 text-challenge',
  edgy: 'bg-test/15 text-test',
}
const TYPE_FILTERS: Array<ExpressionType | 'all'> = ['all', 'idiom', 'phrasal-verb', 'slang']
const REGISTER_FILTERS: Array<Register | 'all'> = ['all', 'kid-friendly', 'casual', 'edgy']

export function ExpressionsPanel() {
  const [all, setAll] = useState<Expression[]>(() => getAllExpressions())
  const [overrides, setOverrides] = useState<OverrideMap>({})
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ExpressionType | 'all'>('all')
  const [registerFilter, setRegisterFilter] = useState<Register | 'all'>('all')

  useEffect(() => {
    setAll(getAllExpressions())
    getExpressionMeaningOverrides().then(setOverrides)
    const refresh = () => setAll(getAllExpressions())
    window.addEventListener('game-data-ready', refresh)
    return () => window.removeEventListener('game-data-ready', refresh)
  }, [])

  async function apply(phrase: string, value: string, source: string) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === source) {
      await removeExpressionMeaningOverride(phrase)
    } else {
      await setExpressionMeaningOverride(phrase, trimmed)
    }
    setOverrides(await getExpressionMeaningOverrides())
    setAll(getAllExpressions())
  }

  async function reset(phrase: string) {
    await removeExpressionMeaningOverride(phrase)
    setOverrides(await getExpressionMeaningOverrides())
    setAll(getAllExpressions())
  }

  async function clearAll() {
    if (!window.confirm('לאפס את כל התרגומים המותאמים של הביטויים?')) return
    await Promise.all(Object.keys(overrides).map((p) => removeExpressionMeaningOverride(p)))
    setOverrides(await getExpressionMeaningOverrides())
    setAll(getAllExpressions())
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (registerFilter !== 'all' && e.register !== registerFilter) return false
      if (!q) return true
      return (
        e.phrase.toLowerCase().includes(q) ||
        e.meaningHe.includes(q) ||
        (e.meaningHeOptions ?? []).some((o) => o.includes(q))
      )
    })
  }, [all, query, typeFilter, registerFilter])

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש בביטוי או במשמעות..."
          dir="rtl"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text outline-none placeholder:text-muted focus:border-white/25"
        />
        <button
          type="button"
          onClick={clearAll}
          disabled={overrideCount === 0}
          className="rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-sm text-coral-400 hover:bg-coral-400/15 disabled:opacity-40"
        >
          אפס הכול ({overrideCount})
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} label={t === 'all' ? 'כל הסוגים' : TYPE_LABEL[t]} />
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {REGISTER_FILTERS.map((r) => (
          <Chip key={r} active={registerFilter === r} onClick={() => setRegisterFilter(r)} label={r === 'all' ? 'כל הרגיסטרים' : REGISTER_LABEL[r]} />
        ))}
      </div>

      <p className="text-xs text-muted">
        מציג {filtered.length} מתוך {all.length}. שינויי תרגום נשמרים בדפדפן ומיושמים מיד.
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted">
          לא נמצאו ביטויים
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="expressions-list">
          {filtered.map((e) => (
            <ExpressionCard
              key={e.phrase}
              e={e}
              overridden={overrides[e.phrase] != null}
              onApply={apply}
              onReset={reset}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'border-accent-blue/40 bg-accent-blue/15 text-accent-blue'
          : 'border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-text')
      }
    >
      {label}
    </button>
  )
}

interface CardProps {
  e: Expression
  overridden: boolean
  onApply: (phrase: string, value: string, source: string) => void
  onReset: (phrase: string) => void
}

function ExpressionCard({ e, overridden, onApply, onReset }: CardProps) {
  const options = e.meaningHeOptions ?? [e.meaningHe]
  const source = options[0]
  const [custom, setCustom] = useState('')
  const [editing, setEditing] = useState(false)

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/5 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span dir="ltr" className="truncate text-sm font-semibold text-text">{e.phrase}</span>
          <button
            type="button"
            onClick={() => speakWord(e.phrase.toLowerCase())}
            className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-white/10 hover:text-text"
            aria-label={`Play "${e.phrase}"`}
          >
            <Volume2 size={14} />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[e.type]}`}>{TYPE_LABEL[e.type]}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REGISTER_BADGE[e.register]}`}>{REGISTER_LABEL[e.register]}</span>
        </div>
      </div>

      {/* Current meaning */}
      <div className="flex items-center gap-1.5">
        <span className={overridden ? 'text-sm font-semibold text-learn' : 'text-sm font-semibold text-text'}>
          {e.meaningHe}
        </span>
        {overridden && <span className="rounded bg-learn/15 px-1 text-[10px] text-learn">מותאם</span>}
        <button
          type="button"
          data-testid="expr-reset"
          onClick={() => onReset(e.phrase)}
          disabled={!overridden}
          className="text-muted hover:text-text disabled:opacity-30"
          title="אפס למקור"
          aria-label={`אפס תרגום ${e.phrase}`}
        >
          <Undo2 size={13} />
        </button>
      </div>

      {/* Option quick-picks */}
      <div className="flex flex-wrap gap-1">
        {options.map((opt, i) => {
          const isCurrent = opt === e.meaningHe
          return (
            <button
              key={i}
              type="button"
              onClick={() => onApply(e.phrase, opt, source)}
              className={
                'rounded-md border px-2 py-0.5 text-xs transition-colors ' +
                (isCurrent
                  ? 'border-learn/40 bg-learn/15 text-learn'
                  : 'border-white/10 bg-white/5 text-muted hover:bg-white/10 hover:text-text')
              }
            >
              {opt}{i === 0 ? ' ★' : ''}
            </button>
          )
        })}
      </div>

      {/* Custom value */}
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            data-testid="expr-custom-input"
            value={custom}
            onChange={(ev) => setCustom(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') { onApply(e.phrase, custom, source); setEditing(false); setCustom('') }
              if (ev.key === 'Escape') { setEditing(false); setCustom('') }
            }}
            placeholder="תרגום משלך..."
            dir="rtl"
            autoFocus
            className="min-w-0 flex-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs text-text outline-none"
          />
          <button type="button" data-testid="expr-custom-save" onClick={() => { onApply(e.phrase, custom, source); setEditing(false); setCustom('') }} className="text-learn" aria-label={`שמור תרגום ${e.phrase}`}>
            <Check size={14} />
          </button>
          <button type="button" onClick={() => { setEditing(false); setCustom('') }} className="text-muted" aria-label="ביטול">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="expr-custom-toggle"
          onClick={() => { setCustom(''); setEditing(true) }}
          className="flex w-fit items-center gap-1 text-xs text-muted hover:text-text"
        >
          <Pencil size={12} /> תרגום משלך
        </button>
      )}
    </li>
  )
}
