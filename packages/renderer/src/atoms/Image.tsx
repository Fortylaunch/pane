import type { CSSProperties } from 'react'

interface ImageProps {
  src: string
  alt?: string
  width?: string
  height?: string
  fit?: 'cover' | 'contain' | 'fill'
  radius?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Image({ src, alt = '', width, height, fit = 'cover', radius, style, className }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: width ?? '100%',
        height: height ?? 'auto',
        objectFit: fit,
        borderRadius: radius ?? 'var(--pane-radius-md)',
        display: 'block',
        ...style,
      }}
      className={className}
    />
  )
}
