import { useState } from 'react'
import {
  findSoonBlock,
  pickStartingSoonLine,
  readDismissed,
  writeDismissed,
  dismissId,
  type NagBlock,
} from '../nagBanner.ts'
import { useNow } from './useNow.ts'
import styles from './NagBanner.module.css'

type NagBannerProps = {
  blocks: NagBlock[]
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}

// CA-29: a canned line when a block starts within 15 minutes. Dismiss hides
// it for that block (kept in localStorage so a refresh doesn't bring it back).
function NagBanner({ blocks, storage = localStorage }: NagBannerProps) {
  // Tick often enough that the banner appears before the 15-minute window closes.
  const now = useNow(10_000)
  const [dismissed, setDismissed] = useState(() => readDismissed(storage))
  const block = findSoonBlock(blocks, now, dismissed)

  if (!block) return null

  function dismiss() {
    const next = new Set(dismissed)
    next.add(dismissId(block!))
    writeDismissed(storage, next)
    setDismissed(next)
  }

  return (
    <div className={styles.banner} role="status">
      <p className={styles.line}>{pickStartingSoonLine(block)}</p>
      <button type="button" className={styles.dismiss} onClick={dismiss}>
        Dismiss
      </button>
    </div>
  )
}

export default NagBanner
