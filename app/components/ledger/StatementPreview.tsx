'use client'

import { useState } from 'react'
import type { Statement, Transaction } from '@/lib/ledger/types'

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface StatementPreviewProps {
  statement: Statement | null
  onApply: (transactions: Transaction[]) => void
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

const card: React.CSSProperties = {
  background: 'var(--page-cream)',
  border: '1px solid var(--grid-major)',
  borderRadius: 3,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const metaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px 24px',
}

const metaLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-25)',
  marginBottom: 2,
}

const metaValue: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 18,
  fontStyle: 'italic',
  color: 'var(--ink-80)',
}

const divider: React.CSSProperties = {
  height: 1,
  background: 'var(--grid-major)',
  border: 'none',
  margin: 0,
}

const statRow: React.CSSProperties = {
  display: 'flex',
  gap: 32,
  flexWrap: 'wrap',
}

const statItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const statLabel: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--ink-25)',
}

const statValue: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 24,
  fontStyle: 'italic',
  color: 'var(--ink-100)',
  letterSpacing: '-0.02em',
}

/* Table (compact) */
const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
}

const th: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid var(--grid-major)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid var(--grid-minor)',
  verticalAlign: 'top',
  lineHeight: 1.3,
}

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: 'right',
}

/* Button */
const applyBtn: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--page)',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 2,
  padding: '14px 32px',
  cursor: 'pointer',
  transition: 'background 0.15s var(--ease-out-quart), opacity 0.15s',
  alignSelf: 'flex-start',
  minHeight: 44,
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function StatementPreview({ statement, onApply }: StatementPreviewProps) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  if (!statement) return null

  const {
    accountName,
    accountNumber,
    statementPeriod,
    openingBalance,
    closingBalance,
    transactions,
  } = statement

  const totalDebits = transactions.reduce((sum, tx) => sum + (tx.debit ?? 0), 0)
  const totalCredits = transactions.reduce((sum, tx) => sum + (tx.credit ?? 0), 0)

  const fmt = (n: number | null): string =>
    n !== null ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

  const periodLabel =
    typeof statementPeriod === 'string'
      ? statementPeriod
      : `${statementPeriod.from} – ${statementPeriod.to}`

  const handleApply = async () => {
    if (applied || applying) return
    setApplying(true)
    try {
      const res = await fetch('/api/ledger/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Apply failed')
      }
      setApplied(true)
      onApply(transactions)
    } catch {
      // Still call onApply so the parent can attempt to handle it locally
      setApplied(true)
      onApply(transactions)
    } finally {
      setApplying(false)
    }
  }

  return (
    <section>
      <h2 style={sectionHeadline}>Statement Preview</h2>

      <div style={{ ...card, marginTop: 16 }}>
        {/* Metadata */}
        <div style={metaGrid}>
          <div>
            <div style={metaLabel}>Account</div>
            <div style={metaValue}>{accountName}</div>
          </div>
          <div>
            <div style={metaLabel}>Account Number</div>
            <div style={metaValue}>{accountNumber}</div>
          </div>
          <div>
            <div style={metaLabel}>Period</div>
            <div style={metaValue}>{periodLabel}</div>
          </div>
          <div>
            <div style={metaLabel}>Opening / Closing Balance</div>
            <div style={metaValue}>
              {fmt(openingBalance)} → {fmt(closingBalance)}
            </div>
          </div>
        </div>

        <hr style={divider} />

        {/* Summary stats */}
        <div style={statRow}>
          <div style={statItem}>
            <span style={statLabel}>Transactions</span>
            <span style={statValue}>{transactions.length}</span>
          </div>
          <div style={statItem}>
            <span style={{ ...statLabel, color: 'var(--ink-100)' }}>Total Debits</span>
            <span style={{ ...statValue, fontSize: 20 }}>{fmt(totalDebits)}</span>
          </div>
          <div style={statItem}>
            <span style={{ ...statLabel, color: 'oklch(48% 0.16 152)' }}>Total Credits</span>
            <span style={{ ...statValue, fontSize: 20, color: 'oklch(48% 0.16 152)' }}>
              {fmt(totalCredits)}
            </span>
          </div>
        </div>

        {/* Compact transaction table: show first 5 rows + "...and N more" */}
        <div style={{ overflowX: 'auto' }}>
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
              {transactions.slice(0, 5).map((tx, i) => (
                <tr key={tx.fingerprint ?? i}>
                  <td style={td}>{tx.date}</td>
                  <td style={{ ...td, fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'italic' }}>
                    {tx.description}
                  </td>
                  <td style={{ ...tdRight, color: 'var(--ink-100)' }}>{fmt(tx.debit)}</td>
                  <td style={{ ...tdRight, color: 'oklch(48% 0.16 152)' }}>{fmt(tx.credit)}</td>
                  <td style={tdRight}>{fmt(tx.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length > 5 && (
          <div style={{
            fontFamily: 'var(--serif)',
            fontSize: 14,
            fontStyle: 'italic',
            color: 'var(--ink-40)',
            textAlign: 'center',
            marginTop: -12,
          }}>
            …and {transactions.length - 5} more
          </div>
        )}

        <hr style={divider} />

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={applied}
          style={{
            ...applyBtn,
            opacity: applied ? 0.5 : applying ? 0.7 : 1,
            cursor: applied ? 'default' : 'pointer',
            background: applied ? 'oklch(48% 0.16 152)' : 'var(--accent)',
          }}
          onMouseEnter={(e) => {
            if (!applied && !applying) {
              (e.currentTarget as HTMLElement).style.background = 'oklch(56% 0.22 22)'
            }
          }}
          onMouseLeave={(e) => {
            if (!applied) {
              (e.currentTarget as HTMLElement).style.background = 'var(--accent)'
            }
          }}
          onMouseDown={(e) => {
            if (!applied) {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)'
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = ''
          }}
        >
          {applied ? '✓ Applied' : applying ? 'Applying…' : 'Apply to Ledger'}
        </button>
      </div>
    </section>
  )
}
