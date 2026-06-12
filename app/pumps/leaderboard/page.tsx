'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Crown, Medal } from 'lucide-react'

export default function LeaderboardPage() {
  const [tab, setTab] = useState('max-weight')
  const [maxWeight, setMaxWeight] = useState<any[]>([])
  const [totalVolume, setTotalVolume] = useState<any[]>([])
  const [perExercise, setPerExercise] = useState<Record<string, any[]>>({})
  const [exercises, setExercises] = useState<any[]>([])

  useEffect(() => {
    supabase.from('exercises').select('*').order('category').then(({ data }) => setExercises(data ?? []))
    supabase.from('exercise_sets').select(`
      weight_kg, reps, workout_exercises!inner(exercise_id, exercises!inner(name), workouts!inner(user_id))
    `).eq('completed', true).then(({ data }) => {
      supabase.from('profiles').select('id, username').then(({ data: profiles }) => {
        const pm = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
        const userBest: Record<string, any> = {}
        const userVol: Record<string, any> = {}
        const exBest: Record<string, Record<string, any>> = {}
        ;(data ?? []).forEach((s: any) => {
          const uid = s.workout_exercises.workouts.user_id
          const prof = pm[uid]; if (!prof) return
          const w = Number(s.weight_kg ?? 0)
          const eid = s.workout_exercises.exercise_id
          const ename = s.workout_exercises.exercises.name
          if (w > (userBest[uid]?.weight ?? 0)) userBest[uid] = { weight: w, username: prof.username, exercise: ename }
          userVol[uid] = { volume: (userVol[uid]?.volume ?? 0) + s.reps * w, username: prof.username }
          if (!exBest[eid]) exBest[eid] = {}
          if (w > (exBest[eid][uid]?.weight ?? 0)) exBest[eid][uid] = { weight: w, username: prof.username }
        })
        setMaxWeight(Object.values(userBest).sort((a:any,b:any) => b.weight - a.weight).map((e:any,i:number) => ({ rank:i+1,...e})))
        setTotalVolume(Object.values(userVol).sort((a:any,b:any) => b.volume - a.volume).map((e:any,i:number) => ({ rank:i+1,...e})))
        const pe: Record<string, any[]> = {}
        Object.entries(exBest).forEach(([eid, users]) => {
          pe[eid] = Object.values(users).sort((a:any,b:any) => b.weight - a.weight).map((e:any,i:number) => ({ rank:i+1,...e}))
        })
        setPerExercise(pe)
      })
    })
  }, [])

  function rankIcon(r: number) {
    if (r===1) return <Crown className="h-4 w-4 inline" style={{ color:'var(--accent-gold)' }} />
    if (r===2) return <Medal className="h-4 w-4 inline" style={{ color:'var(--ink-80)' }} />
    if (r===3) return <Medal className="h-4 w-4 inline" style={{ color:'var(--accent-quiet)' }} />
    return <span className="font-[var(--mono)] text-xs" style={{ color:'var(--ink-40)' }}>{r}</span>
  }

  const cats = [...new Set(exercises.map(e => e.category))]

  return (
    <div>
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>Leaderboards</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-6" style={{ color: 'var(--ink-40)' }}>WHO DOMINATES THE GYM</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'max-weight', label: 'Max Weight' },
          { key: 'volume', label: 'Total Volume' },
          ...cats.map(c => ({ key: `cat-${c}`, label: c })),
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded text-xs font-[var(--mono)] transition-opacity"
            style={{ background: tab===t.key ? 'var(--accent)' : 'var(--page)', color: tab===t.key ? 'var(--page)' : 'var(--ink-60)', border: `1px solid ${tab===t.key ? 'var(--accent)' : 'var(--grid-major)'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'max-weight' && <LBTable data={maxWeight} valueKey="weight" unit="kg" showExercise />}
      {tab === 'volume' && <LBTable data={totalVolume} valueKey="volume" unit="kg" />}

      {cats.map(c => tab === `cat-${c}` && (
        <div key={c} className="space-y-4">
          {exercises.filter(e => e.category === c).map(ex => (
            <div key={ex.id} className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
              <h3 className="font-[var(--serif)] italic text-base p-3 border-b" style={{ borderColor: 'var(--grid-minor)', color: 'var(--ink-100)' }}>{ex.name}</h3>
              <div className="p-3">
                <LBTable data={(perExercise[ex.id]||[]).slice(0,20)} valueKey="weight" unit="kg" compact />
              </div>
            </div>
          ))}
        </div>
      ))}

      {maxWeight.length === 0 && <p className="font-[var(--mono)] text-sm py-12 text-center" style={{ color: 'var(--ink-40)' }}>No data yet.</p>}
    </div>
  )
}

function LBTable({ data, valueKey, unit, showExercise, compact }: any) {
  if (!data || data.length === 0) return <p className="font-[var(--mono)] text-sm py-8 text-center" style={{ color: 'var(--ink-40)' }}>No rankings yet. Start logging!</p>
  return (
    <table className="w-full font-[var(--mono)] text-sm">
      <thead>
        <tr style={{ color: 'var(--ink-40)' }}>
          <th className="text-left pb-2 w-10 text-[10px] tracking-wider">#</th>
          <th className="text-left pb-2 text-[10px] tracking-wider">ATHLETE</th>
          {!compact && showExercise && <th className="text-left pb-2 text-[10px] tracking-wider">EXERCISE</th>}
          <th className="text-right pb-2 text-[10px] tracking-wider">BEST</th>
        </tr>
      </thead>
      <tbody>
        {data.map((e: any) => (
          <tr key={e.rank} className="border-t transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)' }}>
            <td className="py-2">
              {e.rank === 1 ? <Crown className="h-4 w-4" style={{ color:'var(--accent-gold)' }} /> :
               e.rank === 2 ? <Medal className="h-4 w-4" style={{ color:'var(--ink-80)' }} /> :
               e.rank === 3 ? <Medal className="h-4 w-4" style={{ color:'var(--accent-quiet)' }} /> :
               <span className="text-xs" style={{ color:'var(--ink-40)' }}>{e.rank}</span>}
            </td>
            <td className="py-2 font-medium" style={{ color: 'var(--ink-80)' }}>{e.username}</td>
            {!compact && showExercise && <td className="py-2" style={{ color: 'var(--ink-40)' }}>{e.exercise}</td>}
            <td className="py-2 text-right">
              <span className="px-2 py-0.5 rounded-full text-[10px] tracking-wider" style={{ background: 'var(--accent)', color: 'var(--page)' }}>
                {Math.round(e[valueKey]).toLocaleString()} {unit}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
