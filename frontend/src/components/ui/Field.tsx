import { cloneElement, useId, type ReactElement } from 'react'
type Control = ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: Control
}) {
  const generatedId = useId()
  const id = children.props.id || generatedId
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small className="field-error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  )
}
