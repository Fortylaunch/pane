import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

interface ProgressProps {
  value: number
  max?: number
  label?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const variantFill: Record<string, string> = {
  default: 'var(--pane-color-accent)',
  success: 'var(--pane-color-success)',
  warning: 'var(--pane-color-warning)',
  danger: 'var(--pane-color-danger)',
}

export function Progress({
  value,
  max = 100,
  label,
  variant = 'default',
  size = 'md',
  style,
  className,
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const fillColor = variantFill[variant] ?? variantFill.default
  const trackHeight = size === 'sm' ? '4px' : '8px'

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pane-space-xs)', ...style }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{
            fontSize: 'var(--pane-text-xs-size)',
            color: 'var(--pane-color-text-muted)',
            fontFamily: 'var(--pane-font-family)',
          }}>
            {label}
          </span>
          <span style={{
            fontSize: 'var(--pane-text-xs-size)',
            color: 'var(--pane-color-text-muted)',
            fontFamily: 'var(--pane-font-mono)',
          }}>
            {Math.round(pct)}%
          </span>
        </div>
      )}
      <div
        style={{
          height: trackHeight,
          background: 'var(--pane-color-surface-raised)',
          borderRadius: 'var(--pane-radius-full)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          style={{
            height: '100%',
            background: fillColor,
            borderRadius: 'var(--pane-radius-full)',
          }}
        />
      </div>
    </div>
  )
}
