'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabase'
import { Plus } from 'lucide-react'

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<any[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  async function load() {
    const { data } = await supabase.from('exercises').select('*').order('category')
    setExercises(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!name || !category) return
    await supabase.from('exercises').insert({ name, category })
    setName(''); setCategory(''); load()
  }

  const cats = [...new Set(exercises.map(e => e.category))]

  return (
    <div>
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>Exercise Library</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-6" style={{ color: 'var(--ink-40)' }}>BROWSE & CREATE</p>

      <div className="flex gap-2 mb-8 items-end">
        <div>
          <label className="block font-[var(--mono)] text-[10px] tracking-wider mb-1" style={{ color: 'var(--ink-40)' }}>NAME</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bulgarian Split Squat"
            className="px-3 py-2 text-sm font-[var(--mono)] border rounded w-56 outline-none"
            style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }} />
        </div>
        <div>
          <label className="block font-[var(--mono)] text-[10px] tracking-wider mb-1" style={{ color: 'var(--ink-40)' }}>CATEGORY</label>
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. legs"
            className="px-3 py-2 text-sm font-[var(--mono)] border rounded w-36 outline-none"
            style={{ borderColor: 'var(--grid-major)', background: 'var(--page)', color: 'var(--ink-80)' }} />
        </div>
        <button onClick={add} className="flex items-center gap-1 px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80" style={{ background: 'var(--accent)', color: 'var(--page)' }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {cats.map(cat => (
        <div key={cat} className="mb-6">
          <h2 className="font-[var(--serif)] italic text-lg capitalize mb-2" style={{ color: 'var(--ink-80)' }}>{cat}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {exercises.filter(e => e.category === cat).map(ex => (
              <div key={ex.id} className="border rounded p-3 transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)' }}>
                <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{ex.name}</p>
                <p className="font-[var(--mono)] text-[10px] tracking-wider mt-0.5 capitalize" style={{ color: 'var(--ink-40)' }}>{ex.category}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {exercises.length === 0 && <p className="font-[var(--mono)] text-sm py-12 text-center" style={{ color: 'var(--ink-40)' }}>No exercises yet.</p>}
    </div>
  )
}
