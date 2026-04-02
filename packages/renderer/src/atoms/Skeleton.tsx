import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string
  height?: string
  variant?: 'text' | 'rect' | 'circle'
  lines?: number
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const shimmerStyle: CSSProperties = {
  background: 'linear-gradient(90deg, var(--pane-color-surface-raised) 0%, var(--pane-color-border) 50%, var(--pane-color-surface-raised) 100%)',
  backgroundSize: '200% 100%',
  animation: 'pane-shimmer var(--pane-shimmer-duration, 1.5s) ease infinite',
}

export function Skeleton({
  width = '100%',
  height = '20px',
  variant = 'rect',
  lines,
  style,
  className,
}: SkeletonProps) {
  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pane-space-xs)', width, ...style }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...shimmerStyle,
              height,
              borderRadius: 'var(--pane-radius-sm)',
              width: i === lines - 1 ? '70%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }

  const borderRadius = variant === 'circle' ? 'var(--pane-radius-full)'
    : variant === 'text' ? 'var(--pane-radius-sm)'
    : 'var(--pane-radius-md)'

  return (
    <div
      className={className}
      style={{
        ...shimmerStyle,
        width: variant === 'circle' ? height : width,
        height,
        borderRadius,
        ...style,
      }}
    />
  )
}
