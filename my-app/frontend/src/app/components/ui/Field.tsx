import { useId, type InputHTMLAttributes } from 'react'
import styles from './Field.module.css'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

// Labeled input with an optional error message under it.
function Field({ label, error, className, ...inputProps }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

export default Field
