import { usePlayerPrefs } from '@/hooks/usePlayerPrefs'
import { useNikud } from '@/bridge/nikud'
import {
  THEME_NAMES,
  AVATAR_COLORS,
  SOUND_IDS,
  SOUND_EMOJI,
  MASCOTS,
  MASCOT_IDS,
  SOUND_PACKS,
  SOUND_PACK_IDS,
  type ThemeName,
  type SoundChoice,
} from '@/bridge/playerPrefs'
import { playSoundPreview, playEffect } from '@/bridge/feedback'
import { cn } from '@/lib/cn'
import { SectionCard } from '../components/SectionCard'
import { Toggle } from '../components/Toggle'
import { RadioCards, type RadioOption } from '../components/RadioCards'
import { SegmentedControl, type SegmentOption } from '../components/SegmentedControl'

/**
 * "המשחק שלי" — the ONLY kid-facing (unprotected) settings tab. Per-profile
 * customization (playerPrefs): colors/theme, sounds (icon-only picker grids),
 * motion, mascot — each applies live and is saved per-player. Player-facing copy
 * says שחקן/ית; chrome is nk()-wrapped.
 */

const THEME_SWATCH: Record<ThemeName, { label: string; color: string }> = {
  dark: { label: 'כהה', color: '#63e6c6' },
  ocean: { label: 'ים', color: '#34d6c0' },
  sunset: { label: 'שקיעה', color: '#ff7a9c' },
  forest: { label: 'יער', color: '#5fd97a' },
  candy: { label: 'ממתק', color: '#b18cff' },
}

/** Compact icon-only sound picker: a grid of emoji buttons (no text), plus a
 *  mute option. Tapping selects AND previews the sound. */
function SoundGrid({
  value,
  onChange,
  ariaLabel,
}: {
  value: SoundChoice
  onChange: (v: SoundChoice) => void
  ariaLabel: string
}) {
  const choose = (v: SoundChoice) => {
    onChange(v)
    if (v !== 'none') playSoundPreview(v)
  }
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" role="radiogroup" aria-label={ariaLabel}>
      {SOUND_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={id}
          data-testid={`sound-${id}`}
          onClick={() => choose(id)}
          className={cn(
            // Scale the emoji with the tile on wider screens (beta #31); larger
            // base glyph so it reads clearly on phones (issue #51).
            'flex aspect-square items-center justify-center rounded-lg border text-2xl transition-transform hover:scale-110 sm:text-3xl lg:text-4xl',
            value === id ? 'border-learn bg-learn/15' : 'border-white/10 bg-white/5 hover:bg-white/10',
          )}
        >
          <span aria-hidden>{SOUND_EMOJI[id]}</span>
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === 'none'}
        aria-label="none"
        onClick={() => choose('none')}
        className={cn(
          'flex aspect-square items-center justify-center rounded-lg border text-2xl transition-transform hover:scale-110 sm:text-3xl lg:text-4xl',
          value === 'none' ? 'border-coral-400 bg-coral-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10',
        )}
      >
        <span aria-hidden>🔇</span>
      </button>
    </div>
  )
}

