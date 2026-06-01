'use client'
import { useState, useEffect } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Sundial Clock — a working horizontal sundial drawn on graph paper.
   The gnomon casts a shadow that points to the current time.
   The sun arcs across the sky above during the day; the moon at night.
   Everything rendered as pencil-on-paper SVG.
   ──────────────────────────────────────────────────────────────────────────── */

// Minutes since midnight
function minsOfDay(h: number, m: number, s: number) { return h * 60 + m + s / 60 }

// Map time (0-1440 minutes) to shadow angle on a horizontal sundial.
// At noon (720), shadow points straight up (270° in screen coords).
// At 6am (360), shadow points west (180°). At 6pm (1080), shadow points east (0°).
function shadowAngle(mins: number): number {
  // Each minute = 0.25 degrees of sun movement (360° / 1440 min)
  // At mins=720 (noon), angle should be 270 (pointing up/12 o'clock)
  // At mins=360 (6am), angle should be 180 (pointing left)
  return ((mins - 360) * 0.25 + 180) * (Math.PI / 180)
}

// Sun position in the sky arc. Returns {x: 0-1, y: 0-1, visible: boolean, isDay: boolean}
function sunPosition(mins: number): { x: number; y: number; visible: boolean; isDay: boolean } {
  // Day: 5:30 AM to 6:30 PM (330 to 1110 minutes). Night otherwise.
  const dayStart = 330  // 5:30 AM
  const dayEnd   = 1110 // 6:30 PM
  const isDay = mins >= dayStart && mins <= dayEnd

  // Map time to 0-1 across the arc
  const t = isDay
    ? (mins - dayStart) / (dayEnd - dayStart)
    : mins < dayStart
      ? 0 // before dawn — sun is below horizon in the east
      : 1 // after dusk — sun is below horizon in the west

  const x = t
  const y = isDay ? Math.sin(t * Math.PI) : 0

  return { x, y, visible: isDay, isDay }
}

