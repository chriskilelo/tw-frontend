import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: string
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-body-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`rounded border px-3 py-2 text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-caption text-danger-soft-text">
          {error}
        </p>
      )}
    </div>
  )
})
