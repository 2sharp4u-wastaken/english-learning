import { useEffect, useRef } from 'react'

/**
 * Decorative animated background for the home hero band: a canvas sparkle field
 * (drifting, twinkling stars) over a soft purple/blue aurora glow, with gentle
 * mouse-parallax. Self-contained — no external assets. `prefers-reduced-motion`
 * disables motion (static, low-opacity sparkles, no rAF).
 *
 * Layering: a STATIC clip wrapper (`absolute inset-0`, rounded, overflow-hidden)
 * holds an OVERSCANNED inner layer (inset:-OVERSCAN) that carries the parallax
 * translate. The inner layer being larger than the clip means translating it by
 * up to ±PARALLAX_PX never exposes an edge of the band (the bug an inset-0 layer
 * had — translating moved its own clip edge and revealed the band beneath).
 */

const PARALLAX_PX = 18 // max px the layer shifts at the band edges
const OVERSCAN = 28 // inner layer bleed (> PARALLAX_PX so no edge is ever revealed)

export function HeroSparkles() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mouse-parallax: drive --px/--py on the (static) wrapper; the inner layer
  // reads them via translate (CSS vars inherit).
  useEffect(() => {
    const wrap = wrapRef.current
    const parent = wrap?.parentElement
    if (!wrap || !parent) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return

    const onMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      wrap.style.setProperty('--px', `${nx * PARALLAX_PX}px`)
      wrap.style.setProperty('--py', `${ny * PARALLAX_PX}px`)
    }
    const onLeave = () => {
      wrap.style.setProperty('--px', '0px')
      wrap.style.setProperty('--py', '0px')
    }
    parent.addEventListener('pointermove', onMove)
    parent.addEventListener('pointerleave', onLeave)
    return () => {
      parent.removeEventListener('pointermove', onMove)
      parent.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    type Spark = { x: number; y: number; r: number; vx: number; vy: number; tw: number; ph: number }
    let sparks: Spark[] = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.max(18, Math.round((w * h) / 9000))
      sparks = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.18,
        tw: 0.6 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
      }))
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of sparks) {
        if (!reduce) {
          s.x += s.vx
          s.y += s.vy
          if (s.y < -4) {
            s.y = h + 4
            s.x = Math.random() * w
          }
          if (s.x < -4) s.x = w + 4
          if (s.x > w + 4) s.x = -4
        }
        const a = reduce ? 0.5 : 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.tw + s.ph))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(196,181,253,${a})`
        ctx.shadowBlur = 6
        ctx.shadowColor = 'rgba(216,180,254,0.9)'
        ctx.fill()
      }
      ctx.shadowBlur = 0
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    resize()
    draw(0)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {/* overscanned, parallax-translated inner layer (always covers the clip) */}
      <div
        className="absolute"
        style={{
          inset: -OVERSCAN,
          transform: 'translate(var(--px,0), var(--py,0))',
          transition: 'transform 0.18s ease-out',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 80% at 20% 0%, rgba(147,51,234,0.30), transparent 60%), radial-gradient(55% 90% at 85% 110%, rgba(56,189,248,0.22), transparent 60%)',
          }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  )
}
