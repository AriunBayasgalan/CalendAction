import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import mascotUrl from '../../assets/mascot.svg'
import { useAuth } from '../../contexts/auth.ts'
import {
  SLOW_SERVER_HINT,
  UNREACHABLE_MESSAGE,
  fieldErrorsFromApi,
  isUnreachableError,
  messageForAuthFailure,
  validateAuthFields,
  type AuthFieldErrors,
  type AuthMode,
} from '../authForm.ts'
import Alert from '../components/ui/Alert.tsx'
import Button from '../components/ui/Button.tsx'
import Field from '../components/ui/Field.tsx'
import PasswordField from '../components/ui/PasswordField.tsx'
import styles from './AuthPage.module.css'

type AuthResponse = {
  token?: string
}

type AuthLocationState = { from?: { pathname?: string } } | null

const SLOW_AFTER_MS = 4000

function AuthPage({ mode }: { mode: AuthMode }) {
  const { apiFetch, setToken, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)
  const isRegistering = mode === 'register'

  useEffect(() => {
    document.title = isRegistering ? 'Create account · CalendAction' : 'Log in · CalendAction'
  }, [isRegistering])

  useEffect(() => {
    if (!isSubmitting) return
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [isSubmitting])

  if (token) {
    const destination = (location.state as AuthLocationState)?.from?.pathname
    return <Navigate to={destination && destination !== '/login' && destination !== '/register' ? destination : '/week'} replace />
  }

  function updateField(name: keyof AuthFieldErrors, value: string) {
    if (name === 'email') setEmail(value)
    else setPassword(value)
    setFormError('')
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = validateAuthFields(name === 'email' ? value : email, name === 'password' ? value : password)
      return { ...current, [name]: next[name] }
    })
  }

  function validateField(name: keyof AuthFieldErrors) {
    const next = validateAuthFields(email, password)
    setFieldErrors((current) => ({ ...current, [name]: next[name] }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const nextErrors = validateAuthFields(email, password)
    setFieldErrors(nextErrors)
    setFormError('')
    if (nextErrors.email || nextErrors.password) {
      const invalid = nextErrors.email ? 'email' : 'password'
      formRef.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus()
      return
    }

    setSlow(false)
    setIsSubmitting(true)
    try {
      const response = await apiFetch(`/auth/${isRegistering ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const result: unknown = await response.json().catch(() => null)
      const authToken = (result as AuthResponse | null)?.token
      if (!response.ok || !authToken) {
        const apiFields = fieldErrorsFromApi(result)
        if (apiFields.email || apiFields.password) {
          setFieldErrors(apiFields)
          const invalid = apiFields.email ? 'email' : 'password'
          formRef.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus()
        } else {
          setFormError(messageForAuthFailure(response.status, result, mode))
        }
        return
      }

      setToken(authToken)
      const destination = (location.state as AuthLocationState)?.from?.pathname
      navigate(destination && destination !== '/login' && destination !== '/register' ? destination : '/week', {
        replace: true,
      })
    } catch (submitError) {
      setFormError(isUnreachableError(submitError) ? UNREACHABLE_MESSAGE : messageForAuthFailure(500, null, mode))
    } finally {
      setSlow(false)
      setIsSubmitting(false)
    }
  }

  const otherMode = isRegistering
    ? { to: '/login', prompt: 'Already have an account?', action: 'Log in' }
    : { to: '/register', prompt: 'New to CalendAction?', action: 'Create an account' }

  return (
    <section className={styles.page} aria-labelledby="auth-title">
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src={mascotUrl} alt="" width={72} height={72} />
          <h1 id="auth-title" className={styles.title}>
            {isRegistering ? 'Create your account' : 'Log in'}
          </h1>
          <p className={styles.subtitle}>
            {isRegistering ? 'Save your events, tasks, and streak.' : 'Welcome back.'}
          </p>
        </div>

        <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            required
            disabled={isSubmitting}
            error={fieldErrors.email}
            onChange={(event) => updateField('email', event.target.value)}
            onBlur={() => validateField('email')}
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            value={password}
            required
            disabled={isSubmitting}
            error={fieldErrors.password}
            onChange={(event) => updateField('password', event.target.value)}
            onBlur={() => validateField('password')}
          />
          {formError && <Alert>{formError}</Alert>}
          {isSubmitting && slow && (
            <p className={styles.slow} role="status">
              {SLOW_SERVER_HINT}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (isRegistering ? 'Creating account…' : 'Logging in…') : isRegistering ? 'Create account' : 'Log in'}
          </Button>
        </form>

        <p className={styles.switch}>
          {otherMode.prompt}{' '}
          <Link to={otherMode.to} state={location.state}>
            {otherMode.action}
          </Link>
        </p>
      </div>
    </section>
  )
}

export default AuthPage
