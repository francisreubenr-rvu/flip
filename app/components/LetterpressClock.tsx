'use client'
import { useState, useEffect } from 'react'

function Fleuron() {
  return (
    <span style={{
      fontFamily: 'var(--serif)',
      fontSize: 'clamp(24px, 3.5vw, 56px)',
      fontStyle: 'italic',
      color: 'var(--ink-25)',
      lineHeight: 1,
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0 0.08em',
    }}>❧</span>
  )
}

function DigitPair({ value }: { value: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      gap: '0.04em',
      fontFamily: 'var(--serif)',
      fontSize: 'clamp(120px, 16vw, 300px)',
      fontStyle: 'italic',
      fontWeight: 700,
      lineHeight: 0.82,
      color: 'var(--ink-100)',
      letterSpacing: '-0.03em',
      userSelect: 'none',
      textShadow: '0 0 2px var(--ink-100), 0 0 6px oklch(12% 0.028 252 / 0.12), 0 1px 0 oklch(12% 0.028 252 / 0.06)',
    }}>
      <span>{value[0]}</span>
      <span>{value[1]}</span>
    </span>
  )
}

export default function LetterpressClock({ compact = false }: { compact?: boolean }) {
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
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: 0,
      position: 'relative',
    }}>
      <DigitPair value={t.h} />
      <Fleuron />
      <DigitPair value={t.m} />
      <Fleuron />
      <DigitPair value={t.s} />

      {/* AM/PM — fixed position, aligned to the right of seconds */}
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 'clamp(11px, 1.4vw, 17px)',
        letterSpacing: '0.18em',
        color: 'var(--accent)',
        textShadow: '0 0 1px var(--accent)',
        marginLeft: '0.4em',
        whiteSpace: 'nowrap',
      }}>
        {t.ap}
      </span>

      {/* Registration marks */}
      {['tl','tr','bl','br'].map(pos => {
        const style: React.CSSProperties = {
          position: 'absolute', width: 8, height: 8,
          border: '0.5px solid var(--ink-25)', borderRadius: '50%', opacity: 0.25,
        }
        if (pos === 'tl') { style.top = -4; style.left = -10 }
        if (pos === 'tr') { style.top = -4; style.right = -10 }
        if (pos === 'bl') { style.bottom = -4; style.left = -10 }
        if (pos === 'br') { style.bottom = -4; style.right = -10 }
        return <div key={pos} style={style} />
      })}
    </div>
  )
}
