'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────────
   GAME 1: Tic Tac Toe (X vs AI — minimax, 40% random blunder)
   ─────────────────────────────────────────────────────────────────────────── */

type Cell = null | 'X' | 'O'

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function tttWinner(b: Cell[]): { mark: 'X' | 'O'; line: number[] } | 'draw' | null {
  for (const [a, bb, c] of WIN_LINES) {
    if (b[a] && b[a] === b[bb] && b[a] === b[c]) return { mark: b[a] as 'X' | 'O', line: [a, bb, c] }
  }
  return b.every(Boolean) ? 'draw' : null
}

function minimax(b: Cell[], isO: boolean): number {
  const r = tttWinner(b)
  if (r === 'draw') return 0
  if (r && r.mark === 'O') return 10
  if (r && r.mark === 'X') return -10
  const scores = b.map((cell, i) => {
    if (cell) return isO ? -Infinity : Infinity
    const nb = [...b]; nb[i] = isO ? 'O' : 'X'
    return minimax(nb, !isO)
  })
  return isO ? Math.max(...scores) : Math.min(...scores)
}

function bestMove(b: Cell[]) {
  const open = b.map((c, i) => c ? -1 : i).filter(i => i >= 0)
  // 40% of the time play randomly — gives the user a real chance to win
  if (Math.random() < 0.4) return open[Math.floor(Math.random() * open.length)]
  let best = -Infinity, move = -1
  open.forEach(i => {
    const nb = [...b]; nb[i] = 'O'
    const s = minimax(nb, false)
    if (s > best) { best = s; move = i }
  })
  return move
}

function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [xTurn, setXTurn] = useState(true)
  const [result, setResult] = useState<{ mark: 'X' | 'O'; line: number[] } | 'draw' | null>(null)
  const [thinking, setThinking] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }, [])

  const handleClick = (i: number) => {
    if (!xTurn || board[i] || result || thinking) return
    const nb = [...board]; nb[i] = 'X'
    const r = tttWinner(nb)
    setBoard(nb)
    if (r) { setResult(r); return }
    setXTurn(false); setThinking(true)
    aiTimerRef.current = setTimeout(() => {
      const ai = bestMove(nb)
      if (ai >= 0) {
        const nb2 = [...nb]; nb2[ai] = 'O'
        setBoard(nb2)
        setResult(tttWinner(nb2))
      }
      setXTurn(true); setThinking(false)
    }, 320)
  }

  const reset = () => {
    if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null }
    setBoard(Array(9).fill(null)); setXTurn(true); setResult(null); setThinking(false)
  }

  const winLine = typeof result === 'object' && result !== null ? result.line : null
  const status = result
    ? (result === 'draw' ? 'Draw — well matched.' : result.mark === 'X' ? 'You win.' : 'AI wins.')
    : thinking ? 'AI thinking…' : 'Your move (X)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 210 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-40)', letterSpacing: '0.08em' }}>
          {status}
        </span>
        <button onClick={reset} style={{
          background: 'none', border: '1px solid var(--grid-major)', borderRadius: 3,
          padding: '3px 10px', fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--ink-40)', cursor: 'pointer', letterSpacing: '0.08em',
        }}>reset</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 66px)', gap: 5 }}>
        {board.map((cell, i) => {
          const isWin = winLine?.includes(i)
          return (
            <button key={i} onClick={() => handleClick(i)} style={{
              width: 66, height: 66,
              background: isWin ? 'var(--accent-dim)' : 'var(--page)',
              border: `1.5px solid ${isWin ? 'var(--accent)' : 'var(--ink-80)'}`,
              borderRadius: 3,
              fontFamily: 'var(--serif)', fontSize: 30, fontStyle: 'italic', fontWeight: 700,
              color: cell === 'X' ? 'var(--accent)' : 'var(--ink-80)',
              cursor: (!cell && !result && xTurn && !thinking) ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.1s, border-color 0.1s',
            }}>
              {cell}
            </button>
          )
        })}
      </div>

      {result && result !== 'draw' && (
        <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'italic', color: 'var(--ink-40)', textAlign: 'center' }}>
          {result.mark === 'X' ? 'The machine yields.' : 'The machine never tires.'}
        </div>
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

type Tab = 'ttt' | 'slide' | 'word'

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'ttt',   label: 'Tic Tac Toe', desc: 'pattern recognition' },
  { id: 'slide', label: 'Slide',       desc: 'spatial reasoning' },
  { id: 'word',  label: 'Unscramble',  desc: 'language + focus' },
]

export default function MiniGames({ disabled }: { disabled?: boolean }) {
  const [tab, setTab] = useState<Tab>('ttt')

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

        {tab === 'ttt'   && <TicTacToe />}
        {tab === 'slide' && <NumberSlide />}
        {tab === 'word'  && <WordUnscramble />}
      </div>
    </div>
  )
}
