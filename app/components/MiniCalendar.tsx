'use client'
import { useState, useEffect } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['MON','TUE','WED','THU','FRI','SAT','SUN']

export default function MiniCalendar() {
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState<Date | null>(null)

  useEffect(() => { setMounted(true); setToday(new Date()) }, [])

  if (!mounted || !today) return null

  const year = today.getFullYear()
  const month = today.getMonth()
  const date = today.getDate()

  // First day of month (0=Sun, shift to Mon=0)
  const firstDay = new Date(year, month, 1).getDay()
  const firstDayShifted = firstDay === 0 ? 6 : firstDay - 1

  // Days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const weeks: (number | null)[][] = []
  let day = 1
  for (let w = 0; w < 6; w++) {
    const week: (number | null)[] = []
    for (let d = 0; d < 7; d++) {
      if (w === 0 && d < firstDayShifted) {
        week.push(null)
      } else if (day > daysInMonth) {
        week.push(null)
      } else {
        week.push(day++)
      }
    }
    weeks.push(week)
    if (day > daysInMonth) break
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      maxWidth: 420,
    }}>
      {/* Month/Year header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottom: '1px solid var(--grid-major)',
        paddingBottom: 8,
      }}>
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 700,
          color: 'var(--ink-100)',
          letterSpacing: '-0.01em',
        }}>
          {MONTHS[month]}
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--ink-40)',
          letterSpacing: '0.18em',
        }}>
          {year}
        </div>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
      }}>
        {DAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 8,
            letterSpacing: '0.12em',
            color: 'var(--ink-40)',
            paddingBottom: 4,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}>
          {week.map((d, di) => {
            const isToday = d === date
            return (
              <div key={di} style={{
                textAlign: 'center',
                padding: '6px 2px',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: d ? (isToday ? 'var(--page)' : 'var(--ink-80)') : 'var(--ink-25)',
                background: isToday ? 'var(--accent)' : 'transparent',
                borderRadius: isToday ? 2 : 0,
                fontWeight: isToday ? 700 : 400,
              }}>
                {d ?? ''}
              </div>
            )
          })}
        </div>
      ))}

      {/* Today's date in words */}
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--ink-60)',
        textAlign: 'center',
        borderTop: '1px solid var(--grid-minor)',
        paddingTop: 8,
      }}>
        {today.toLocaleDateString('en-US', { weekday: 'long' })}, {MONTHS[month]} {date}
      </div>
    </div>
  )
}
