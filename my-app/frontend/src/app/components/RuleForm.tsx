import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import styles from './RuleForm.module.css'

type Rule = {
  _id: string
  notBefore: string
  notAfter: string
  label?: string
}

// Reads an error message from a failed response without assuming it is JSON.
// Plain text, HTML (e.g. a proxy error page), or an empty body fall back to `fallback`.
async function readErrorMessage(res: Response, fallback: string) {
  if (!res.headers.get('content-type')?.includes('application/json')) return fallback

  try {
    const data = await res.json()
    return data?.details?.[0]?.message ?? data?.error ?? fallback
  } catch {
    return fallback
  }
}

function RuleForm() {
  const { apiFetch } = useAuth()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [notBefore, setNotBefore] = useState('09:00')
  const [notAfter, setNotAfter] = useState('17:00')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadRules() {
      try {
        const res = await apiFetch('/rules', { signal: controller.signal })

        if (!res.ok) {
          setError(await readErrorMessage(res, 'Could not load rules.'))
          return
        }

        setRules(await res.json())
      } catch {
        if (!controller.signal.aborted) setError('Could not load rules.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadRules()

    return () => controller.abort()
  }, [apiFetch])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setError('')
    setSaving(true)

    try {
      const res = await apiFetch('/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notBefore, notAfter, label: label || undefined }),
      })

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not save rule.'))
        return
      }

      const created: Rule = await res.json()
      setRules((prev) => [created, ...prev])
      setLabel('')
    } catch {
      setError('Could not save rule.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingIds.includes(id)) return

    setError('')
    setDeletingIds((prev) => [...prev, id])

    try {
      const res = await apiFetch(`/rules/${id}`, { method: 'DELETE' })

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not delete rule.'))
        return
      }

      setRules((prev) => prev.filter((rule) => rule._id !== id))
    } catch {
      setError('Could not delete rule.')
    } finally {
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id))
    }
  }

  return (
    <section className={styles.wrapper}>
      <h2>Rules</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Nothing before
          <input
            type="time"
            value={notBefore}
            onChange={(e) => setNotBefore(e.target.value)}
            required
          />
        </label>
        <label>
          Nothing after
          <input
            type="time"
            value={notAfter}
            onChange={(e) => setNotAfter(e.target.value)}
            required
          />
        </label>
        <label>
          Label (optional)
          <input
            type="text"
            value={label}
            maxLength={50}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save rule'}
        </button>
      </form>

      {/* Always rendered so screen readers announce the message when it appears */}
      <div role="alert" aria-live="assertive" className={error ? styles.error : undefined}>
        {error}
      </div>

      {loading ? (
        <p role="status" aria-live="polite" className={styles.status}>
          Loading rules…
        </p>
      ) : rules.length === 0 ? (
        <p className={styles.status}>No rules yet</p>
      ) : (
        <ul className={styles.list}>
          {rules.map((rule) => (
            <li key={rule._id}>
              <span>
                {rule.label && <strong>{rule.label}: </strong>}
                Nothing before {rule.notBefore}, nothing after {rule.notAfter}
              </span>
              <button
                type="button"
                disabled={deletingIds.includes(rule._id)}
                onClick={() => handleDelete(rule._id)}
              >
                {deletingIds.includes(rule._id) ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RuleForm
