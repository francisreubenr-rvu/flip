'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { CalendarDays, Dumbbell, TrendingUp } from 'lucide-react'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<any>(null)
  const [workoutCount, setWorkoutCount] = useState(0)
  const [volume, setVolume] = useState(0)
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    if (!username) return
    supabase.from('profiles').select('*').eq('username', username).single().then(({ data }) => {
      if (!data) return; setProfile(data)
      supabase.from('workouts').select('*', { count:'exact', head:true }).eq('user_id', data.id).then(({ count }) => setWorkoutCount(count??0))
      supabase.from('exercise_sets').select('reps, weight_kg, workout_exercises!inner(workout_id, workouts!inner(user_id))').eq('workout_exercises.workouts.user_id', data.id).eq('completed', true).then(({ data: sets }) => {
        setVolume((sets??[]).reduce((s:number,r:any) => s + r.reps*(r.weight_kg??0), 0))
      })
      supabase.from('workouts').select('*').eq('user_id', data.id).order('started_at', { ascending:false }).limit(5).then(({ data }) => setRecent(data??[]))
    })
  }, [username])

  if (!profile) return <div className="font-[var(--mono)] text-sm py-12 text-center" style={{ color:'var(--ink-40)' }}>Profile not found</div>

  return (
    <div>
      <div className="border rounded p-6 mb-6 flex items-center gap-4" style={{ borderColor:'var(--grid-major)', background:'var(--page)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-[var(--mono)]" style={{ background:'var(--accent)', color:'var(--page)' }}>
          {profile.username?.slice(0,2).toUpperCase()}
        </div>
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color:'var(--ink-100)' }}>{profile.username}</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color:'var(--ink-40)' }}>Joined {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'Workouts', value:workoutCount, icon:Dumbbell },
          { label:'Volume', value:`${volume.toLocaleString()} kg`, icon:TrendingUp },
          { label:'Since', value:new Date(profile.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}), icon:CalendarDays },
        ].map(s => (
          <div key={s.label} className="border rounded p-4" style={{ borderColor:'var(--grid-major)', background:'var(--page)' }}>
            <div className="flex items-center gap-1 mb-1"><s.icon className="h-3 w-3" style={{ color:'var(--accent)' }} /><span className="font-[var(--mono)] text-[9px] tracking-wider uppercase" style={{ color:'var(--ink-40)' }}>{s.label}</span></div>
            <p className="font-[var(--mono)] text-lg" style={{ color:'var(--ink-80)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="border rounded" style={{ borderColor:'var(--grid-major)', background:'var(--page)' }}>
        <h3 className="font-[var(--serif)] italic text-lg p-3 border-b" style={{ borderColor:'var(--grid-minor)', color:'var(--ink-100)' }}>Recent Workouts</h3>
        <div className="p-3">
          {recent.length>0 ? recent.map(w => (
            <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor:'var(--grid-minor)' }}>
              <div>
                <p className="font-[var(--mono)] text-sm" style={{ color:'var(--ink-80)' }}>{w.name}</p>
                <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color:'var(--ink-40)' }}>{new Date(w.started_at).toLocaleDateString()}</p>
              </div>
              <span className="text-[9px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{ background:w.completed_at?'var(--rest-color)':'var(--ink-40)', color:'var(--page)' }}>{w.completed_at?'Done':'Active'}</span>
            </div>
          )) : <p className="font-[var(--mono)] text-sm py-8 text-center" style={{ color:'var(--ink-40)' }}>No workouts yet</p>}
        </div>
      </div>
    </div>
  )
}