export function DisplayTab() {
  const nk = useNikud()
  const { prefs, updatePrefs } = usePlayerPrefs()

  const celebrationOptions: SegmentOption<'calm' | 'normal' | 'party'>[] = [
    { value: 'calm', label: nk('רגוע'), emoji: '😌' },
    { value: 'normal', label: nk('רגיל'), emoji: '🙂' },
    { value: 'party', label: nk('מסיבה'), emoji: '🎉' },
  ]
  const packOptions: RadioOption<(typeof SOUND_PACK_IDS)[number]>[] = SOUND_PACK_IDS.map((id) => ({
    value: id,
    label: nk(SOUND_PACKS[id].label),
  }))

  return (
    <div className="space-y-4" data-testid="player-customization">
      {/* Colors / theme */}
      <SectionCard title={nk('צבעים')} description={nk('בחרו ערכת צבעים ואת צבע הדמות.')}>
        <div className="space-y-3">
          {/* Primary, prominent selection — bigger cards with a large swatch and a
              strong ring on the active theme, so the signature choice clearly
              outranks the toggles beneath it (M16 / beta #13). */}
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            role="radiogroup"
            aria-label={nk('ערכת צבעים')}
          >
            {THEME_NAMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={prefs.theme === t}
                data-testid={`theme-${t}`}
                onClick={() => updatePrefs({ theme: t })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 text-sm font-semibold transition-all',
                  prefs.theme === t
                    ? 'border-learn bg-learn/15 text-text shadow-[var(--shadow-panel)] scale-[1.03]'
                    : 'border-white/10 bg-white/5 text-muted hover:bg-white/10',
                )}
              >
                <span
                  className={cn(
                    'h-9 w-9 rounded-full ring-2 transition-shadow',
                    prefs.theme === t ? 'ring-white/80' : 'ring-white/15',
                  )}
                  style={{ background: THEME_SWATCH[t].color }}
                  aria-hidden
                />
                {THEME_SWATCH[t].label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">{nk('צבע הדמות')}</span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c || 'default'}
                  type="button"
                  aria-label={c ? c : nk('ברירת מחדל')}
                  aria-pressed={prefs.avatarColor === c}
                  onClick={() => updatePrefs({ avatarColor: c })}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                    prefs.avatarColor === c ? 'border-white' : 'border-white/20',
                  )}
                  style={{ background: c || 'linear-gradient(135deg,#63e6c6,#68a8ff)' }}
                />
              ))}
            </div>
          </div>

          <Toggle
            label={nk('טקסט גדול')}
            description={nk('הגדלת הכתב בכל המסכים')}
            checked={prefs.bigText}
            onChange={(v) => updatePrefs({ bigText: v })}
          />
          <Toggle
            label={nk('ניגודיות גבוהה')}
            description={nk('צבעי טקסט בהירים יותר לקריאה קלה')}
            checked={prefs.highContrast}
            onChange={(v) => updatePrefs({ highContrast: v })}
          />
        </div>
      </SectionCard>

      {/* Sounds */}
      <SectionCard title={nk('צלילים')} description={nk('בחרו אילו צלילים יושמעו. הקישו על צליל כדי לשמוע אותו.')}>
        <div className="space-y-3">
          <Toggle
            label={nk('צלילים פעילים')}
            description={nk('מתג ראשי לכל הצלילים')}
            checked={prefs.soundOn}
            onChange={(v) => updatePrefs({ soundOn: v })}
          />
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">{nk('צליל כניסה')}</span>
            <SoundGrid
              value={prefs.loginSound}
              ariaLabel={nk('צליל כניסה')}
              onChange={(v) => updatePrefs({ loginSound: v })}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">{nk('צליל יציאה')}</span>
            <SoundGrid
              value={prefs.logoutSound}
              ariaLabel={nk('צליל יציאה')}
              onChange={(v) => updatePrefs({ logoutSound: v })}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted">{nk('חבילת צלילים (פסי הניקוד)')}</span>
            <RadioCards
              columns={2}
              options={packOptions}
              value={prefs.soundPack}
              onChange={(v) => {
                updatePrefs({ soundPack: v })
                if (prefs.soundOn) setTimeout(() => playEffect('sparkle'), 0) // preview
              }}
            />
          </div>
          <Toggle
            label={nk('צלילי תשובה')}
            description={nk('צליל על תשובה נכונה או שגויה')}
            checked={prefs.answerSounds}
            disabled={!prefs.soundOn}
            onChange={(v) => updatePrefs({ answerSounds: v })}
          />
          <Toggle
            label={nk('צלילי מסך הבית')}
            description={nk('צלילים בלחיצה על הפסים והכפתורים')}
            checked={prefs.heroSounds}
            disabled={!prefs.soundOn}
            onChange={(v) => updatePrefs({ heroSounds: v })}
          />
          <Toggle
            label={nk('צליל מטבעות')}
            description={nk('צליל בעת קבלת מטבעות')}
            checked={prefs.coinSounds}
            disabled={!prefs.soundOn}
            onChange={(v) => updatePrefs({ coinSounds: v })}
          />
        </div>
      </SectionCard>

      {/* Motion / animation — the celebration LEVEL is the one primary choice
          (prominent segmented control); the rest are secondary fine-tuning
          toggles, visually demoted so "all three on together" no longer reads as
          three equal switches (M16 / beta #13). */}
      <SectionCard title={nk('תנועה ואנימציה')} description={nk('בחרו כמה תנועה וחגיגות יהיו במשחק.')}>
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel={nk('עוצמת חגיגה')}
            options={celebrationOptions}
            value={prefs.celebration}
            onChange={(v) => updatePrefs({ celebration: v })}
          />

          <div className="space-y-2 border-t border-white/10 pt-3">
            <span className="block text-xs font-medium text-muted">{nk('אפשרויות נוספות')}</span>
            <Toggle
              label={nk('קונפטי')}
              description={nk('פיזור קונפטי על הצלחה')}
              checked={prefs.confetti}
              onChange={(v) => updatePrefs({ confetti: v })}
            />
            <Toggle
              label={nk('נצנוצים במסך הבית')}
              description={nk('רקע נוצץ בראש מסך הבית')}
              checked={prefs.sparkles}
              onChange={(v) => updatePrefs({ sparkles: v })}
            />
            <Toggle
              label={nk('הפחתת תנועה')}
              description={nk('מצב רגוע — פחות אנימציות')}
              checked={prefs.reducedMotion}
              onChange={(v) => updatePrefs({ reducedMotion: v })}
            />
          </div>
        </div>
      </SectionCard>

      {/* Mascot */}
      <SectionCard title={nk('הדמות')} description={nk('הדמות שמקפצת בראש מסך הבית ומעודדת.')}>
        <div className="space-y-3">
          <Toggle
            label={nk('הצגת הדמות')}
            description={nk('דמות ידידותית במסך הבית')}
            checked={prefs.mascot}
            onChange={(v) => updatePrefs({ mascot: v })}
          />
          {prefs.mascot && (
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">{nk('בחירת חיה')}</span>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8" role="radiogroup" aria-label={nk('בחירת חיה')}>
                {MASCOT_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={prefs.mascotCharacter === id}
                    aria-label={id}
                    data-testid={`mascot-${id}`}
                    onClick={() => updatePrefs({ mascotCharacter: id })}
                    className={cn(
                      // Emoji scales with the (square) tile so it doesn't read as a
                      // tiny glyph in a big card on desktop (beta #31); larger base
                      // glyph for phones (issue #51).
                      'flex aspect-square items-center justify-center rounded-lg border text-3xl transition-transform hover:scale-110 sm:text-4xl lg:text-5xl',
                      prefs.mascotCharacter === id
                        ? 'border-learn bg-learn/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10',
                    )}
                  >
                    <span aria-hidden>{MASCOTS[id]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
