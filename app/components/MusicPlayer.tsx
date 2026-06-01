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

function ytSrc(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&controls=0&rel=0&enablejsapi=0`
}

export default function MusicPlayer({ onPlay }: { onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [ch, setCh] = useState(CHANNELS[0])
  const [elapsed, setElapsed] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chRef = useRef(ch)  // keep a ref so event handlers always see the current channel

  useEffect(() => { chRef.current = ch }, [ch])
  useEffect(() => () => { if (timRef.current) clearInterval(timRef.current) }, [])

  const startTimer = () => {
    if (timRef.current) clearInterval(timRef.current)
    setElapsed(0)
    timRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  // Sets iframe.src synchronously inside the user-gesture call stack so
  // iOS Safari counts it as a user-triggered autoplay (not a deferred React render).
  const loadChannel = (c: typeof CHANNELS[0]) => {
    if (iframeRef.current) iframeRef.current.src = ytSrc(c.ytId)
  }

  const clearIframe = () => {
    if (iframeRef.current) iframeRef.current.src = 'about:blank'
  }

  const toggle = () => {
    if (playing) {
      clearIframe()
      setPlaying(false)
      if (timRef.current) clearInterval(timRef.current)
    } else {
      loadChannel(ch)       // synchronous — must happen before any await/setState
      setPlaying(true)
      startTimer()
      onPlay?.()
    }
  }

  const selectChannel = (c: typeof CHANNELS[0]) => {
    onPlay?.()
    setCh(c)
    chRef.current = c
    if (playing) {
      loadChannel(c)        // synchronous channel swap — still inside click handler
      startTimer()
    }
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const bars = Array.from({ length: 52 }, (_, i) => ({
    h: (Math.abs(Math.sin(i * 0.5 + 1) * 60 + Math.sin(i * 1.3) * 30) + 10).toFixed(2),
    d: ((i % 7) * 0.07).toFixed(2),
    dur: (0.5 + (i % 5) * 0.16).toFixed(2),
  }))

  const hidden: CSSProperties = {
    position: 'fixed', width: 1, height: 1, opacity: 0,
    border: 'none', bottom: 0, left: 0, pointerEvents: 'none',
  }

  return (
    <div className="sound-layout">
      {/* Always in DOM so we can set .src synchronously in the click handler */}
      <iframe
        ref={iframeRef}
        src="about:blank"
        allow="autoplay; encrypted-media"
        aria-hidden="true"
        style={hidden}
      />

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
