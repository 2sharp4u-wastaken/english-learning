import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from './settings'

const CASE_KEY = 'globalLetterCase'

/** Strip Hebrew nikud (vowel marks, U+0591..U+05C7) from a string. */
export function stripNikud(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/[֑-ׇ]/g, '')
}

export function getCaseMode(): 'uppercase' | 'lowercase' {
  return (localStorage.getItem(CASE_KEY) as 'uppercase' | 'lowercase' | null) ?? 'uppercase'
}

export function setCaseMode(mode: 'uppercase' | 'lowercase'): void {
  localStorage.setItem(CASE_KEY, mode)
  document.body.classList.toggle('lowercase-mode', mode === 'lowercase')
  window.dispatchEvent(new CustomEvent('caseModeChanged', { detail: { mode } }))
}

export function toggleCaseMode(): 'uppercase' | 'lowercase' {
  const next = getCaseMode() === 'uppercase' ? 'lowercase' : 'uppercase'
  setCaseMode(next)
  return next
}

export function getShowNikud(): boolean {
  const w = window as any
  if (typeof w._showNikud === 'boolean') return w._showNikud
  return getSettings().showNikud !== false
}

export function setShowNikud(value: boolean): void {
  ;(window as any)._showNikud = value
  saveSettings({ showNikud: value })
  window.dispatchEvent(new CustomEvent('nikud-changed', { detail: { value } }))
}

export function toggleShowNikud(): boolean {
  const next = !getShowNikud()
  setShowNikud(next)
  return next
}

/**
 * React hook returning `{ caseMode, showNikud }` and reacting to legacy
 * toggle events so React re-renders when the toggles are flipped from
 * anywhere (legacy header, settings page, etc.).
 */
export function useTextPrefs() {
  const [caseMode, setCaseModeState] = useState<'uppercase' | 'lowercase'>(getCaseMode)
  const [showNikud, setShowNikudState] = useState<boolean>(getShowNikud)

  useEffect(() => {
    // Make sure the body class reflects the persisted state on mount.
    document.body.classList.toggle('lowercase-mode', caseMode === 'lowercase')
    const onCase = () => setCaseModeState(getCaseMode())
    const onNikud = () => setShowNikudState(getShowNikud())
    window.addEventListener('caseModeChanged', onCase)
    window.addEventListener('nikud-changed', onNikud)
    return () => {
      window.removeEventListener('caseModeChanged', onCase)
      window.removeEventListener('nikud-changed', onNikud)
    }
  }, [caseMode])

  return { caseMode, showNikud, toggleCase: toggleCaseMode, toggleNikud: toggleShowNikud }
}
