'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function SignIn() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => { if (!loading && user) router.replace('/') }, [user, loading, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setBusy(false) }
    // on success, onAuthStateChange fires → user set → useEffect above redirects
  }

  return (
    <div className="notebook auth-notebook">
      <div className="auth-margin-num">01</div>
      <form className="auth-form" onSubmit={submit} noValidate>

        <a href="/" className="auth-brand">fl<span>i</span>p</a>

        <div className="auth-heading">
          <div className="auth-eyebrow">sign in</div>
          <h1 className="auth-title">Welcome back.</h1>
        </div>

        <div className="auth-fields">
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email address</label>
            <input
              id="email" type="email" autoComplete="email"
              className="auth-input" required
              placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <input
              id="password" type="password" autoComplete="current-password"
              className="auth-input" required
              placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? 'signing in…' : 'sign in →'}
        </button>

        <p className="auth-footer">
          No account?{' '}
          <a href="/signup" className="auth-link">Create one</a>
        </p>
      </form>
    </div>
  )
}
