'use client'

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import type { TutorialProgress, TutorialWithProgress, ProgressStatus } from '@/lib/byox/types'
import tutorialsData from '@/lib/byox/data.json'
import ByoxHeader from '@/app/components/byox/ByoxHeader'
import ByoxFilters from '@/app/components/byox/ByoxFilters'
import TutorialGrid from '@/app/components/byox/TutorialGrid'

/* ─── Style constants (mirrors ledger/page.tsx) ──────────────────────────── */

const separator: CSSProperties = {
  height: 1,
  background: 'var(--grid-major)',
  border: 'none',
  margin: 0,
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const ALL_TUTORIALS = tutorialsData as TutorialWithProgress[]

const PROGRESS_KEY = 'flip-byox-progress'

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function loadProgress(): Map<string, TutorialProgress> {
  const map = new Map<string, TutorialProgress>()
  if (typeof window === 'undefined') return map
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return map
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return map
    Object.entries(parsed as Record<string, unknown>).forEach(([id, v]) => {
      const entry = v as Partial<TutorialProgress> | null
      if (!entry || typeof entry !== 'object') return
      map.set(id, {
        tutorialId: id,
        status: (['todo', 'in_progress', 'done'] as ProgressStatus[]).includes(entry.status as ProgressStatus)
          ? (entry.status as ProgressStatus)
          : 'todo',
        notes: typeof entry.notes === 'string' ? entry.notes : '',
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      })
    })
  } catch { /* ignore corrupt data */ }
  return map
}

function saveProgress(map: Map<string, TutorialProgress>) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(Object.fromEntries(map))) } catch { /* ignore quota/serialization errors */ }
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default function ByoxPage() {
  /* ── State ──────────────────────────────────────────────────────────────── */
  const [progress, setProgress] = useState<Map<string, TutorialProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<ProgressStatus | null>(null)

  /* ── Load progress from localStorage ─────────────────────────────────────── */
  useEffect(() => {
    setProgress(loadProgress())
    setLoading(false)
  }, [])

  /* ── Merge static tutorials + progress ──────────────────────────────────── */
  const tutorialsWithProgress = useMemo<TutorialWithProgress[]>(() => {
    return ALL_TUTORIALS.map(t => ({
      ...t,
      status: progress.get(t.id)?.status ?? 'todo',
      notes: progress.get(t.id)?.notes ?? '',
    }))
  }, [progress])

  /* ── Derived filter options ──────────────────────────────────────────────── */
  const categories = useMemo(
    () => unique(ALL_TUTORIALS.map(t => t.category)).sort(),
    []
  )

  const languages = useMemo(() => {
    const source = activeCategory
      ? ALL_TUTORIALS.filter(t => t.category === activeCategory)
      : ALL_TUTORIALS
    return unique(source.map(t => t.language)).sort()
  }, [activeCategory])

  /* ── Filtered list ───────────────────────────────────────────────────────── */
  const filtered = useMemo<TutorialWithProgress[]>(() => {
    const q = searchTerm.toLowerCase()
    return tutorialsWithProgress.filter(t => {
      const matchCat    = !activeCategory || t.category === activeCategory
      const matchLang   = !activeLanguage || t.language === activeLanguage
      const matchStatus = !activeStatus   || t.status === activeStatus
      const matchSearch = !q ||
        t.title.toLowerCase().includes(q) ||
        t.language.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      return matchCat && matchLang && matchStatus && matchSearch
    })
  }, [tutorialsWithProgress, activeCategory, activeLanguage, activeStatus, searchTerm])

  /* ── Stats ───────────────────────────────────────────────────────────────── */
  const doneCount = useMemo(
    () => tutorialsWithProgress.filter(t => t.status === 'done').length,
    [tutorialsWithProgress]
  )
  const inProgressCount = useMemo(
    () => tutorialsWithProgress.filter(t => t.status === 'in_progress').length,
    [tutorialsWithProgress]
  )

  /* ── Handlers ────────────────────────────────────────────────────────────── */
  const handleStatusChange = useCallback((tutorialId: string, status: ProgressStatus) => {
    const existing = progress.get(tutorialId)
    const next = new Map(progress)
    next.set(tutorialId, {
      tutorialId,
      status,
      notes: existing?.notes ?? '',
      updatedAt: new Date().toISOString(),
    })
    setProgress(next)
    saveProgress(next)
  }, [progress])

  const handleNotesChange = useCallback((tutorialId: string, notes: string) => {
    const existing = progress.get(tutorialId)
    const next = new Map(progress)
    next.set(tutorialId, {
      tutorialId,
      status: existing?.status ?? 'todo',
      notes,
      updatedAt: new Date().toISOString(),
    })
    setProgress(next)
    saveProgress(next)
  }, [progress])

  /* ── Category change clears language filter ──────────────────────────────── */
  const handleCategoryChange = useCallback((cat: string | null) => {
    setActiveCategory(cat)
    setActiveLanguage(null)
  }, [])

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div
      className="notebook"
      style={{ height: 'auto', minHeight: 'calc(100dvh - 24px)' }}
    >
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
        padding: '48px 48px 80px 76px',
        position: 'relative',
        zIndex: 4,
        overflowY: 'auto',
      }}>
        <ByoxHeader
          totalCount={ALL_TUTORIALS.length}
          doneCount={doneCount}
          inProgressCount={inProgressCount}
        />

        <hr style={separator} />

        <ByoxFilters
          categories={categories}
          languages={languages}
          activeCategory={activeCategory}
          activeLanguage={activeLanguage}
          activeStatus={activeStatus}
          searchTerm={searchTerm}
          filteredCount={filtered.length}
          totalCount={ALL_TUTORIALS.length}
          onCategory={handleCategoryChange}
          onLanguage={setActiveLanguage}
          onStatus={setActiveStatus}
          onSearch={setSearchTerm}
        />

        <hr style={separator} />

        <TutorialGrid
          tutorials={filtered}
          loading={loading}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
        />
      </div>
    </div>
  )
}
