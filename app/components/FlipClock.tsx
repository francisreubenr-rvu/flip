'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

function FlipDigit({ value }: { value: string }) {
  const [cur, setCur] = useState(value)
  const [prev, setPrev] = useState(value)
  const [phase, setPhase] = useState<'idle' | 'flipping'>('idle')
  const pending = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value === cur) return
    pending.current = value
    if (phase !== 'idle') return
    doFlip()
  }, [value]) // eslint-disable-line

  const doFlip = useCallback(() => {
    const next = pending.current
    setPrev(cur)
    setPhase('flipping')
    try {
      const c = new (window.AudioContext || (window as any).webkitAudioContext)()
      const b = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.007))
      const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = 0.05
      s.connect(g); g.connect(c.destination); s.start(); s.onended = () => c.close()
    } catch (_) {}
    timer.current = setTimeout(() => {
      setCur(next); setPhase('idle')
      if (pending.current !== next) setTimeout(doFlip, 16)
    }, 320)
  }, [cur])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const show = phase === 'flipping' ? pending.current : cur

  return (
    <div className="flip-digit">
      <div className="flip-digit-frame">
        <div className="flip-half flip-half-top">
          <span className="flip-half-char">{show}</span>
        </div>
        <div className="flip-half flip-half-bot">
          <span className="flip-half-char">{cur}</span>
        </div>
        {phase === 'flipping' && (
          <>
            <div className="flip-anim-card flip-anim-top do-flip-top">
              <span className="flip-half-char" style={{ top: '8%' }}>{prev}</span>
            </div>
            <div className="flip-anim-card flip-anim-bot do-flip-bot">
              <span className="flip-half-char" style={{ top: '-46%' }}>{pending.current}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function FlipClock({ compact = false }: { compact?: boolean }) {
  const [t, setT] = useState({ h: '00', m: '00', s: '00', ap: 'AM' })
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date(); const h24 = d.getHours(); const h12 = h24 % 12 || 12
      setT({ h: String(h12).padStart(2,'0'), m: String(d.getMinutes()).padStart(2,'0'), s: String(d.getSeconds()).padStart(2,'0'), ap: h24 < 12 ? 'AM' : 'PM' })
    }
    tick(); const i = setInterval(tick, 1000); return () => clearInterval(i)
  }, [])

  if (!on) return compact ? <span className="topbar-time">—:—:—</span> : null

  if (compact) return (
    <span className="topbar-time">{t.h}:{t.m}:{t.s} <span style={{ color: 'var(--ink-40)', fontSize: 10, marginLeft: 4 }}>{t.ap}</span></span>
  )

  return (
    <div className="flip-clock">
      <div className="flip-unit">
        <div className="flip-unit-digits"><FlipDigit value={t.h[0]} /><FlipDigit value={t.h[1]} /></div>
        <span className="flip-unit-label">hours</span>
      </div>
      <div className="flip-colon-wrap"><span className="flip-colon">:</span></div>
      <div className="flip-unit">
        <div className="flip-unit-digits"><FlipDigit value={t.m[0]} /><FlipDigit value={t.m[1]} /></div>
        <span className="flip-unit-label">minutes</span>
      </div>
      <div className="flip-colon-wrap"><span className="flip-colon">:</span></div>
      <div className="flip-unit">
        <div className="flip-unit-digits"><FlipDigit value={t.s[0]} /><FlipDigit value={t.s[1]} /></div>
        <span className="flip-unit-label">seconds</span>
      </div>
      <span className="flip-ampm">{t.ap}</span>
    </div>
  )
}
