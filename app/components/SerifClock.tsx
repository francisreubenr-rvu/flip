'use client'
import { useState, useEffect } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   The clock is pure typography — massive Instrument Serif italic on paper.
   Each digit pair gets a subtle deterministic rotation for hand-set feel.
   Colons are smaller, aligned to cap-height. Labels in tiny mono caps.
   AM/PM as a red stamp in the margin.
   ──────────────────────────────────────────────────────────────────────────── */

// Deterministic "hand-set" rotation based on digit value
const ROTS: Record<string, number> = {
  '0': -0.4, '1': 0.6, '2': -0.3, '3': 0.5, '4': -0.6,
  '5': 0.3, '6': -0.5, '7': 0.4, '8': -0.2, '9': 0.2,
}

function DigitPair({ value, label }: { value: string; label: string }) {
  const d0 = value[0]
  const d1 = value[1]
  const r0 = ROTS[d0] ?? 0
  const r1 = ROTS[d1] ?? 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{
        display: 'flex',
        gap: '0.04em',
        fontFamily: 'var(--serif)',
        fontSize: 'clamp(160px, 18vw, 380px)',
        fontStyle: 'italic',
        fontWeight: 400,
        lineHeight: 0.82,
        color: 'var(--ink-100)',
        letterSpacing: '-0.03em',
        userSelect: 'none',
      }}>
        {/* First digit */}
        <span style={{
          display: 'inline-block',
          transform: `rotate(${r0}deg)`,
          textShadow: '0 0 3px var(--ink-100)',
        }}>
          {d0}
        </span>
        {/* Second digit */}
        <span style={{
          display: 'inline-block',
          transform: `rotate(${r1}deg)`,
          textShadow: '0 0 3px var(--ink-100)',
        }}>
          {d1}
        </span>
      </div>
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: 'var(--ink-40)',
      }}>
        {label}
      </span>
    </div>
  )
}

function ColonSep() {
  return (
    <span style={{
      fontFamily: 'var(--serif)',
      fontSize: 'clamp(80px, 9vw, 200px)',
      fontStyle: 'italic',
      fontWeight: 400,
      color: 'var(--ink-25)',
      lineHeight: 0.82,
      letterSpacing: '-0.04em',
      paddingBottom: '0.12em',
    }}>
      :
    </span>
  )
}

export default function SerifClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: '00', m: '00', s: '00', ap: 'AM' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date()
      const h24 = d.getHours()
      const h12 = h24 % 12 || 12
      setT({
        h: String(h12).padStart(2, '0'),
        m: String(d.getMinutes()).padStart(2, '0'),
        s: String(d.getSeconds()).padStart(2, '0'),
        ap: h24 < 12 ? 'AM' : 'PM',
      })
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null

  if (compact) return (
    <span className="topbar-time">{t.h}:{t.m}:{t.s} <span style={{ color: 'var(--ink-40)', fontSize: 10 }}>{t.ap}</span></span>
  )

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      position: 'relative',
    }}>
      <DigitPair value={t.h} label="hours" />
      <ColonSep />
      <DigitPair value={t.m} label="minutes" />
      <ColonSep />
      <DigitPair value={t.s} label="seconds" />

      {/* AM/PM badge — vertically centered alongside seconds digits */}
      <span style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        marginLeft: 14,
        height: 'clamp(160px, 18vw, 380px)',
        lineHeight: 0.82,
      }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 14,
          letterSpacing: '0.16em',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: 3,
          padding: '6px 10px 5px',
          opacity: 0.7,
          whiteSpace: 'nowrap',
        }}>
          {t.ap}
        </span>
      </span>
    </div>
  )
}
