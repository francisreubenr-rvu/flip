'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import type { MutableRefObject } from 'react'

const CHANNELS = [
  { id: 'rain',     label: 'Rain',     sub: 'thunderstorm + ambience', src: '/audio/rain.mp3',     note: 'Storm sounds mask speech-frequency distractors without semantic content.' },
  { id: 'binaural', label: 'Binaural', sub: 'theta 6Hz beats',         src: '/audio/binaural.mp3', note: 'Theta binaural beats (6Hz). Memory + attention effects. Use headphones.' },
  { id: 'cafe',     label: 'Café',     sub: 'coffee shop voices',      src: '/audio/cafe.mp3',     note: 'Background murmur provides auditory presence without lyrical interference.' },
  { id: 'forest',   label: 'Forest',   sub: 'birds + nature',          src: '/audio/forest.mp3',   note: 'Nature sounds: strongest cross-study evidence for attention restoration.' },
  { id: 'brown',    label: 'Brown',    sub: 'pure low frequency',      src: '/audio/brown.mp3',    note: 'Deep low-frequency masking. Preferred for high-load reading and writing.' },
]

const BARS = Array.from({ length: 52 }, (_, i) => ({
  h: (Math.abs(Math.sin(i * 0.5 + 1) * 60 + Math.sin(i * 1.3) * 30) + 10).toFixed(2),
  d: ((i % 7) * 0.07).toFixed(2),
  dur: (0.5 + (i % 5) * 0.16).toFixed(2),
}))

export default function MusicPlayer({ onPlay, stopRef }: { onPlay?: () => void; stopRef?: MutableRefObject<(() => void) | null> }) {
  const [playing, setPlaying] = useState(false)
  const [ch, setCh] = useState(CHANNELS[0])
  const [elapsed, setElapsed] = useState(0)
  const [resumeNeeded, setResumeNeeded] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const timRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Stable ref so the visibilitychange closure always sees current playing state
  const playingRef = useRef(false)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => () => { if (timRef.current) clearInterval(timRef.current) }, [])

  const startTimer = () => {
    if (timRef.current) clearInterval(timRef.current)
    setElapsed(0)
    timRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  const setupMediaSession = useCallback((channel: typeof CHANNELS[0]) => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: channel.label,
      artist: channel.sub,
      album: 'Flip · Focus',
    })
    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play()
      setPlaying(true)
      setResumeNeeded(false)
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
      setPlaying(false)
    })
    navigator.mediaSession.setActionHandler('stop', () => {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.currentTime = 0
      setPlaying(false)
      setResumeNeeded(false)
    })
  }, [])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.currentTime = 0 }
    setPlaying(false)
    setResumeNeeded(false)
    if (timRef.current) { clearInterval(timRef.current); timRef.current = null }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'
  }, [])

  useEffect(() => {
    if (stopRef) stopRef.current = stopPlayback
  })

  // When the tab regains visibility and the audio was silently interrupted (iOS, Android)
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && playingRef.current && audioRef.current?.paused) {
        setResumeNeeded(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  const startPlaying = useCallback(async (channel: typeof CHANNELS[0]) => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src.endsWith(channel.src)) audio.src = channel.src
    try {
      await audio.play()
      setPlaying(true)
      setResumeNeeded(false)
      setupMediaSession(channel)
      startTimer()
      onPlay?.()
    } catch {
      // Autoplay blocked — user must interact first (shouldn't happen since we're in a click handler)
      setPlaying(false)
    }
  }, [onPlay, setupMediaSession])

  const toggle = () => {
    if (playing) { stopPlayback() } else { startPlaying(ch) }
  }

  const selectChannel = (c: typeof CHANNELS[0]) => {
    if (c.id === ch.id && playing) return
    setCh(c)
    startPlaying(c)
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="sound-layout">
      <audio ref={audioRef} loop preload="none" />

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
          {BARS.map((b, i) => (
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
            {playing ? 'playing' : 'tap to play'}
          </span>
        </div>

        {resumeNeeded && (
          <button className="resume-banner" onClick={() => startPlaying(ch)}>
            audio paused — tap to resume
          </button>
        )}

        <div className="sound-footnote">{ch.note}</div>
      </div>
    </div>
  )
}
