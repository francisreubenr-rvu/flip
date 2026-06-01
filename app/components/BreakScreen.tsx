'use client'

import { useState, useEffect, useRef } from 'react'

/* ─── Breathing animation phases ────────────────────────────────────────────── */

type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out'

const BOX_BREATH: { phase: BreathPhase; duration: number; label: string }[] = [
  { phase: 'inhale',   duration: 4000, label: 'breathe in' },
  { phase: 'hold-in',  duration: 4000, label: 'hold' },
  { phase: 'exhale',   duration: 4000, label: 'breathe out' },
  { phase: 'hold-out', duration: 4000, label: 'hold' },
]

const BREAK_PROMPTS = [
  'Stand up. Look out a window.',
  'Take a slow walk — no destination.',
  'Let your eyes rest on something distant.',
  'Notice three things you can hear right now.',
  'Roll your shoulders. Breathe slowly.',
  'Do nothing for 60 seconds. That\'s enough.',
]

/* ─── Breathing circle component ────────────────────────────────────────────── */

function BreathingCircle({ active }: { active: boolean }) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [progress, setProgress]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!active) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    startRef.current = Date.now()

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const current = BOX_BREATH[phaseIdx]
      if (elapsed >= current.duration) {
        setPhaseIdx(p => (p + 1) % BOX_BREATH.length)
        startRef.current = Date.now()
        setProgress(0)
      } else {
        setProgress(elapsed / current.duration)
      }
    }, 50)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [active, phaseIdx])

  const currentPhase = BOX_BREATH[phaseIdx]

  // Scale: inhale → grows, exhale → shrinks, holds → steady
  const scale = currentPhase.phase === 'inhale'    ? 0.55 + progress * 0.45
              : currentPhase.phase === 'exhale'   ? 1.0  - progress * 0.45
              : currentPhase.phase === 'hold-in'  ? 1.0
              :                                     0.55

  const baseR  = 50
  const circum = 2 * Math.PI * baseR

  const glowColor = currentPhase.phase === 'inhale' ? 'oklch(52% 0.16 248)'
                  : currentPhase.phase === 'exhale' ? 'oklch(55% 0.22 22)'
                  : 'oklch(52% 0.16 152)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    }}>
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        {/* Background ring */}
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="80" cy="80" r={baseR}
            fill="none"
            stroke="var(--border-1)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          {/* Progress arc */}
          <circle cx="80" cy="80" r={baseR}
            fill="none"
            stroke={glowColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circum}
            strokeDashoffset={circum * (1 - progress)}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke 0.3s ease, stroke-dashoffset 0.05s linear',
            }}
          />
        </svg>

        {/* Breathing orb */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: glowColor,
            opacity: 0.15 + scale * 0.12,
            transform: `scale(${scale})`,
            transition: 'transform 0.05s linear, background 0.3s ease, opacity 0.3s ease',
            boxShadow: `0 0 ${30 * scale}px ${glowColor}`,
          }} />
        </div>

        {/* Phase label */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font)',
            fontSize: 12,
            color: 'var(--text-3)',
            fontStyle: 'italic',
          }}>
            {currentPhase.label}
          </span>
        </div>
      </div>

      <p style={{
        fontFamily: 'var(--font)',
        fontSize: 11,
        color: 'var(--text-3)',
        textAlign: 'center',
        letterSpacing: '0.04em',
      }}>
        box breathing · 4-4-4-4
      </p>
    </div>
  )
}

/* ─── Ambient particle (soft-fascination) ────────────────────────────────────── */

function DriftingParticles() {
  return (
    <div style={{
      position: 'relative', width: '100%', height: 60, overflow: 'hidden',
    }}>
      <svg width="100%" height="60" viewBox="0 0 280 60">
        {Array.from({ length: 8 }).map((_, i) => {
          const x = 10 + i * 34 + (i % 2) * 12
          const delay = i * 0.7
          const size  = 3 + (i % 3) * 2
          return (
            <circle
              key={i}
              cx={x} cy={30 + (i % 3 - 1) * 10}
              r={size}
              fill="var(--text-3)"
              opacity={0.25}
              style={{
                animation: `drift ${4 + (i % 3)}s ease-in-out infinite alternate`,
                animationDelay: `${delay}s`,
              }}
            />
          )
        })}
      </svg>
      <style>{`
        @keyframes drift {
          from { transform: translateY(0px) translateX(0px); opacity: 0.1; }
          to   { transform: translateY(-8px) translateX(4px); opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

/* ─── BreakScreen ────────────────────────────────────────────────────────────── */

export default function BreakScreen({ mode }: { mode: 'short-break' | 'long-break' }) {
  const [prompt] = useState(() => BREAK_PROMPTS[Math.floor(Math.random() * BREAK_PROMPTS.length)])
  const [breathing, setBreathing] = useState(false)

  const isLong = mode === 'long-break'

  return (
    <div style={{
      border: '1px solid var(--border-1)',
      borderRadius: 4,
      padding: '20px 20px',
      background: 'var(--surface-2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font)',
          fontSize: 18,
          color: isLong ? 'var(--amber)' : 'var(--green)',
          fontWeight: 700,
          marginBottom: 4,
        }}>
          {isLong ? 'Long Break' : 'Short Break'}
        </div>
        <p style={{
          fontFamily: 'var(--font)',
          fontSize: 13,
          color: 'var(--text-3)',
          fontStyle: 'italic',
        }}>
          {isLong ? '20 minutes — move your body' : '5 minutes — soft attention only'}
        </p>
      </div>

      {/* Soft fascination prompt */}
      <div style={{
        textAlign: 'center',
        padding: '12px 16px',
        background: 'var(--surface-3)',
        borderRadius: 2,
        border: '1px solid var(--border-1)',
      }}>
        <p style={{
          fontFamily: 'var(--font)',
          fontSize: 15,
          color: 'var(--text-2)',
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>
          {prompt}
        </p>
      </div>

      {/* Drifting particles (soft fascination) */}
      <DriftingParticles />

      {/* Breathing exercise */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {!breathing ? (
          <button
            onClick={() => setBreathing(true)}
            className="btn-terminal"
            style={{ fontSize: 12, padding: '6px 16px' }}
          >
            box breathing
          </button>
        ) : (
          <>
            <BreathingCircle active={breathing} />
            <button
              onClick={() => setBreathing(false)}
              style={{ fontFamily: 'var(--font)', fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              stop
            </button>
          </>
        )}
      </div>

      {/* ART science note */}
      <div style={{
        fontFamily: 'var(--font)',
        fontSize: 10.5,
        color: 'var(--text-3)',
        lineHeight: 1.55,
        fontStyle: 'italic',
        borderTop: '1px solid var(--border-1)',
        paddingTop: 10,
        textAlign: 'center',
      }}>
        <strong>Why this matters:</strong> Games and social media during breaks are
        hard fascination — they fully capture attention and deplete, not restore, directed focus.
        Soft engagement (nature, breath, stillness) activates the Default Mode Network,
        enabling true attentional recovery. (Kaplan & Kaplan, 1989; Basu et al. 2019)
      </div>
    </div>
  )
}
