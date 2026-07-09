'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'
import { Plus, Swords } from 'lucide-react'

export default function CompetitionsPage() {
  const [comps, setComps] = useState<any[]>([])

  useEffect(() => {
    supabase.from('competitions').select('*, exercises(name), competition_participants(count)').order('created_at', { ascending: false }).then(({ data }) => setComps(data ?? []))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[var(--serif)] italic text-3xl" style={{ color: 'var(--ink-100)' }}>Competitions</h1>
          <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>LIVE WORKOUT BATTLES</p>
        </div>
        <Link href="/pumps/competitions/new" className="flex items-center gap-2 px-4 py-2 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80" style={{ background: 'var(--accent)', color: 'var(--page)' }}>
          <Plus className="h-4 w-4" /> Create
        </Link>
      </div>

      {comps.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {comps.map(c => (
            <Link key={c.id} href={`/pumps/competitions/${c.id}`} className="border rounded p-4 transition-colors hover:opacity-70" style={{ borderColor: c.status === 'active' ? 'var(--accent)' : 'var(--grid-minor)', background: 'var(--page)' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{c.name}</p>
                <span className="text-[9px] tracking-wider px-1.5 py-0.5 rounded-full font-[var(--mono)]" style={{ background: c.status==='active'?'var(--work-color)':c.status==='completed'?'var(--ink-40)':'var(--accent-gold)', color:'var(--page)' }}>{c.status}</span>
              </div>
              <p className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>
                {c.exercises?.name} — {c.type.replace('_',' ')}
              </p>
              <p className="font-[var(--mono)] text-[10px] tracking-wider mt-2" style={{ color: 'var(--ink-40)' }}>
                <Swords className="inline h-3 w-3 mr-1" />
                {c.competition_participants?.[0]?.count ?? 0} participants
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
          <Swords className="mx-auto h-8 w-8 mb-3" style={{ color: 'var(--ink-25)' }} />
          <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-40)' }}>No competitions yet</p>
          <Link href="/pumps/competitions/new" className="inline-block mt-3 px-4 py-2 rounded text-sm font-[var(--mono)]" style={{ background: 'var(--accent)', color: 'var(--page)' }}>Create One</Link>
        </div>
      )}
    </div>
  )
}
