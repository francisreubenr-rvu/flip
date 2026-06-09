'use client'

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import type { Statement } from '@/lib/ledger/types'

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface UploadResult {
  filePath: string
  fileName: string
}

interface ProcessResult {
  statement: Statement
  cleanedMarkdown: string
}

interface UploadZoneProps {
  onProcessed: (statement: Statement, cleanedMarkdown: string) => void
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'processing' | 'done' | 'error'

/* ─── Styles (stable references to avoid re-render) ───────────────────────── */

const cardStyle: React.CSSProperties = {
  background: 'var(--page-cream)',
  border: '2px dashed var(--grid-major)',
  borderRadius: 4,
  padding: '40px 32px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  cursor: 'pointer',
  transition: 'border-color 0.15s var(--ease-out-quart), background 0.15s var(--ease-out-quart)',
  minHeight: 160,
  position: 'relative',
  userSelect: 'none',
}

const cardDragStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent-dim)',
}

const iconStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 28,
  color: 'var(--ink-40)',
  lineHeight: 1,
  transition: 'color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontSize: 'clamp(18px, 2vw, 24px)',
  fontStyle: 'italic',
  color: 'var(--ink-60)',
  textAlign: 'center',
  lineHeight: 1.4,
}

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--ink-25)',
  letterSpacing: '0.08em',
}

const stateStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const errorStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  color: 'var(--danger)',
  letterSpacing: '0.06em',
  padding: '8px 16px',
  background: 'oklch(44% 0.26 16 / 0.06)',
  borderRadius: 2,
  border: '1px solid var(--danger)',
  maxWidth: '100%',
  textAlign: 'center',
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function UploadZone({ onProcessed }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setState('idle')
    setErrorMsg('')
    setFileName('')
  }

  const upload = async (file: File) => {
    setFileName(file.name)
    setErrorMsg('')

    // Sanity check
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'pdf'].includes(ext)) {
      setState('error')
      setErrorMsg('Only .xlsx and .pdf files are accepted.')
      return
    }

    // ── Upload ──────────────────────────────────────────────────────────
    setState('uploading')
    let uploadResult: UploadResult
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ledger/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Upload failed (${res.status})`)
      }
      uploadResult = (await res.json()) as UploadResult
    } catch (err: unknown) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      return
    }

    // ── Process ─────────────────────────────────────────────────────────
    setState('processing')
    try {
      const res = await fetch('/api/ledger/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadResult.filePath }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Processing failed (${res.status})`)
      }
      const result = (await res.json()) as ProcessResult

      setState('done')
      onProcessed(result.statement, result.cleanedMarkdown)
    } catch (err: unknown) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Processing failed')
    }
  }

  /* ── Drag handlers ────────────────────────────────────────────────────── */

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setState('dragging')
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set idle if we're not re-entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setState('idle')
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) {
      upload(file)
    } else {
      setState('idle')
    }
  }

  /* ── Click / keyboard handlers ────────────────────────────────────────── */

  const handleClick = () => {
    if (state === 'done') {
      reset()
      return
    }
    if (state === 'uploading' || state === 'processing') return
    inputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }

  const handleActive = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'
  }

  const handleRelease = (e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.transform = ''
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  const isBusy = state === 'uploading' || state === 'processing'

  const stateMsg = (() => {
    switch (state) {
      case 'uploading':
        return (
          <div style={stateStyle}>
            <span style={{ display: 'inline-block', animation: 'dotPulse 1s ease-in-out infinite' }}>●</span>
            {' '}uploading…
          </div>
        )
      case 'processing':
        return (
          <div style={stateStyle}>
            <span style={{ display: 'inline-block', animation: 'dotPulse 1s ease-in-out infinite' }}>●</span>
            {' '}processing…
          </div>
        )
      case 'done':
        return (
          <div style={{ ...stateStyle, color: 'var(--ink-60)' }}>
            ✓ uploaded
          </div>
        )
      case 'error':
        return <div style={errorStyle}>{errorMsg}</div>
      default:
        return null
    }
  })()

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a bank statement"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleActive}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={state === 'dragging' ? cardDragStyle : cardStyle}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Icon */}
      <div style={state === 'done' ? { ...iconStyle, color: 'var(--ink-60)' } : iconStyle}>
        {state === 'done' ? '✓' : '↑'}
      </div>

      {/* Label */}
      {state === 'idle' && (
        <div style={labelStyle}>
          Drop a statement here, or click to browse
        </div>
      )}

      {state === 'dragging' && (
        <div style={labelStyle}>
          Drop to upload
        </div>
      )}

      {state === 'done' && fileName && (
        <div style={{ ...labelStyle, fontSize: 'clamp(14px, 1.6vw, 18px)' }}>
          {fileName}
        </div>
      )}

      {/* Hint */}
      {state === 'idle' && (
        <div style={hintStyle}>
          .xlsx or .pdf
        </div>
      )}

      {/* State badge */}
      {stateMsg}

      {/* Retry hint */}
      {state === 'done' && (
        <div style={hintStyle}>
          click to upload another
        </div>
      )}

      {state === 'error' && (
        <button
          onClick={(e) => { e.stopPropagation(); reset() }}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-40)',
            background: 'none',
            border: '1px solid var(--grid-major)',
            borderRadius: 3,
            padding: '8px 18px',
            cursor: 'pointer',
            transition: 'color 0.15s, border-color 0.15s',
            marginTop: 4,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--ink-40)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--grid-major)'
          }}
        >
          try again
        </button>
      )}
    </div>
  )
}
