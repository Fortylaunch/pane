import type { CSSProperties } from 'react'

interface IconProps {
  name: string
  size?: string
  color?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

// Simple inline SVG icon set — enough to demo. Replace with a real icon system later.
const ICONS: Record<string, string> = {
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M6 18L18 6',
  arrow_right: 'M5 12h14m-7-7l7 7-7 7',
  plus: 'M12 5v14m-7-7h14',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  alert: 'M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z',
  spinner: 'M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93',
}

export function Icon({ name, size = '20', color = 'currentColor', style, className }: IconProps) {
  const path = ICONS[name]

  if (!path) {
    return (
      <span
        style={{
          display: 'inline-flex',
          width: `${size}px`,
          height: `${size}px`,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--pane-text-xs-size)',
          color: 'var(--pane-color-text-muted)',
          ...style,
        }}
        className={className}
      >
        {name.charAt(0)}
      </span>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      className={className}
    >
      <path d={path} />
    </svg>
  )
}
