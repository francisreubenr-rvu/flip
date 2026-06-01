'use client'
import { useState, useEffect } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Ink & Paper Clock — stamped digits, red pencil circles, graphite underline.
   A small rocket orbits on an inclined elliptical path, drawn in faint pencil.
   ──────────────────────────────────────────────────────────────────────────── */

const INK: Record<string, number> = {
  '0': 0.92, '1': 0.85, '2': 0.78, '3': 0.88, '4': 0.95,
  '5': 0.82, '6': 0.90, '7': 0.75, '8': 0.87, '9': 0.93,
}

const TILT: Record<string, number> = {
  '0': 0.3, '1': -0.5, '2': 0.4, '3': -0.3, '4': 0.6,
  '5': -0.4, '6': 0.2, '7': -0.6, '8': 0.5, '9': -0.2,
}

function InkDigit({ value, scale = 1 }: { value: string; scale?: number }) {
  const ink = INK[value] ?? 0.9
  const tilt = TILT[value] ?? 0
  const sizes = {
    1:    'clamp(140px, 18vw, 340px)',
    0.85: 'clamp(110px, 14vw, 260px)',
    0.6:  'clamp(72px, 9vw, 170px)',
  }
  const sz = sizes[scale as keyof typeof sizes] ?? sizes[1]

  return (
    <span style={{
      display: 'inline-block',
      fontFamily: 'var(--serif)',
      fontSize: sz,
      fontStyle: 'italic',
      fontWeight: 700,
      color: `oklch(12% 0.028 252 / ${ink})`,
      letterSpacing: '-0.03em',
      lineHeight: 0.84,
      transform: `rotate(${tilt}deg)`,
      userSelect: 'none',
      position: 'relative',
      textShadow: `
        0 0 1px oklch(12% 0.028 252 / ${ink * 0.4}),
        0 0 4px oklch(12% 0.028 252 / ${ink * 0.15}),
        0 0.5px 0 oklch(12% 0.028 252 / ${ink * 0.06})
      `,
    }}>
      {value}
      <span style={{
        position: 'absolute', bottom: '12%', right: '-8%',
        width: 'clamp(4px, 0.6vw, 10px)', height: 'clamp(4px, 0.6vw, 10px)',
        borderRadius: '50%',
        background: `oklch(12% 0.028 252 / ${ink * 0.2})`,
        display: 'block', pointerEvents: 'none',
      }} />
    </span>
  )
}

function InkPair({ value, scale = 1 }: { value: string; scale?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '0.02em' }}>
      <InkDigit value={value[0]} scale={scale} />
      <InkDigit value={value[1]} scale={scale} />
    </span>
  )
}

function Colon() {
  return (
    <span style={{
      fontFamily: 'var(--serif)',
      fontSize: 'clamp(70px, 9vw, 180px)',
      fontStyle: 'italic', fontWeight: 400,
      color: 'var(--ink-25)', lineHeight: 0.84,
      padding: '0 0.04em',
    }}>:</span>
  )
}

/* ─── Cosmic scene — orbit, stars, planet, moon ───────────────────────────── */

// A twinkling star (deterministic animation based on position)
function Star({ x, y, size, phase }: { x: number; y: number; size: number; phase: number }) {
  const [t, setT] = useState(phase)

  useEffect(() => {
    let frame: number
    const go = () => { setT(p => (p + 0.005) % (Math.PI * 2)); frame = requestAnimationFrame(go) }
    frame = requestAnimationFrame(go)
    return () => cancelAnimationFrame(frame)
  }, [])

  const s = size * (0.6 + 0.4 * Math.sin(t))
  const alpha = 0.2 + 0.25 * Math.sin(t + phase)

  return (
    <g>
      {/* Glow */}
      <circle cx={x} cy={y} r={s * 2.5} fill="oklch(65% 0.06 250)" opacity={alpha * 0.3} />
      {/* Core */}
      <circle cx={x} cy={y} r={s} fill="oklch(55% 0.04 240)" opacity={alpha * 0.7} />
      {/* Cross sparkle */}
      {(Math.sin(t + phase) > 0.5) && (
        <>
          <line x1={x - s * 2} y1={y} x2={x + s * 2} y2={y}
            stroke="oklch(65% 0.06 250)" strokeWidth={0.3} opacity={alpha * 0.5} />
          <line x1={x} y1={y - s * 2} x2={x} y2={y + s * 2}
            stroke="oklch(65% 0.06 250)" strokeWidth={0.3} opacity={alpha * 0.5} />
        </>
      )}
    </g>
  )
}

