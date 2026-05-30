import { useEffect, useMemo, useState } from 'react'
import { Check, Undo2, FolderOpen, Star, Pencil, X } from 'lucide-react'
import { getAllWords, getCategories, type CatalogWord } from '@/bridge/categories'
import {
  getImageOverrides,
  setImageOverride,
  removeImageOverride,
  getTranslationOverrides,
  setTranslationOverride,
  removeTranslationOverride,
  overrideKey,
  type OverrideMap,
} from '@/bridge/customContent'

export function WordImagesPanel() {
  const [words, setWords] = useState<CatalogWord[]>([])
  const [images, setImages] = useState<OverrideMap>({})
  const [translations, setTranslations] = useState<OverrideMap>({})
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')

  const categories = useMemo(() => getCategories(), [])

  useEffect(() => {
    setWords(getAllWords())
    getImageOverrides().then(setImages)
    getTranslationOverrides().then(setTranslations)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return words.filter((w) => {
      if (filterCat && w.category !== filterCat) return false
      if (q && !w.word.toLowerCase().includes(q) && !(w.translation || '').includes(q)) return false
      return true
    })
  }, [words, filterCat, search])

  const overrideCount = Object.keys(images).length + Object.keys(translations).length

  async function applyImage(w: CatalogWord, url: string) {
    const trimmed = url.trim()
    if (!trimmed) return
    await setImageOverride(w.category, w.word, trimmed)
    setImages(await getImageOverrides())
  }

  async function clearImage(w: CatalogWord) {
    await removeImageOverride(w.category, w.word)
    setImages(await getImageOverrides())
  }

  async function applyTranslation(w: CatalogWord, value: string) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === w.translation) {
      await removeTranslationOverride(w.category, w.word)
    } else {
      await setTranslationOverride(w.category, w.word, trimmed)
    }
    setTranslations(await getTranslationOverrides())
  }

  async function clearAll() {
    if (!window.confirm('למחוק את כל התמונות והתרגומים המותאמים?')) return
    await Promise.all([
      ...Object.keys(images).map((k) => {
        const [c, ...rest] = k.split(':')
        return removeImageOverride(c, rest.join(':'))
      }),
      ...Object.keys(translations).map((k) => {
        const [c, ...rest] = k.split(':')
        return removeTranslationOverride(c, rest.join(':'))
      }),
    ])
    setImages(await getImageOverrides())
    setTranslations(await getTranslationOverrides())
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text outline-none focus:border-white/25"
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מילה..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text outline-none placeholder:text-muted focus:border-white/25"
        />
        <button
          type="button"
          onClick={clearAll}
          disabled={overrideCount === 0}
          className="rounded-lg border border-coral-400/25 bg-coral-400/10 px-3 py-1.5 text-sm text-coral-400 hover:bg-coral-400/15 disabled:opacity-40"
        >
          נקה הכול ({overrideCount})
        </button>
      </div>

      <p className="text-xs text-muted">שינויי תרגום ייכנסו לתוקף בטעינה הבאה של האפליקציה. שינויי תמונה מיידיים.</p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted">
          לא נמצאו מילים
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="word-images-list">
          {filtered.map((w) => (
            <WordCard
              key={overrideKey(w.category, w.word)}
              word={w}
              imageOverride={images[overrideKey(w.category, w.word)]}
              translationOverride={translations[overrideKey(w.category, w.word)]}
              onApplyImage={applyImage}
              onClearImage={clearImage}
              onApplyTranslation={applyTranslation}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface CardProps {
  word: CatalogWord
  imageOverride?: string
  translationOverride?: string
  onApplyImage: (w: CatalogWord, url: string) => void
  onClearImage: (w: CatalogWord) => void
  onApplyTranslation: (w: CatalogWord, value: string) => void
}

function WordCard({
  word,
  imageOverride,
  translationOverride,
  onApplyImage,
  onClearImage,
  onApplyTranslation,
}: CardProps) {
  const effectiveUrl = imageOverride || word.imageUrl || ''
  const isBase64 = !!imageOverride && imageOverride.startsWith('data:')
  const [urlInput, setUrlInput] = useState(effectiveUrl && !isBase64 ? effectiveUrl : '')
  const [pendingBase64, setPendingBase64] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)

  const [editingTrans, setEditingTrans] = useState(false)
  const displayTranslation = translationOverride || word.translation || ''
  const [transDraft, setTransDraft] = useState(displayTranslation)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = String(ev.target?.result || '')
      setPendingBase64(result)
      setUrlInput('')
    }
    reader.readAsDataURL(file)
  }

  function save() {
    const value = pendingBase64 || urlInput
    if (value.trim()) onApplyImage(word, value)
    setPendingBase64(null)
  }

  const previewUrl = pendingBase64 || effectiveUrl

  return (
    <li className="flex gap-3 rounded-xl border border-white/8 bg-white/5 p-2.5">
      {/* Preview */}
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-2xl">
        {previewUrl && !imgError ? (
          <img
            src={previewUrl}
            alt={word.word}
            className="h-full w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span aria-hidden>{word.image || '🔤'}</span>
        )}
        {imageOverride && (
          <span className="absolute right-0 top-0 rounded-bl bg-learn/90 p-0.5 text-ink-950" title="תמונה מותאמת">
            <Star size={10} />
          </span>
        )}
      </div>

      {/* Info + controls */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-text" dir="ltr">{word.word}</span>
          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">{word.category}</span>
        </div>

        {/* Translation (inline edit) */}
        <div className="flex items-center gap-1.5">
          {editingTrans ? (
            <>
              <input
                data-testid="wim-trans-input"
                value={transDraft}
                onChange={(e) => setTransDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onApplyTranslation(word, transDraft); setEditingTrans(false) }
                  if (e.key === 'Escape') { setTransDraft(displayTranslation); setEditingTrans(false) }
                }}
                autoFocus
                className="min-w-0 flex-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs text-text outline-none"
              />
              <button type="button" data-testid="wim-trans-save" onClick={() => { onApplyTranslation(word, transDraft); setEditingTrans(false) }} className="text-learn" title="שמור תרגום" aria-label={`שמור תרגום ${word.word}`}>
                <Check size={14} />
              </button>
              <button type="button" onClick={() => { setTransDraft(displayTranslation); setEditingTrans(false) }} className="text-muted" title="ביטול">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <span className={translationOverride ? 'truncate text-xs text-learn' : 'truncate text-xs text-muted'}>
                {displayTranslation}
              </span>
              <button type="button" data-testid="wim-trans-edit" onClick={() => { setTransDraft(displayTranslation); setEditingTrans(true) }} className="text-muted hover:text-text" title="ערוך תרגום" aria-label={`ערוך תרגום ${word.word}`}>
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>

        {/* Image controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setPendingBase64(null); setImgError(false) }}
            placeholder="URL של תמונה..."
            dir="ltr"
            className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-text outline-none placeholder:text-muted focus:border-white/25"
          />
          <label className="flex cursor-pointer items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-muted hover:text-text" title="העלה קובץ">
            <FolderOpen size={13} />
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
          <button type="button" data-testid="wim-save" onClick={save} className="flex items-center gap-1 rounded bg-learn/90 px-2 py-1 text-xs font-medium text-ink-950 hover:bg-learn" aria-label={`שמור תמונה ${word.word}`}>
            <Check size={13} />
          </button>
          <button
            type="button"
            data-testid="wim-reset"
            onClick={() => { onClearImage(word); setUrlInput(''); setPendingBase64(null); setImgError(false) }}
            disabled={!imageOverride}
            className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-muted hover:text-text disabled:opacity-30"
            title="אפס תמונה"
            aria-label={`אפס תמונה ${word.word}`}
          >
            <Undo2 size={13} />
          </button>
        </div>
      </div>
    </li>
  )
}
