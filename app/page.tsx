'use client'
import React, { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import InkStampClock from './components/InkStampClock'
import Pomodoro from './components/Pomodoro'
import MusicPlayer from './components/MusicPlayer'
import MiniGames from './components/MiniGames'
import BreathingOrb from './components/BreathingOrb'
import Calendar from './components/Calendar'
import Folio from './components/Folio'
import RocketOrbit from './components/RocketOrbit'
import OceanWorld  from './components/OceanWorld'
import GolfNav from './components/GolfNav'
import Widgets from './components/Widgets'
import { useAuth } from './lib/auth'
import { motion } from 'framer-motion'

type Mode = 'work' | 'short-break' | 'long-break'

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setMobile(mq.matches)
    const cb = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  return mobile
}

/* ─── Persistence ────────────────────────────────────────────────────────── */

type SessionLog = { start: string; end: string; duration: number; intention: string }
type DayData = { date: string; intention: string; ifThen: string; sessions: SessionLog[] }

function loadDay(key: string): DayData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || typeof d !== 'object') return null
    // Normalise shape so a legacy/corrupt record can't crash the mount effect
    // (e.g. sessions.reduce on a non-array would lock the user out entirely).
    return {
      ...d,
      intention: typeof d.intention === 'string' ? d.intention : '',
      ifThen: typeof d.ifThen === 'string' ? d.ifThen : '',
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
    } as DayData
  } catch { return null }
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