function CosmicOrbit() {
  const [angle, setAngle] = useState(0)

  useEffect(() => {
    let frame: number
    const animate = () => {
      setAngle(prev => (prev + 0.0025) % (Math.PI * 2))
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Much larger ellipse
  const cx = 0; const cy = 0
  const rx = 540; const ry = 180
  const tilt = -12

  const x = cx + rx * Math.cos(angle)
  const y = cy + ry * Math.sin(angle)
  const depthScale = 0.45 + ((y + ry) / (2 * ry)) * 0.9
  const tangentAngle = Math.atan2(ry * Math.cos(angle), -rx * Math.sin(angle)) * (180 / Math.PI)

  // Stars scattered around — deterministic positions
  const stars = [
    { x: -380, y: -120, s: 1.5, p: 0 }, { x: 350, y: -150, s: 2, p: 1.2 },
    { x: -420, y: 80,  s: 1.2, p: 2.5 }, { x: 400, y: 100, s: 1.8, p: 0.7 },
    { x: -300, y: 140, s: 1,   p: 3.1 }, { x: 280, y: -100, s: 1.6, p: 1.8 },
    { x: -100, y: -170, s: 1.3, p: 2.1 }, { x: 150, y: 160, s: 1, p: 0.3 },
    { x: -450, y: -40, s: 2.2, p: 1.5 }, { x: 460, y: -20, s: 1.4, p: 2.8 },
    { x: 200, y: -140, s: 1,   p: 3.5 }, { x: -200, y: 130, s: 1.7, p: 0.9 },
    { x: 50,  y: -180, s: 1.1, p: 2.3 }, { x: -50,  y: 170, s: 1.5, p: 1.1 },
    { x: 480, y: -90, s: 1.2,  p: 3.0 }, { x: -470, y: 110, s: 1.3, p: 0.5 },
    { x: 320, y: 140, s: 0.9,  p: 2.7 }, { x: -340, y: -140, s: 1.6, p: 1.4 },
    { x: 420, y: 40,  s: 1,    p: 3.3 }, { x: -400, y: -90, s: 1.8, p: 0.8 },
  ]

  // Tiny planet (just a ringed circle) at a fixed point on the opposite side
  const planetAngle = angle + Math.PI
  const px = cx + rx * 0.7 * Math.cos(planetAngle)
  const py = cy + ry * 0.7 * Math.sin(planetAngle)

  return (
    <svg style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      width: '100%', height: '100%', overflow: 'visible',
    }} viewBox="-620 -260 1240 520">
      <defs>
        <radialGradient id="flame" cx="50%" cy="100%">
          <stop offset="0%" stopColor="oklch(68% 0.22 22)" />
          <stop offset="100%" stopColor="oklch(68% 0.22 22 / 0)" />
        </radialGradient>
      </defs>

      {/* Stars */}
      {stars.map((s, i) => (
        <Star key={i} x={s.x} y={s.y} size={s.s} phase={s.p} />
      ))}

      {/* Outer orbit ring — faint */}
      <ellipse cx={cx} cy={cy} rx={rx + 30} ry={ry + 15}
        fill="none" stroke="oklch(40% 0.01 40 / 0.1)" strokeWidth={0.4}
        strokeDasharray="3 12" transform={`rotate(${tilt})`} />

      {/* Main orbit path */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke="oklch(40% 0.01 40 / 0.25)" strokeWidth={0.7}
        strokeDasharray="8 12"
        transform={`rotate(${tilt})`} />

      {/* Minor axis cross — faint guide lines */}
      <line x1={-rx - 40} y1={0} x2={rx + 40} y2={0}
        stroke="oklch(40% 0.01 40 / 0.08)" strokeWidth={0.3} />
      <line x1={0} y1={-ry - 20} x2={0} y2={ry + 20}
        stroke="oklch(40% 0.01 40 / 0.08)" strokeWidth={0.3} />

      {/* Tiny planet — ringed, pencil-drawn */}
      <g transform={`translate(${px}, ${py})`}>
        <ellipse cx={0} cy={0} rx={8} ry={3}
          fill="none" stroke="oklch(35% 0.01 40 / 0.3)" strokeWidth={0.6}
          transform="rotate(-20)" />
        <circle cx={0} cy={0} r={3.5}
          fill="oklch(30% 0.01 40 / 0.5)" stroke="oklch(25% 0.01 40 / 0.6)" strokeWidth={0.5} />
      </g>

      {/* Small moon — at ~60% of orbit */}
      <g transform={`translate(${cx + rx * 0.6 * Math.cos(angle + 2.1)}, ${cy + ry * 0.6 * Math.sin(angle + 2.1)})`}>
        <circle cx={0} cy={0} r={4}
          fill="oklch(85% 0.01 82 / 0.6)" stroke="oklch(70% 0.01 78 / 0.7)" strokeWidth={0.4} />
        <circle cx={-2} cy={-1} r={3} fill="oklch(20% 0.01 40 / 0.5)" />
      </g>

      {/* Rocket */}
      <g transform={`translate(${x}, ${y}) rotate(${tangentAngle + 90}) scale(${depthScale})`}>
        <path d="M0,-14 L4,2 L4,10 L2,14 L0,20 L-2,14 L-4,10 L-4,2 Z"
          fill="oklch(30% 0.02 40)" stroke="oklch(18% 0.02 30)" strokeWidth={0.5}
          strokeLinejoin="round" />
        <circle cx={0} cy={-2} r={2.5}
          fill="oklch(75% 0.08 220)" stroke="oklch(55% 0.06 220)" strokeWidth={0.5} />
        <path d="M-4,10 L-8,18 L-3,13" fill="oklch(34% 0.02 40)" stroke="oklch(18% 0.02 30)" strokeWidth={0.4} />
        <path d="M4,10 L8,18 L3,13"  fill="oklch(34% 0.02 40)" stroke="oklch(18% 0.02 30)" strokeWidth={0.4} />
        <ellipse cx={0} cy={22} rx={3} ry={6} fill="url(#flame)" opacity={0.8} />
      </g>

      {/* Rocket trail — dotted */}
      {Array.from({ length: 40 }).map((_, i) => {
        const a = angle - (i + 1) * 0.035
        const tx = cx + rx * Math.cos(a)
        const ty = cy + ry * Math.sin(a)
        const fade = 1 - i / 40
        const ds = depthScale * fade * (0.4 + ((ty + ry) / (2 * ry)) * 0.5)
        return (
          <circle key={i} cx={tx} cy={ty} r={ds * 0.7}
            fill="oklch(40% 0.01 40)" opacity={fade * 0.25} />
        )
      })}
    </svg>
  )
}

/* ─── Clock ──────────────────────────────────────────────────────────────── */

export default function InkStampClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: '00', m: '00', s: '00', ap: 'AM' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date(); const h24 = d.getHours(); const h12 = h24 % 12 || 12
      setT({ h: String(h12).padStart(2, '0'), m: String(d.getMinutes()).padStart(2, '0'), s: String(d.getSeconds()).padStart(2, '0'), ap: h24 < 12 ? 'AM' : 'PM' })
    }
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null
  if (compact) return <span className="topbar-time">{t.h}:{t.m}:{t.s} {t.ap}</span>

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0,
      position: 'relative',
      padding: '80px 60px',
    }}>
      {/* Rocket orbit — behind the text */}
      <CosmicOrbit />

      {/* Main time line — descending sizes */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 0,
        position: 'relative',
        zIndex: 3,
      }}>
        {/* Hours — largest */}
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <svg style={{
            position: 'absolute', inset: '-14% -6% -8% -6%',
            width: 'calc(100% + 12%)', height: 'calc(100% + 22%)',
            pointerEvents: 'none',
          }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <ellipse cx="50" cy="48" rx="46" ry="44"
              fill="none" stroke="var(--accent)" strokeWidth="1.5"
              strokeDasharray="90 4 85 3" opacity="0.5"
              transform="rotate(-2 50 50)" />
            <ellipse cx="50" cy="48" rx="46" ry="44"
              fill="none" stroke="var(--accent)" strokeWidth="0.7"
              strokeDasharray="20 160" opacity="0.35"
              transform="rotate(-2 50 50)" />
          </svg>
          <InkPair value={t.h} scale={1} />
        </span>

        <Colon />

        {/* Minutes — medium */}
        <InkPair value={t.m} scale={0.85} />

        <Colon />

        {/* Seconds — smallest, lighter */}
        <InkPair value={t.s} scale={0.6} />

        {/* AM/PM */}
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'clamp(10px, 1.3vw, 15px)',
          letterSpacing: '0.16em', color: 'var(--accent)',
          opacity: 0.7, marginLeft: '0.5em',
          position: 'relative', top: '-0.3em',
        }}>
          {t.ap}
        </span>
      </div>

      {/* Graphite underline */}
      <div style={{
        width: 'clamp(340px, 48vw, 860px)', height: 1,
        marginTop: 'clamp(4px, 0.8vw, 14px)',
        background: 'oklch(35% 0.01 40 / 0.25)',
        position: 'relative', zIndex: 3,
      }}>
        <div style={{
          position: 'absolute', inset: '-3px 0 -3px 0',
          background: 'linear-gradient(to right, transparent 10%, oklch(35% 0.01 40 / 0.08) 30%, transparent 50%, oklch(35% 0.01 40 / 0.06) 70%, transparent 90%)',
          borderRadius: '50%',
        }} />
      </div>

      {/* Footnote */}
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 'clamp(13px, 1.5vw, 18px)',
        color: 'var(--ink-40)', letterSpacing: '0.14em',
        textTransform: 'uppercase', marginTop: 'clamp(6px, 0.8vw, 12px)',
        opacity: 0.6, zIndex: 3,
      }}>
        hours &nbsp;·&nbsp; minutes &nbsp;·&nbsp; seconds
      </div>
    </div>
  )
}
