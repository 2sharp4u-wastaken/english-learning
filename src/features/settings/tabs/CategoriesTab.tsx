import { useMemo, useState, useEffect } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { getCategories } from '@/bridge/categories'
import type { VocabularyCategory } from '@/bridge/types'
import { SectionCard } from '../components/SectionCard'
import { cn } from '@/lib/cn'

export function CategoriesTab() {
  const { settings, updateSettings } = useSettings()
  const [categories, setCategories] = useState<VocabularyCategory[]>(() => getCategories())

  // vocabularyBank may load after initial render; refresh once when it populates
  useEffect(() => {
    const initial = categories.reduce((sum, c) => sum + c.wordCount, 0)
    if (initial > 0) return
    const id = setInterval(() => {
      const next = getCategories()
      const total = next.reduce((sum, c) => sum + c.wordCount, 0)
      if (total > 0) {
        setCategories(next)
        clearInterval(id)
      }
    }, 300)
    return () => clearInterval(id)
  }, [categories])

  const selected = new Set(settings.selectedCategories)
  const selectedCount = selected.size
  const totalCount = categories.length
  const isPracticeMode = selectedCount > 0 && selectedCount < 5

  const totalWords = useMemo(
    () =>
      categories
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.wordCount, 0),
    [categories, selected],
  )

  function toggle(id: string) {
    const current = new Set(settings.selectedCategories)
    if (current.has(id)) {
      if (current.size <= 1) return  // minimum 1 enforced
      current.delete(id)
    } else {
      current.add(id)
    }
    updateSettings({ selectedCategories: Array.from(current) })
  }

  function selectAll() {
    updateSettings({ selectedCategories: categories.map((c) => c.id) })
  }

  function clearAll() {
    // Always keep at least the first category to preserve the minimum-1 rule
    const first = categories[0]?.id
    if (!first) return
    updateSettings({ selectedCategories: [first] })
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="קטגוריות אוצר מילים"
        description="בחר אילו קטגוריות ישתתפו במשחקים. פחות מ-5 קטגוריות מפעיל מצב תרגול."
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white/8 hover:text-text"
            >
              בחר הכל
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white/8 hover:text-text"
            >
              נקה
            </button>
          </div>
        }
      >
        {/* Summary row */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium text-text tabular-nums">
            {selectedCount}/{totalCount}
          </span>
          <span className="text-muted">
            {totalWords.toLocaleString()} מילים נבחרו
          </span>
          {isPracticeMode && (
            <span className="inline-flex items-center gap-1 rounded-full border border-challenge/40 bg-challenge/10 px-2.5 py-1 font-medium text-challenge">
              <AlertTriangle size={12} />
              מצב תרגול
            </span>
          )}
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => {
            const isOn = selected.has(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={cn(
                  'relative rounded-xl border p-3 text-start transition-colors',
                  isOn
                    ? 'border-learn/60 bg-learn/10'
                    : 'border-white/8 bg-white/5 hover:border-white/20 hover:bg-white/8',
                )}
              >
                {isOn && (
                  <span className="absolute end-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-learn text-ink-950">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <div className={cn('text-sm font-medium', isOn ? 'text-text' : 'text-muted')}>
                  {cat.name}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-text tabular-nums">
                  <span>{cat.wordCount}</span>
                  <span className="font-normal text-muted">מילים</span>
                </div>
              </button>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}
