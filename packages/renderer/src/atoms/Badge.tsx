import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

interface BadgeProps {
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const variantColors: Record<string, { bg: string; text: string }> = {
  default:  { bg: 'var(--pane-color-surface-raised)', text: 'var(--pane-color-text)' },
  success:  { bg: 'rgba(34, 197, 94, 0.15)', text: 'var(--pane-color-success)' },
  warning:  { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--pane-color-warning)' },
  danger:   { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--pane-color-danger)' },
  info:     { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--pane-color-info)' },
}

export function Badge({
  label,
  variant = 'default',
  size = 'sm',
  style,
  className,
}: BadgeProps) {
  const colors = variantColors[variant] ?? variantColors.default

  const computedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: size === 'sm' ? '2px 8px' : '4px 12px',
    fontSize: size === 'sm' ? 'var(--pane-text-xs-size)' : 'var(--pane-text-sm-size)',
    fontWeight: 500,
    lineHeight: size === 'sm' ? 'var(--pane-text-xs-line)' : 'var(--pane-text-sm-line)',
    fontFamily: 'var(--pane-font-family)',
    borderRadius: 'var(--pane-radius-full)',
    background: colors.bg,
    color: colors.text,
    whiteSpace: 'nowrap',
    ...style,
  }

  return (
    <motion.span
      layout
      style={computedStyle}
      className={className}
    >
      {label}
    </motion.span>
  )
}
