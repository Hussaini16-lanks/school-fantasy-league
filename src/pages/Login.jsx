import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' or 'signup'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Already logged in? Go straight to My Team
  if (session) return <Navigate to="/team" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } },
          })
        : await supabase.auth.signInWithPassword({ email, password })

    setBusy(false)
    if (error) setError(error.message)
    else navigate('/team')
  }

  const isSignup = mode === 'signup'

  return (
    <section className="auth-card">
      <p className="eyebrow">PAU Fantasy</p>
      <h1>{isSignup ? 'Create account' : 'Welcome back'}</h1>

      <form className="form" onSubmit={handleSubmit}>
        {isSignup && (
          <label className="field">
            Your name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Phil"
              required
            />
          </label>
        )}
        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@pau.edu.ng"
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
      </form>

      <p className="switch-mode">
        {isSignup ? 'Already have an account?' : 'New to PAU Fantasy?'}{' '}
        <button
          className="link-btn"
          onClick={() => {
            setMode(isSignup ? 'signin' : 'signup')
            setError(null)
          }}
        >
          {isSignup ? 'Log in' : 'Create an account'}
        </button>
      </p>
    </section>
  )
}