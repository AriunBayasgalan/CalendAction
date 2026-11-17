import type { ReactNode } from 'react'
import styles from './Alert.module.css'

type AlertProps = {
  tone?: 'error' | 'info'
  children: ReactNode
}

function Alert({ tone = 'error', children }: AlertProps) {
  const role = tone === 'error' ? 'alert' : 'status'
  return <div className={`${styles.alert} ${styles[tone]}`} role={role}>{children}</div>
}

export default Alert
