'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Dumbbell, TrendingUp } from 'lucide-react'

export default function ProgressPage() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [maxWeightData, setMaxWeightData] = useState<any[]>([])
  const [volumeData, setVolumeData] = useState<any[]>([])
  const [tab, setTab] = useState<'weight'|'volume'>('weight')

  useEffect(() => {
    if (!user) return
    supabase.from('exercise_sets').select(`
      reps, weight_kg, created_at,
      workout_exercises!inner(exercises!inner(name), workouts!inner(started_at))
    `).eq('completed', true).eq('workout_exercises.workouts.user_id', user.id).order('created_at', { ascending: true }).then(({ data }) => {
      const uniq = [...new Set((data ?? []).map((d: any) => d.workout_exercises.exercises.name))] as string[]
      setExercises(uniq)
      if (uniq.length > 0) setSelected(uniq[0])

      const all: any[] = (data ?? []).map((r: any) => ({
        date: new Date(r.workout_exercises.workouts.started_at).toLocaleDateString(),
        weight_kg: r.weight_kg ?? 0, reps: r.reps,
        volume: r.reps * (r.weight_kg ?? 0),
        exercise: r.workout_exercises.exercises.name,
      }))

      const mwd: any[] = []
      const seen: Record<string, number> = {}
      all.forEach((d: any) => {
        const k = `${d.date}|${d.exercise}`
        if (!seen[k] || d.weight_kg > seen[k]) { seen[k] = d.weight_kg; mwd.push(d) }
      })
      setMaxWeightData(mwd.sort((a: any,b: any) => a.date.localeCompare(b.date)))

      const vw: Record<string,number> = {}
      all.forEach((d:any) => {
        const dt = new Date(d.date.replace(/\//g,'-'))
        dt.setDate(dt.getDate() - dt.getDay())
        const k = dt.toLocaleDateString()
        vw[k] = (vw[k]||0) + d.volume
      })
      setVolumeData(Object.entries(vw).map(([p,v]) => ({ period: p, volume: Math.round(v) })).sort((a,b) => a.period.localeCompare(b.period)))
    })
  }, [user])

  const filtered = maxWeightData.filter((d: any) => d.exercise === selected)

  return (
    <div>
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>Progress</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-6" style={{ color: 'var(--ink-40)' }}>STRENGTH OVER TIME</p>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'weight' as const, label: 'Max Weight', icon: Dumbbell },
          { key: 'volume' as const, label: 'Volume', icon: TrendingUp },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1 px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity"
            style={{ background: tab === t.key ? 'var(--accent)' : 'var(--page)', color: tab === t.key ? 'var(--page)' : 'var(--ink-60)', border: `1px solid ${tab === t.key ? 'var(--accent)' : 'var(--grid-major)'}` }}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'weight' && (
        <div className="border rounded p-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Max Weight</h3>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="px-2 py-1 text-xs font-[var(--mono)] border rounded outline-none"
              style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }}>
              {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          {filtered.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filtered}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-minor)" />
                  <XAxis dataKey="date" stroke="var(--ink-40)" fontSize={10} />
                  <YAxis stroke="var(--ink-40)" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'var(--page)', border: '1px solid var(--grid-major)', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--mono)' }} />
                  <Line type="monotone" dataKey="weight_kg" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="font-[var(--mono)] text-sm py-8 text-center" style={{ color: 'var(--ink-40)' }}>No data for {selected}</p>}
        </div>
      )}

      {tab === 'volume' && (
        <div className="border rounded p-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <h3 className="font-[var(--serif)] italic text-lg mb-4" style={{ color: 'var(--ink-100)' }}>Weekly Volume</h3>
          {volumeData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-minor)" />
                  <XAxis dataKey="period" stroke="var(--ink-40)" fontSize={10} />
                  <YAxis stroke="var(--ink-40)" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'var(--page)', border: '1px solid var(--grid-major)', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--mono)' }} />
                  <Bar dataKey="volume" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="font-[var(--mono)] text-sm py-8 text-center" style={{ color: 'var(--ink-40)' }}>Log workouts to see volume data</p>}
        </div>
      )}
    </div>
  )
}
