import { type CSSProperties, type ReactNode, useState } from 'react'
import { motion } from 'motion/react'

interface BoxProps {
  children?: ReactNode
  style?: CSSProperties
  background?: string
  border?: string
  borderColor?: string
  radius?: string
  padding?: string
  gap?: string
  direction?: 'row' | 'column'
  align?: string
  justify?: string
  flex?: string
  interactive?: boolean
  glass?: boolean
  fill?: boolean   // stretch to fill parent + internal scroll
  className?: string
  [key: string]: unknown
}

export function Box({
  children,
  style,
  background,
  border,
  borderColor,
  radius,
  padding,
  gap,
  direction = 'column',
  align,
  justify,
  flex,
  interactive = false,
  glass = false,
  fill = false,
  className,
  ...rest
}: BoxProps) {
  const [hovered, setHovered] = useState(false)

  const hasBorder = border || borderColor || background || glass

  // Contrast enforcement: if a light background is set, force dark text
  // But exempt glass/translucent backgrounds
  const isLightBg = !glass && background && isLightColor(background)
  const enforcedBg = isLightBg ? 'var(--pane-color-surface)' : background
  const textColor = isLightBg ? '#18181b' : 'var(--pane-color-text)'

  // Glass effect
  const glassStyles: CSSProperties = glass ? {
    background: background ?? 'var(--pane-glass-bg)',
    backdropFilter: 'blur(var(--pane-glass-blur))',
    WebkitBackdropFilter: 'blur(var(--pane-glass-blur))',
    border: border ?? `1px solid var(--pane-glass-border)`,
  } : {}

  // Fill protocol: stretch to fill parent cell and scroll internally
  const fillStyles: CSSProperties = fill ? {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  } : {}

  const computedStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    color: textColor,
    background: enforcedBg ?? (hasBorder && !glass ? 'var(--pane-color-surface)' : 'transparent'),
    border: border ?? (borderColor ? `1px solid ${borderColor}` : (hasBorder && !background && !glass) ? '1px solid var(--pane-color-border)' : 'none'),
    borderRadius: radius ?? '0px',
    padding: padding ?? (hasBorder ? 'var(--pane-space-md)' : 'var(--pane-space-xs)'),
    gap: gap ?? 'var(--pane-space-xs)',
    alignItems: align,
    justifyContent: justify,
    flex,
    transition: 'border-color 0.15s ease',
    ...(hovered && interactive ? {
      borderColor: 'var(--pane-color-text-muted)',
    } : {}),
    ...glassStyles,
    ...fillStyles,
    ...style,
  }

  return (
    <motion.div
      layout
      style={computedStyle}
      className={className}
      onMouseEnter={hasBorder ? () => setHovered(true) : undefined}
      onMouseLeave={hasBorder ? () => setHovered(false) : undefined}
    >
      {children}
    </motion.div>
  )
}

// Detect if a CSS color string is "light" (would need dark text for contrast)
function isLightColor(color: string): boolean {
  if (!color) return false
  // Skip CSS variables — they're from our dark theme
  if (color.startsWith('var(')) return false
  if (color === 'transparent' || color === 'inherit') return false

  // Skip translucent rgba backgrounds (glass effects, overlays)
  const alphaMatch = color.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/)
  if (alphaMatch && parseFloat(alphaMatch[1]) <= 0.5) return false

  // Parse hex
  let hex = color
  if (hex.startsWith('#')) {
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Parse rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Named colors that are light
  const lightNames = ['white', 'snow', 'ivory', 'beige', 'linen', 'oldlace', 'lightyellow', 'lightcyan', 'azure', 'mintcream', 'honeydew', 'ghostwhite', 'aliceblue', 'lavenderblush', 'seashell', 'floralwhite', 'whitesmoke', 'lavender', 'lightgoldenrodyellow', 'cornsilk', 'lemonchiffon', 'lightgray', 'lightgrey', 'gainsboro', 'mistyrose', 'antiquewhite', 'papayawhip', 'blanchedalmond', 'bisque', 'peachpuff', 'navajowhite', 'moccasin', 'wheat', 'pink', 'lightpink', 'lightsalmon', 'lightyellow']
  return lightNames.includes(color.toLowerCase())
}
