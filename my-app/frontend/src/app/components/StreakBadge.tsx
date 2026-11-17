import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import { streakHint, streakLabel, type Streak } from './streak.ts'
import styles from './StreakBadge.module.css'

type StreakBadgeProps = {
  // Bumped after a Start so the count updates right away
  reloadToken: number
  // Today's date ("2026-11-16"). A new day reloads, since the streak may have reset overnight.
  today: string
}

// CA-28: the streak in the week header. Highlighted once today has counted.
function StreakBadge({ reloadToken, today }: StreakBadgeProps) {
  const { apiFetch, logout } = useAuth()
  const [streak, setStreak] = useState<Streak | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadStreak() {
      try {
        const res = await apiFetch('/streak', { signal: controller.signal })
        if (res.status === 401) {
          logout()
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStreak(await res.json())
      } catch (error) {
        // Keeps the last count (or nothing) on screen; the streak isn't worth an error banner
        if (!controller.signal.aborted) console.error('Could not load the streak:', error)
      }
    }

    loadStreak()

    return () => controller.abort()
  }, [apiFetch, logout, reloadToken, today])

  if (!streak) return null

  return (
    <p
      className={`${styles.badge} ${streak.countedToday ? styles.counted : ''}`}
      role="status"
      title={streakHint(streak)}
    >
      {streakLabel(streak)}
    </p>
  )
}

export default StreakBadge
