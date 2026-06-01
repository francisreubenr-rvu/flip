'use client'
import { useState, useEffect, type ReactNode } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   The digit is built from matchsticks, twigs, vines, and leaves.
   Each digit shape is rendered as a set of organic SVG paths.
   ──────────────────────────────────────────────────────────────────────────── */

// A single matchstick: pale wood body + dark burnt tip
function Matchstick({ x1, y1, x2, y2, angle = 0, scale = 1 }: {
  x1: number; y1: number; x2: number; y2: number; angle?: number; scale?: number
}) {
  const dx = x2 - x1; const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const mid = Math.atan2(dy, dx) * (180 / Math.PI)
  const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2
  const tipLen = 8 * scale
  const bodyLen = len - tipLen
  const bodyW = 2.8 * scale
  const tipW = 3.2 * scale

  return (
    <g transform={`rotate(${mid} ${cx} ${cy})`}>
      {/* Wood body — cream/pale */}
      <rect x={cx - bodyLen / 2 - tipLen / 2} y={cy - bodyW / 2}
        width={bodyLen} height={bodyW} rx={1} ry={1}
        fill="oklch(78% 0.04 78)" stroke="oklch(65% 0.05 70)" strokeWidth={0.4} />
      {/* Burnt tip — dark brown/charcoal */}
      <rect x={cx + bodyLen / 2 - tipLen / 2} y={cy - tipW / 2}
        width={tipLen} height={tipW} rx={1.2} ry={1.2}
        fill="oklch(18% 0.02 30)" />
      {/* Slight grain line */}
      <line x1={cx - bodyLen / 2 - tipLen / 2 + 2} y1={cy}
        x2={cx + bodyLen / 2 - tipLen / 2 - 2} y2={cy}
        stroke="oklch(68% 0.03 72)" strokeWidth={0.3} opacity={0.5} />
    </g>
  )
}

// A branch: slightly curved, varied thickness, bark texture
function Branch({ d, strokeW = 4, color = 'oklch(28% 0.03 60)' }: {
  d: string; strokeW?: number; color?: string
}) {
  return (
    <g>
      {/* Main branch */}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Bark highlight */}
      <path d={d} fill="none" stroke="oklch(38% 0.03 62)" strokeWidth={strokeW * 0.35}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.5}
        style={{ strokeDasharray: '3 8' }} />
    </g>
  )
}

// Small leaf — teardrop/diamond shape
function Leaf({ x, y, size = 8, angle = 0, color = 'oklch(58% 0.16 140)' }: {
  x: number; y: number; size?: number; angle?: number; color?: string
}) {
  const a = angle * (Math.PI / 180)
  const w = size * 0.4; const h = size
  return (
    <ellipse cx={x} cy={y} rx={w} ry={h}
      fill={color} stroke="oklch(45% 0.14 135)" strokeWidth={0.5}
      transform={`rotate(${angle} ${x} ${y})`} />
  )
}

