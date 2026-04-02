import type { CSSProperties } from 'react'

interface ListProps {
  items: string[]
  ordered?: boolean
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function List({
  items,
  ordered = false,
  style,
  className,
}: ListProps) {
  const baseStyle: CSSProperties = {
    margin: 0,
    paddingLeft: 'var(--pane-space-lg)',
    fontFamily: 'var(--pane-font-family)',
    fontSize: 'var(--pane-text-sm-size)',
    lineHeight: 'var(--pane-text-sm-line)',
    color: 'var(--pane-color-text)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--pane-space-xs)',
    ...style,
  }

  const Tag = ordered ? 'ol' : 'ul'

  return (
    <Tag className={className} style={baseStyle}>
      {items.map((item, i) => (
        <li key={i} style={{ paddingLeft: 'var(--pane-space-xs)' }}>
          {item}
        </li>
      ))}
    </Tag>
  )
}
