'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/lib/supabase'
import { ArrowLeft, Crown, Medal } from 'lucide-react'

export default function ExerciseLeaderboardPage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const [exercise, setExercise] = useState<any>(null)
  const [ranked, setRanked] = useState<any[]>([])

  useEffect(() => {
    if (!exerciseId) return
    supabase.from('exercises').select('*').eq('id', exerciseId).single().then(({ data }) => setExercise(data))
    supabase.from('exercise_sets').select(`
      weight_kg, reps, workout_exercises!inner(exercise_id, exercises!inner(name), workouts!inner(user_id))
    `).eq('completed', true).eq('workout_exercises.exercise_id', exerciseId).then(({ data }) => {
      supabase.from('profiles').select('id, username').then(({ data: profiles }) => {
        const pm = Object.fromEntries((profiles??[]).map((p:any) => [p.id, p]))
        const best: Record<string, any> = {}
        ;(data??[]).forEach((s:any) => {
          const uid = s.workout_exercises.workouts.user_id
          const prof = pm[uid]; if (!prof) return
          const w = Number(s.weight_kg ?? 0)
          if (w > (best[uid]?.weight ?? 0)) best[uid] = { weight: w, username: prof.username }
        })
        setRanked(Object.values(best).sort((a:any,b:any) => b.weight - a.weight).map((e:any,i:number) => ({ rank:i+1,...e })))
      })
    })
  }, [exerciseId])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pumps/leaderboard" className="hover:opacity-70" style={{ color: 'var(--ink-40)' }}><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>{exercise?.name ?? 'Exercise'} Leaderboard</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>{exercise?.category}</p>
        </div>
      </div>

      {ranked.length > 0 ? (
        <div className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <table className="w-full font-[var(--mono)] text-sm">
            <thead>
              <tr style={{ color: 'var(--ink-40)' }}>
                <th className="text-left p-3 pb-2 text-[10px] tracking-wider">#</th>
                <th className="text-left p-3 pb-2 text-[10px] tracking-wider">ATHLETE</th>
                <th className="text-right p-3 pb-2 text-[10px] tracking-wider">BEST</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(e => (
                <tr key={e.rank} className="border-t transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)' }}>
                  <td className="p-3">
                    {e.rank===1 ? <Crown className="h-4 w-4" style={{ color:'var(--accent-gold)' }} /> :
                     e.rank===2 ? <Medal className="h-4 w-4" style={{ color:'var(--ink-80)' }} /> :
                     e.rank===3 ? <Medal className="h-4 w-4" style={{ color:'var(--accent-quiet)' }} /> :
                     <span className="text-xs" style={{ color:'var(--ink-40)' }}>{e.rank}</span>}
                  </td>
                  <td className="p-3 font-medium" style={{ color:'var(--ink-80)' }}>{e.username}</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] tracking-wider" style={{ background:'var(--accent)', color:'var(--page)' }}>
                      {Math.round(e.weight).toLocaleString()} kg
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="font-[var(--mono)] text-sm py-12 text-center" style={{ color:'var(--ink-40)' }}>No lifts logged yet</p>}
    </div>
  )
}
