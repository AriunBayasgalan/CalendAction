import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/auth.ts'
import mascotUrl from '../../assets/mascot.svg'
import type { CalendarEvent } from './events.ts'
import { placedFormat } from './tasks.ts'
import { formatTime, isSameDay } from './week.ts'
import styles from './Mascot.module.css'

type MascotProps = {
  // Placed tasks the page already has (TaskForm keeps them in sync)
  taskBlocks: CalendarEvent[]
  // Open this block in the event panel, switching to its week
  onOpenBlock: (block: CalendarEvent) => void
  // Nothing coming up: send the user to the task form instead
  onAddTask: () => void
}

// What the bubble says. Canned lines only (CA-26: no LLM).
type Speech =
  | { kind: 'loading' }
  | { kind: 'now'; block: CalendarEvent }
  | { kind: 'next'; block: CalendarEvent; at: string }
  | { kind: 'empty' }
  | { kind: 'error' }

// "today at 10:00 AM", or "Tue, Nov 24, 10:00 AM"
function when(date: Date, now: Date) {
  return isSameDay(date, now) ? `today at ${formatTime(date)}` : placedFormat.format(date)
}

// The block happening right now, else the next one to start
function pickNextBlock(blocks: CalendarEvent[], now: Date) {
  const upcoming = blocks
    .filter((block) => new Date(block.end) > now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  return upcoming[0] ?? null
}

// CA-26: a static mascot in the corner of the week page. Clicking it shows one
// canned line and one button: open the next block, or add a task if there is none.
function Mascot({ taskBlocks, onOpenBlock, onAddTask }: MascotProps) {
  const { apiFetch, logout } = useAuth()
  const [speech, setSpeech] = useState<Speech | null>(null)

  // Esc closes the bubble
  useEffect(() => {
    if (!speech) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSpeech(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [speech])

  async function handleClick() {
    if (speech) {
      setSpeech(null)
      return
    }
    setSpeech({ kind: 'loading' })
    const now = new Date()
    try {
      // Classes from now on (any week); placed tasks are already loaded
      const res = await apiFetch(`/events?${new URLSearchParams({ from: now.toISOString() })}`)
      if (res.status === 401) {
        logout()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const events: CalendarEvent[] = await res.json()
      const block = pickNextBlock([...events, ...taskBlocks], now)
      if (!block) setSpeech({ kind: 'empty' })
      else if (new Date(block.start) <= now) setSpeech({ kind: 'now', block })
      else setSpeech({ kind: 'next', block, at: when(new Date(block.start), now) })
    } catch (error) {
      console.error('Mascot could not load the next block:', error)
      setSpeech({ kind: 'error' })
    }
  }

  function act() {
    if (!speech) return
    if (speech.kind === 'now' || speech.kind === 'next') onOpenBlock(speech.block)
    else if (speech.kind === 'empty') onAddTask()
    else {
      setSpeech(null)
      handleClick()
      return
    }
    setSpeech(null)
  }

  let line = ''
  let action = ''
  if (speech?.kind === 'loading') line = 'Let me check your week…'
  if (speech?.kind === 'now') {
    line = `“${speech.block.title}” is happening right now. Let's go!`
    action = 'Open this block'
  }
  if (speech?.kind === 'next') {
    line = `Next up: “${speech.block.title}”, ${speech.at}.`
    action = 'Open next block'
  }
  if (speech?.kind === 'empty') {
    line = "Nothing coming up. Add a task and I'll find it a slot!"
    action = 'Add a task'
  }
  if (speech?.kind === 'error') {
    line = "Hmm, I couldn't check your week."
    action = 'Try again'
  }

  return (
    <div className={styles.mascot}>
      {speech && (
        <div className={styles.bubble} role="status">
          <p className={styles.line}>{line}</p>
          {action && (
            <button type="button" className={styles.action} onClick={act}>
              {action}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.bird}
        onClick={handleClick}
        aria-expanded={speech !== null}
        aria-label="Mascot: what's next?"
        title="What's next?"
      >
        <img src={mascotUrl} alt="" width={72} height={72} />
      </button>
    </div>
  )
}

export default Mascot
