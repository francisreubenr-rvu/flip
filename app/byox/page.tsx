'use client'

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
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

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default function ByoxPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  /* ── Auth guard ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && !user) router.replace('/signin')
  }, [user, authLoading, router])

  /* ── State ──────────────────────────────────────────────────────────────── */
  const [progress, setProgress] = useState<Map<string, TutorialProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<ProgressStatus | null>(null)

  /* ── Load progress from Supabase ─────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    supabase
      .from('byox_progress')
      .select('tutorial_id, status, notes, updated_at')
      .then(({ data, error }) => {
        if (error) console.warn('[byox] failed to load progress:', error.message)
        if (data) {
          const map = new Map<string, TutorialProgress>()
          data.forEach(row => {
            map.set(row.tutorial_id, {
              tutorialId: row.tutorial_id,
              status: row.status as ProgressStatus,
              notes: row.notes ?? '',
              updatedAt: row.updated_at ?? '',
            })
          })
          setProgress(map)
        }
        setLoading(false)
      })
  }, [user])

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
  const handleStatusChange = useCallback(async (tutorialId: string, status: ProgressStatus) => {
    // Optimistic update
    setProgress(prev => {
      const next = new Map(prev)
      const existing = next.get(tutorialId)
      next.set(tutorialId, {
        tutorialId,
        status,
        notes: existing?.notes ?? '',
        updatedAt: new Date().toISOString(),
      })
      return next
    })
    const { error } = await supabase.from('byox_progress').upsert(
      { tutorial_id: tutorialId, status, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,tutorial_id' }
    )
    if (error) console.warn('[byox] status update failed:', error.message)
  }, [])

  const handleNotesChange = useCallback(async (tutorialId: string, notes: string) => {
    setProgress(prev => {
      const next = new Map(prev)
      const existing = next.get(tutorialId)
      next.set(tutorialId, {
        tutorialId,
        status: existing?.status ?? 'todo',
        notes,
        updatedAt: new Date().toISOString(),
      })
      return next
    })
    const { error } = await supabase.from('byox_progress').upsert(
      { tutorial_id: tutorialId, notes, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,tutorial_id' }
    )
    if (error) console.warn('[byox] notes update failed:', error.message)
  }, [])

  /* ── Category change clears language filter ──────────────────────────────── */
  const handleCategoryChange = useCallback((cat: string | null) => {
    setActiveCategory(cat)
    setActiveLanguage(null)
  }, [])

  /* ── Guard ───────────────────────────────────────────────────────────────── */
  if (authLoading || !user) return null

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
