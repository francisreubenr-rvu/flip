'use client'

import { useState, useCallback } from 'react'
import type { Transaction } from '@/lib/ledger/types'

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface TransactionTableProps {
  transactions: Transaction[]
  total: number
  searchTerm?: string
  dateFrom?: string
  dateTo?: string
  onSearch?: (term: string) => void
  onDateFrom?: (date: string) => void
  onDateTo?: (date: string) => void
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const sectionHeadline: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(20px, 2.4vw, 32px)',
  fontStyle: 'italic',
  color: 'var(--ink-100)',
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
}

const countBadge: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--ink-40)',
  letterSpacing: '0.10em',
}

/* Filter input style */
const filterInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--page)',
  border: '1px solid var(--grid-major)',
  borderRadius: 2,
  padding: '10px 14px',
  fontFamily: 'var(--serif)',
  fontSize: 16,
  fontStyle: 'italic',
  color: 'var(--ink-80)',
  outline: 'none',
  transition: 'border-color 0.15s var(--ease-out-quart)',
  minHeight: 44,
}

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--page)',
  border: '1px solid var(--grid-major)',
  borderRadius: 2,
  padding: '8px 12px',
  fontFamily: 'var(--mono)',
  fontSize: 13,
  color: 'var(--ink-60)',
  outline: 'none',
  transition: 'border-color 0.15s var(--ease-out-quart)',
  minHeight: 44,
  fontVariantNumeric: 'tabular-nums',
}

/* Table styles */
const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
  maxHeight: 560,
  overflowY: 'auto',
  border: '1px solid var(--grid-major)',
  borderRadius: 2,
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
}

const th: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  textAlign: 'left',
  padding: '10px 14px',
  borderBottom: '1px solid var(--grid-major)',
  background: 'var(--page-cream)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '8px 14px',
  borderBottom: '1px solid var(--grid-minor)',
  verticalAlign: 'top',
  lineHeight: 1.4,
}

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  fontFamily: 'var(--serif)',
  fontSize: 18,
  fontStyle: 'italic',
  color: 'var(--ink-25)',
  padding: '48px 24px',
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function TransactionTable({
  transactions,
  total,
  searchTerm = '',
  dateFrom = '',
  dateTo = '',
  onSearch,
  onDateFrom,
  onDateTo,
}: TransactionTableProps) {
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSearch?.(e.target.value),
    [onSearch],
  )

  const handleDateFrom = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onDateFrom?.(e.target.value),
    [onDateFrom],
  )

  const handleDateTo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onDateTo?.(e.target.value),
    [onDateTo],
  )

  const handleFocus = (name: string) => () => setFocusedInput(name)
  const handleBlur = () => setFocusedInput(null)

  const filteredCount = transactions.length

  /* ── Input dynamic border (focus highlight) ───────────────────────────── */
  const searchInputStyle = {
    ...filterInputStyle,
    borderColor: focusedInput === 'search' ? 'var(--accent)' as string : 'var(--grid-major)' as string,
  }

  const dateFromInputStyle = {
    ...dateInputStyle,
    borderColor: focusedInput === 'dateFrom' ? 'var(--accent)' as string : 'var(--grid-major)' as string,
  }

  const dateToInputStyle = {
    ...dateInputStyle,
    borderColor: focusedInput === 'dateTo' ? 'var(--accent)' as string : 'var(--grid-major)' as string,
  }

  /* ── Render helpers ────────────────────────────────────────────────────── */

  const fmt = (n: number | null): string =>
    n !== null ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

  const renderRow = (tx: Transaction, i: number) => {
    const bg = i % 2 === 0 ? 'var(--page)' : 'var(--page-cream)'
    return (
      <tr
        key={tx.fingerprint ?? i}
        style={{
          background: bg,
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--page-buff)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = bg
        }}
      >
        <td style={td}>{tx.date}</td>
        <td style={{ ...td, fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic' }}>
          {tx.description}
        </td>
        <td style={{ ...tdRight, color: 'var(--ink-100)' }}>
          {tx.debit !== null ? fmt(tx.debit) : ''}
        </td>
        <td style={{ ...tdRight, color: 'oklch(48% 0.16 152)' }}>
          {tx.credit !== null ? fmt(tx.credit) : ''}
        </td>
        <td style={tdRight}>{fmt(tx.balance)}</td>
      </tr>
    )
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <section>
      {/* Headline row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h2 style={sectionHeadline}>Ledger</h2>
        <span style={countBadge}>
          {filteredCount !== total
            ? `${filteredCount} of ${total} transactions`
            : `${total} transaction${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px 180px',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search descriptions…"
            value={searchTerm}
            onChange={handleSearch}
            onFocus={handleFocus('search')}
            onBlur={handleBlur}
            style={searchInputStyle}
            aria-label="Search transactions by description"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={handleDateFrom}
          onFocus={handleFocus('dateFrom')}
          onBlur={handleBlur}
          style={dateFromInputStyle}
          aria-label="Filter from date"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={handleDateTo}
          onFocus={handleFocus('dateTo')}
          onBlur={handleBlur}
          style={dateToInputStyle}
          aria-label="Filter to date"
          placeholder="To"
        />
      </div>

      {/* Table */}
      {total === 0 ? (
        <div style={emptyStyle}>No transactions yet.</div>
      ) : filteredCount === 0 ? (
        <div style={emptyStyle}>No transactions match your search.</div>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Description</th>
                <th style={{ ...th, textAlign: 'right' }}>Debit</th>
                <th style={{ ...th, textAlign: 'right' }}>Credit</th>
                <th style={{ ...th, textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => renderRow(tx, i))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
