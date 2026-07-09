'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { supabase } from '@/app/lib/supabase'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
  }, [user])

  async function handleSignOut() {
    await signOut()
    router.push('/signin')
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-[var(--serif)] italic text-3xl mb-2" style={{ color: 'var(--ink-100)' }}>Settings</h1>
      <p className="font-[var(--mono)] text-[10px] tracking-wider mb-6" style={{ color: 'var(--ink-40)' }}>YOUR ACCOUNT</p>

      <div className="border rounded p-4 mb-4 space-y-3" style={{ borderColor: 'var(--grid-major)', background: 'var(--page)' }}>
        <div>
          <span className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>EMAIL</span>
          <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{user?.email}</p>
        </div>
        <div>
          <span className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>USERNAME</span>
          <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>{profile?.username ?? 'Not set'}</p>
        </div>
        <div>
          <span className="font-[var(--mono)] text-[10px] tracking-wider" style={{ color: 'var(--ink-40)' }}>MEMBER SINCE</span>
          <p className="font-[var(--mono)] text-sm" style={{ color: 'var(--ink-80)' }}>
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
      </div>

      <button onClick={handleSignOut}
        className="w-full py-3 rounded text-sm font-[var(--mono)] transition-opacity hover:opacity-80"
        style={{ background: 'var(--accent)', color: 'var(--page)' }}>
        Sign Out
      </button>
    </div>
  )
}
