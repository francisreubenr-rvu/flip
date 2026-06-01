'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "The ability to perform deep work is becoming increasingly rare at exactly the same time it is becoming increasingly valuable.", author: "Cal Newport" },
  { text: "You can do anything, but not everything.", author: "David Allen" },
  { text: "Starve your distraction, feed your focus.", author: "Unknown" },
  { text: "It is not that we have a short time to live, but that we waste a good part of it.", author: "Seneca" },
  { text: "The scarce resource is not ideas, but the courage to build them.", author: "Naval Ravikant" },
  { text: "A man who dares to waste one hour of time has not discovered the value of life.", author: "Charles Darwin" },
  { text: "Work expands so as to fill the time available for its completion.", author: "Parkinson's Law" },
  { text: "The most important skill of the 21st century is the ability to direct your own attention.", author: "Howard Rheingold" },
  { text: "Focus is more valuable than intelligence.", author: "Shane Parrish" },
  { text: "We have two lives. The second begins when we realize we have only one.", author: "Confucius" },
  { text: "Energy, not time, is the fundamental currency of high performance.", author: "Jim Loehr" },
  { text: "Almost everything will work again if you unplug it for a few minutes.", author: "Anne Lamott" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Perfection is the enemy of progress.", author: "Winston Churchill" },
  { text: "The single biggest problem in communication is the illusion that it has taken place.", author: "G.B. Shaw" },
]

const FACTS = [
  { title: "The 90-min ultradian cycle", body: "Alertness and focus peak in 90-minute waves. Schedule deep work in 90-min blocks, then genuinely rest." },
  { title: "Working memory: 4 chunks", body: "Working memory holds ~4 items simultaneously. Each context switch erases a slot. Guard your attention fiercely." },
  { title: "Sharp wave ripples", body: "The hippocampus replays and consolidates memories during rest. Idleness is when learning actually happens." },
  { title: "Attention restoration", body: "Natural fractal patterns (trees, water) restore directed attention within 20 minutes. Step outside." },
  { title: "The 52/17 finding", body: "Top performers work ~52 minutes and rest ~17. Not Pomodoro — longer focus demands longer, genuine rest." },
  { title: "Cold start is the hardest", body: "The first 5 minutes of deep work are neurologically the hardest. Start with the smallest possible action." },
  { title: "Implementation intentions", body: "\"I will X at time Y in location Z\" increases follow-through by 91%. (Gollwitzer, 2006, d=0.65)" },
  { title: "The testing effect", body: "Retrieving information strengthens memory 2–3× more than re-reading. Teach what you learn." },
  { title: "Decision fatigue is real", body: "Willpower, focus, and decision-making share a substrate. Heavy choices deplete your ability to concentrate." },
  { title: "Boredom trains attention", body: "The urge to check your phone is boredom avoidance. Tolerating boredom systematically builds sustained focus." },
]

const WORDS = [
  { word: "Sonder", def: "The realization that each passerby has a life as vivid and complex as one's own.", origin: "The Dictionary of Obscure Sorrows" },
  { word: "Eudaimonia", def: "Human flourishing through virtuous, meaningful activity — not merely pleasure.", origin: "Greek, Aristotle's Nicomachean Ethics" },
  { word: "Kairos", def: "The opportune moment to act. Distinct from chronos (clock time).", origin: "Greek rhetoric" },
  { word: "Ataraxia", def: "Tranquility achieved through suspension of judgment. The Stoic goal.", origin: "Greek, Pyrrho of Elis" },
  { word: "Liminal", def: "Occupying a threshold — between two states, not yet fully either.", origin: "Latin limen, threshold" },
  { word: "Meraki", def: "Pouring a piece of your soul, creativity, and love into what you make.", origin: "Modern Greek" },
  { word: "Tsundoku", def: "Buying books intending to read them, then letting them pile up unread.", origin: "Japanese, 19th century" },
  { word: "Palimpsest", def: "A manuscript overwritten but still legible beneath. Any object with layered history.", origin: "Greek palimpsestos, scraped again" },
  { word: "Sophrosyne", def: "Soundness of mind; moderation; knowing the limits of what is appropriate.", origin: "Greek, Plato's Charmides" },
  { word: "Apophenia", def: "The tendency to perceive meaningful connections between unrelated things.", origin: "Klaus Conrad, 1958" },
]