// Small berry / bud for the colon separator
function Berry({ r = 6 }: { r?: number }) {
  const s = r * 3
  // Use plain gradient ID to avoid server/client mismatch with dynamic IDs
  const gradId = 'berry'
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={gradId} cx="40%" cy="30%">
          <stop offset="0%" stopColor="oklch(60% 0.18 16)" />
          <stop offset="60%" stopColor="oklch(45% 0.16 20)" />
          <stop offset="100%" stopColor="oklch(30% 0.1 18)" />
        </radialGradient>
      </defs>
      <circle cx={s/2} cy={s/2} r={r}
        fill={`url(#${gradId})`} stroke="oklch(30% 0.08 18)" strokeWidth={0.5} />
      <ellipse cx={s/2 - r*0.25} cy={s/2 - r*0.25} rx={r*0.25} ry={r*0.18}
        fill="oklch(95% 0.02 60 / 0.35)" />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Digit definitions — each built from branches, matchsticks, and leaves.
   Coordinate space: 0,0 to 80,140
   ──────────────────────────────────────────────────────────────────────────── */

function DigitZero() {
  return (
    <g>
      <Branch d="M40,12 C65,12 72,25 72,70 C72,115 65,128 40,128 C15,128 8,115 8,70 C8,25 15,12 40,12Z"
        strokeW={5} />
      <Leaf x={40} y={6} size={10} angle={-20} />
      <Leaf x={55} y={10} size={7} angle={15} />
      <Leaf x={25} y={10} size={7} angle={-45} />
      <Matchstick x1={62} y1={50} x2={72} y2={48} scale={1.2} />
      <Matchstick x1={64} y1={80} x2={73} y2={82} scale={1.1} />
      <Branch d="M50,8 C55,6 60,7 62,9" strokeW={2} color="oklch(42% 0.06 55)" />
      <Branch d="M30,8 C25,5 20,7 18,9" strokeW={2} color="oklch(42% 0.06 55)" />
    </g>
  )
}

function DigitOne() {
  return (
    <g>
      <Matchstick x1={40} y1={10} x2={40} y2={130} scale={1.6} />
      <Branch d="M20,28 C30,20 40,14 42,12" strokeW={3.5} />
      <Branch d="M20,28 C28,24 35,22 40,20" strokeW={2} color="oklch(42% 0.06 55)" />
      <Leaf x={20} y={26} size={9} angle={-60} />
      <Leaf x={40} y={6} size={8} angle={30} />
      {/* Lighter accent stick */}
      <Matchstick x1={32} y1={16} x2={22} y2={26} scale={1} />
      <Branch d="M40,125 C38,130 34,134 30,136" strokeW={3} />
      <Leaf x={30} y={138} size={8} angle={80} />
    </g>
  )
}

function DigitTwo() {
  return (
    <g>
      <Branch d="M16,22 C16,10 30,8 40,8 C60,8 66,16 66,30 C66,42 50,56 14,80 L68,80 C68,82 66,106 40,106 C18,106 14,118 14,128 C14,136 18,138 40,138 C62,138 68,132 68,130"
        strokeW={5} />
      <Branch d="M18,22 C18,14 30,10 40,10 C58,10 64,18 64,30 C64,40 48,53 16,76" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Matchstick x1={60} y1={45} x2={68} y2={48} scale={1.1} />
      <Leaf x={14} y={78} size={10} angle={170} />
      <Leaf x={68} y={10} size={9} angle={45} />
      <Leaf x={68} y={130} size={8} angle={-30} />
      <Matchstick x1={16} y1={92} x2={10} y2={88} scale={1} />
    </g>
  )
}

function DigitThree() {
  return (
    <g>
      <Branch d="M18,18 C18,8 30,6 46,6 C62,6 64,12 64,22 C64,30 54,38 44,42"
        strokeW={5} />
      <Branch d="M44,42 C54,46 58,54 58,66 C58,80 54,88 44,92"
        strokeW={5} />
      <Branch d="M44,92 C54,96 58,106 58,118 C58,132 48,138 40,138 C22,138 18,130 18,122 C18,114 22,108 28,106"
        strokeW={5} />
      <Leaf x={64} y={10} size={8} angle={30} />
      <Leaf x={58} y={118} size={9} angle={45} />
      <Matchstick x1={16} y1={18} x2={8} y2={14} scale={1.2} />
      <Branch d="M28,68 C38,68 48,68 52,76" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Leaf x={18} y={122} size={8} angle={-40} />
    </g>
  )
}

function DigitFour() {
  return (
    <g>
      <Matchstick x1={48} y1={10} x2={48} y2={138} scale={1.6} />
      <Branch d="M48,60 C44,52 36,36 6,54 C10,58 18,64 26,68"
        strokeW={4.5} />
      <Matchstick x1={12} y1={60} x2={44} y2={50} scale={1.3} angle={-18} />
      <Branch d="M48,12 C40,8 32,6 28,8" strokeW={3} color="oklch(48% 0.05 52)" />
      <Leaf x={48} y={6} size={9} angle={10} />
      <Leaf x={48} y={140} size={8} angle={90} />
      <Leaf x={8} y={56} size={8} angle={-50} />
      <Matchstick x1={6} y1={58} x2={0} y2={52} scale={1} />
    </g>
  )
}

function DigitFive() {
  return (
    <g>
      <Branch d="M60,10 C30,6 22,12 22,30 C22,42 30,50 40,54"
        strokeW={5} />
      <Branch d="M40,54 C56,54 62,60 62,74 C62,100 54,106 40,106 C18,106 14,118 14,128 C14,136 18,138 40,138 C62,138 68,132 68,128"
        strokeW={5} />
      <Branch d="M58,10 C32,8 24,14 24,30 C24,40 30,47 38,52" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Leaf x={60} y={6} size={9} angle={40} />
      <Leaf x={14} y={128} size={8} angle={-20} />
      <Matchstick x1={56} y1={40} x2={64} y2={42} scale={1.1} />
      <Leaf x={68} y={128} size={7} angle={30} />
    </g>
  )
}

function DigitSix() {
  return (
    <g>
      <Branch d="M56,8 C30,6 18,14 14,70 C12,110 18,132 40,136 C58,138 66,126 66,108 C66,94 58,86 46,84 C30,82 22,90 20,104 C18,112 20,120 26,124"
        strokeW={5} />
      <Branch d="M54,8 C32,8 20,16 18,68 C16,108 20,128 38,134" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Leaf x={56} y={4} size={9} angle={25} />
      <Leaf x={14} y={70} size={8} angle={-70} />
      <Matchstick x1={68} y1={110} x2={74} y2={108} scale={1.2} />
      <Branch d="M22,104 C24,110 28,116 34,118" strokeW={2.8} />
      <Leaf x={26} y={126} size={7} angle={80} />
    </g>
  )
}

function DigitSeven() {
  return (
    <g>
      <Branch d="M12,16 C18,8 30,6 42,6 C56,8 64,14 68,24"
        strokeW={5} />
      <Branch d="M64,21 C54,34 46,56 42,80 C38,104 40,130 44,138"
        strokeW={4.5} />
      <Matchstick x1={68} y1={28} x2={74} y2={30} scale={1.2} />
      <Branch d="M12,18 C20,10 32,8 42,8" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Leaf x={68} y={8} size={8} angle={50} />
      <Leaf x={44} y={140} size={8} angle={85} />
      <Matchstick x1={46} y1={100} x2={52} y2={104} scale={1} />
      <Leaf x={14} y={18} size={7} angle={-30} />
    </g>
  )
}

function DigitEight() {
  return (
    <g>
      <Branch d="M40,8 C56,8 64,16 64,30 C64,44 56,52 46,56"
        strokeW={5} />
      <Branch d="M46,56 C56,58 62,66 62,80 C62,106 54,114 40,114 C22,114 18,106 18,80 C18,66 24,60 34,56"
        strokeW={5} />
      <Branch d="M34,56 C24,54 16,44 16,30 C16,22 18,16 40,8" strokeW={5} />
      <Leaf x={40} y={4} size={9} angle={0} />
      <Leaf x={62} y={80} size={8} angle={60} />
      <Leaf x={18} y={80} size={7} angle={-60} />
      <Matchstick x1={56} y1={40} x2={66} y2={38} scale={1.1} />
      <Matchstick x1={54} y1={100} x2={64} y2={102} scale={1} />
      <Branch d="M30,56 C34,52 40,50 46,52" strokeW={2} color="oklch(52% 0.05 50)" />
    </g>
  )
}

function DigitNine() {
  return (
    <g>
      <Branch d="M24,8 C42,6 68,14 66,38 C64,52 58,56 42,58 C26,60 20,52 18,36 C16,22 22,8 40,6"
        strokeW={5} />
      <Branch d="M26,10 C44,8 64,16 64,38 C64,50 60,55 44,56" strokeW={2.5} color="oklch(48% 0.05 52)" />
      <Leaf x={24} y={4} size={8} angle={-20} />
      <Leaf x={40} y={2} size={9} angle={10} />
      <Matchstick x1={67} y1={38} x2={74} y2={40} scale={1.2} />
      <Branch d="M18,38 C14,50 16,80 20,110 C22,128 28,134 40,136 C52,136 56,130 58,120"
        strokeW={4} />
      <Leaf x={58} y={120} size={8} angle={30} />
      <Leaf x={18} y={60} size={7} angle={-80} />
      <Matchstick x1={14} y1={100} x2={6} y2={98} scale={1.1} />
    </g>
  )
}

const DIGITS: Record<string, () => ReactNode> = {
  '0': DigitZero, '1': DigitOne, '2': DigitTwo, '3': DigitThree,
  '4': DigitFour, '5': DigitFive, '6': DigitSix, '7': DigitSeven,
  '8': DigitEight, '9': DigitNine,
}

/* ────────────────────────────────────────────────────────────────────────────
   Render a single organic digit SVG
   ──────────────────────────────────────────────────────────────────────────── */

function OrganicDigit({ value, size = 140 }: { value: string; size?: number }) {
  const Digit = DIGITS[value]
  if (!Digit) return null
  const h = size * 1.75
  return (
    <svg width={size} height={h} viewBox="0 0 80 140"
      style={{ display: 'block' }}>
      {/* Soft background glow — like moss/soil shadow */}
      <defs>
        <filter id={`shadow-${value}`}>
          <feDropShadow dx={1} dy={2} stdDeviation={3} floodColor="oklch(15% 0.02 40)" floodOpacity={0.2} />
        </filter>
      </defs>
      <g filter={`url(#shadow-${value})`}>
        <Digit />
      </g>
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   The full organic clock: six digits separated by berries
   ──────────────────────────────────────────────────────────────────────────── */

export default function OrganicClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: '00', m: '00', s: '00' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date(); const h24 = d.getHours(); const h12 = h24 % 12 || 12
      setT({
        h: String(h12).padStart(2, '0'),
        m: String(d.getMinutes()).padStart(2, '0'),
        s: String(d.getSeconds()).padStart(2, '0'),
      })
    }
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null

  if (compact) return (
    <span className="topbar-time">{t.h}:{t.m}:{t.s}</span>
  )

  const digitW = 82

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      flexWrap: 'wrap',
    }}>
      {/* Hours */}
      <div style={{ display: 'flex', gap: 4 }}>
        <OrganicDigit value={t.h[0]} size={digitW} />
        <OrganicDigit value={t.h[1]} size={digitW} />
      </div>

      {/* Colon — two berries */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 20, padding: '0 8px',
      }}>
        <Berry r={5} />
        <Berry r={5} />
      </div>

      {/* Minutes */}
      <div style={{ display: 'flex', gap: 4 }}>
        <OrganicDigit value={t.m[0]} size={digitW} />
        <OrganicDigit value={t.m[1]} size={digitW} />
      </div>

      {/* Colon — two berries */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 20, padding: '0 8px',
      }}>
        <Berry r={5} />
        <Berry r={5} />
      </div>

      {/* Seconds */}
      <div style={{ display: 'flex', gap: 4 }}>
        <OrganicDigit value={t.s[0]} size={digitW} />
        <OrganicDigit value={t.s[1]} size={digitW} />
      </div>

      {/* Month/date vine label */}
      <div style={{
        alignSelf: 'flex-end', marginLeft: 10, paddingBottom: 8,
        fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic',
        color: 'var(--ink-60)', letterSpacing: '-0.01em',
      }}>
      </div>
    </div>
  )
}
