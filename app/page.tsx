'use client'
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import InkStampClock from './components/InkStampClock'
import Pomodoro from './components/Pomodoro'
import MusicPlayer from './components/MusicPlayer'
import MiniGames from './components/MiniGames'
import BreathingOrb from './components/BreathingOrb'
import Calendar from './components/Calendar'
import Folio from './components/Folio'
import RocketOrbit from './components/RocketOrbit'
import GolfNav from './components/GolfNav'

type Mode = 'work' | 'short-break' | 'long-break'

/* ─── Persistence ────────────────────────────────────────────────────────── */

type SessionLog = { start: string; end: string; duration: number; intention: string }
type DayData = { date: string; intention: string; ifThen: string; sessions: SessionLog[] }

function loadDay(key: string): DayData | null {
  if (typeof window === 'undefined') return null
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null } catch { return null }
}
function saveDay(key: string, data: DayData) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}
function todayKey(): string {
  const d = new Date()
  return `flip-day-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function pct() { const n=new Date();return Math.round((n.getHours()*3600+n.getMinutes()*60+n.getSeconds())/86400*100) }
function weekInfo() { const n=new Date();const s=new Date(n.getFullYear(),0,1);const d=Math.floor((n.getTime()-s.getTime())/86400000)+1;return{day:d,week:Math.ceil(d/7)} }

export default function FlipPage() {
  const [mode, setMode] = useState<Mode>('work')
  const [mounted, setMounted] = useState(false)
  const [dayPct, setDayPct] = useState(0)
  const [page, setPage] = useState(0)
  const totalPages = 5

  // Daily state
  const [intention, setIntention] = useState('')
  const [ifThen, setIfThen] = useState('')
  const [committed, setCommitted] = useState(false)
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [totalFocus, setTotalFocus] = useState(0)

  // Calendar popup state
  const [showCalendar, setShowCalendar] = useState(false)

  // ─── Ambient: brown noise + YouTube ──────────────────────────────────────
  const [ambientOn, setAmbientOn] = useState(false)
  const hasStartedRef = useRef(false)
  const brownCtxRef = useRef<AudioContext | null>(null)

  // ─── Scroll-snap refs ─────────────────────────────────────────────────────
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  const { day, week } = mounted ? weekInfo() : { day: 0, week: 0 }
  const weeksLeft = 52 - week
  const yrPct = mounted ? Math.round((day / 365) * 100) : 0
  const key = mounted ? todayKey() : ''

  // Load today's data from localStorage
  useEffect(() => {
    setMounted(true)
    setDayPct(pct())
    const d = loadDay(key)
    if (d) {
      setIntention(d.intention)
      setIfThen(d.ifThen)
      setCommitted(!!d.intention)
      setSessions(d.sessions)
      setTotalFocus(d.sessions.reduce((sum, s) => sum + s.duration, 0))
    }
    const i = setInterval(() => setDayPct(pct()), 60000)
    return () => clearInterval(i)
  }, [key])

  // Sync page state from scroll position
  useEffect(() => {
    if (!mounted) return
    const observers: IntersectionObserver[] = []
    pageRefs.current.forEach((ref, i) => {
      if (!ref) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setPage(i) },
        { threshold: 0.55 }
      )
      obs.observe(ref)
      observers.push(obs)
    })
    return () => observers.forEach(obs => obs.disconnect())
  }, [mounted])

  // ─── Wake Lock: keep screen awake while page is visible ─────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    const acquire = async () => {
      try { lock = await (navigator as any).wakeLock.request('screen') } catch {}
    }
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release() }
  }, [])

  // ─── Ambient start: brown noise + YouTube on first user gesture ───────────
  const startAmbient = useCallback(async () => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true
    setAmbientOn(true)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      await ctx.resume()
      const sr = ctx.sampleRate, size = sr * 4
      const buf = ctx.createBuffer(1, size, sr)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < size; i++) {
        const w = Math.random() * 2 - 1
        d[i] = (last + 0.02 * w) / 1.02
        last = d[i]
        d[i] *= 3
      }
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
      const g = ctx.createGain(); g.gain.value = 0.3
      src.connect(lp); lp.connect(g); g.connect(ctx.destination)
      src.start()
      brownCtxRef.current = ctx
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted) return
    const go = () => startAmbient()
    document.addEventListener('click', go, { once: true })
    document.addEventListener('keydown', go, { once: true })
    return () => {
      document.removeEventListener('click', go)
      document.removeEventListener('keydown', go)
    }
  }, [mounted, startAmbient])

  useEffect(() => () => { brownCtxRef.current?.close() }, [])

  // Save to localStorage on changes
  const persist = useCallback((s: SessionLog[], intent: string, ift: string) => {
    saveDay(key, { date: key, intention: intent, ifThen: ift, sessions: s })
  }, [key])

  const commitIntention = () => {
    if (!intention.trim()) return
    setCommitted(true)
    persist(sessions, intention, ifThen)
  }

  // Called when a pomodoro session completes
  const onSessionComplete = (duration: number) => {
    const log: SessionLog = {
      start: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      end: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      duration,
      intention,
    }
    const updated = [...sessions, log]
    setSessions(updated)
    setTotalFocus(prev => prev + duration)
    persist(updated, intention, ifThen)
  }

  const scrollToPage = (n: number) => {
    setPage(n)
    pageRefs.current[n]?.scrollIntoView({ behavior: 'smooth' })
  }

  const now = new Date()
  const dateLong = mounted ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''
  const focusMin = Math.floor(totalFocus / 60)

  const pageLabel = ['Daily Page', 'Focus', 'Sound', 'Rest', 'Play']

  if (!mounted) return null

  return (
    <div className="notebook" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar: brand + ambient clock + folio ──────────────────────── */}
      <header className="topbar">
        <div className="topbar-bg" />
        <div className="topbar-brand">fl<span>i</span>p</div>
        <div className="topbar-rhythm">
          <Folio />
          <span className="topbar-rhythm-sep">·</span>
          <span>WK{week} DY{day}</span>
          <span className="topbar-rhythm-sep">·</span>
          <span>{dayPct}% spent</span>
          {ambientOn && (
            <>
              <span className="topbar-rhythm-sep">·</span>
              <span style={{ color: 'var(--accent)', animation: 'dotPulse 4s ease-in-out infinite' }}>♪ ambient</span>
            </>
          )}
        </div>
        <RocketOrbit><InkStampClock compact /></RocketOrbit>
      </header>

      {/* ── Sidebar margin stats ────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: 20, top: '50%', transform: 'translateY(-50%)',
        zIndex: 80, pointerEvents: 'none', maxWidth: 50,
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--ink-60)', letterSpacing: '0.08em', lineHeight: 1.4 }}>
          <span>WK{week}</span><br/>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-40)' }}>{weeksLeft} left</span><br/>
          <span style={{ display: 'block', marginTop: 8 }}>DY{day}</span><br/>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-40)' }}>{yrPct}% of yr</span>
        </div>
      </div>

      {/* ── Golf-sphere page nav ────────────────────────────────────────── */}
      <GolfNav page={page} onNavigate={scrollToPage} />

      {/* ── Hidden YouTube background player (injected after first gesture) ── */}
      {ambientOn && (
        <iframe
          src="https://www.youtube.com/embed/XNBV9PcH8ik?autoplay=1&loop=1&playlist=XNBV9PcH8ik&controls=0&rel=0"
          allow="autoplay; encrypted-media"
          aria-hidden="true"
          style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none', bottom: 0, right: 0 } as CSSProperties}
        />
      )}

      {/* ── Scroll-snap page area ────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
        minHeight: 0,
      }}>

        {/* ── PAGE 0: DAILY PAGE ──────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[0] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 28,
            padding: '40px 80px 40px 100px',
          }}
        >
          {/* Date header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 5vw, 64px)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink-100)', letterSpacing: '-0.02em' }}>
              {dateLong}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-40)', letterSpacing: '0.14em', marginTop: 8 }}>
              PAGE {page + 1} OF {totalPages} · {focusMin} MIN FOCUSED TODAY
            </div>
          </div>

          {/* Intention block */}
          {!committed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: 600, width: '100%' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(22px, 2.5vw, 36px)', fontStyle: 'italic', color: 'var(--ink-60)', textAlign: 'center' }}>
                What will you focus on today?
              </div>
              <input
                className="intent-input"
                type="text"
                value={intention}
                onChange={e => setIntention(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && intention.trim() && commitIntention()}
                placeholder="one specific thing, written in your own hand"
                autoFocus
                style={{ textAlign: 'center', fontSize: 'clamp(20px, 2.5vw, 34px)' }}
              />
              <input
                className="intent-input"
                type="text"
                value={ifThen}
                onChange={e => setIfThen(e.target.value)}
                placeholder="...and if you get stuck?"
                style={{ textAlign: 'center', fontSize: 'clamp(16px, 2vw, 24px)' }}
              />
              <button className="btn-circle primary" style={{ width: 56, height: 56, marginTop: 12 }}
                onClick={commitIntention} disabled={!intention.trim()}>
                <span style={{ fontSize: 20 }}>→</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', maxWidth: 600, width: '100%' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3vw, 48px)', fontStyle: 'italic', color: 'var(--ink-100)', letterSpacing: '-0.01em', textAlign: 'center' }}>
                {intention}
              </div>
              {ifThen && (
                <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(16px, 2vw, 24px)', fontStyle: 'italic', color: 'var(--ink-60)' }}>
                  if stuck → {ifThen}
                </div>
              )}
              <button className="intent-edit-btn" onClick={() => setCommitted(false)}>edit intention</button>

              {/* Session log */}
              {sessions.length > 0 && (
                <div style={{
                  width: '100%', borderTop: '1px solid var(--grid-major)',
                  paddingTop: 16, marginTop: 8,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-40)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    Today's Sessions
                  </div>
                  {sessions.map((s, i) => (
                    <div key={i} style={{
                      fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-60)',
                      display: 'flex', gap: 16, alignItems: 'baseline',
                    }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{String(i+1).padStart(2,'0')}</span>
                      <span style={{ color: 'var(--ink-25)' }}>{s.start}–{new Date(new Date(`2000-01-01 ${s.start}`).getTime() + s.duration * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ color: 'var(--ink-40)' }}>{s.duration} min</span>
                    </div>
                  ))}
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-80)', marginTop: 8 }}>
                    {focusMin} minutes of deep work today
                  </div>
                </div>
              )}

              {/* Calendar toggle */}
              <button onClick={() => setShowCalendar(c => !c)} style={{
                fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.10em',
                color: 'var(--ink-40)', background: 'none', border: 'none', cursor: 'pointer',
                marginTop: 8, textTransform: 'uppercase',
              }}>
                {showCalendar ? 'hide calendar' : 'show calendar'}
              </button>
              {showCalendar && <Calendar />}
            </div>
          )}
        </div>

        {/* ── PAGE 1: FOCUS ────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[1] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 24,
            padding: '40px 80px 40px 100px',
            background: 'var(--page-cream)',
          }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(48px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
            Focus <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Session</em>
          </div>
          <Pomodoro onModeChange={setMode} onSessionComplete={onSessionComplete} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-40)', letterSpacing: '0.08em', textAlign: 'center', maxWidth: 480 }}>
            Each completed session is logged to your daily page. Gollwitzer 2006: if-then intentions (d=0.65) more than double follow-through.
          </div>
        </div>

        {/* ── PAGE 2: SOUND ─────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[2] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 28,
            padding: '40px 80px 40px 100px',
          }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(48px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
            Sound <em style={{ fontStyle: 'italic', color: 'var(--ink-60)' }}>Environment</em>
          </div>
          <MusicPlayer />
        </div>

        {/* ── PAGE 3: REST ──────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[3] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 24,
            padding: '40px 80px 40px 100px',
          }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(48px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
            Rest <em style={{ fontStyle: 'italic', color: 'var(--break-color)' }}>& Recover</em>
          </div>
          <BreathingOrb />
          <div className="breath-cue-text">box breathing · 4-4-4-4</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-60)', textAlign: 'center', maxWidth: 500 }}>
            Rest is not weakness. It is the work continuing without you. Soft fascination restores directed attention. Hard fascination depletes it.
          </div>
        </div>

        {/* ── PAGE 4: PLAY ──────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[4] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 20, padding: '40px 80px 40px 100px',
          }}
        >
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
            Play <em style={{ fontStyle: 'italic', color: 'var(--ink-60)' }}>After Work</em>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-60)', textAlign: 'center', maxWidth: 560 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', fontStyle: 'normal', marginRight: 8 }}>Note</span>
            Games are hard fascination. Use after sessions, not during breaks. Real recovery is silence, sky, and movement.
          </div>
          <MiniGames disabled={false} />
        </div>
      </div>

      {/* ── Bottom page navigation ──────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--grid-major)',
        padding: '12px 28px 12px 76px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--page)',
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-40)', letterSpacing: '0.10em' }}>
          {pageLabel[page]}
          {!ambientOn && (
            <span style={{ marginLeft: 16, fontSize: 11, color: 'var(--ink-25)', animation: 'dotPulse 3s ease-in-out infinite' }}>
              · tap anywhere to begin ambient
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => scrollToPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.10em',
              background: 'none', border: '1px solid var(--grid-major)',
              borderRadius: 3, padding: '6px 16px', cursor: page === 0 ? 'default' : 'pointer',
              color: page === 0 ? 'var(--ink-25)' : 'var(--ink-80)',
              opacity: page === 0 ? 0.4 : 1,
            }}>
            ← prev
          </button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-25)', letterSpacing: '0.16em' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => scrollToPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            style={{
              fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.10em',
              background: 'none', border: '1px solid var(--grid-major)',
              borderRadius: 3, padding: '6px 16px', cursor: page === totalPages - 1 ? 'default' : 'pointer',
              color: page === totalPages - 1 ? 'var(--ink-25)' : 'var(--ink-80)',
              opacity: page === totalPages - 1 ? 0.4 : 1,
            }}>
            next →
          </button>
        </div>
      </div>
    </div>
  )
}
