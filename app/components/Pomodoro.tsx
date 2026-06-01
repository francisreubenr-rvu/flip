'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

type Mode = 'work' | 'short-break' | 'long-break'
const P = {
  'work': { label:'Focus', short:'focus', dur:25*60, col:'var(--work-color)' },
  'short-break': { label:'Short Break', short:'short', dur:5*60, col:'var(--break-color)' },
  'long-break': { label:'Long Break', short:'long', dur:20*60, col:'var(--rest-color)' },
} as const
const BEFORE_LONG = 4

function chime() {
  try {
    const c = new (window.AudioContext||(window as any).webkitAudioContext)()
    const p = (f:number,t:number)=>{const o=c.createOscillator();const g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.5);o.start(t);o.stop(t+0.5)}
    p(880,c.currentTime);p(1108,c.currentTime+0.12);p(1318,c.currentTime+0.24);setTimeout(()=>c.close(),800)
  } catch(_){}
}

export default function Pomodoro({ onModeChange, onSessionComplete }: { onModeChange?: (m: Mode) => void; onSessionComplete?: (duration: number) => void }) {
  const [mode, setMode] = useState<Mode>('work')
  const [rem, setRem] = useState(P['work'].dur)
  const [run, setRun] = useState(false)
  const [sess, setSess] = useState(0)
  const intRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const p = P[mode]
  const prog = 1 - rem / p.dur
  const mm = String(Math.floor(rem/60)).padStart(2,'0')
  const ss = String(rem%60).padStart(2,'0')

  const sw = useCallback((n: Mode) => { setMode(n); setRem(P[n].dur); setRun(false); onModeChange?.(n) }, [onModeChange])

  const done = useCallback(() => {
    setRun(false); chime()
    if (mode === 'work') {
      const n = sess + 1; setSess(n)
      onSessionComplete?.(p.dur / 60)
      sw(n % BEFORE_LONG === 0 ? 'long-break' : 'short-break')
    }
    else sw('work')
  }, [mode, sess, sw, onSessionComplete, p.dur])

  useEffect(() => {
    if (!run) { if (intRef.current) clearInterval(intRef.current); return }
    intRef.current = setInterval(() => setRem(p => { if (p <= 1) { done(); return 0 } return p - 1 }), 1000)
    return () => { if (intRef.current) clearInterval(intRef.current) }
  }, [run, done])

  const chipCls = (m: Mode) => {
    if (mode !== m) return 'mode-chip'
    if (m === 'work') return 'mode-chip work-active'
    if (m === 'short-break') return 'mode-chip break-active'
    return 'mode-chip rest-active'
  }

  return (
    <div className="pomo-wrap">
      <div className="pomo-chips">
        {(Object.keys(P) as Mode[]).map(m => <button key={m} className={chipCls(m)} onClick={() => sw(m)}>{P[m].label}</button>)}
      </div>

      <div className="pomo-display">
        <span className="pomo-time">{mm}:{ss}</span>
        <div className="pomo-meta-col">
          <span className="pomo-mode-label" style={{ color: p.col }}>{p.short}</span>
          <div className="pomo-bar"><div className="pomo-bar-fill" style={{ width: '100%', background: p.col, transform: `scaleX(${prog})`, transition: run ? 'transform 1s linear' : 'none' }} /></div>
        </div>
      </div>

      <div className="pomo-controls">
        <button className="btn-circle primary" onClick={() => setRun(r => !r)} aria-label={run?'Pause':'Start'}>
          {run ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="btn-circle" onClick={() => { setRun(false); setRem(p.dur) }} aria-label="Reset"><RotateCcw size={16} /></button>
        <div className="session-tracker">
          <div className="session-dots">
            {Array.from({ length: BEFORE_LONG }).map((_, i) => <div key={i} className={`session-dot ${i < sess % BEFORE_LONG ? 'filled' : ''}`} />)}
          </div>
          <span className="session-count">{(sess % BEFORE_LONG) + 1}/{BEFORE_LONG}{sess > 0 ? ` · ${sess} done` : ''}</span>
        </div>
      </div>
    </div>
  )
}