export default function SundialClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: 12, m: 0, s: 0, ap: 'AM' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date(); const h24 = d.getHours(); const h12 = h24 % 12 || 12
      setT({ h: h24, m: d.getMinutes(), s: d.getSeconds(), ap: h24 < 12 ? 'AM' : 'PM' })
    }
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null
  if (compact) return <span className="topbar-time">{String(t.h%12||12).padStart(2,'0')}:{String(t.m).padStart(2,'0')} {t.ap}</span>

  const mins = minsOfDay(t.h, t.m, t.s)
  const sun = sunPosition(mins)
  const shadowRad = shadowAngle(mins)

  // Shadow line endpoint from sundial center
  const cx = 250; const cy = 280
  const shadowLen = 140
  const sx = cx + Math.cos(shadowRad) * shadowLen
  const sy = cy - Math.sin(shadowRad) * shadowLen // negative because SVG y is inverted

  // Sun screen position (in the sky arc)
  const skyW = 500; const skyH = 140
  const sunX = 10 + sun.x * (skyW - 20)
  const sunY = skyH - sun.y * (skyH - 30)

  // Hour labels around sundial face
  const hourLabels = [5,6,7,8,9,10,11,12,1,2,3,4,5,6,7].map((hr, i) => {
    const a = ((hr - 12) * 15 + 180) * (Math.PI / 180)
    const r = 115
    return {
      hr, x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r,
      isMajor: hr % 3 === 0,
    }
  })

  // Minutes tick marks
  const minuteTicks = Array.from({ length: 60 }, (_, i) => {
    const a = ((i - 30) * 6 + 180) * (Math.PI / 180) // offset so 0 = top
    const inner = 105; const outer = 110
    const isMajor = i % 5 === 0
    return {
      x1: cx + Math.cos(a) * (isMajor ? 100 : 105),
      y1: cy - Math.sin(a) * (isMajor ? 100 : 105),
      x2: cx + Math.cos(a) * 110,
      y2: cy - Math.sin(a) * 110,
      isMajor,
    }
  })

  const formattedTime = `${String(t.h % 12 || 12)}:${String(t.m).padStart(2, '0')}:${String(t.s).padStart(2, '0')} ${t.ap}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* Sky arc — sun or moon */}
      <svg width={skyW} height={skyH + 20} viewBox={`0 0 ${skyW} ${skyH + 20}`}
        style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="sunglow">
            <stop offset="0%" stopColor="oklch(68% 0.18 80 / 0.9)"/>
            <stop offset="60%" stopColor="oklch(68% 0.18 80 / 0.2)"/>
            <stop offset="100%" stopColor="oklch(68% 0.18 80 / 0)"/>
          </radialGradient>
          <radialGradient id="moonglow">
            <stop offset="0%" stopColor="oklch(90% 0.02 80 / 0.85)"/>
            <stop offset="60%" stopColor="oklch(90% 0.02 80 / 0.15)"/>
            <stop offset="100%" stopColor="oklch(90% 0.02 80 / 0)"/>
          </radialGradient>
        </defs>

        {/* The arc path */}
        <path d={`M 10 ${skyH} Q ${skyW/2} ${skyH - skyH} ${skyW - 10} ${skyH}`}
          fill="none" stroke="var(--grid-major)" strokeWidth={1}
          strokeDasharray="4 6" opacity={0.4}/>

        {/* Sun or moon */}
        {sun.isDay ? (
          <>
            {/* Sun glow */}
            <circle cx={sunX} cy={sunY} r={40} fill="url(#sunglow)"/>
            {/* Sun body */}
            <circle cx={sunX} cy={sunY} r={16}
              fill="oklch(68% 0.18 80)" stroke="oklch(58% 0.16 78)" strokeWidth={1}/>
            {/* Sun rays — sketchy pencil lines */}
            {[0,45,90,135,180,225,270,315].map(a => {
              const rad = a * Math.PI / 180
              return (
                <line key={a} x1={sunX + Math.cos(rad) * 20} y1={sunY + Math.sin(rad) * 20}
                  x2={sunX + Math.cos(rad) * 28} y2={sunY + Math.sin(rad) * 28}
                  stroke="oklch(55% 0.14 76)" strokeWidth={1} strokeLinecap="round" opacity={0.6}/>
              )
            })}
          </>
        ) : (
          <>
            {/* Moon glow */}
            <circle cx={sunX} cy={sunY} r={34} fill="url(#moonglow)"/>
            {/* Moon body */}
            <circle cx={sunX} cy={sunY} r={14}
              fill="oklch(94% 0.01 82)" stroke="oklch(80% 0.01 78)" strokeWidth={0.8}/>
            {/* Crescent shadow */}
            <circle cx={sunX - 5} cy={sunY - 2} r={11}
              fill="oklch(14% 0.02 60 / 0.75)" opacity={0.7}/>
            {/* Tiny stars scattered */}
            {[10, 80, 160, 250, 340, 420, 480].map(x => (
              <circle key={x} cx={x} cy={Math.random() * skyH * 0.7}
                r={Math.random() * 1.2 + 0.4} fill="oklch(70% 0.01 80)" opacity={0.5}/>
            ))}
          </>
        )}

        {/* Time label under the celestial body */}
        <text x={sunX} y={skyH + 18} textAnchor="middle"
          fontFamily="var(--serif)" fontSize={13} fontStyle="italic"
          fill="var(--ink-80)" letterSpacing="0.02em">
          {formattedTime}
        </text>
      </svg>

      {/* Sundial face */}
      <svg width={500} height={320} viewBox="0 0 500 320" style={{ overflow: 'visible', marginTop: -10 }}>
        {/* Concentric rings */}
        <circle cx={cx} cy={cy} r={130} fill="none" stroke="var(--grid-minor)" strokeWidth={1}/>
        <circle cx={cx} cy={cy} r={115} fill="none" stroke="var(--grid-major)" strokeWidth={0.8}/>
        <circle cx={cx} cy={cy} r={20}  fill="none" stroke="var(--grid-major)" strokeWidth={0.6} opacity={0.5}/>

        {/* Minute ticks */}
        {minuteTicks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isMajor ? 'var(--ink-40)' : 'var(--grid-minor)'}
            strokeWidth={t.isMajor ? 1.2 : 0.4} strokeLinecap="round"/>
        ))}

        {/* Hour labels */}
        {hourLabels.map(({ hr, x, y, isMajor }) => (
          <text key={hr} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontFamily={isMajor ? 'var(--serif)' : 'var(--mono)'}
            fontSize={isMajor ? 14 : 10}
            fontStyle={isMajor ? 'italic' : 'normal'}
            fontWeight={isMajor ? 700 : 400}
            fill="var(--ink-60)" letterSpacing={isMajor ? '-0.01em' : '0.04em'}>
            {hr}
          </text>
        ))}

        {/* Gnomon (the triangular piece that casts the shadow) */}
        <polygon
          points={`${cx-4},${cy} ${cx+4},${cy} ${cx},${cy-35}`}
          fill="oklch(30% 0.02 40 / 0.5)" stroke="var(--ink-60)" strokeWidth={0.8}
          strokeLinejoin="round"/>

        {/* Shadow line — from gnomon base */}
        <line x1={cx} y1={cy} x2={sx} y2={sy}
          stroke="oklch(25% 0.02 40 / 0.7)" strokeWidth={1.8} strokeLinecap="round"
          style={{
            transition: 'x2 1s linear, y2 1s linear',
          }}/>
        {/* Shadow glow edge */}
        <line x1={cx} y1={cy} x2={sx} y2={sy}
          stroke="oklch(25% 0.02 40 / 0.2)" strokeWidth={5} strokeLinecap="round"/>

        {/* Small dot at shadow tip */}
        <circle cx={sx} cy={sy} r={3} fill="var(--ink-60)" opacity={0.6}/>

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="var(--ink-80)"/>

        {/* "N" / "S" / "E" / "W" compass labels */}
        {[
          { label:'N', x:cx, y:cy-125 },
          { label:'S', x:cx, y:cy+125 },
          { label:'E', x:cx+125, y:cy },
          { label:'W', x:cx-125, y:cy },
        ].map(({label,x,y}) => (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fontFamily="var(--mono)" fontSize={9} fill="var(--ink-25)"
            letterSpacing="0.14em">{label}</text>
        ))}
      </svg>
    </div>
  )
}
