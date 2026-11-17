import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { readErrorMessage } from './apiErrors.ts'
import Button from './ui/Button.tsx'
import styles from './RuleForm.module.css'

type Rule = {
  _id: string
  notBefore: string
  notAfter: string
  label?: string
}

function RuleForm() {
  const { apiFetch, logout } = useAuth()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [notBefore, setNotBefore] = useState('09:00')
  const [notAfter, setNotAfter] = useState('17:00')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  // The rule loaded into the form for editing; null means the form adds a new rule
  const [editingId, setEditingId] = useState<string | null>(null)

  function retryLoad() {
    setError('')
    setLoadFailed(false)
    setLoading(true)
    setLoadAttempt((n) => n + 1)
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadRules() {
      try {
        const res = await apiFetch('/rules', { signal: controller.signal })

        if (res.status === 401) {
          logout()
          return
        }

        if (!res.ok) {
          setLoadFailed(true)
          setError(await readErrorMessage(res, 'Could not load rules.'))
          return
        }

        setLoadFailed(false)
        setError('')
        setRules(await res.json())
      } catch {
        if (!controller.signal.aborted) {
          setLoadFailed(true)
          setError('Could not load rules.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadRules()

    return () => controller.abort()
  }, [apiFetch, logout, loadAttempt])

  useEffect(() => {
    document.title = 'Rules · CalendAction'
  }, [])

  function startEdit(rule: Rule) {
    setError('')
    setEditingId(rule._id)
    setNotBefore(rule.notBefore)
    setNotAfter(rule.notAfter)
    setLabel(rule.label ?? '')
  }

  function resetForm() {
    setEditingId(null)
    setNotBefore('09:00')
    setNotAfter('17:00')
    setLabel('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    setError('')
    setSaving(true)

    try {
      const res = await apiFetch(editingId ? `/rules/${editingId}` : '/rules', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // An empty label clears it when editing
        body: JSON.stringify({ notBefore, notAfter, label }),
      })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not save rule.'))
        return
      }

      const saved: Rule = await res.json()
      setRules((prev) =>
        editingId
          ? prev.map((rule) => (rule._id === saved._id ? saved : rule))
          : [saved, ...prev],
      )
      if (editingId) resetForm()
      else setLabel('')
    } catch {
      setError('Could not save rule.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (deletingIds.includes(id)) return
    if (!window.confirm('Delete this rule?')) return

    setError('')
    setDeletingIds((prev) => [...prev, id])

    try {
      const res = await apiFetch(`/rules/${id}`, { method: 'DELETE' })

      if (res.status === 401) {
        logout()
        return
      }

      if (!res.ok) {
        setError(await readErrorMessage(res, 'Could not delete rule.'))
        return
      }

      setRules((prev) => prev.filter((rule) => rule._id !== id))
      if (editingId === id) resetForm()
    } catch {
      setError('Could not delete rule.')
    } finally {
      setDeletingIds((prev) => prev.filter((deletingId) => deletingId !== id))
    }
  }

  return (
    <section className={styles.page} aria-labelledby="rules-title">
      <header className={styles.intro}>
        <h1 id="rules-title">Rules</h1>
        <p>Tasks are placed only inside these hours. Add a window for mornings, evenings, or a full study day.</p>
      </header>

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
        <div className={styles.formActions}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save rule'}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {/* Always rendered so screen readers announce the message when it appears */}
      <div role="alert" aria-live="assertive" className={error ? styles.error : undefined}>
        {error}
      </div>

      {loading ? (
        <p role="status" aria-live="polite" className={styles.status}>
          Loading rules…
        </p>
      ) : loadFailed ? (
        <div className={styles.status}>
          <Button type="button" size="sm" variant="secondary" onClick={retryLoad}>
            Retry
          </Button>
        </div>
      ) : rules.length === 0 ? (
        <p className={styles.status}>No rules yet. Add a rule to set when tasks can be placed.</p>
      ) : (
        <ul className={styles.list}>
          {rules.map((rule) => (
            <li key={rule._id}>
              <span>
                {rule.label && <strong>{rule.label}: </strong>}
                Nothing before {rule.notBefore}, nothing after {rule.notAfter}
              </span>
              <span className={styles.actions}>
                <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(rule)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={deletingIds.includes(rule._id)}
                  onClick={() => handleDelete(rule._id)}
                >
                  {deletingIds.includes(rule._id) ? 'Deleting…' : 'Delete'}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RuleForm
