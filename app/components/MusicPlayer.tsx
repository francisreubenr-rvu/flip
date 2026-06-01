'use client'
import { useState, useRef, useEffect } from 'react'
import { Play, Pause } from 'lucide-react'
import type { CSSProperties } from 'react'

const CHANNELS = [
  { id: 'rain',     label: 'Rain',     sub: 'thunderstorm + ambience', ytId: '3MBTtuEXMpc',  note: 'Storm sounds mask speech-frequency distractors without semantic content.' },
  { id: 'binaural', label: 'Binaural', sub: 'theta 6Hz beats',         ytId: '_E95KdGPNdA',  note: 'Theta binaural beats (6Hz). Memory + attention effects. Use headphones.' },
  { id: 'cafe',     label: 'Café',     sub: 'coffee shop voices',      ytId: 'BPyp3GHk-d4',  note: 'Background murmur provides auditory presence without lyrical interference.' },
  { id: 'forest',   label: 'Forest',   sub: 'birds + nature',          ytId: 'CqXeTN-xkm0',  note: 'Nature sounds: strongest cross-study evidence for attention restoration.' },
  { id: 'brown',    label: 'Brown',    sub: 'pure low frequency',      ytId: 'IOijfCTQPGQ',  note: 'Deep low-frequency masking. Preferred for high-load reading and writing.' },
]

export default function MusicPlayer({ onPlay }: { onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [ch, setCh] = useState(CHANNELS[0])
  const [elapsed, setElapsed] = useState(0)
  const [iframeKey, setIframeKey] = useState(0)
  const timRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    if (timRef.current) clearInterval(timRef.current)
    timRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }
  useEffect(() => () => { if (timRef.current) clearInterval(timRef.current) }, [])

  const selectChannel = (c: typeof CHANNELS[0]) => {
    onPlay?.()
    setCh(c)
    if (playing) { setIframeKey(k => k + 1); setElapsed(0); startTimer() }
  }

  const toggle = () => {
    if (playing) {
      setPlaying(false)
      if (timRef.current) clearInterval(timRef.current)
    } else {
      setPlaying(true); setElapsed(0); setIframeKey(k => k + 1); startTimer(); onPlay?.()
    }
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const bars = Array.from({ length: 52 }, (_, i) => ({
    h: (Math.abs(Math.sin(i * 0.5 + 1) * 60 + Math.sin(i * 1.3) * 30) + 10).toFixed(2),
    d: ((i % 7) * 0.07).toFixed(2),
    dur: (0.5 + (i % 5) * 0.16).toFixed(2),
  }))

  return (
    <div className="sound-layout">
      {/* Hidden YouTube iframe — audio only, injected on play */}
      {playing && (
        <iframe
          key={iframeKey}
          src={`https://www.youtube.com/embed/${ch.ytId}?autoplay=1&loop=1&playlist=${ch.ytId}&controls=0&rel=0`}
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          style={{ position: 'fixed', width: 1, height: 1, opacity: 0, border: 'none', bottom: 0, left: 0, pointerEvents: 'none' } as CSSProperties}
        />
      )}

      <div className="channel-list">
        {CHANNELS.map((c, i) => (
          <button key={c.id} className={`channel-item ${ch.id === c.id ? 'active' : ''}`} onClick={() => selectChannel(c)}>
            <span className="ch-num">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <span className="ch-name">{c.label}</span><br />
              <span className="ch-sub">{c.sub}</span>
            </div>
            <span className="ch-state">{ch.id === c.id ? (playing ? '▶ play' : '— sel') : ''}</span>
          </button>
        ))}
      </div>

      <div className="sound-stage">
        <div className="now-playing">
          <div>
            <div className="np-label">Now playing</div>
            <div className="np-name">{ch.label}</div>
          </div>
          <span className="np-elapsed">{fmt(elapsed)}</span>
        </div>

        <div className="waveform-big">
          {bars.map((b, i) => (
            <div key={i} className={`wave-bar ${playing ? 'live' : ''}`} style={{
              height: `${b.h}%`,
              ...(playing ? { animationDuration: `${b.dur}s`, animationDelay: `${b.d}s` } : {}),
            }} />
          ))}
        </div>

        <div className="sound-ctrls">
          <button className="btn-circle primary" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-25)', letterSpacing: '0.1em' }}>
            {playing ? 'streaming from youtube' : 'tap to stream'}
          </span>
        </div>

        <div className="sound-footnote">{ch.note}</div>
      </div>
    </div>
  )
}
