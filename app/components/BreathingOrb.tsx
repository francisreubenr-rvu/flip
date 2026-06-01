'use client'
import { useState, useEffect, useRef } from 'react'

type Phase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out'
const BREATH: { phase: Phase; duration: number; label: string }[] = [
  { phase: 'inhale', duration: 4000, label: 'breathe in' },
  { phase: 'hold-in', duration: 4000, label: 'hold' },
  { phase: 'exhale', duration: 4000, label: 'breathe out' },
  { phase: 'hold-out', duration: 4000, label: 'hold' },
]

export default function BreathingOrb() {
  const [idx, setIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const cur = BREATH[idx]
      if (elapsed >= cur.duration) {
        setIdx(p => (p + 1) % BREATH.length)
        startRef.current = Date.now()
        setProgress(0)
      } else setProgress(elapsed / cur.duration)
    }, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [idx])

  const cur = BREATH[idx]
  const scale = cur.phase === 'inhale' ? 0.55 + progress * 0.55
              : cur.phase === 'exhale' ? 1.1 - progress * 0.55
              : cur.phase === 'hold-in' ? 1.1 : 0.55
  const opacity = cur.phase === 'inhale' || cur.phase === 'hold-in' ? 0.75 : 0.45

  return (
    <div className="breath-stage">
      <div className="breath-ring-bg" />
      <div className="breath-orb" style={{ transform: `scale(${scale})`, opacity, transition: 'transform 0.05s linear, opacity 0.05s linear' }} />
      <span className="breath-label">{cur.label}</span>
    </div>
  )
}
