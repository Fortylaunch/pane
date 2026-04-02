import type { CSSProperties } from 'react'

interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  spacing?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Divider({
  orientation = 'horizontal',
  label,
  spacing = 'var(--pane-space-md)',
  style,
  className,
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={className}
        style={{
          width: 'var(--pane-border-thin)',
          alignSelf: 'stretch',
          background: 'var(--pane-color-border)',
          margin: `0 ${spacing}`,
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }

  if (label) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--pane-space-sm)',
          margin: `${spacing} 0`,
          ...style,
        }}
      >
        <div style={{ flex: 1, height: 'var(--pane-border-thin)', background: 'var(--pane-color-border)' }} />
        <span style={{
          fontSize: 'var(--pane-text-xs-size)',
          color: 'var(--pane-color-text-muted)',
          fontFamily: 'var(--pane-font-family)',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 'var(--pane-border-thin)', background: 'var(--pane-color-border)' }} />
      </div>
    )
  }

  return (
    <hr
      className={className}
      style={{
        border: 'none',
        height: 'var(--pane-border-thin)',
        background: 'var(--pane-color-border)',
        margin: `${spacing} 0`,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
