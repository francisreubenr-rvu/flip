'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Plus, ArrowRight } from 'lucide-react'

export default function PumpsDashboard() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [workoutCount, setWorkoutCount] = useState(0)
  const [volume, setVolume] = useState(0)
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([])
  const [activeComps, setActiveComps] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
    supabase.from('workouts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setWorkoutCount(count ?? 0))
    supabase.from('exercise_sets')
      .select('reps, weight_kg, workout_exercises!inner(workout_id, workouts!inner(user_id))')
      .eq('workout_exercises.workouts.user_id', user.id)
      .eq('completed', true)
      .then(({ data }) => {
        setVolume(data?.reduce((s: number, r: any) => s + (r.reps * (r.weight_kg ?? 0)), 0) ?? 0)
      })
    supabase.from('workouts').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(5).then(({ data }) => setRecentWorkouts(data ?? []))
    supabase.from('competitions').select('*, exercises(name)').eq('status', 'active').limit(5).then(({ data }) => setActiveComps(data ?? []))
  }, [user])

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="font-[var(--serif)] italic" style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'var(--ink-100)', lineHeight: 1.1 }}>
            {profile?.username || user?.email?.split('@')[0]}
          </h1>
          <p className="font-[var(--mono)] mt-2" style={{ fontSize: '0.6875rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-40)' }}>
            gym overview
          </p>
        </div>
        <Link
          href="/pumps/workouts/new"
          className="flex items-center gap-2 font-[var(--mono)] transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'var(--page)', padding: '10px 18px', borderRadius: 3, fontSize: '0.75rem', letterSpacing: '0.06em' }}
        >
          <Plus className="h-3.5 w-3.5" /> Start Workout
        </Link>
      </div>

      {/* Stats — serif numbers as data heroes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        {[
          { label: 'workouts', value: workoutCount },
          { label: 'kg lifted', value: volume.toLocaleString() },
          { label: 'live comps', value: activeComps.length },
        ].map((stat) => (
          <div key={stat.label} className="border" style={{ borderColor: 'var(--grid-major)', padding: '20px 22px', background: 'var(--page)' }}>
            <p className="font-[var(--mono)]" style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-40)', marginBottom: 8 }}>
              {stat.label}
            </p>
            <p className="font-[var(--serif)] italic" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', color: 'var(--ink-100)', lineHeight: 1 }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        <div className="border" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--grid-minor)' }}>
            <h2 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Recent Workouts</h2>
            <Link href="/pumps/workouts" className="font-[var(--mono)] hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
              all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 py-2">
            {recentWorkouts.length > 0 ? recentWorkouts.map((w: any) => (
              <Link key={w.id} href={`/pumps/workouts/${w.id}`} className="flex items-center justify-between border-b last:border-0 transition-opacity hover:opacity-60" style={{ borderColor: 'var(--grid-minor)', padding: '13px 0' }}>
                <div>
                  <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{w.name}</p>
                  <p className="font-[var(--mono)] mt-1" style={{ fontSize: '0.6875rem', color: 'var(--ink-40)', letterSpacing: '0.05em' }}>
                    {new Date(w.started_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="font-[var(--mono)]" style={{ fontSize: '0.6875rem', letterSpacing: '0.08em', color: w.completed_at ? 'var(--ink-60)' : 'var(--accent)' }}>
                  [ {w.completed_at ? 'done' : 'active'} ]
                </span>
              </Link>
            )) : (
              <p className="font-[var(--mono)] text-sm py-10 text-center" style={{ color: 'var(--ink-40)' }}>
                No workouts yet. <Link href="/pumps/workouts/new" className="underline" style={{ color: 'var(--accent)' }}>Start one</Link>
              </p>
            )}
          </div>
        </div>

        <div className="border" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--grid-minor)' }}>
            <h2 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Active Competitions</h2>
            <Link href="/pumps/competitions" className="font-[var(--mono)] hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
              all <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
          <div className="px-5 py-2">
            {activeComps.length > 0 ? activeComps.map((c: any) => (
              <Link key={c.id} href={`/pumps/competitions/${c.id}`} className="flex items-center justify-between border-b last:border-0 transition-opacity hover:opacity-60" style={{ borderColor: 'var(--grid-minor)', padding: '13px 0' }}>
                <div>
                  <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{c.name}</p>
                  <p className="font-[var(--mono)] mt-1" style={{ fontSize: '0.6875rem', color: 'var(--ink-40)', letterSpacing: '0.05em' }}>
                    {c.exercises?.name} — {c.type.replace('_', ' ')}
                  </p>
                </div>
                <span className="font-[var(--mono)]" style={{ fontSize: '0.6875rem', letterSpacing: '0.08em', color: 'var(--accent)' }}>
                  [ live ]
                </span>
              </Link>
            )) : (
              <div className="text-center py-10">
                <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-40)' }}>No active competitions</p>
                <Link href="/pumps/competitions/new" className="font-[var(--mono)] mt-3 inline-block underline" style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>Create one</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
