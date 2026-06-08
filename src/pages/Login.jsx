import { useState } from 'react'
import { useAuth } from '../context/useAuth'
import { Btn, Card } from '../components/UI'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail || password.length < 6) {
      setMessage('Enter a valid email and a password of at least 6 characters.')
      setBusy(false)
      return
    }

    const { data, error } =
      mode === 'signin'
        ? await signIn(trimmedEmail, password)
        : await signUp(trimmedEmail, password)

    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }

    if (mode === 'signup' && data?.user && !data.session) {
      setMessage('Account created. Check your email to confirm, then sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden>
            💰
          </span>
          <h1 className="auth-title">Earmark</h1>
          <p className="auth-subtitle">Your personal budget — sign in to access your data.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </label>

          {message && (
            <p className={`auth-message ${message.includes('created') ? 'auth-message-ok' : 'auth-message-err'}`}>
              {message}
            </p>
          )}

          <Btn type="submit" disabled={busy} style={{ width: '100%', marginTop: 4 }}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Btn>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button type="button" className="auth-link" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </Card>
    </div>
  )
}
