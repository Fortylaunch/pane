import { useState, type CSSProperties } from 'react'

interface FrameProps {
  src?: string
  html?: string
  title?: string
  width?: string
  height?: string
  sandbox?: string
  loading?: string          // placeholder text while content loads
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Frame({
  src,
  html,
  title,
  width = '100%',
  height = '300px',
  sandbox = 'allow-scripts',
  loading,
  style,
  className,
}: FrameProps) {
  const [loaded, setLoaded] = useState(false)

  const frameStyle: CSSProperties = {
    width,
    height,
    border: '1px solid var(--pane-color-border)',
    background: '#000',
    display: 'block',
    ...style,
  }

  if (html) {
    return (
      <div style={{ position: 'relative', width, height }} className={className}>
        {!loaded && <FrameLoading width={width} height={height} text={loading ?? title ?? 'Loading...'} />}
        <iframe
          srcDoc={html}
          sandbox={sandbox}
          title={title}
          onLoad={() => setLoaded(true)}
          style={{ ...frameStyle, opacity: loaded ? 1 : 0, position: loaded ? 'relative' : 'absolute', top: 0, left: 0 }}
        />
      </div>
    )
  }

  if (src) {
    return (
      <div style={{ position: 'relative', width, height }} className={className}>
        {!loaded && <FrameLoading width={width} height={height} text={loading ?? 'Loading...'} />}
        <iframe
          src={src}
          sandbox={sandbox}
          title={title}
          onLoad={() => setLoaded(true)}
          style={{ ...frameStyle, opacity: loaded ? 1 : 0, position: loaded ? 'relative' : 'absolute', top: 0, left: 0 }}
        />
      </div>
    )
  }

  // No src or html — show loading placeholder (Norman: feedback loop)
  return <FrameLoading width={width} height={height} text={loading ?? 'No content'} className={className} />
}

// ── Loading placeholder ──
function FrameLoading({ width, height, text, className }: { width: string; height: string; text: string; className?: string }) {
  return (
    <div style={{
      width,
      height,
      border: '1px solid var(--pane-color-border)',
      background: 'var(--pane-color-surface)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      color: 'var(--pane-color-text-muted)',
      fontSize: '11px',
      fontFamily: 'var(--pane-font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }} className={className}>
      <div style={{
        width: '16px',
        height: '16px',
        border: '2px solid var(--pane-color-border)',
        borderTopColor: 'var(--pane-color-accent)',
        borderRadius: '50%',
        animation: 'pane-spin 0.8s linear infinite',
      }} />
      {text}
    </div>
  )
}
