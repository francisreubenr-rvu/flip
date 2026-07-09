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
  const [error, setError] = useState('')

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
    if (!user || saving) return
    setSaving(true); setError('')

    // 1. Create the workout.
    const { data: w, error: wErr } = await supabase.from('workouts').insert({
      user_id: user.id, name: workoutName || 'Workout',
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).select().single()
    if (wErr || !w) {
      setSaving(false)
      setError(wErr?.message ?? 'Could not create workout. Try again.')
      return
    }

    // 2. Batch-insert this workout's exercises (one round-trip, not N).
    const weRows = selected.map((eid, idx) => ({ workout_id: w.id, exercise_id: eid, sort_order: idx }))
    const { data: wes, error: weErr } = weRows.length
      ? await supabase.from('workout_exercises').insert(weRows).select()
      : { data: [], error: null }
    if (weErr || !wes) {
      await supabase.from('workouts').delete().eq('id', w.id) // roll back the orphan
      setSaving(false)
      setError(weErr?.message ?? 'Could not save exercises. Try again.')
      return
    }

    // 3. Batch-insert every set across all exercises (one round-trip).
    const idByExercise = new Map<string, string>((wes as { id: string; exercise_id: string }[]).map((we) => [we.exercise_id, we.id]))
    const setRows = selected.flatMap((eid) =>
      (sets[eid] || []).map((s, i) => ({
        workout_exercise_id: idByExercise.get(eid),
        set_number: i + 1, reps: s.reps, weight_kg: s.weight, completed: s.completed,
      })),
    )
    if (setRows.length) {
      const { error: sErr } = await supabase.from('exercise_sets').insert(setRows)
      if (sErr) {
        await supabase.from('workouts').delete().eq('id', w.id) // cascades to exercises + sets
        setSaving(false)
        setError(sErr.message)
        return
      }
    }

    router.push(`/pumps/workouts/${w.id}`)
  }

  const cats = [...new Set(exercises.map(e => e.category))]

  return (
    <div>
      <h1 className="font-[var(--serif)] italic mb-1" style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'var(--ink-100)', lineHeight: 1.1 }}>New Workout</h1>
      <p className="font-[var(--mono)] mb-8" style={{ fontSize: '0.6875rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-40)' }}>log your sets</p>

      <input value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="Workout name"
        className="font-[var(--mono)] border w-full max-w-sm mb-8 outline-none"
        style={{ borderColor: 'var(--grid-major)', background: 'transparent', color: 'var(--ink-80)', padding: '10px 14px', fontSize: '0.875rem' }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {selected.map(eid => {
            const ex = exercises.find(e => e.id === eid)
            const ess = sets[eid] || []
            return (
              <div key={eid} className="border" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--grid-minor)' }}>
                  <span className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-80)' }}>{ex?.name}</span>
                  <button onClick={() => removeEx(eid)} className="flex items-center justify-center w-8 h-8 hover:opacity-60 transition-opacity" style={{ color: 'var(--accent)' }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-1">
                  {/* Column headers */}
                  {ess.length > 0 && (
                    <div className="grid items-center mb-3" style={{ gridTemplateColumns: '2rem 1fr 1fr 2rem 2rem', gap: '12px' }}>
                      {['set', 'kg', 'reps', '', ''].map((h, i) => (
                        <span key={i} className="font-[var(--mono)]" style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-40)' }}>{h}</span>
                      ))}
                    </div>
                  )}
                  {ess.map((s, i) => (
                    <div key={i} className="grid items-center" style={{ gridTemplateColumns: '2rem 1fr 1fr 2rem 2rem', gap: '12px' }}>
                      <span className="font-[var(--mono)] text-center" style={{ fontSize: '0.75rem', color: 'var(--ink-40)' }}>{i + 1}</span>
                      <input type="number" placeholder="0" value={s.weight || ''} onChange={e => updateSet(eid, i, 'weight', Number(e.target.value))}
                        className="font-[var(--mono)] border outline-none w-full"
                        style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)', color: 'var(--ink-80)', padding: '8px 10px', fontSize: '0.875rem' }} />
                      <input type="number" placeholder="0" value={s.reps || ''} onChange={e => updateSet(eid, i, 'reps', Number(e.target.value))}
                        className="font-[var(--mono)] border outline-none w-full"
                        style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)', color: 'var(--ink-80)', padding: '8px 10px', fontSize: '0.875rem' }} />
                      <button onClick={() => toggleSet(eid, i)} className="flex items-center justify-center w-8 h-8 transition-opacity hover:opacity-70" style={{ color: s.completed ? 'var(--accent)' : 'var(--ink-25)' }}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeSet(eid, i)} className="flex items-center justify-center w-8 h-8 transition-opacity hover:opacity-60" style={{ color: 'var(--ink-25)' }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSet(eid)} className="w-full border-dashed border font-[var(--mono)] transition-opacity hover:opacity-70 mt-3"
                    style={{ borderColor: 'var(--grid-major)', color: 'var(--ink-40)', padding: '10px', fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                    <Plus className="inline h-3 w-3 mr-1" /> Add Set
                  </button>
                </div>
              </div>
            )
          })}
          {error && (
            <p className="font-[var(--mono)]" style={{ color: 'var(--danger, var(--accent))', fontSize: '0.75rem', letterSpacing: '0.04em' }}>
              {error}
            </p>
          )}
          {selected.length > 0 && (
            <button onClick={save} disabled={saving}
              className="w-full flex items-center justify-center gap-2 font-[var(--mono)] transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'var(--page)', padding: '14px', fontSize: '0.8125rem', letterSpacing: '0.06em', opacity: saving ? 0.6 : 1 }}>
              <Save className="h-4 w-4" /> {saving ? 'saving…' : 'Complete Workout'}
            </button>
          )}
        </div>

        {/* Exercise picker */}
        <div className="border h-fit" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', position: 'sticky', top: '80px' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--grid-minor)' }}>
            <h3 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Add Exercises</h3>
          </div>
          <div className="px-4 py-4">
            {cats.map(cat => (
              <div key={cat} className="mb-4">
                <p className="font-[var(--mono)] mb-2" style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-40)' }}>{cat}</p>
                {exercises.filter(e => e.category === cat).map(ex => {
                  const added = selected.includes(ex.id)
                  return (
                    <button key={ex.id} onClick={() => addEx(ex.id)} disabled={added}
                      className="w-full text-left font-[var(--mono)] transition-opacity mb-1"
                      style={{ color: added ? 'var(--ink-40)' : 'var(--ink-80)', padding: '8px 10px', fontSize: '0.8125rem', opacity: added ? 0.5 : 1, background: 'transparent' }}>
                      {added ? '✓' : '+'} {ex.name}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
