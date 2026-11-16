import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/auth.ts'
import { firstErrorMessage } from '../components/apiErrors.ts'

type AuthResponse = {
  token?: string
}

function LoginPage() {
  const { apiFetch, setToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    try {
      const response = await apiFetch(`/auth/${isRegistering ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      })
      const result: unknown = await response.json().catch(() => null)
      const token = (result as AuthResponse | null)?.token
      if (!response.ok || !token) {
        throw new Error(firstErrorMessage(result, 'Unable to authenticate.'))
      }

      setToken(token)
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(destination ?? '/week', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="login-title">
      <h1 id="login-title">{isRegistering ? 'Create your account' : 'Log in'}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Please wait...' : isRegistering ? 'Create account' : 'Log in'}
        </button>
      </form>
      <button type="button" onClick={() => setIsRegistering((value) => !value)}>
        {isRegistering ? 'Back to log in' : 'Create an account'}
      </button>
    </section>
  )
}

export default LoginPage
