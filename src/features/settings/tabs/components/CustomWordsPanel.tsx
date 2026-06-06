import { useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2, Download, Upload, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { importCustomWords, type ImportLog } from '@/bridge/wordImport'
import {
  getCustomWords,
  deleteCustomWord,
  exportAll,
  importAll,
  type CustomWord,
  type CustomContentBundle,
} from '@/bridge/customContent'

export function CustomWordsPanel() {
  const { settings, updateSettings } = useSettings()
  const [words, setWords] = useState<CustomWord[]>([])
  const [input, setInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCustomWords().then(setWords)
  }, [])

  async function handleImport() {
    if (busy) return
    setBusy(true)
    setLogs([])
    setMessage(null)
    const collected: ImportLog[] = []
    const result = await importCustomWords(input, settings.claudeApiKey, (log) => {
      collected.push(log)
      setLogs([...collected])
    })
    setMessage({ ok: result.ok, text: result.message })
    if (result.ok) {
      setInput('')
      setWords(await getCustomWords())
    }
    setBusy(false)
  }

  async function handleDelete(word: string) {
    setWords(await deleteCustomWord(word))
  }

  async function handleExport() {
    const bundle = await exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `english-learning-custom-content-${bundle.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      const bundle = JSON.parse(await file.text()) as CustomContentBundle
      const res = await importAll(bundle, 'merge')
      setWords(await getCustomWords())
      setMessage({ ok: true, text: `יובאו ${res.words} מילים, ${res.images} תמונות, ${res.translations} תרגומים, ${res.expressions} ביטויים` })
    } catch {
      setMessage({ ok: false, text: 'קובץ הגיבוי אינו תקין' })
    }
  }

  return (
    <div className="space-y-4">
      {/* API key */}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-text">מפתח Claude API</span>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.claudeApiKey}
            onChange={(e) => updateSettings({ claudeApiKey: e.target.value })}
            placeholder="sk-ant-..."
            dir="ltr"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-white/25"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted hover:text-text"
            title={showKey ? 'הסתר מפתח' : 'הצג מפתח'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-muted">
          המפתח נשמר מקומית בדפדפן בלבד. צור מפתח ב-platform.claude.com.
        </p>
      </label>

      {/* Words input */}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-text">מילים באנגלית (מופרדות בפסיק)</span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="dog, sun, happy"
          dir="ltr"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-white/25"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleImport}
          disabled={busy || !input.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-learn/90 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-learn disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? 'מייבא...' : 'ייבא עם Claude'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text hover:bg-white/10"
        >
          <Download size={15} /> ייצוא גיבוי
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text hover:bg-white/10"
        >
          <Upload size={15} /> ייבוא גיבוי
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      </div>

      {message && (
        <p
          data-testid="custom-words-message"
          className={message.ok ? 'text-sm text-learn' : 'text-sm text-coral-400'}
        >
          {message.text}
        </p>
      )}

      {/* Import log */}
      {logs.length > 0 && (
        <pre
          dir="ltr"
          className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-left text-[11px] leading-relaxed text-muted"
        >
          {logs.map((l, i) => (
            <div key={i} className={l.type === 'error' ? 'text-coral-400' : l.type === 'success' ? 'text-learn' : ''}>
              {l.time} {l.text}
            </div>
          ))}
        </pre>
      )}

      {/* Current custom words */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">מילים מותאמות ({words.length})</span>
        </div>
        {words.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-muted">
            עדיין אין מילים מותאמות
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="custom-words-list">
            {words.map((w) => (
              <li
                key={`${w.category}:${w.word}`}
                className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 p-2.5"
              >
                <span className="text-xl" aria-hidden>{w.image || '📝'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text" dir="ltr">{w.word}</div>
                  <div className="truncate text-xs text-muted">{w.translation} · {w.category}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(w.word)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-coral-400"
                  title="מחק מילה"
                  aria-label={`מחק ${w.word}`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
