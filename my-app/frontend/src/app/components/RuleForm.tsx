import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import styles from './RuleForm.module.css'

type Rule = {
  _id: string
  notBefore: string
  notAfter: string
  label?: string
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function RuleForm() {
  const [rules, setRules] = useState<Rule[]>([])
  const [notBefore, setNotBefore] = useState('09:00')
  const [notAfter, setNotAfter] = useState('17:00')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiUrl}/rules`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setRules)
      .catch(() => setError('Could not load rules.'))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    try {
      const res = await fetch(`${apiUrl}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notBefore, notAfter, label: label || undefined }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.details?.[0]?.message ?? 'Could not save rule.')
        return
      }

      setRules([data, ...rules])
      setLabel('')
    } catch {
      setError('Could not save rule.')
    }
  }

  async function handleDelete(id: string) {
    setError('')

    try {
      const res = await fetch(`${apiUrl}/rules/${id}`, { method: 'DELETE' })

      if (!res.ok) {
        setError('Could not delete rule.')
        return
      }

      setRules(rules.filter((rule) => rule._id !== id))
    } catch {
      setError('Could not delete rule.')
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
        <button type="submit">Save rule</button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {rules.map((rule) => (
          <li key={rule._id}>
            <span>
              {rule.label && <strong>{rule.label}: </strong>}
              Nothing before {rule.notBefore}, nothing after {rule.notAfter}
            </span>
            <button type="button" onClick={() => handleDelete(rule._id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default RuleForm
