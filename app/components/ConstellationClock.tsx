'use client'
import { useState, useEffect, useMemo } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Constellation Clock — each digit is a constellation plotted on graph paper.
   Stars sit on grid intersections. Lines connect them. A shooting star
   crosses every 30 seconds. Colons are binary star pairs.
   ──────────────────────────────────────────────────────────────────────────── */

// Each digit: points on a 5-wide × 7-tall grid
// x goes 0-4, y goes 0-6. Coords map to actual pixel positions.

type Point = [number, number] // [x, y] in grid coords

const DIGIT_POINTS: Record<string, Point[]> = {
  '0': [[1,0],[3,0],[4,1],[4,3],[4,5],[3,6],[1,6],[0,5],[0,3],[0,1]],
  '1': [[2,0],[2,6],[1,1]],
  '2': [[0,1],[1,0],[3,0],[4,1],[4,2],[3,3],[2,3],[0,5],[0,6],[4,6]],
  '3': [[1,0],[3,0],[4,1],[4,2],[2,3],[4,4],[4,5],[3,6],[1,6],[0,5]],
  '4': [[3,0],[3,6],[3,3],[0,3],[0,2],[3,1]],
  '5': [[3,0],[1,0],[0,0],[0,2],[0,3],[2,3],[4,4],[4,5],[3,6],[1,6]],
  '6': [[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,4],[2,3],[0,2]],
  '7': [[1,0],[4,0],[4,1],[3,3],[2,5],[2,6]],
  '8': [[1,0],[3,0],[4,1],[4,2],[3,3],[1,3],[0,2],[0,1],[1,0],[1,6],[3,6],[4,5],[4,4],[3,3]],
  '9': [[1,0],[3,0],[4,1],[4,2],[3,3],[1,3],[0,2],[0,1],[1,0],[4,5],[4,6],[3,6],[1,5]],
}

// Which pairs of consecutive points are connected by lines
function connectPoints(points: Point[]): [Point, Point][] {
  const pairs: [Point, Point][] = []
  for (let i = 0; i < points.length; i++) {
    pairs.push([points[i], points[(i + 1) % points.length]])
  }
  return pairs
}

const DIGIT_CONNECTIONS: Record<string, [Point, Point][]> = {}
for (const d of Object.keys(DIGIT_POINTS)) {
  DIGIT_CONNECTIONS[d] = connectPoints(DIGIT_POINTS[d])
}

