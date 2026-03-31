import { type CSSProperties, useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'

type InputType = 'text' | 'number' | 'textarea' | 'select' | 'toggle' | 'button' | 'date'

interface InputProps {
  type?: InputType
  placeholder?: string
  value?: string
  label?: string
  options?: { label: string; value: string }[]
  onSubmit?: (value: string) => void
  onChange?: (value: string) => void
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const baseStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--pane-text-md-size)',
  lineHeight: 'var(--pane-text-md-line)',
  color: 'var(--pane-color-text)',
  background: 'var(--pane-color-surface)',
  border: '1px solid var(--pane-color-border)',
  borderRadius: 'var(--pane-radius-md)',
  padding: '10px 14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  transition: 'all 0.15s ease',
}

const focusStyle: CSSProperties = {
  borderColor: 'var(--pane-color-accent)',
  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)',
}

export function Input({
  type = 'text',
  placeholder,
  value: controlledValue,
  label,
  options,
  onSubmit,
  onChange,
  style,
  className,
}: InputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const value = controlledValue ?? internalValue

  const handleChange = useCallback((v: string) => {
    setInternalValue(v)
    onChange?.(v)
  }, [onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.(value)
      setInternalValue('')
    }
  }, [onSubmit, value])

  const mergedStyle = {
    ...baseStyle,
    ...(focused ? focusStyle : {}),
    ...style,
  }

  if (type === 'button') {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          ...baseStyle,
          cursor: 'pointer',
          background: 'var(--pane-color-accent)',
          color: 'var(--pane-color-accent-text)',
          border: 'none',
          fontWeight: 500,
          textAlign: 'center',
          width: 'auto',
          padding: '10px 20px',
          borderRadius: 'var(--pane-radius-md)',
          ...style,
        }}
        className={className}
        onClick={() => onSubmit?.(label ?? '')}
      >
        {label ?? 'Submit'}
      </motion.button>
    )
  }

  if (type === 'toggle') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={e => handleChange(String(e.target.checked))}
          style={{ accentColor: 'var(--pane-color-accent)' }}
        />
        {label && <span style={{ color: 'var(--pane-color-text)', fontSize: 'var(--pane-text-sm-size)' }}>{label}</span>}
      </label>
    )
  }

  if (type === 'select' && options) {
    return (
      <select
        style={mergedStyle}
        className={className}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  if (type === 'textarea') {
    return (
      <textarea
        ref={inputRef as any}
        style={{ ...mergedStyle, minHeight: '100px', resize: 'vertical' }}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    )
  }

  return (
    <input
      ref={inputRef as any}
      type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
      style={mergedStyle}
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={e => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  )
}
