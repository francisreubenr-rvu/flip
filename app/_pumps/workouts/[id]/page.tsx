'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [workout, setWorkout] = useState<any>(null)
  const [exercises, setExercises] = useState<any[]>([])

  useEffect(() => {
    if (!user || !id) return
    supabase.from('workouts').select('*').eq('id', id).single().then(({ data }) => {
      if (!data || data.user_id !== user.id) { router.push('/pumps/workouts'); return }
      setWorkout(data)
    })
    supabase.from('workout_exercises').select('*, exercises(name, category)').eq('workout_id', id).order('sort_order').then(async ({ data }) => {
      if (!data) return
      const withSets = await Promise.all(data.map(async (we: any) => {
        const { data: sets } = await supabase.from('exercise_sets').select('*').eq('workout_exercise_id', we.id).order('set_number')
        return { ...we, sets: sets || [] }
      }))
      setExercises(withSets)
    })
  }, [user, id])

  if (!workout) return <div className="font-[var(--mono)] text-sm py-12 text-center" style={{ color: 'var(--ink-40)' }}>…</div>

  const totalVolume = exercises.reduce((sum, we) => sum + we.sets.reduce((s: number, set: any) => s + (set.reps * (set.weight_kg ?? 0)), 0), 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pumps/workouts" className="hover:opacity-70" style={{ color: 'var(--ink-40)' }}><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>{workout.name}</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>
            {new Date(workout.started_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', hour:'numeric', minute:'2-digit' })}
          </p>
        </div>
        <span className="ml-auto text-[10px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{ background: workout.completed_at ? 'var(--rest-color)' : 'var(--ink-40)', color: 'var(--page)' }}>
          {workout.completed_at ? 'Completed' : 'Active'}
        </span>
      </div>

      <div className="border rounded p-4 mb-6" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
        <span className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>TOTAL VOLUME</span>
        <p className="font-[var(--mono)] text-xl font-medium" style={{ color: 'var(--ink-80)' }}>{totalVolume.toLocaleString()} kg</p>
      </div>

      {exercises.map(we => (
        <div key={we.id} className="border rounded mb-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="p-3 border-b" style={{ borderColor: 'var(--grid-minor)' }}>
            <span className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>
              {we.exercises?.name}
              <span className="ml-2 text-[9px] tracking-wider uppercase" style={{ color: 'var(--ink-40)' }}>{we.exercises?.category}</span>
            </span>
          </div>
          <div className="p-3">
            <table className="w-full font-[var(--mono)] text-sm">
              <thead>
                <tr style={{ color: 'var(--ink-40)' }}>
                  <th className="text-left pb-2 font-medium text-[10px] tracking-wider">SET</th>
                  <th className="text-left pb-2 font-medium text-[10px] tracking-wider">WEIGHT</th>
                  <th className="text-left pb-2 font-medium text-[10px] tracking-wider">REPS</th>
                  <th className="text-left pb-2 font-medium text-[10px] tracking-wider">VOLUME</th>
                </tr>
              </thead>
              <tbody>
                {we.sets.map((s: any) => (
                  <tr key={s.id} className="border-t" style={{ borderColor: 'var(--grid-minor)' }}>
                    <td className="py-2" style={{ color: 'var(--ink-40)' }}>{s.set_number}</td>
                    <td className="py-2" style={{ color: 'var(--ink-80)' }}>{s.weight_kg ?? 0} kg</td>
                    <td className="py-2" style={{ color: 'var(--ink-80)' }}>{s.reps}</td>
                    <td className="py-2" style={{ color: 'var(--accent)' }}>{(s.reps * (s.weight_kg ?? 0)).toLocaleString()} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