function ConstellationDigit({ value, size = 120 }: { value: string; size?: number }) {
  const points = DIGIT_POINTS[value] || DIGIT_POINTS['0']
  const connections = DIGIT_CONNECTIONS[value] || DIGIT_CONNECTIONS['0']

  const padding = size * 0.08
  const cellW = (size - padding * 2) / 4
  const cellH = (size * 1.4 - padding * 2) / 6

  const toPx = (p: Point): [number, number] => [
    padding + p[0] * cellW,
    padding + p[1] * cellH,
  ]

  return (
    <svg width={size} height={size * 1.52} viewBox={`0 0 ${size} ${size * 1.52}`}
      style={{ display: 'block', overflow: 'visible' }}>
      {/* Subtle grid lines behind the constellation */}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`v${i}`} x1={padding + i * cellW} y1={padding}
          x2={padding + i * cellW} y2={padding + 6 * cellH}
          stroke="var(--grid-minor)" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1={padding} y1={padding + i * cellH}
          x2={padding + 4 * cellW} y2={padding + i * cellH}
          stroke="var(--grid-minor)" strokeWidth={0.5} />
      ))}

      {/* Connection lines */}
      {connections.map(([a, b], i) => {
        const [ax, ay] = toPx(a); const [bx, by] = toPx(b)
        return (
          <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
            stroke="var(--ink-30)" strokeWidth={1.4}
            strokeLinecap="round" opacity={0.7} />
        )
      })}

      {/* Star points */}
      {points.map((p, i) => {
        const [px, py] = toPx(p)
        return (
          <g key={i}>
            {/* Glow */}
            <circle cx={px} cy={py} r={5}
              fill="var(--accent-glow)" opacity={0.5} />
            {/* Core star */}
            <circle cx={px} cy={py} r={2.5}
              fill="var(--accent)" />
            {/* Cross sparkle on major nodes */}
            {i % 3 === 0 && (
              <>
                <line x1={px - 4} y1={py} x2={px + 4} y2={py}
                  stroke="var(--accent)" strokeWidth={0.6} opacity={0.5} />
                <line x1={px} y1={py - 4} x2={px} y2={py + 4}
                  stroke="var(--accent)" strokeWidth={0.6} opacity={0.5} />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function BinaryStar() {
  const s = 24
  return (
    <svg width={s} height={s * 2.5} viewBox={`0 0 ${s} ${s * 2.5}`}
      style={{ display: 'block' }}>
      {/* Top star */}
      <circle cx={s / 2 + 3} cy={s * 0.5} r={4} fill="var(--accent-glow)" opacity={0.4} />
      <circle cx={s / 2 + 3} cy={s * 0.5} r={2} fill="var(--accent)" />
      {/* Bottom star */}
      <circle cx={s / 2 - 3} cy={s * 2} r={4} fill="var(--accent-glow)" opacity={0.4} />
      <circle cx={s / 2 - 3} cy={s * 2} r={2} fill="var(--accent)" />
      {/* Faint orbit ring */}
      <circle cx={s / 2} cy={s * 1.25} r={s * 0.8}
        fill="none" stroke="var(--grid-minor)" strokeWidth={0.4}
        strokeDasharray="2 4" />
    </svg>
  )
}

function ShootingStar() {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const trigger = () => {
      const maxW = 700; const maxH = 280
      setPos({ x: Math.random() * maxW, y: 40 + Math.random() * maxH })
      setVisible(true)
      setTimeout(() => setVisible(false), 800)
    }
    trigger()
    const i = setInterval(trigger, 15000 + Math.random() * 20000)
    return () => clearInterval(i)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'absolute', left: pos.x, top: pos.y,
      width: 60, height: 2, zIndex: 10, pointerEvents: 'none',
      background: 'linear-gradient(to right, transparent, oklch(88% 0.18 110 / 0.9), transparent)',
      borderRadius: 2, transform: 'rotate(-30deg)',
      animation: 'shoot 0.8s ease-out forwards',
    }} />
  )
}

export default function ConstellationClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: '00', m: '00', s: '00', ap: 'AM' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date(); const h24 = d.getHours(); const h12 = h24 % 12 || 12
      setT({
        h: String(h12).padStart(2, '0'),
        m: String(d.getMinutes()).padStart(2, '0'),
        s: String(d.getSeconds()).padStart(2, '0'),
        ap: h24 < 12 ? 'AM' : 'PM',
      })
    }
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null
  if (compact) return <span className="topbar-time">{t.h}:{t.m}:{t.s} {t.ap}</span>

  const digitW = 94

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, position: 'relative',
    }}>
      <ShootingStar />

      {/* Hours */}
      <div style={{ display: 'flex', gap: 0 }}>
        <ConstellationDigit value={t.h[0]} size={digitW} />
        <ConstellationDigit value={t.h[1]} size={digitW} />
      </div>

      <BinaryStar />

      {/* Minutes */}
      <div style={{ display: 'flex', gap: 0 }}>
        <ConstellationDigit value={t.m[0]} size={digitW} />
        <ConstellationDigit value={t.m[1]} size={digitW} />
      </div>

      <BinaryStar />

      {/* Seconds */}
      <div style={{ display: 'flex', gap: 0 }}>
        <ConstellationDigit value={t.s[0]} size={digitW} />
        <ConstellationDigit value={t.s[1]} size={digitW} />
      </div>

      {/* AM/PM — star label */}
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-25)',
        letterSpacing: '0.2em', writingMode: 'vertical-lr',
        marginLeft: 8, alignSelf: 'center',
      }}>
        {t.ap}
      </span>
    </div>
  )
}
