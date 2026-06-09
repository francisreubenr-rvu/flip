'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { Transaction, Statement, Ledger } from '@/lib/ledger/types'
import UploadZone from '../components/ledger/UploadZone'
import StatementPreview from '../components/ledger/StatementPreview'
import TransactionTable from '../components/ledger/TransactionTable'

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const pageHeadline: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(32px, 5vw, 72px)',
  fontStyle: 'italic',
  fontWeight: 700,
  color: 'var(--ink-100)',
  letterSpacing: '-0.03em',
  lineHeight: 1,
}

const pageEyebrow: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(20px, 2.4vw, 32px)',
  fontStyle: 'italic',
  color: 'var(--ink-100)',
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
}

const sectionSeperator: React.CSSProperties = {
  height: 1,
  background: 'var(--grid-major)',
  border: 'none',
  margin: 0,
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function LedgerPage() {
  /* ── Data state ────────────────────────────────────────────────────────── */
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [statement, setStatement] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)

  /* ── Filter state ──────────────────────────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  /* ── Fetch ledger on mount ─────────────────────────────────────────────── */
  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetch('/api/ledger/transactions')
        if (res.ok) {
          const data = await res.json()
          setTransactions(data.transactions ?? [])
          setLastUpdated(data.lastUpdated ?? '')
        }
      } catch {
        // API may not be available — start empty
      } finally {
        setLoading(false)
      }
    }
    fetchLedger()
  }, [])

  /* ── Filtered transactions ─────────────────────────────────────────────── */
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchDesc =
        !searchTerm ||
        tx.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchFrom = !dateFrom || tx.date >= dateFrom
      const matchTo = !dateTo || tx.date <= dateTo
      return matchDesc && matchFrom && matchTo
    })
  }, [transactions, searchTerm, dateFrom, dateTo])

  /* ── Callbacks ──────────────────────────────────────────────────────────── */

  const handleProcessed = useCallback(
    (newStatement: Statement, _cleanedMarkdown: string) => {
      setStatement(newStatement)
    },
    [],
  )

  const handleApply = useCallback(
    async (newTransactions: Transaction[]) => {
      // Refresh the full ledger from the API after applying.
      try {
        const res = await fetch('/api/ledger/transactions')
        if (res.ok) {
          const data = await res.json()
          setTransactions(data.transactions ?? [])
          setLastUpdated(data.lastUpdated ?? '')
        }
      } catch {
        // Fallback: merge locally
        const existingFps = new Set(transactions.map((t) => t.fingerprint))
        const fresh = newTransactions.filter((t) => !existingFps.has(t.fingerprint))
        if (fresh.length > 0) {
          const merged = [...transactions, ...fresh].sort((a, b) => {
            const dc = a.date.localeCompare(b.date)
            if (dc !== 0) return dc
            return a.balance - b.balance
          })
          setTransactions(merged)
          setLastUpdated(new Date().toISOString())
        }
      }
    },
    [transactions],
  )

  const handleSearch = useCallback((term: string) => setSearchTerm(term), [])
  const handleDateFrom = useCallback((d: string) => setDateFrom(d), [])
  const handleDateTo = useCallback((d: string) => setDateTo(d), [])

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div
      className="notebook"
      style={{
        height: 'auto',
        minHeight: 'calc(100dvh - 24px)',
      }}
    >
      {/* ── Content (padded for margin line) ─────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
          padding: '48px 48px 64px 76px',
          position: 'relative',
          zIndex: 4,
          overflowY: 'auto',
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <header>
          <div style={pageEyebrow}>Financial Ledger</div>
          <h1 style={pageHeadline}>Ledger</h1>
          {lastUpdated !== 'never' && lastUpdated !== '' && (
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--ink-25)',
                letterSpacing: '0.06em',
                marginTop: 8,
              }}
            >
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          )}
        </header>

        {/* ── Section 1: Upload ──────────────────────────────────────────── */}
        <section>
          <div style={sectionTitle}>Upload Statement</div>
          <div style={{ marginTop: 14 }}>
            <UploadZone onProcessed={handleProcessed} />
          </div>
        </section>

        <hr style={sectionSeperator} />

        {/* ── Section 2: Statement Preview ───────────────────────────────── */}
        {statement && (
          <>
            <StatementPreview statement={statement} onApply={handleApply} />
            <hr style={sectionSeperator} />
          </>
        )}

        {/* ── Section 3: Ledger view ─────────────────────────────────────── */}
        <section>
          {loading ? (
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 13,
                color: 'var(--ink-25)',
                letterSpacing: '0.10em',
              }}
            >
              Loading ledger…
            </div>
          ) : (
            <TransactionTable
              transactions={filteredTransactions}
              total={transactions.length}
              searchTerm={searchTerm}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onSearch={handleSearch}
              onDateFrom={handleDateFrom}
              onDateTo={handleDateTo}
            />
          )}
        </section>
      </div>
    </div>
  )
}
