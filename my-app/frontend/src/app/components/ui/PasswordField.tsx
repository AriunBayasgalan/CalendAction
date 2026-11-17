import { useState, type InputHTMLAttributes } from 'react'
import Field from './Field.tsx'
import styles from './Field.module.css'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
  hint?: string
}

function PasswordField({ label, error, hint, disabled, ...inputProps }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <Field
      {...inputProps}
      label={label}
      error={error}
      hint={hint}
      disabled={disabled}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          disabled={disabled}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
    />
  )
}

export default PasswordField
