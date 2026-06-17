'use client'

import type { CSSProperties } from 'react'

interface ByoxHeaderProps {
  totalCount: number
  doneCount: number
  inProgressCount: number
}

const eyebrow: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const headline: CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(32px, 5vw, 72px)',
  fontStyle: 'italic',
  fontWeight: 700,
  color: 'var(--ink-100)',
  letterSpacing: '-0.03em',
  lineHeight: 1,
  marginBottom: 4,
}

const subline: CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(20px, 2.4vw, 36px)',
  fontStyle: 'italic',
  color: 'var(--ink-60)',
  letterSpacing: '-0.02em',
  lineHeight: 1,
  marginBottom: 20,
}

export default function ByoxHeader({ totalCount, doneCount, inProgressCount }: ByoxHeaderProps) {
  const todoCount = totalCount - doneCount - inProgressCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <a
          href="/"
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
          ← back to flip
        </a>
      </div>

      {/* Eyebrow */}
      <p style={eyebrow}>Study · Build Your Own X</p>

      {/* Headline */}
      <h1 style={headline}>Build Your</h1>
      <h1 style={subline}>Own X.</h1>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        marginTop: 4,
      }}>
        <span style={{ color: 'var(--break-color)' }}>
          {doneCount} done
        </span>
        <span style={{ color: 'var(--accent-gold)' }}>
          {inProgressCount} in progress
        </span>
        <span style={{ color: 'var(--ink-40)' }}>
          {todoCount} to do
        </span>
        <span style={{ color: 'var(--ink-25)' }}>
          {totalCount} total
        </span>
      </div>
    </div>
  )
}
