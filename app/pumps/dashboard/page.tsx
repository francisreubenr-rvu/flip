'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Dumbbell, TrendingUp, CalendarDays, Plus, ArrowRight } from 'lucide-react'

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>Hey, {profile?.username || user?.email?.split('@')[0]}</h1>
          <p className="font-[var(--mono)] text-xs tracking-wider mt-1" style={{ color: 'var(--ink-40)' }}>YOUR GYM OVERVIEW</p>
        </div>
        <Link href="/pumps/workouts/new" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80" style={{ background: 'var(--accent)', color: 'var(--page)' }}>
          <Plus className="h-4 w-4" /> Start Workout
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Workouts', value: workoutCount, icon: Dumbbell, color: 'var(--accent)' },
          { label: 'Volume', value: `${volume.toLocaleString()} kg`, icon: TrendingUp, color: 'var(--work-color)' },
          { label: 'Live Comps', value: activeComps.length, icon: CalendarDays, color: 'var(--ink-60)' },
        ].map((stat) => (
          <div key={stat.label} className="border rounded p-4" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
              <span className="font-[var(--mono)] text-[10px] tracking-wider uppercase" style={{ color: 'var(--ink-40)' }}>{stat.label}</span>
            </div>
            <p className="font-[var(--mono)] text-2xl font-medium" style={{ color: 'var(--ink-80)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--grid-minor)' }}>
            <h2 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Recent Workouts</h2>
            <Link href="/pumps/workouts" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="p-4">
            {recentWorkouts.length > 0 ? recentWorkouts.map((w: any) => (
              <Link key={w.id} href={`/pumps/workouts/${w.id}`} className="flex items-center justify-between py-2 border-b last:border-0 transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)' }}>
                <div>
                  <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{w.name}</p>
                  <p className="font-[var(--mono)] text-[10px] tracking-wider mt-0.5" style={{ color: 'var(--ink-40)' }}>{new Date(w.started_at).toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{ background: w.completed_at ? 'var(--rest-color)' : 'var(--ink-40)', color: 'var(--page)' }}>
                  {w.completed_at ? 'Done' : 'Active'}
                </span>
              </Link>
            )) : (
              <p className="text-sm font-[var(--mono)] py-8 text-center" style={{ color: 'var(--ink-40)' }}>No workouts yet. <Link href="/pumps/workouts/new" className="underline" style={{ color: 'var(--accent)' }}>Start one</Link></p>
            )}
          </div>
        </div>

        <div className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--grid-minor)' }}>
            <h2 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Active Competitions</h2>
            <Link href="/pumps/competitions" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>View all <ArrowRight className="inline h-3 w-3" /></Link>
          </div>
          <div className="p-4">
            {activeComps.length > 0 ? activeComps.map((c: any) => (
              <Link key={c.id} href={`/pumps/competitions/${c.id}`} className="flex items-center justify-between py-2 border-b last:border-0 transition-colors hover:opacity-70" style={{ borderColor: 'var(--grid-minor)' }}>
                <div>
                  <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{c.name}</p>
                  <p className="font-[var(--mono)] text-[10px] tracking-wider mt-0.5" style={{ color: 'var(--ink-40)' }}>{c.exercises?.name} — {c.type.replace('_', ' ')}</p>
                </div>
                <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{ background: 'var(--work-color)', color: 'var(--page)' }}>LIVE</span>
              </Link>
            )) : (
              <div className="text-center py-8">
                <p className="text-sm font-[var(--mono)]" style={{ color: 'var(--ink-40)' }}>No active competitions</p>
                <Link href="/pumps/competitions/new" className="text-xs mt-2 inline-block underline" style={{ color: 'var(--accent)' }}>Create one</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
