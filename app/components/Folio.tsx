'use client'
import { useState, useEffect } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Folio — the page number of the current moment in the book of the day.
   Renders "— 612 —" (minutes elapsed) in the top bar margin.
   Updates once per minute with zero animation. Quiet, ambient, always there.
   ──────────────────────────────────────────────────────────────────────────── */

export default function Folio() {
  const [page, setPage] = useState<number | null>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(true)
    const tick = () => {
      const d = new Date()
      setPage(d.getHours() * 60 + d.getMinutes())
    }
    tick()
    const i = setInterval(tick, 30000)
    return () => clearInterval(i)
  }, [])

  if (!on || page === null) return null

  return (
    <span style={{
      fontFamily: 'var(--serif)',
      fontSize: 16,
      fontStyle: 'italic',
      color: 'var(--accent-gold)',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      — {page} —
    </span>
  )
}
