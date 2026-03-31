import type { CSSProperties } from 'react'

interface FrameProps {
  src?: string
  html?: string
  width?: string
  height?: string
  sandbox?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Frame({ src, html, width = '100%', height = '300px', sandbox = 'allow-scripts', style, className }: FrameProps) {
  if (html) {
    return (
      <iframe
        srcDoc={html}
        sandbox={sandbox}
        style={{
          width,
          height,
          border: '1px solid var(--pane-color-border)',
          borderRadius: 'var(--pane-radius-md)',
          background: 'var(--pane-color-surface)',
          ...style,
        }}
        className={className}
      />
    )
  }

  if (src) {
    return (
      <iframe
        src={src}
        sandbox={sandbox}
        style={{
          width,
          height,
          border: '1px solid var(--pane-color-border)',
          borderRadius: 'var(--pane-radius-md)',
          background: 'var(--pane-color-surface)',
          ...style,
        }}
        className={className}
      />
    )
  }

  return (
    <div style={{
      width,
      height,
      border: '1px solid var(--pane-color-border)',
      borderRadius: 'var(--pane-radius-md)',
      background: 'var(--pane-color-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--pane-color-text-muted)',
      fontSize: 'var(--pane-text-sm-size)',
      ...style,
    }} className={className}>
      No content
    </div>
  )
}
