'use client'

import type { CSSProperties } from 'react'
import type { ProgressStatus } from '@/lib/byox/types'

interface ByoxFiltersProps {
  categories: string[]
  languages: string[]
  activeCategory: string | null
  activeLanguage: string | null
  activeStatus: ProgressStatus | null
  searchTerm: string
  filteredCount: number
  totalCount: number
  onCategory: (cat: string | null) => void
  onLanguage: (lang: string | null) => void
  onStatus: (status: ProgressStatus | null) => void
  onSearch: (term: string) => void
}

const labelStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  marginBottom: 6,
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const STATUS_LABELS: { value: ProgressStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const STATUS_ACTIVE_COLORS: Record<string, string> = {
  todo: 'var(--ink-60)',
  in_progress: 'var(--accent-gold)',
  done: 'var(--break-color)',
}

function Chip({
  label,
  active,
  activeColor,
  onClick,
}: {
  label: string
  active: boolean
  activeColor?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        border: `1px solid ${active ? (activeColor ?? 'var(--ink-80)') : 'var(--grid-major)'}`,
        borderRadius: 2,
        background: active ? (activeColor ? `color-mix(in oklch, ${activeColor} 12%, var(--page))` : 'var(--page-cream)') : 'transparent',
        color: active ? (activeColor ?? 'var(--ink-80)') : 'var(--ink-40)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export default function ByoxFilters({
  categories,
  languages,
  activeCategory,
  activeLanguage,
  activeStatus,
  searchTerm,
  filteredCount,
  totalCount,
  onCategory,
  onLanguage,
  onStatus,
  onSearch,
}: ByoxFiltersProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search */}
      <div>
        <p style={labelStyle}>Search</p>
        <input
          type="text"
          placeholder="filter by title or language…"
          value={searchTerm}
          onChange={e => onSearch(e.target.value)}
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--ink-80)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--grid-major)',
            outline: 'none',
            padding: '4px 0',
            width: '100%',
            maxWidth: 360,
          }}
        />
      </div>

      {/* Status */}
      <div>
        <p style={labelStyle}>Status</p>
        <div style={chipRowStyle}>
          {STATUS_LABELS.map(({ value, label }) => (
            <Chip
              key={label}
              label={label}
              active={activeStatus === value}
              activeColor={value ? STATUS_ACTIVE_COLORS[value] : undefined}
              onClick={() => onStatus(activeStatus === value ? null : value)}
            />
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <p style={labelStyle}>Category</p>
        <div style={chipRowStyle}>
          <Chip
            label="All"
            active={activeCategory === null}
            onClick={() => onCategory(null)}
          />
          {categories.map(cat => (
            <Chip
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => onCategory(activeCategory === cat ? null : cat)}
            />
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <p style={labelStyle}>Language</p>
        <div style={chipRowStyle}>
          <Chip
            label="All"
            active={activeLanguage === null}
            onClick={() => onLanguage(null)}
          />
          {languages.map(lang => (
            <Chip
              key={lang}
              label={lang}
              active={activeLanguage === lang}
              onClick={() => onLanguage(activeLanguage === lang ? null : lang)}
            />
          ))}
        </div>
      </div>

      {/* Results count */}
      <p style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: 'var(--ink-25)',
        marginTop: -8,
      }}>
        {filteredCount} of {totalCount} tutorials
      </p>
    </div>
  )
}
