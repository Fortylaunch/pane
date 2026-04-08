import { type CSSProperties, type ReactNode, useCallback, useState } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { motion } from 'motion/react'
import { isLightColor } from './contrast.js'

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
  wrap?: boolean             // flex-wrap (default: true for row direction)
  minChildWidth?: string     // min-width per child, e.g. "180px"
  gridColumns?: string       // explicit grid-template-columns, e.g. "repeat(3, 1fr)"
  align?: string
  justify?: string
  flex?: string
  interactive?: boolean
  glass?: boolean
  fill?: boolean
  animate?: boolean
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
  wrap,
  minChildWidth,
  gridColumns,
  align,
  justify,
  flex,
  interactive = false,
  glass = false,
  fill = false,
  animate = true,
  className,
  ...rest
}: BoxProps) {
  const [hovered, setHovered] = useState(false)
  const [autoAnimateRef] = useAutoAnimate({ duration: 150 })

  // Merge auto-animate ref with motion.div's ref
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (animate && children) {
        autoAnimateRef(node)
      }
    },
    [animate, children, autoAnimateRef],
  )

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

  // Row direction defaults to flex-wrap to prevent child compression
  const shouldWrap = wrap ?? (direction === 'row')

  // Grid layout: explicit columns take precedence, then auto-fill via minChildWidth
  const useGrid = !!gridColumns || (!!minChildWidth && direction === 'row')

  const layoutStyles: CSSProperties = useGrid
    ? {
        display: 'grid',
        gridTemplateColumns: gridColumns ?? `repeat(auto-fill, minmax(${minChildWidth}, 1fr))`,
      }
    : { display: 'flex', flexDirection: direction, flexWrap: shouldWrap ? 'wrap' : 'nowrap' }

  const computedStyle: CSSProperties = {
    ...layoutStyles,
    color: textColor,
    background: enforcedBg ?? (hasBorder && !glass ? 'var(--pane-color-surface)' : 'transparent'),
    border: border ?? (borderColor ? `1px solid ${borderColor}` : (hasBorder && !background && !glass) ? '1px solid var(--pane-color-border)' : 'none'),
    borderRadius: radius ?? '0px',
    padding: padding ?? (hasBorder ? 'var(--pane-space-md)' : 'var(--pane-space-xs)'),
    gap: gap ?? 'var(--pane-space-xs)',
    alignItems: useGrid ? undefined : align,
    justifyContent: useGrid ? undefined : justify,
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
      ref={mergedRef}
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
