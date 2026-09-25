import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { Btn, Card } from '../components/UI'

export default function Login() {
  const { signIn, signUp, resetPassword, updatePassword, passwordRecovery } = useAuth()
  const [mode, setMode] = useState(passwordRecovery ? 'update' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(false)

  useEffect(() => {
    if (passwordRecovery) {
      setMode('update')
      setMessage('')
      setMessageOk(false)
      setPassword('')
      setConfirmPassword('')
    }
  }, [passwordRecovery])

  const switchMode = (next) => {
    setMode(next)
    setMessage('')
    setMessageOk(false)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setMessageOk(false)

    const trimmedEmail = email.trim()

    if (mode === 'forgot') {
      if (!trimmedEmail) {
        setMessage('Enter the email for your account.')
        setBusy(false)
        return
      }
      const { error } = await resetPassword(trimmedEmail)
      setBusy(false)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessageOk(true)
      setMessage('Check your email for a password reset link. It will bring you back here to choose a new password.')
      return
    }

    if (mode === 'update') {
      if (password.length < 6) {
        setMessage('Password must be at least 6 characters.')
        setBusy(false)
        return
      }
      if (password !== confirmPassword) {
        setMessage('Passwords do not match.')
        setBusy(false)
        return
      }
      const { error } = await updatePassword(password)
      setBusy(false)
      if (error) {
        setMessage(error.message)
        return
      }
      setMessageOk(true)
      setMessage('Password updated. You are signed in.')
      return
    }

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
      setMessageOk(true)
      setMessage('Account created. Check your email — the confirmation link will bring you back to this app.')
      setMode('signin')
    }
  }

  const title =
    mode === 'forgot'
      ? 'Reset password'
      : mode === 'update'
        ? 'Choose a new password'
        : 'Earmark'

  const subtitle =
    mode === 'forgot'
      ? 'Enter your email and we will send a reset link.'
      : mode === 'update'
        ? 'Pick a new password for your account.'
        : 'Your personal budget — sign in to access your data.'

  const submitLabel =
    mode === 'forgot'
      ? 'Send reset link'
      : mode === 'update'
        ? 'Update password'
        : mode === 'signin'
          ? 'Sign in'
          : 'Create account'

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden>
            💰
          </span>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="auth-form">
          {mode !== 'update' && (
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
          )}

          {(mode === 'signin' || mode === 'signup' || mode === 'update') && (
            <label className="auth-field">
              <span>{mode === 'update' ? 'New password' : 'Password'}</span>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === 'update' && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                minLength={6}
                required
              />
            </label>
          )}

          {mode === 'signin' && (
            <div className="auth-forgot-row">
              <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </div>
          )}

          {message && (
            <p className={`auth-message ${messageOk ? 'auth-message-ok' : 'auth-message-err'}`}>
              {message}
            </p>
          )}

          <Btn type="submit" disabled={busy} style={{ width: '100%', marginTop: 4 }}>
            {busy ? 'Please wait…' : submitLabel}
          </Btn>
        </form>

        {mode !== 'update' && (
          <p className="auth-switch">
            {mode === 'signin' && (
              <>
                New here?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <>
                Remembered it?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                  Back to sign in
                </button>
              </>
            )}
          </p>
        )}
      </Card>
    </div>
  )
}