function usePastIntention() {
  const [past, setPast] = useState<{ date: string; intention: string } | null>(null)
  useEffect(() => {
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const k = `flip-day-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const data = loadDay(k)
      if (data?.intention) {
        setPast({
          date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          intention: data.intention,
        })
        break
      }
    }
  }, [])
  return past
}

function InkReveal({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <motion.div key={text} style={style}>
      {text.split(' ').map((word, wi) => (
        <motion.span
          key={wi}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: wi * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'inline' }}
        >
          {word}{wi < text.split(' ').length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </motion.div>
  )
}

export default function FlipPage() {
  const [mode, setMode] = useState<Mode>('work')
  const [mounted, setMounted] = useState(false)
  const [dayPct, setDayPct] = useState(0)
  const [page, setPage] = useState(0)
  const totalPages = 5
  const [isDark, setIsDark] = useState(false)

  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/signin')
  }, [user, authLoading, router])

  // Sync dark theme state from <html data-theme>
  useEffect(() => {
    setIsDark(document.documentElement.dataset.theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : ''
    try { localStorage.setItem('flip-theme', next ? 'dark' : 'light') } catch {}
  }

  // Daily state
  const [intention, setIntention] = useState('')
  const [ifThen, setIfThen] = useState('')
  const [committed, setCommitted] = useState(false)
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [totalFocus, setTotalFocus] = useState(0)

  // Calendar popup state
  const [showCalendar, setShowCalendar] = useState(false)

  const pastIntention = usePastIntention()

  // ─── Ambient: brown noise + YouTube ──────────────────────────────────────
  const [ambientOn, setAmbientOn] = useState(false)
  const hasStartedRef = useRef(false)
  const brownCtxRef = useRef<AudioContext | null>(null)
  const ambientIframeRef = useRef<HTMLIFrameElement>(null)
  const musicStopRef = useRef<(() => void) | null>(null)

  // ─── Scroll-snap refs ─────────────────────────────────────────────────────
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  const { day, week } = mounted ? weekInfo() : { day: 0, week: 0 }
  const isMobile = useIsMobile()
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

  // ─── Wake Lock: keep screen awake ────────────────────────────────────────
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let acquiring = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || acquiring || lock) return
      acquiring = true
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => { lock = null; acquire() })
      } catch {
      } finally {
        acquiring = false
      }
    }

    acquire()
    const onVis = () => { if (document.visibilityState === 'visible' && !lock) acquire() }
    const timer = setInterval(() => { if (!lock) acquire() }, 15000)
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(timer)
      lock?.release()
    }
  }, [])

  // ─── Ambient: brown noise bed + YouTube lofi ─────────────────────────────
  const startAmbient = useCallback(async () => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true
    // Set src synchronously — iOS Safari requires iframe load to happen in the user-gesture call stack
    if (ambientIframeRef.current) {
      ambientIframeRef.current.src = 'https://www.youtube.com/embed/XNBV9PcH8ik?autoplay=1&loop=1&playlist=XNBV9PcH8ik&controls=0&rel=0&playsinline=1'
    }
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

  const stopAmbient = useCallback(() => {
    hasStartedRef.current = false
    setAmbientOn(false)
    if (ambientIframeRef.current) ambientIframeRef.current.src = 'about:blank'
    brownCtxRef.current?.close()
    brownCtxRef.current = null
    musicStopRef.current?.()
  }, [])

  // Tap-anywhere ambient start — desktop only; mobile uses the Sound page button
  useEffect(() => {
    if (!mounted) return
    if (window.innerWidth <= 640) return
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

  if (!mounted || authLoading || !user) return null

  return (
    <div className="notebook" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar: brand + ambient clock + folio ──────────────────────── */}
      <header className="topbar">
        <div className="topbar-bg" />
        <div className="topbar-brand">fl<span>i</span>p</div>
        <div className="topbar-rhythm">
          <Folio />
          {!isMobile && <>
            <span className="topbar-rhythm-sep">·</span>
            <span>WK{week} DY{day}</span>
            <span className="topbar-rhythm-sep">·</span>
            <span>{dayPct}% spent</span>
          </>}
          {ambientOn && (
            <>
              <span className="topbar-rhythm-sep">·</span>
              <span style={{ color: 'var(--accent)', animation: 'dotPulse 4s ease-in-out infinite' }}>♪ ambient</span>
            </>
          )}
        </div>
        <InkStampClock compact />
        <div className="topbar-user">
          <a
            href="/byox"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-40)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-40)')}
          >
            byox
          </a>
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-40)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-40)')}
          >
            gpa
          </a>
          <a
            href="/pumps"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--page)',
              textDecoration: 'none',
              background: 'var(--accent)',
              padding: '3px 10px',
              borderRadius: '3px',
              transition: 'opacity 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>🏋</span> pumps
          </a>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title={isDark ? 'Switch to light' : 'Switch to dark'}>
            {isDark ? '☀' : '☾'}
          </button>
          <div className="topbar-avatar" title={user.email ?? ''}>
            {(user.user_metadata?.display_name as string)?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <button className="topbar-signout" onClick={signOut}>sign out</button>
        </div>
      </header>

      {/* ── Sidebar margin stats (desktop only) ────────────────────────── */}
      {!isMobile && (
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
      )}

      {/* ── Right margin annotation (desktop only) ─────────────────────── */}
      {!isMobile && committed && (
        <div style={{
          position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
          zIndex: 80, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
          maxWidth: 44,
        }}>
          {sessions.length > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-25)', textAlign: 'right', lineHeight: 1.6, letterSpacing: '0.08em' }}>
              <span style={{ display: 'block', color: 'var(--accent)', fontSize: 13 }}>{sessions.length}×</span>
              <span style={{ display: 'block' }}>{focusMin}′</span>
              <span style={{ display: 'block', fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 4, color: 'var(--ink-25)' }}>focus</span>
            </div>
          )}
          <div style={{
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.2em',
            color: 'var(--ink-25)', textTransform: 'uppercase',
            marginTop: sessions.length > 0 ? 12 : 0,
          }}>
            {dateLong.split(',')[0]}
          </div>
        </div>
      )}

      {/* ── Global rocket orbit (desktop only — costly on mobile) ──────── */}
      {!isMobile && isDark  && <RocketOrbit />}
      {!isMobile && !isDark && <OceanWorld />}

      {/* ── Golf-sphere page nav (desktop only) ────────────────────────── */}
      {!isMobile && <GolfNav page={page} onNavigate={scrollToPage} />}

      {/* Always in DOM so startAmbient can set .src synchronously in the user-gesture call stack */}
      <iframe
        ref={ambientIframeRef}
        src="about:blank"
        allow="autoplay; encrypted-media"
        aria-hidden="true"
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none', bottom: 0, right: 0 } as CSSProperties}
      />

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
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: committed ? 'flex-start' : 'center', gap: 28,
            padding: isMobile
              ? '36px 16px 28px'
              : (committed ? '68px 80px 60px 100px' : '56px 80px 40px 100px'),
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: isMobile ? '6px 16px' : '6px 24px 6px 76px',
            borderBottom: '1px solid var(--grid-minor)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-25)',
            pointerEvents: 'none', zIndex: 5, background: 'var(--page)',
          }}>
            <span>Daily Page</span>
            <span>1 / {totalPages}</span>
          </div>
          {/* Date header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 8vw, 116px)', fontStyle: 'italic', fontWeight: 700, color: 'var(--ink-100)', letterSpacing: '-0.03em' }}>
              {dateLong}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-40)', letterSpacing: '0.14em', marginTop: 8 }}>
              PAGE {page + 1} OF {totalPages} · {focusMin} MIN FOCUSED TODAY
            </div>
          </div>

          {/* Intention block */}
          {!committed ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: isMobile ? '100%' : 600, width: '100%' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(20px, 3.5vw, 52px)', fontStyle: 'italic', color: 'var(--ink-60)', textAlign: 'center' }}>
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
                style={{ textAlign: 'center', fontSize: 'clamp(18px, 3.2vw, 46px)' }}
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
            /* ── Committed view: notebook-page aesthetic ──────────────── */
            <div style={{ maxWidth: isMobile ? '100%' : 660, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>

              {/* Margin annotation in page gutter */}
              {focusMin > 0 && (
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em',
                  color: 'var(--ink-25)', textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} · {focusMin} min focused
                </div>
              )}

              {/* Intention — the hero element */}
              <div style={{ position: 'relative', paddingBottom: 18, marginBottom: 8 }}>
                <InkReveal
                  text={intention}
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 'clamp(32px, 8.5vw, 128px)',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    color: 'var(--ink-100)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                />
                {/* Hand-ruled baseline beneath the intention */}
                <svg width="100%" height="6" style={{ position: 'absolute', bottom: 0, left: 0 }} aria-hidden="true">
                  <path
                    d="M0 3 Q 15% 1.5, 30% 3.5 T 60% 2.5 T 90% 3.5 T 100% 3"
                    fill="none"
                    stroke="rgba(62,92,185,0.45)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* If-stuck: parenthetical annotation */}
              {ifThen && (
                <div style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 'clamp(14px, 1.6vw, 20px)',
                  fontStyle: 'italic',
                  color: 'var(--ink-40)',
                  paddingLeft: 20,
                  marginBottom: 24,
                  letterSpacing: '0.005em',
                }}>
                  ({ifThen})
                </div>
              )}

              {/* Edit + calendar controls */}
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: sessions.length > 0 ? 32 : 0 }}>
                <button className="intent-edit-btn" onClick={() => setCommitted(false)}>edit</button>
                <button onClick={() => setShowCalendar(c => !c)} style={{
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em',
                  color: 'var(--ink-25)', background: 'none', border: 'none', cursor: 'pointer',
                  textTransform: 'uppercase',
                }}>
                  {showCalendar ? '− calendar' : '+ calendar'}
                </button>
              </div>

              {showCalendar && <Calendar />}

              {/* ── Spaced review: most recent past intention ──────────── */}
              {pastIntention && !showCalendar && (
                <div style={{
                  width: '100%', marginTop: 12,
                  borderTop: '1px dashed var(--grid-major)',
                  paddingTop: 14,
                }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.20em',
                    textTransform: 'uppercase', color: 'var(--accent-gold)',
                    marginBottom: 6,
                  }}>
                    ↑ {pastIntention.date}
                  </div>
                  <div style={{
                    fontFamily: 'var(--serif)', fontStyle: 'italic',
                    fontSize: 'clamp(14px, 1.5vw, 18px)', color: 'var(--ink-40)',
                    letterSpacing: '-0.01em', lineHeight: 1.35,
                  }}>
                    {pastIntention.intention}
                  </div>
                </div>
              )}

              {/* Session log: timeline */}
              {sessions.length > 0 && (
                <div style={{ borderTop: '1px solid var(--grid-major)', paddingTop: 18, width: '100%', textAlign: 'left' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--ink-25)', marginBottom: 14 }}>
                    Session Log
                  </div>
                  <div style={{ position: 'relative', paddingLeft: 22 }}>
                    {/* Vertical timeline rule */}
                    <div style={{ position: 'absolute', left: 4, top: 6, bottom: 8, width: 1, background: 'var(--grid-major)' }} />
                    {sessions.map((s, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: 14 }}>
                        <div style={{
                          position: 'absolute', left: -18, top: 5,
                          width: 9, height: 9, borderRadius: '50%',
                          background: i === sessions.length - 1 ? 'var(--accent)' : 'var(--grid-major)',
                          boxShadow: i === sessions.length - 1 ? '0 0 0 3px var(--accent-dim)' : 'none',
                          boxSizing: 'border-box',
                        }} />
                        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.2 }}>
                          {s.start}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.10em', marginTop: 1 }}>
                          {s.duration}′
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-60)', marginTop: 4, letterSpacing: '-0.01em' }}>
                    {focusMin} minutes on the page today.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── E-ink widgets (always visible on daily page) ─────────── */}
          {committed && <Widgets />}
        </div>

        {/* ── PAGE 1: FOCUS ────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[1] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 24,
            padding: isMobile ? '36px 16px 24px' : '40px 80px 40px 100px',
            background: 'var(--page-cream)',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: isMobile ? '6px 16px' : '6px 24px 6px 76px',
            borderBottom: '1px solid var(--grid-minor)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-25)',
            pointerEvents: 'none', zIndex: 5, background: 'var(--page-cream)',
          }}>
            <span>Focus</span>
            <span>2 / {totalPages}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
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
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 28,
            padding: isMobile ? '36px 16px 24px' : '40px 80px 40px 100px',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: isMobile ? '6px 16px' : '6px 24px 6px 76px',
            borderBottom: '1px solid var(--grid-minor)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-25)',
            pointerEvents: 'none', zIndex: 5, background: 'var(--page)',
          }}>
            <span>Sound</span>
            <span>3 / {totalPages}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
            Sound <em style={{ fontStyle: 'italic', color: 'var(--accent-gold)' }}>Environment</em>
          </div>

          {/* Mobile-only ambient toggle — desktop uses tap-anywhere */}
          {isMobile && (
            <button onClick={ambientOn ? stopAmbient : startAmbient} style={{
              background: ambientOn ? 'var(--accent-dim)' : 'none',
              border: `1.5px solid ${ambientOn ? 'var(--accent)' : 'var(--grid-major)'}`,
              borderRadius: 999,
              padding: '9px 22px',
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.14em',
              color: ambientOn ? 'var(--accent)' : 'var(--ink-40)',
              cursor: 'pointer',
              textTransform: 'uppercase' as const,
              transition: 'all 0.2s',
            }}>
              {ambientOn ? '♪ stop ambient' : '♪ begin ambient'}
            </button>
          )}

          <MusicPlayer onPlay={startAmbient} stopRef={musicStopRef} />
        </div>

        {/* ── PAGE 3: REST ──────────────────────────────────────────────── */}
        <div
          ref={el => { pageRefs.current[3] = el }}
          style={{
            scrollSnapAlign: 'start',
            minHeight: '100%',
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 24,
            padding: isMobile ? '36px 16px 24px' : '40px 80px 40px 100px',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: isMobile ? '6px 16px' : '6px 24px 6px 76px',
            borderBottom: '1px solid var(--grid-minor)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-25)',
            pointerEvents: 'none', zIndex: 5, background: 'var(--page)',
          }}>
            <span>Rest</span>
            <span>4 / {totalPages}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 6vw, 96px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
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
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 20, padding: isMobile ? '36px 16px 24px' : '56px 80px 40px 100px',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: isMobile ? '6px 16px' : '6px 24px 6px 76px',
            borderBottom: '1px solid var(--grid-minor)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-25)',
            pointerEvents: 'none', zIndex: 5, background: 'var(--page-cream)',
          }}>
            <span>Play</span>
            <span>5 / {totalPages}</span>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(24px, 5vw, 72px)', fontWeight: 700, lineHeight: 0.9, color: 'var(--ink-100)', letterSpacing: '-0.04em', textAlign: 'center' }}>
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
      {isMobile ? (
        /* ── Mobile: 5-tab bar ──────────────────────────────────────────── */
        <div style={{
          borderTop: '1px solid var(--grid-major)',
          background: 'var(--page)',
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {(['Daily', 'Focus', 'Sound', 'Rest', 'Play'] as const).map((label, i) => {
            const TAB_ICONS = ['◎', '⏱', '♪', '○', '◇']
            const isActive = page === i
            return (
              <button
                key={i}
                onClick={() => scrollToPage(i)}
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 4,
                  padding: '10px 4px 9px',
                  minHeight: 56,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: isActive ? 'var(--accent)' : 'var(--ink-40)',
                  fontFamily: 'var(--mono)',
                  position: 'relative',
                  transition: 'color 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0, left: '15%', right: '15%',
                    height: 2, background: 'var(--accent)', borderRadius: '0 0 2px 2px',
                  }} />
                )}
                <span style={{ fontSize: 15, lineHeight: 1 }}>{TAB_ICONS[i]}</span>
                <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        /* ── Desktop: prev / next ───────────────────────────────────────── */
        <div style={{
          borderTop: '1px solid var(--grid-major)',
          padding: '12px 28px 12px 76px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--page)',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-40)', letterSpacing: '0.10em' }}>
            {pageLabel[page]}
            <button
              onClick={ambientOn ? stopAmbient : startAmbient}
              style={{
                marginLeft: 16, fontSize: 11,
                color: ambientOn ? 'var(--accent)' : 'var(--ink-25)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--mono)', letterSpacing: '0.10em',
                opacity: ambientOn ? 0.85 : 1,
                animation: ambientOn ? 'none' : 'dotPulse 3s ease-in-out infinite',
              }}
            >
              {ambientOn ? '· ♪ stop ambient' : '· ♪ begin ambient'}
            </button>
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
      )}
    </div>
  )
}
