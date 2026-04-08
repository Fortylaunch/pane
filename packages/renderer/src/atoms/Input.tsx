import { type CSSProperties, useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { getContrastTextColor } from './contrast.js'

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
  fontFamily: 'var(--pane-font-mono)',
  fontSize: 'var(--pane-text-sm-size)',
  lineHeight: 'var(--pane-text-sm-line)',
  color: 'var(--pane-color-text)',
  background: 'var(--pane-color-surface)',
  border: '1px solid var(--pane-color-border)',
  borderRadius: '0px',
  padding: '6px 8px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s ease',
}

const focusStyle: CSSProperties = {
  borderColor: 'var(--pane-color-accent)',
  boxShadow: 'none',
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
  const [userHasTyped, setUserHasTyped] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Local-state-first model:
  // - Once the user starts typing, the local state is authoritative
  // - The controlled value is only used as the initial value
  // - Server roundtrips that re-send a value prop don't clobber what
  //   the user is currently typing
  // - For discrete-choice inputs (toggle, select), the controlled value
  //   is honored because the agent IS the source of truth there
  const isDiscrete = type === 'toggle' || type === 'select'
  const value = isDiscrete
    ? (controlledValue ?? internalValue)
    : (userHasTyped ? internalValue : (controlledValue ?? internalValue))

  const handleChange = useCallback((v: string) => {
    setInternalValue(v)
    setUserHasTyped(true)
    onChange?.(v)
  }, [onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.(value)
      // Only auto-clear when uncontrolled (no value prop). The global chat
      // input wants this behavior (clear after sending). In-view form fields
      // pass a value prop and want the value to persist.
      if (controlledValue === undefined) {
        setInternalValue('')
        setUserHasTyped(false)
      }
    }
  }, [onSubmit, value, controlledValue])

  // Contrast enforcement: if a light background is set on this Input, force dark text
  const contrastColor = getContrastTextColor(style)

  const mergedStyle = {
    ...baseStyle,
    ...(focused ? focusStyle : {}),
    ...style,
    ...(contrastColor ? { color: contrastColor } : {}),
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
    // Normalize options — Claude sometimes sends strings instead of {value, label} objects
    const normalizedOptions = options.map((opt: any, i: number) => {
      if (typeof opt === 'string') return { value: opt, label: opt, key: `${opt}-${i}` }
      return { value: opt.value ?? opt.label ?? `opt-${i}`, label: opt.label ?? opt.value ?? `Option ${i + 1}`, key: `${opt.value ?? i}-${i}` }
    })
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
        {normalizedOptions.map(opt => (
          <option key={opt.key} value={opt.value}>{opt.label}</option>
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
