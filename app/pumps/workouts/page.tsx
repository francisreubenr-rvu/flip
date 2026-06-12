'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Plus } from 'lucide-react'

export default function WorkoutsPage() {
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    supabase.from('workouts').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).then(({ data }) => setWorkouts(data ?? []))
  }, [user])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>Workouts</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>YOUR LOG</p>
        </div>
        <Link href="/pumps/workouts/new" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80" style={{ background: 'var(--accent)', color: 'var(--page)' }}>
          <Plus className="h-4 w-4" /> New
        </Link>
      </div>

      {workouts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {workouts.map((w: any) => (
            <Link key={w.id} href={`/pumps/workouts/${w.id}`} className="border rounded p-4 transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)', background: 'var(--page)' }}>
              <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{w.name}</p>
              <p className="font-[var(--mono)] text-[10px] tracking-wider mt-1" style={{ color: 'var(--ink-40)' }}>{new Date(w.started_at).toLocaleDateString()}</p>
              <span className="inline-block mt-2 text-[9px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{ background: w.completed_at ? 'var(--rest-color)' : 'var(--ink-40)', color: 'var(--page)' }}>
                {w.completed_at ? 'Done' : 'Active'}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-40)' }}>No workouts logged yet</p>
          <Link href="/pumps/workouts/new" className="inline-block mt-3 px-4 py-2 rounded text-sm font-[var(--mono)]" style={{ background: 'var(--accent)', color: 'var(--page)' }}>Log Your First Workout</Link>
        </div>
      )}
    </div>
  )
}
