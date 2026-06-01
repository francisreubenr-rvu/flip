'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   GAME 1: Dot Grid (connect dots to form squares — attention restoration)
   ─────────────────────────────────────────────────────────────────────────── */

type Line = { r: number; c: number; dir: 'h' | 'v' }

function DotGrid({ size = 5 }: { size?: number }) {
  const [lines, setLines]   = useState<Line[]>([])
  const [boxes, setBoxes]   = useState<Record<string, 'player' | 'ai'>>({})
  const [turn, setTurn]     = useState<'player' | 'ai'>('player')
  const [done, setDone]     = useState(false)
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasLine = (r: number, c: number, dir: 'h' | 'v') =>
    lines.some(l => l.r === r && l.c === c && l.dir === dir)

  const checkBox = useCallback((r: number, c: number, newLines: Line[]) => {
    const has = (rr: number, cc: number, d: 'h' | 'v') =>
      newLines.some(l => l.r === rr && l.c === cc && l.dir === d)
    return (
      has(r, c, 'h') &&
      has(r + 1, c, 'h') &&
      has(r, c, 'v') &&
      has(r, c + 1, 'v')
    )
  }, [])

  const addLine = useCallback((r: number, c: number, dir: 'h' | 'v', who: 'player' | 'ai') => {
    if (hasLine(r, c, dir) || done) return false
    const newLines = [...lines, { r, c, dir }]
    setLines(newLines)

    const newBoxes = { ...boxes }
    let scored = false
    for (let br = 0; br < size - 1; br++) {
      for (let bc = 0; bc < size - 1; bc++) {
        const key = `${br},${bc}`
        if (!newBoxes[key] && checkBox(br, bc, newLines)) {
          newBoxes[key] = who
          scored = true
        }
      }
    }
    setBoxes(newBoxes)

    const totalBoxes = (size - 1) * (size - 1)
    if (Object.keys(newBoxes).length >= totalBoxes) {
      setDone(true)
      return false
    }

    if (!scored) setTurn(who === 'player' ? 'ai' : 'player')
    return scored
  }, [lines, boxes, done, size, checkBox, hasLine])

  // AI move (random with slight smarts)
  useEffect(() => {
    if (turn !== 'ai' || done) return
    aiTimer.current = setTimeout(() => {
      const allPossible: { r: number; c: number; dir: 'h' | 'v' }[] = []
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (r < size - 1) allPossible.push({ r, c, dir: 'v' })
          if (c < size - 1) allPossible.push({ r, c, dir: 'h' })
        }
      }
      const avail = allPossible.filter(l => !hasLine(l.r, l.c, l.dir))
      if (!avail.length) return

      const completing = avail.find(({ r, c, dir }) => {
        const test = [...lines, { r, c, dir }]
        for (let br = 0; br < size - 1; br++)
          for (let bc = 0; bc < size - 1; bc++)
            if (!boxes[`${br},${bc}`] && checkBox(br, bc, test)) return true
        return false
      })

      const pick = completing ?? avail[Math.floor(Math.random() * avail.length)]
      addLine(pick.r, pick.c, pick.dir, 'ai')
    }, 400)
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current) }
  }, [turn, done, size, lines, boxes, hasLine, addLine, checkBox])

  const reset = () => {
    setLines([]); setBoxes({}); setTurn('player'); setDone(false)
  }

  const pScore = Object.values(boxes).filter(v => v === 'player').length
  const aScore = Object.values(boxes).filter(v => v === 'ai').length
  const CELL = 34

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-2)' }}>
          You: {pScore}  •  AI: {aScore}
        </div>
        <button className="btn-terminal" style={{ padding: '4px 10px', fontSize: 11 }} onClick={reset}>
          <RefreshCw size={11} /> New
        </button>
      </div>

      {done && (
        <div style={{ fontFamily: 'var(--font)', fontSize: 14, color: pScore > aScore ? 'var(--green)' : 'var(--red)', textAlign: 'center' }}>
          {pScore > aScore ? 'You won!' : pScore === aScore ? 'Draw!' : 'AI wins!'}
        </div>
      )}

      <svg
        width={(size - 1) * CELL + size * 6}
        height={(size - 1) * CELL + size * 6}
        style={{ overflow: 'visible', display: 'block' }}
      >
        {/* Boxes */}
        {Array.from({ length: size - 1 }, (_, r) =>
          Array.from({ length: size - 1 }, (_, c) => {
            const who = boxes[`${r},${c}`]
            return who ? (
              <rect
                key={`b${r}${c}`}
                x={c * CELL + (c + 1) * 3 + 1}
                y={r * CELL + (r + 1) * 3 + 1}
                width={CELL - 2}
                height={CELL - 2}
                fill={who === 'player' ? 'var(--red-dim)' : 'oklch(52% 0.16 248 / 0.12)'}
              />
            ) : null
          })
        )}

        {/* Horizontal lines */}
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size - 1 }, (_, c) => {
            const exists = hasLine(r, c, 'h')
            return (
              <line
                key={`h${r}${c}`}
                x1={c * CELL + (c + 1) * 3 + 3}
                y1={r * CELL + (r + 0.5) * 3 + 3}
                x2={(c + 1) * CELL + (c + 1) * 3 + 3}
                y2={r * CELL + (r + 0.5) * 3 + 3}
                stroke={exists ? (lines.find(l => l.r === r && l.c === c && l.dir === 'h') ? 'var(--text-1)' : 'oklch(62% 0.18 248)') : 'var(--border-1)'}
                strokeWidth={exists ? 2.5 : 1.5}
                style={{ cursor: exists ? 'default' : 'pointer' }}
                onClick={() => !exists && turn === 'player' && addLine(r, c, 'h', 'player')}
              />
            )
          })
        )}

        {/* Vertical lines */}
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => {
            if (r >= size - 1) return null
            const exists = hasLine(r, c, 'v')
            return (
              <line
                key={`v${r}${c}`}
                x1={c * CELL + (c + 0.5) * 3 + 3}
                y1={r * CELL + (r + 1) * 3 + 3}
                x2={c * CELL + (c + 0.5) * 3 + 3}
                y2={(r + 1) * CELL + (r + 1) * 3 + 3}
                stroke={exists ? 'var(--text-1)' : 'var(--border-1)'}
                strokeWidth={exists ? 2.5 : 1.5}
                style={{ cursor: exists ? 'default' : 'pointer' }}
                onClick={() => !exists && turn === 'player' && addLine(r, c, 'v', 'player')}
              />
            )
          })
        )}

        {/* Dots */}
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => (
            <circle
              key={`d${r}${c}`}
              cx={c * CELL + (c + 0.5) * 3 + 3}
              cy={r * CELL + (r + 0.5) * 3 + 3}
              r={4}
              fill="var(--text-1)"
            />
          ))
        )}
      </svg>

      {!done && (
        <p style={{ fontFamily: 'var(--font)', fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
          {turn === 'player' ? 'Click any line to draw it.' : 'AI is thinking...'}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   GAME 2: Number Slide (15-puzzle on graph paper)
   ─────────────────────────────────────────────────────────────────────────── */

function shuffle(arr: number[]): number[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  // ensure solvability: count inversions
  let inv = 0
  const flat = a.filter(x => x !== 0)
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++
  const blankRow = Math.floor(a.indexOf(0) / 4)
  const solvable = inv % 2 === 0 ? blankRow % 2 !== 0 : blankRow % 2 === 0
  if (!solvable) { const t = a[0]; a[0] = a[1]; a[1] = t }
  return a
}

const GOAL = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0]

function NumberSlide() {
  const [tiles, setTiles] = useState<number[]>(() => shuffle(GOAL))
  const [moves, setMoves] = useState(0)
  const [won, setWon]     = useState(false)

  const move = (idx: number) => {
    if (won) return
    const blank = tiles.indexOf(0)
    const r = Math.floor(idx / 4), c = idx % 4
    const br = Math.floor(blank / 4), bc = blank % 4
    if (!((Math.abs(r - br) === 1 && c === bc) || (Math.abs(c - bc) === 1 && r === br))) return
    const next = [...tiles]
    next[blank] = next[idx]; next[idx] = 0
    setTiles(next)
    setMoves(m => m + 1)
    if (next.join(',') === GOAL.join(',')) setWon(true)
  }

  const reset = () => { setTiles(shuffle(GOAL)); setMoves(0); setWon(false) }

  const CELL = 44

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-2)' }}>
          Moves: {moves}
        </span>
        <button className="btn-terminal" style={{ padding: '4px 10px', fontSize: 11 }} onClick={reset}>
          <RefreshCw size={11} /> Reset
        </button>
      </div>
      {won && (
        <div style={{ fontFamily: 'var(--font)', fontSize: 14, color: 'var(--green)', textAlign: 'center' }}>
          Solved in {moves} moves!
        </div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(4, ${CELL}px)`,
        gridTemplateRows: `repeat(4, ${CELL}px)`,
        gap: 3,
        background: 'var(--border-1)',
        border: '1px solid var(--border-1)',
        width: 'fit-content',
      }}>
        {tiles.map((t, i) => (
          <button
            key={i}
            onClick={() => move(i)}
            style={{
              width: CELL, height: CELL,
              background: t === 0 ? 'transparent' : 'var(--surface-2)',
              border: 'none',
              fontFamily: 'var(--font)',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--text-1)',
              cursor: t === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.1s ease',
              boxShadow: t === 0 ? 'none' : 'inset 0 1px 0 oklch(100% 0 0 / 0.5)',
            }}
          >
            {t !== 0 && t}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   GAME 3: Word Unscramble (gentle language task, soft cognition)
   ─────────────────────────────────────────────────────────────────────────── */

const WORD_POOL = [
  ['FOCUS', 'Focus → flow state trigger'],
  ['BREATH', 'Breath → regulates the nervous system'],
  ['PATIENCE', 'Patience → precondition for deep work'],
  ['SILENCE', 'Silence → where ideas emerge'],
  ['HABIT', 'Habit → reduces cognitive load'],
  ['RHYTHM', 'Rhythm → ultradian work cycles'],
  ['MINDFUL', 'Mindful → conscious attention training'],
  ['RESTORE', 'Restore → attention restoration theory'],
  ['DOPAMINE', 'Dopamine → motivation neurotransmitter'],
  ['PRESENCE', 'Presence → the antidote to distraction'],
  ['FLOW', 'Flow → Csikszentmihalyi\'s peak state'],
  ['SLEEP', 'Sleep → consolidates memory and learning'],
]

function anagram(word: string): string {
  const arr = word.split('')
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
  } while (arr.join('') === word)
  return arr.join('')
}

function WordUnscramble() {
  const [idx, setIdx]     = useState(() => Math.floor(Math.random() * WORD_POOL.length))
  const [word, hint]      = WORD_POOL[idx]
  const [scrambled]       = useState(() => anagram(word))
  const [input, setInput] = useState('')
  const [state, setState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [attempts, setAttempts] = useState(0)

  // reset scramble on idx change
  const [currentScrambled, setCurrentScrambled] = useState(scrambled)

  useEffect(() => {
    setCurrentScrambled(anagram(WORD_POOL[idx][0]))
    setInput('')
    setState('idle')
    setAttempts(0)
  }, [idx])

  const next = () => setIdx(i => (i + 1) % WORD_POOL.length)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempts(a => a + 1)
    if (input.toUpperCase() === WORD_POOL[idx][0]) {
      setState('correct')
    } else {
      setState('wrong')
      setInput('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font)',
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--text-1)',
          letterSpacing: '0.18em',
          background: 'var(--surface-3)',
          padding: '12px 24px',
          borderRadius: 4,
          border: '1px solid var(--border-1)',
          display: 'inline-block',
        }}>
          {currentScrambled.split('').join(' ')}
        </div>
      </div>

      {state === 'correct' ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font)', fontSize: 15, color: 'var(--green)', marginBottom: 6 }}>
            Correct! {word}
          </p>
          <p style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 12, maxWidth: 240, margin: '0 auto 12px' }}>
            {hint}
          </p>
          <button className="btn-terminal primary" style={{ fontSize: 12 }} onClick={next}>
            Next word →
          </button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value.toUpperCase()); setState('idle') }}
            placeholder="Type the word..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontFamily: 'var(--font)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.1em',
              border: `1.5px solid ${state === 'wrong' ? 'var(--red)' : 'var(--text-3)'}`,
              background: 'transparent',
              color: 'var(--text-1)',
              borderRadius: 2,
              outline: 'none',
              textTransform: 'uppercase',
            }}
            autoFocus
          />
          <button type="submit" className="btn-terminal primary">Go</button>
        </form>
      )}

      {state === 'wrong' && (
        <p style={{ fontFamily: 'var(--font)', fontSize: 12, color: 'var(--red)' }}>
          Not quite. Try again!
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font)', fontSize: 10, color: 'var(--text-3)' }}>
          Attempts: {attempts}
        </span>
        <button className="btn-terminal" style={{ padding: '3px 8px', fontSize: 10 }} onClick={next}>
          Skip
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   MiniGames — tabbed container
   ─────────────────────────────────────────────────────────────────────────── */

type Tab = 'dots' | 'slide' | 'word'

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'dots',  label: 'Dot Grid', desc: 'soft fascination' },
  { id: 'slide', label: 'Slide',    desc: 'spatial reasoning' },
  { id: 'word',  label: 'Unscramble', desc: 'language + focus' },
]

export default function MiniGames({ disabled }: { disabled?: boolean }) {
  const [tab, setTab] = useState<Tab>('dots')

  return (
    <div style={{ position: 'relative' }}>
      {disabled && (
        <div style={{ position:'absolute', inset:0, background:'oklch(9.5% 0.018 254 / 0.8)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, letterSpacing:'0.18em', color:'var(--text-3)', borderRadius:4 }}>
          AVAILABLE AFTER SESSION
        </div>
      )}

      <div style={{ opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        {/* Tab bar */}
        <div className="game-tabs-row" style={{ marginBottom: 16 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`game-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{
          fontFamily: 'var(--font)',
          fontSize: 11,
          color: 'var(--text-3)',
          fontStyle: 'italic',
          marginBottom: 12,
        }}>
          {TABS.find(t => t.id === tab)?.desc} — designed for attention restoration
        </div>

        {tab === 'dots'  && <DotGrid />}
        {tab === 'slide' && <NumberSlide />}
        {tab === 'word'  && <WordUnscramble />}
      </div>
    </div>
  )
}
