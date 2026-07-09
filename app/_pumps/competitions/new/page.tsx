'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Swords } from 'lucide-react'

export default function NewCompetitionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [exercises, setExercises] = useState<any[]>([])
  const [name, setName] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [type, setType] = useState('max_weight')

  useEffect(() => { supabase.from('exercises').select('*').order('name').then(({ data }) => setExercises(data ?? [])) }, [])

  async function create() {
    if (!user || !name || !exerciseId) return
    const { data: c } = await supabase.from('competitions').insert({
      name, exercise_id: exerciseId, type, status: 'waiting', created_by: user.id,
    }).select().single()
    if (c) {
      await supabase.from('competition_participants').insert({ competition_id: c.id, user_id: user.id })
      router.push(`/pumps/competitions/${c.id}`)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>New Competition</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-6" style={{ color: 'var(--ink-40)' }}>CHALLENGE FRIENDS</p>

      <div className="border rounded p-4 space-y-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
        <div>
          <label className="block font-[var(--mono)] text-[10px] tracking-wider mb-1" style={{ color: 'var(--ink-40)' }}>NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bench Press Showdown"
            className="w-full px-3 py-2 text-sm font-[var(--mono)] border rounded outline-none"
            style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }} />
        </div>
        <div>
          <label className="block font-[var(--mono)] text-[10px] tracking-wider mb-1" style={{ color: 'var(--ink-40)' }}>EXERCISE</label>
          <select value={exerciseId} onChange={e => setExerciseId(e.target.value)}
            className="w-full px-3 py-2 text-sm font-[var(--mono)] border rounded outline-none"
            style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }}>
            <option value="">Select exercise</option>
            {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-[var(--mono)] text-[10px] tracking-wider mb-1" style={{ color: 'var(--ink-40)' }}>TYPE</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm font-[var(--mono)] border rounded outline-none"
            style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }}>
            <option value="max_weight">Max Weight</option>
            <option value="max_reps">Max Reps</option>
            <option value="total_volume">Total Volume</option>
          </select>
        </div>
        <button onClick={create} disabled={!name || !exerciseId}
          className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'var(--page)' }}>
          <Swords className="h-4 w-4" /> Create Competition
        </button>
      </div>
    </div>
  )
}
