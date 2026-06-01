'use client'
import { useState, useEffect, useCallback } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

type Reminder = { text: string; time: string }
type Reminders = Record<string, Reminder>

function loadReminders(): Reminders {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('flip-reminders') || '{}') } catch { return {} }
}

function saveReminders(r: Reminders) {
  try { localStorage.setItem('flip-reminders', JSON.stringify(r)) } catch {}
}

export default function Calendar() {
  const [today, setToday] = useState<Date | null>(null)
  const [view, setView] = useState<{ year: number; month: number } | null>(null)
  const [reminders, setReminders] = useState<Reminders>({})
  const [popup, setPopup] = useState<{ day: number; key: string } | null>(null)
  const [input, setInput] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const d = new Date()
    setToday(d)
    setView({ year: d.getFullYear(), month: d.getMonth() })
    setReminders(loadReminders())
  }, [])

  const save = useCallback((r: Reminders) => { setReminders(r); saveReminders(r) }, [])

  if (!mounted || !today || !view) return null

  const { year, month } = view
  const firstDay = new Date(year, month, 1).getDay()
  const firstShifted = firstDay === 0 ? 6 : firstDay - 1
  const totalDays = new Date(year, month + 1, 0).getDate()

  // Build week rows
  const weeks: (number | null)[][] = []
  let d = 1
  for (let w = 0; w < 6; w++) {
    const row: (number | null)[] = []
    for (let col = 0; col < 7; col++) {
      if (w === 0 && col < firstShifted) row.push(null)
      else if (d > totalDays) row.push(null)
      else row.push(d++)
    }
    weeks.push(row)
    if (d > totalDays) break
  }

  const prevMonth = () => setView(v => ({ year: v!.month === 0 ? v!.year - 1 : v!.year, month: v!.month === 0 ? 11 : v!.month - 1 }))
  const nextMonth = () => setView(v => ({ year: v!.month === 11 ? v!.year + 1 : v!.year, month: v!.month === 11 ? 0 : v!.month + 1 }))

  const openPopup = (day: number) => {
    const key = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const existing = reminders[key]
    setPopup({ day, key })
    setInput(existing?.text || '')
  }

  const handleSave = () => {
    if (!popup) return
    const trimmed = input.trim()
    if (!trimmed) {
      // Delete reminder
      const next = { ...reminders }
      delete next[popup.key]
      save(next)
    } else {
      save({ ...reminders, [popup.key]: { text: trimmed, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) } })
    }
    setPopup(null)
    setInput('')
  }

  const handleDelete = () => {
    if (!popup) return
    const next = { ...reminders }
    delete next[popup.key]
    save(next)
    setPopup(null)
    setInput('')
  }

  return (
    <div style={{
      width: '100%', maxWidth: 640,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Month header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        borderBottom: '1px solid var(--grid-major)', paddingBottom: 10,
      }}>
        <button onClick={prevMonth} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink-40)',
          padding: '2px 8px',
        }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--serif)', fontSize: 36, fontStyle: 'italic', fontWeight: 700,
            color: 'var(--ink-100)', letterSpacing: '-0.02em', lineHeight: 1,
          }}>
            {MONTHS[view.month]}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-40)', letterSpacing: '0.14em', marginTop: 2 }}>
            {view.year}
          </div>
        </div>
        <button onClick={nextMonth} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--ink-40)',
          padding: '2px 8px',
        }}>→</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {DAYS.map(dh => (
          <div key={dh} style={{
            textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--ink-40)', letterSpacing: '0.10em', padding: '6px 0 8px',
          }}>{dh}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {weeks.map((row, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {row.map((day, di) => {
              if (day === null) return <div key={di} style={{ aspectRatio: '1', borderRadius: 3 }} />
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const key = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const hasReminder = !!reminders[key]

              return (
                <button
                  key={di}
                  onClick={() => openPopup(day)}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--grid-minor)',
                    background: isToday ? 'var(--accent-dim)' : hasReminder ? 'oklch(78% 0.04 55 / 0.5)' : 'var(--page)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 14,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--accent)' : 'var(--ink-80)',
                    position: 'relative',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Today info */}
      <div style={{
        fontFamily: 'var(--serif)', fontSize: 14, fontStyle: 'italic',
        color: 'var(--ink-60)', textAlign: 'center',
        borderTop: '1px solid var(--grid-minor)', paddingTop: 10,
      }}>
        {today.toLocaleDateString('en-US', { weekday: 'long' })}, {MONTHS[today.getMonth()]} {today.getDate()}
        {' · '}{Object.keys(reminders).length} reminder{Object.keys(reminders).length !== 1 ? 's' : ''}
      </div>

      {/* Popup modal */}
      {popup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'oklch(10% 0.01 60 / 0.3)', backdropFilter: 'blur(4px)',
        }} onClick={() => setPopup(null)}>
          <div style={{
            background: 'var(--page)', border: '1px solid var(--grid-major)',
            borderRadius: 16, padding: 32, width: 560, maxWidth: '92vw',
            boxShadow: '0 16px 64px oklch(10% 0.02 40 / 0.3)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily: 'var(--serif)', fontSize: 22, fontStyle: 'italic',
              color: 'var(--ink-100)', letterSpacing: '-0.01em',
            }}>
              {MONTHS[view.month]} {popup.day}, {view.year}
            </div>

            {reminders[popup.key] && (
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-40)',
                letterSpacing: '0.08em', background: 'var(--page-cream)',
                padding: '8px 10px', borderRadius: 2, border: '1px solid var(--grid-minor)',
              }}>
                Last saved at {reminders[popup.key].time}
              </div>
            )}

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="What do you need to remember?"
              autoFocus
              style={{
                width: '100%', minHeight: 80,
                background: 'var(--page)', border: '1px solid var(--grid-major)',
                borderRadius: 3, padding: 12,
                fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'italic',
                color: 'var(--ink-100)', resize: 'vertical', outline: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                if (e.key === 'Escape') setPopup(null)
              }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {reminders[popup.key] && (
                <button onClick={handleDelete} style={{
                  background: 'none', border: '1px solid var(--accent)',
                  borderRadius: 3, padding: '8px 14px',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em',
                  color: 'var(--accent)', cursor: 'pointer',
                }}>Delete</button>
              )}
              <button onClick={() => setPopup(null)} style={{
                background: 'none', border: '1px solid var(--grid-major)',
                borderRadius: 3, padding: '8px 14px',
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em',
                color: 'var(--ink-60)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleSave} style={{
                background: 'var(--ink-100)', border: '1px solid var(--ink-100)',
                borderRadius: 3, padding: '8px 18px',
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em',
                color: 'var(--page)', cursor: 'pointer', fontWeight: 700,
              }}>
                {input.trim() ? 'Save' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
