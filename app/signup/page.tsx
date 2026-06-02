'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function SignUp() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [sent, setSent]         = useState(false)
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => { if (!loading && user) router.replace('/') }, [user, loading, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name.trim() || email.split('@')[0] } },
    })
    if (error) { setError(error.message); setBusy(false) }
    else setSent(true)
  }

  if (sent) return (
    <div className="notebook auth-notebook">
      <div className="auth-margin-num">01</div>
      <div className="auth-form">
        <a href="/" className="auth-brand">fl<span>i</span>p</a>
        <div className="auth-heading">
          <div className="auth-eyebrow">one more step</div>
          <h1 className="auth-title">Check your inbox.</h1>
        </div>
        <p className="auth-sent-note">
          A confirmation link is on its way to <strong>{email}</strong>.
          Click it to activate your account, then sign in.
        </p>
        <a href="/signin" className="auth-submit" style={{ textDecoration: 'none', textAlign: 'center' }}>
          go to sign in →
        </a>
      </div>
    </div>
  )

  return (
    <div className="notebook auth-notebook">
      <div className="auth-margin-num">01</div>
      <form className="auth-form" onSubmit={submit} noValidate>

        <a href="/" className="auth-brand">fl<span>i</span>p</a>

        <div className="auth-heading">
          <div className="auth-eyebrow">create account</div>
          <h1 className="auth-title">Start your practice.</h1>
        </div>

        <div className="auth-fields">
          <div className="auth-field">
            <label className="auth-label" htmlFor="name">Name <span className="auth-optional">(optional)</span></label>
            <input
              id="name" type="text" autoComplete="name"
              className="auth-input"
              placeholder="Your name"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>

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
              id="password" type="password" autoComplete="new-password"
              className="auth-input" required
              placeholder="min. 8 characters"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm" type="password" autoComplete="new-password"
              className="auth-input" required
              placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? 'creating account…' : 'create account →'}
        </button>

        <p className="auth-footer">
          Already have an account?{' '}
          <a href="/signin" className="auth-link">Sign in</a>
        </p>
      </form>
    </div>
  )
}
