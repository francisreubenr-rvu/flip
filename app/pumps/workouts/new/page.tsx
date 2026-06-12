'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Plus, Check, Trash2, Save } from 'lucide-react'

export default function NewWorkoutPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [exercises, setExercises] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [sets, setSets] = useState<Record<string, { reps: number; weight: number; completed: boolean }[]>>({})
  const [workoutName, setWorkoutName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('exercises').select('*').order('category').then(({ data }) => setExercises(data ?? []))
  }, [])

  function addEx(id: string) {
    if (selected.includes(id)) return
    setSelected([...selected, id])
    setSets({ ...sets, [id]: [] })
  }
  function removeEx(id: string) {
    setSelected(selected.filter(x => x !== id))
    const ns = { ...sets }; delete ns[id]; setSets(ns)
  }
  function addSet(eid: string) {
    const cur = sets[eid] || []
    setSets({ ...sets, [eid]: [...cur, { reps: 0, weight: 0, completed: false }] })
  }
  function updateSet(eid: string, i: number, f: 'reps'|'weight', v: number) {
    const cur = [...(sets[eid] || [])]
    cur[i] = { ...cur[i], [f]: v }
    setSets({ ...sets, [eid]: cur })
  }
  function toggleSet(eid: string, i: number) {
    const cur = [...(sets[eid] || [])]
    cur[i] = { ...cur[i], completed: !cur[i].completed }
    setSets({ ...sets, [eid]: cur })
  }
  function removeSet(eid: string, i: number) {
    const cur = [...(sets[eid] || [])]; cur.splice(i, 1)
    setSets({ ...sets, [eid]: cur })
  }

  async function save() {
    if (!user) return; setSaving(true)
    const { data: w } = await supabase.from('workouts').insert({
      user_id: user.id, name: workoutName || 'Workout',
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).select().single()
    if (!w) { setSaving(false); return }

    for (const [idx, eid] of selected.entries()) {
      const { data: we } = await supabase.from('workout_exercises').insert({
        workout_id: w.id, exercise_id: eid, sort_order: idx,
      }).select().single()
      if (!we) continue

      const es = sets[eid] || []
      await supabase.from('exercise_sets').insert(es.map((s, i) => ({
        workout_exercise_id: we.id, set_number: i + 1,
        reps: s.reps, weight_kg: s.weight, completed: s.completed,
      })))
    }
    setSaving(false)
    router.push(`/pumps/workouts/${w.id}`)
  }

  const cats = [...new Set(exercises.map(e => e.category))]

  return (
    <div>
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>New Workout</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-4" style={{ color: 'var(--ink-40)' }}>LOG YOUR SETS</p>

      <input value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="Workout name"
        className="px-3 py-2 text-sm font-[var(--mono)] border rounded w-full max-w-xs mb-6 outline-none"
        style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {selected.map(eid => {
            const ex = exercises.find(e => e.id === eid)
            const ess = sets[eid] || []
            return (
              <div key={eid} className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
                <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--grid-minor)' }}>
                  <span className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{ex?.name}</span>
                  <button onClick={() => removeEx(eid)} className="hover:opacity-60" style={{ color: 'var(--accent)' }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="p-3 space-y-2">
                  {ess.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-[var(--mono)] text-xs w-6 text-center" style={{ color: 'var(--ink-40)' }}>{i + 1}</span>
                      <input type="number" placeholder="kg" value={s.weight || ''} onChange={e => updateSet(eid, i, 'weight', Number(e.target.value))}
                        className="w-20 px-2 py-1 text-sm font-[var(--mono)] border rounded outline-none"
                        style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)', color: 'var(--ink-80)' }} />
                      <span className="font-[var(--mono)] text-[10px]" style={{ color: 'var(--ink-40)' }}>kg</span>
                      <input type="number" placeholder="reps" value={s.reps || ''} onChange={e => updateSet(eid, i, 'reps', Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm font-[var(--mono)] border rounded outline-none"
                        style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)', color: 'var(--ink-80)' }} />
                      <button onClick={() => toggleSet(eid, i)} style={{ color: s.completed ? 'var(--rest-color)' : 'var(--ink-25)' }}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeSet(eid, i)} style={{ color: 'var(--ink-25)' }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSet(eid)} className="w-full py-1.5 border border-dashed rounded text-xs font-[var(--mono)] transition-colors hover:opacity-70"
                    style={{ borderColor: 'var(--grid-major)', color: 'var(--ink-40)' }}>
                    <Plus className="inline h-3 w-3 mr-1" /> Add Set
                  </button>
                </div>
              </div>
            )
          })}
          {selected.length > 0 && (
            <button onClick={save} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'var(--page)' }}>
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Complete Workout'}
            </button>
          )}
        </div>

        <div className="border rounded p-4 h-fit" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <h3 className="font-[var(--serif)] italic text-lg mb-3" style={{ color: 'var(--ink-100)' }}>Add Exercises</h3>
          {cats.map(cat => (
            <div key={cat} className="mb-3">
              <p className="font-[var(--mono)] text-[9px] tracking-widest uppercase mb-1" style={{ color: 'var(--ink-40)' }}>{cat}</p>
              {exercises.filter(e => e.category === cat).map(ex => {
                const added = selected.includes(ex.id)
                return (
                  <button key={ex.id} onClick={() => addEx(ex.id)} disabled={added}
                    className="w-full text-left px-3 py-1.5 text-sm font-[var(--mono)] rounded transition-colors mb-0.5"
                    style={{ color: added ? 'var(--ink-40)' : 'var(--ink-80)', background: added ? 'var(--page-buff)' : 'transparent' }}>
                    <Plus className="inline h-3 w-3 mr-1" /> {ex.name}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
