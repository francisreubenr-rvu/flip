'use client'

import { useMemo } from 'react'
import TutorialCard from './TutorialCard'
import type { TutorialWithProgress, ProgressStatus } from '@/lib/byox/types'

interface TutorialGridProps {
  tutorials: TutorialWithProgress[]
  loading: boolean
  onStatusChange: (id: string, status: ProgressStatus) => void
  onNotesChange: (id: string, notes: string) => void
}

export default function TutorialGrid({ tutorials, loading, onStatusChange, onNotesChange }: TutorialGridProps) {
  const cards = useMemo(() => tutorials, [tutorials])

  if (loading) {
    return (
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 13,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: 'var(--ink-25)',
        padding: '48px 0',
      }}>
        Loading your study list…
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div style={{
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 18,
        color: 'var(--ink-25)',
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        No tutorials match your filters.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {cards.map(tutorial => (
        <TutorialCard
          key={tutorial.id}
          tutorial={tutorial}
          onStatusChange={onStatusChange}
          onNotesChange={onNotesChange}
        />
      ))}
    </div>
  )
}
