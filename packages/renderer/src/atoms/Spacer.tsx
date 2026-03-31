import type { CSSProperties } from 'react'

interface SpacerProps {
  size?: string
  direction?: 'horizontal' | 'vertical'
  line?: boolean
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Spacer({ size = 'var(--pane-space-md)', direction = 'vertical', line = false, style, className }: SpacerProps) {
  if (line) {
    return (
      <hr
        style={{
          border: 'none',
          borderTop: direction === 'vertical' ? '1px solid var(--pane-color-border)' : 'none',
          borderLeft: direction === 'horizontal' ? '1px solid var(--pane-color-border)' : 'none',
          margin: direction === 'vertical' ? `${size} 0` : `0 ${size}`,
          width: direction === 'vertical' ? '100%' : '0',
          height: direction === 'horizontal' ? '100%' : '0',
          ...style,
        }}
        className={className}
      />
    )
  }

  return (
    <div
      style={{
        width: direction === 'horizontal' ? size : '100%',
        height: direction === 'vertical' ? size : '100%',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  )
}
