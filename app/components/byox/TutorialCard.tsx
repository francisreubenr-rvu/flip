'use client'

import { useState, useCallback, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Pencil, ChevronDown } from 'lucide-react'
import type { TutorialWithProgress, ProgressStatus } from '@/lib/byox/types'

interface TutorialCardProps {
  tutorial: TutorialWithProgress
  onStatusChange: (id: string, status: ProgressStatus) => void
  onNotesChange: (id: string, notes: string) => void
}

const STATUS_CYCLE: ProgressStatus[] = ['todo', 'in_progress', 'done']
const STATUS_LABELS: Record<ProgressStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}
const STATUS_COLORS: Record<ProgressStatus, string> = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-wip)',
  done: 'var(--status-done)',
}

const STATUS_BG: Record<ProgressStatus, string> = {
  todo: 'transparent',
  in_progress: 'var(--status-wip-dim)',
  done: 'var(--status-done-dim)',
}

function statusChipStyle(status: ProgressStatus, active: boolean): CSSProperties {
  const color = STATUS_COLORS[status]
  const bg = STATUS_BG[status]
  return {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    border: `1px solid ${active ? color : 'var(--grid-minor)'}`,
    borderRadius: 2,
    background: active ? bg : 'transparent',
    color: active ? color : 'var(--ink-25)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  }
}

export default function TutorialCard({ tutorial, onStatusChange, onNotesChange }: TutorialCardProps) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState(tutorial.notes)

  const handleNotesBlur = useCallback(() => {
    if (localNotes !== tutorial.notes) {
      onNotesChange(tutorial.id, localNotes)
    }
  }, [localNotes, tutorial.notes, tutorial.id, onNotesChange])

  return (
    <div style={{
      border: '1px solid var(--grid-major)',
      borderLeft: `3px solid ${STATUS_COLORS[tutorial.status]}`,
      borderRadius: 3,
      background: STATUS_BG[tutorial.status] !== 'transparent' ? STATUS_BG[tutorial.status] : 'var(--page)',
      padding: '16px 18px 16px 15px',
      display: 'flex',
      flexDirection: 'column',
      gap: 11,
      transition: 'background 0.2s, border-left-color 0.2s, box-shadow 0.2s',
      position: 'relative',
      boxShadow: '0 1px 6px var(--shadow-card)',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = 'var(--page-cream)'
        el.style.boxShadow = '0 3px 12px var(--shadow-card-hover)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = STATUS_BG[tutorial.status] !== 'transparent' ? STATUS_BG[tutorial.status] : 'var(--page)'
        el.style.boxShadow = '0 1px 6px var(--shadow-card)'
      }}
    >
      {/* Header row: category + language + external link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-40)',
          }}>
            {tutorial.category}
          </span>
          <span style={{ color: 'var(--grid-major)', fontSize: 9, fontFamily: 'var(--mono)' }}>·</span>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}>
            {tutorial.language}
          </span>
          {tutorial.hasVideo && (
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent-gold)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 2,
              padding: '1px 5px',
            }}>video</span>
          )}
          {tutorial.hasPdf && (
            <span style={{
              fontFamily: 'var(--mono)',
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent-gold)',
              border: '1px solid var(--accent-gold)',
              borderRadius: 2,
              padding: '1px 5px',
            }}>pdf</span>
          )}
        </div>
        <a
          href={tutorial.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ink-25)', flexShrink: 0, transition: 'color 0.15s' }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)')}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-25)')}
          title="Open tutorial"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Title */}
      <p style={{
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 15,
        color: 'var(--ink-100)',
        lineHeight: 1.35,
        margin: 0,
      }}>
        {tutorial.title}
      </p>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STATUS_CYCLE.map(status => (
          <button
            key={status}
            onClick={() => onStatusChange(tutorial.id, status)}
            style={statusChipStyle(status, tutorial.status === status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {/* Notes toggle */}
      <div>
        <button
          onClick={() => setNotesOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: notesOpen || localNotes ? 'var(--ink-60)' : 'var(--ink-25)',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            transition: 'color 0.15s',
          }}
        >
          <Pencil size={10} />
          {localNotes ? 'Notes' : 'Add note'}
          <motion.span
            animate={{ rotate: notesOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <ChevronDown size={10} />
          </motion.span>
        </button>

        <AnimatePresence>
          {notesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <textarea
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Your notes…"
                rows={3}
                style={{
                  marginTop: 8,
                  width: '100%',
                  resize: 'vertical',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--grid-major)',
                  outline: 'none',
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--ink-80)',
                  lineHeight: 1.5,
                  padding: '4px 0',
                  boxSizing: 'border-box',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