const PROMPTS = [
  "What assumption am I making that, if wrong, would change everything?",
  "What would I work on if no one would ever see the result?",
  "What is the smallest version of this I could ship today?",
  "What would I tell a friend doing exactly what I'm doing now?",
  "What have I been avoiding that, once done, would relieve enormous weight?",
  "What does 'done' look like today — exactly, specifically?",
  "If this were easy, what would I do first?",
  "What am I optimising for that I probably shouldn't be?",
  "Who is one person I could help right now without being asked?",
  "What would I regret not doing, a year from now?",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todaySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

function sr(seed: number, i: number) {   // seeded random [0,1)
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 14757395
  return x - Math.floor(x)
}

function lsGet(k: string, fb = '') {
  try { return localStorage.getItem(k) ?? fb } catch { return fb }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch {}
}

// ─── E-ink Widget Shell ───────────────────────────────────────────────────────

function Widget({ label, hint, onClick, children, cols = 1 }: {
  label: string
  hint?: string
  onClick?: () => void
  children: React.ReactNode
  cols?: number
}) {
  const [flash, setFlash] = useState(false)
  const trigger = () => {
    setFlash(true); setTimeout(() => setFlash(false), 280)
    onClick?.()
  }
  return (
    <div
      onClick={onClick ? trigger : undefined}
      style={{
        gridColumn: cols > 1 ? `span ${cols}` : undefined,
        border: '1.5px solid var(--ink-80)',
        background: flash ? 'var(--ink-80)' : 'var(--page)',
        padding: '18px 22px 20px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        minHeight: 140,
        transition: 'background 0.05s, color 0.05s',
        color: flash ? 'var(--page)' : 'var(--ink-100)',
      }}
    >
      {/* header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--grid-major)',
        paddingBottom: 7, marginBottom: 10,
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: flash ? 'var(--page)' : 'var(--ink-40)' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: flash ? 'var(--page)' : 'var(--ink-25)', letterSpacing: '0.10em' }}>
            {hint}
          </span>
        )}
      </div>
      <div style={{ flex: 1, opacity: flash ? 0 : 1, transition: 'opacity 0.04s' }}>
        {children}
      </div>
    </div>
  )
}

// ─── W1 · Quote ───────────────────────────────────────────────────────────────
function QuoteWidget() {
  const s = todaySeed()
  const [i, setI] = useState(() => Math.floor(sr(s, 0) * QUOTES.length))
  const q = QUOTES[i]
  return (
    <Widget label="Quotation" hint="tap · next" onClick={() => setI(x => (x + 1) % QUOTES.length)} cols={2}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontStyle: 'italic', color: 'var(--ink-80)', lineHeight: 1.55, marginBottom: 10 }}>
        &ldquo;{q.text}&rdquo;
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.10em' }}>— {q.author}</div>
    </Widget>
  )
}

// ─── W2 · Focus Science ───────────────────────────────────────────────────────
function ScienceWidget() {
  const s = todaySeed()
  const [i, setI] = useState(() => Math.floor(sr(s, 1) * FACTS.length))
  const [open, setOpen] = useState(false)
  const f = FACTS[i]
  return (
    <Widget label="Focus science" hint={open ? 'tap · next' : 'tap · reveal'} onClick={() => open ? (setI(x => (x+1) % FACTS.length), setOpen(false)) : setOpen(true)}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-80)', letterSpacing: '0.04em', marginBottom: 8 }}>
        {f.title}
      </div>
      {open
        ? <div style={{ fontFamily: 'var(--serif)', fontSize: 14.5, fontStyle: 'italic', color: 'var(--ink-60)', lineHeight: 1.5 }}>{f.body}</div>
        : <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-25)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>tap to reveal</div>
      }
    </Widget>
  )
}

// ─── W3 · Word ────────────────────────────────────────────────────────────────
function WordWidget() {
  const s = todaySeed()
  const [i] = useState(() => Math.floor(sr(s, 2) * WORDS.length))
  const [stage, setStage] = useState(0)
  const w = WORDS[i]
  return (
    <Widget label="Word" hint={stage < 2 ? 'tap · reveal' : undefined} onClick={() => setStage(x => Math.min(x + 1, 2))}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'italic', color: 'var(--ink-100)', letterSpacing: '-0.01em', marginBottom: 8 }}>{w.word}</div>
      {stage >= 1 && <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-60)', lineHeight: 1.5, marginBottom: 6 }}>{w.def}</div>}
      {stage >= 2 && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-25)', letterSpacing: '0.10em' }}>{w.origin}</div>}
    </Widget>
  )
}

// ─── W4 · Reflection Prompt ───────────────────────────────────────────────────
function PromptWidget() {
  const s = todaySeed()
  const [i, setI] = useState(() => Math.floor(sr(s, 3) * PROMPTS.length))
  const [ans, setAns] = useState(() => lsGet(`flip-prompt-${s}`))
  const [editing, setEditing] = useState(false)
  return (
    <Widget label="Reflection" hint={editing ? undefined : 'tap prompt · next'} onClick={editing ? undefined : () => setI(x => (x + 1) % PROMPTS.length)} cols={2}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic', color: 'var(--ink-80)', lineHeight: 1.55, marginBottom: 12 }}>
        {PROMPTS[i]}
      </div>
      {editing
        ? <textarea
            autoFocus
            value={ans}
            onChange={e => { setAns(e.target.value); lsSet(`flip-prompt-${s}`, e.target.value) }}
            onBlur={() => setEditing(false)}
            onClick={e => e.stopPropagation()}
            rows={2}
            placeholder="write here…"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--grid-major)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14.5, color: 'var(--ink-80)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
          />
        : <div
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            style={{ fontFamily: 'var(--serif)', fontSize: 14.5, fontStyle: 'italic', color: ans ? 'var(--ink-60)' : 'var(--ink-25)', borderBottom: '1px solid var(--grid-minor)', paddingBottom: 4, minHeight: 26, cursor: 'text' }}
          >
            {ans || 'tap here to write…'}
          </div>
      }
    </Widget>
  )
}

// ─── W5 · Day Arc ─────────────────────────────────────────────────────────────
function DayArcWidget() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const calc = () => {
      const n = new Date()
      setPct((n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400)
    }
    calc()
    const t = setInterval(calc, 15000)
    return () => clearInterval(t)
  }, [])
  const h = new Date().getHours()
  const seg = h < 6 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
  return (
    <Widget label="Day arc">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <div style={{ position: 'relative', height: 22, border: '1.5px solid var(--ink-80)' }}>
          <div style={{ position: 'absolute', inset: 0, right: `${(1 - pct) * 100}%`, background: 'var(--ink-80)' }} />
          {[6, 12, 18].map(hh => (
            <div key={hh} style={{ position: 'absolute', left: `${hh / 24 * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--page)', opacity: 0.4 }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-40)', letterSpacing: '0.10em' }}>
          <span>00h</span>
          <span style={{ color: 'var(--ink-80)', fontWeight: 700 }}>{Math.round(pct * 100)}% · {seg}</span>
          <span>24h</span>
        </div>
      </div>
    </Widget>
  )
}

// ─── W6 · Scratch Pad ────────────────────────────────────────────────────────
function ScratchWidget() {
  const s = todaySeed()
  const [text, setText] = useState(() => lsGet(`flip-scratch-${s}`))
  const lines = text.split('\n').filter(Boolean).length
  return (
    <Widget label={`Margin notes · ${lines}`}>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); lsSet(`flip-scratch-${s}`, e.target.value) }}
        onClick={e => e.stopPropagation()}
        placeholder="thoughts from the margin…"
        style={{
          flex: 1, width: '100%', minHeight: 60, background: 'transparent', border: 'none',
          fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-80)',
          outline: 'none', resize: 'none', lineHeight: 1.7,
        }}
      />
    </Widget>
  )
}

// ─── W7 · Generative E-ink Art ────────────────────────────────────────────────
function PatternWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const s = todaySeed()
  const [v, setV] = useState(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = canvas.width, H = canvas.height
    const seed = s + v * 7919

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#f5f0e8'; ctx.fillRect(0, 0, W, H)

    const type = Math.floor(sr(seed, 0) * 4)
    ctx.strokeStyle = '#1e2535'; ctx.fillStyle = '#1e2535'

    if (type === 0) {
      // nested rectangles
      for (let k = 0; k < 9; k++) {
        const m = 3 + k * 9
        if (m * 2 >= W || m * 2 >= H) break
        ctx.lineWidth = sr(seed, k + 10) > 0.6 ? 1.5 : 0.6
        ctx.strokeRect(m, m, W - m * 2, H - m * 2)
      }
    } else if (type === 1) {
      // hatching
      ctx.lineWidth = 0.7
      const sp = 7 + Math.floor(sr(seed, 5) * 9)
      const angle = sr(seed, 6) * Math.PI
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(angle)
      for (let x = -W; x <= W; x += sp) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H); ctx.stroke() }
      if (sr(seed, 7) > 0.45) {
        ctx.rotate(Math.PI / 2)
        for (let x = -W; x <= W; x += sp) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H); ctx.stroke() }
      }
      ctx.restore()
    } else if (type === 2) {
      // dot field
      const n = 15 + Math.floor(sr(seed, 8) * 25)
      for (let k = 0; k < n; k++) {
        const x = sr(seed, k * 3 + 20) * W, y = sr(seed, k * 3 + 21) * H
        const r = 1 + sr(seed, k * 3 + 22) * 3.5
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
    } else {
      // pixel grid
      const cols = 9, rows = 5, cw = W / cols, ch = H / rows
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (sr(seed, r * cols + c + 30) > 0.45)
            ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2)
    }
    ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1.5; ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5)
  }, [s, v])

  useEffect(() => { draw() }, [draw])

  return (
    <Widget label="Daily pattern" hint="tap · new" onClick={() => setV(x => x + 1)}>
      <canvas ref={canvasRef} width={200} height={88}
        style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'crisp-edges' }}
      />
    </Widget>
  )
}

// ─── W8 · Compound Focus ──────────────────────────────────────────────────────
function CompoundWidget() {
  const [stats] = useState(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('flip-day-'))
      const totalSessions = keys.reduce((acc, k) => {
        try { return acc + (JSON.parse(localStorage.getItem(k) ?? '{}').sessions?.length ?? 0) } catch { return acc }
      }, 0)
      return { sessions: totalSessions, min: totalSessions * 25 }
    } catch { return { sessions: 0, min: 0 } }
  })
  const hr = Math.floor(stats.min / 60), min = stats.min % 60
  return (
    <Widget label="Compound focus">
      <div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink-100)', lineHeight: 1, marginBottom: 8 }}>
        {hr > 0 ? `${hr}h ${min}m` : `${min}m`}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        {stats.sessions} sessions total
      </div>
      {stats.sessions > 0 && (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, fontStyle: 'italic', color: 'var(--ink-60)', marginTop: 8, lineHeight: 1.45 }}>
          At this pace: {Math.round(stats.min / 60 * 365 / Math.max(1, Object.keys(localStorage).filter(k => k.startsWith('flip-day-')).length))}h/year.
        </div>
      )}
    </Widget>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Widgets() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14,
      width: '100%',
      maxWidth: 860,
    }}>
      <QuoteWidget />
      <ScienceWidget />
      <WordWidget />
      <DayArcWidget />
      <ScratchWidget />
      <PromptWidget />
      <PatternWidget />
      <CompoundWidget />
    </div>
  )
}
