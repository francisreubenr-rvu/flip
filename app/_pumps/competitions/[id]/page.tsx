'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Swords, Play, Square, Timer, UserPlus } from 'lucide-react'

export default function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [comp, setComp] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [weight, setWeight] = useState(60)
  const [reps, setReps] = useState(10)
  const [isParticipant, setIsParticipant] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const load = useCallback(async () => {
    if (!id || !user) return
    const { data: c } = await supabase.from('competitions').select('*, exercises(name)').eq('id', id).single()
    if (!c) return; setComp(c)
    const { data: p } = await supabase.from('competition_participants').select('user_id, profiles!inner(username)').eq('competition_id', id)
    setParticipants((p ?? []).map((pp: any) => ({ user_id: pp.user_id, username: pp.profiles?.username ?? 'Unknown' })))
    setIsParticipant(p?.some((pp: any) => pp.user_id === user.id) ?? false)
    const { data: l } = await supabase.from('competition_logs').select('*').eq('competition_id', id).order('logged_at', { ascending: true })
    setLogs(l ?? [])
  }, [id, user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!id) return
    const ch = supabase.channel(`comp:${id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'competition_logs', filter:`competition_id=eq.${id}` },
        (p: any) => setLogs(prev => [...prev, p.new]))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'competitions', filter:`id=eq.${id}` },
        (p: any) => setComp((prev: any) => prev ? { ...prev, status: p.new.status } : prev))
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'competition_participants', filter:`competition_id=eq.${id}` },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  useEffect(() => {
    if (comp?.status !== 'active') return
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [comp?.status])

  async function start() {
    await supabase.from('competitions').update({ status:'active', starts_at: new Date().toISOString() }).eq('id', id)
  }
  async function end() {
    await supabase.from('competitions').update({ status:'completed', ends_at: new Date().toISOString() }).eq('id', id)
  }
  async function join() {
    if (!user) return
    await supabase.from('competition_participants').insert({ competition_id: id, user_id: user.id })
    setIsParticipant(true); load()
  }
  async function logSet() {
    if (!user || !isParticipant) return
    await supabase.from('competition_logs').insert({
      competition_id: id, user_id: user.id,
      set_number: logs.filter(l => l.user_id === user.id).length + 1, reps, weight_kg: weight,
    })
  }

  function stats(uid: string) {
    const ul = logs.filter(l => l.user_id === uid)
    if (!comp) return ''
    if (comp.type === 'max_weight') return `${Math.max(...ul.map((l: any) => Number(l.weight_kg ?? 0)), 0)} kg`
    if (comp.type === 'max_reps') return `${Math.max(...ul.map((l: any) => l.reps), 0)} reps`
    return `${ul.reduce((s: number, l: any) => s + l.reps * Number(l.weight_kg ?? 0), 0)} kg`
  }

  const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const isCreator = comp?.created_by === user?.id

  if (!comp) return <div className="font-[var(--mono)] text-sm py-12 text-center" style={{ color: 'var(--ink-40)' }}>…</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pumps/competitions" className="hover:opacity-70" style={{ color: 'var(--ink-40)' }}><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>{comp.name}</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>
            {comp.exercises?.name} — {comp.type.replace('_',' ')}
          </p>
        </div>
        <span className="ml-auto text-[10px] tracking-wider px-2 py-0.5 rounded-full font-[var(--mono)]" style={{
          background: comp.status==='active'?'var(--work-color)':comp.status==='completed'?'var(--ink-40)':'var(--accent-gold)', color:'var(--page)'
        }}>{comp.status}</span>
      </div>

      {comp.status === 'active' && (
        <div className="border rounded p-4 mb-6 text-center" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <Timer className="inline h-4 w-4 mr-2" style={{ color:'var(--accent)' }} />
          <span className="font-[var(--mono)] text-2xl" style={{ color: 'var(--ink-80)' }}>{fmt(elapsed)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--grid-minor)' }}>
              <h3 className="font-[var(--serif)] italic text-lg" style={{ color: 'var(--ink-100)' }}>Participants</h3>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {participants.map(p => (
                <div key={p.user_id} className="flex items-center justify-between border rounded p-2" style={{ borderColor: 'var(--grid-minor)', background: 'var(--page-cream)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-[var(--mono)]" style={{ background: 'var(--accent)', color:'var(--page)' }}>
                      {p.username?.slice(0,2).toUpperCase()}
                    </div>
                    <span className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{p.username}</span>
                  </div>
                  <span className="text-[10px] tracking-wider px-1.5 py-0.5 rounded-full font-[var(--mono)]" style={{ background:'var(--accent)', color:'var(--page)' }}>{stats(p.user_id)}</span>
                </div>
              ))}
            </div>
          </div>

          {isParticipant && comp.status === 'active' && (
            <div className="border rounded p-4 flex items-end gap-3" style={{ borderColor: 'var(--accent)', background: 'var(--page)' }}>
              <div className="flex-1">
                <label className="block font-[var(--mono)] text-[9px] tracking-wider mb-0.5" style={{ color:'var(--ink-40)' }}>WEIGHT (KG)</label>
                <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm font-[var(--mono)] border rounded outline-none"
                  style={{ borderColor:'var(--grid-major)', background:'var(--page)', color:'var(--ink-80)' }} />
              </div>
              <div className="flex-1">
                <label className="block font-[var(--mono)] text-[9px] tracking-wider mb-0.5" style={{ color:'var(--ink-40)' }}>REPS</label>
                <input type="number" value={reps} onChange={e => setReps(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm font-[var(--mono)] border rounded outline-none"
                  style={{ borderColor:'var(--grid-major)', background:'var(--page)', color:'var(--ink-80)' }} />
              </div>
              <button onClick={logSet} className="px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80" style={{ background:'var(--accent)', color:'var(--page)' }}>Log Set</button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isCreator && comp.status === 'waiting' && (
            <button onClick={start} disabled={participants.length < 1}
              className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-[var(--mono)]" style={{ background:'var(--rest-color)', color:'var(--page)' }}>
              <Play className="h-4 w-4" /> Start
            </button>
          )}
          {isCreator && comp.status === 'active' && (
            <button onClick={end}
              className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-[var(--mono)]" style={{ background:'var(--accent)', color:'var(--page)' }}>
              <Square className="h-4 w-4" /> End
            </button>
          )}
          {!isParticipant && comp.status !== 'completed' && (
            <button onClick={join}
              className="w-full flex items-center justify-center gap-2 py-3 rounded text-sm font-[var(--mono)]" style={{ background:'var(--accent)', color:'var(--page)' }}>
              <UserPlus className="h-4 w-4" /> Join
            </button>
          )}

          <div className="border rounded" style={{ borderColor:'var(--grid-major)', background:'var(--page)' }}>
            <div className="p-3 border-b" style={{ borderColor:'var(--grid-minor)' }}>
              <h3 className="font-[var(--serif)] italic text-base" style={{ color:'var(--ink-100)' }}>
                <Swords className="inline h-4 w-4 mr-1" style={{ color:'var(--accent)' }} /> Live Log
              </h3>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto space-y-2">
              {[...logs].reverse().map(l => {
                const pu = participants.find(pp => pp.user_id === l.user_id)
                return (
                  <div key={l.id} className="border rounded p-2" style={{ borderColor:'var(--grid-minor)', background:'var(--page-cream)' }}>
                    <p className="font-[var(--mono)] text-xs font-medium" style={{ color:'var(--ink-80)' }}>{pu?.username ?? 'Unknown'}</p>
                    <p className="font-[var(--mono)] text-[10px] tracking-wider mt-0.5" style={{ color:'var(--ink-40)' }}>
                      Set {l.set_number}: {l.weight_kg} kg × {l.reps} = {(Number(l.weight_kg ?? 0) * l.reps).toLocaleString()} kg
                    </p>
                  </div>
                )
              })}
              {logs.length===0 && <p className="font-[var(--mono)] text-xs text-center" style={{ color:'var(--ink-40)' }}>Waiting for first set...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
