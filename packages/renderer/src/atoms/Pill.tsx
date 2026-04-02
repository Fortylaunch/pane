import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

interface PillProps {
  label: string
  active?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  dot?: boolean
  onToggle?: () => void
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const dotColors: Record<string, string> = {
  default: 'var(--pane-color-text-muted)',
  success: 'var(--pane-color-success)',
  warning: 'var(--pane-color-warning)',
  danger: 'var(--pane-color-danger)',
  info: 'var(--pane-color-info)',
}

const activeBgColors: Record<string, string> = {
  default: 'var(--pane-color-surface-raised)',
  success: 'rgba(34, 197, 94, 0.15)',
  warning: 'rgba(245, 158, 11, 0.15)',
  danger: 'rgba(239, 68, 68, 0.15)',
  info: 'rgba(59, 130, 246, 0.15)',
}

export function Pill({
  label,
  active = false,
  variant = 'default',
  dot = false,
  onToggle,
  style,
  className,
}: PillProps) {
  const dotColor = dotColors[variant] ?? dotColors.default
  const activeBg = activeBgColors[variant] ?? activeBgColors.default

  const computedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    height: '28px',
    fontSize: 'var(--pane-text-xs-size)',
    fontWeight: 500,
    fontFamily: 'var(--pane-font-family)',
    borderRadius: 'var(--pane-radius-full)',
    border: `1px solid ${active ? 'transparent' : 'var(--pane-color-border)'}`,
    background: active ? activeBg : 'transparent',
    color: active ? 'var(--pane-color-text)' : 'var(--pane-color-text-muted)',
    cursor: onToggle ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
    ...style,
  }

  return (
    <motion.button
      style={computedStyle}
      className={className}
      onClick={onToggle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--pane-radius-full)',
          background: dotColor,
          flexShrink: 0,
        }} />
      )}
      {label}
    </motion.button>
  )
}
