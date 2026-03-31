import type { CSSProperties } from 'react'

type ShapeType = 'line' | 'rect' | 'circle' | 'arc' | 'path'

interface ShapeProps {
  shape: ShapeType
  width?: string
  height?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  // Line
  x1?: number; y1?: number; x2?: number; y2?: number
  // Circle
  cx?: number; cy?: number; r?: number
  // Rect
  x?: number; y?: number; rx?: number
  // Path
  d?: string
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

export function Shape({ shape, width = '100%', height = '64', fill = 'none', stroke = 'var(--pane-color-accent)', strokeWidth = 2, style, className, ...rest }: ShapeProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${typeof width === 'string' && width.endsWith('%') ? 200 : parseInt(width)} ${parseInt(height)}`}
      style={{ display: 'block', ...style }}
      className={className}
    >
      {shape === 'line' && (
        <line x1={rest.x1 ?? 0} y1={rest.y1 ?? 0} x2={rest.x2 ?? 200} y2={rest.y2 ?? 0} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shape === 'rect' && (
        <rect x={rest.x ?? 0} y={rest.y ?? 0} width="100%" height="100%" rx={rest.rx ?? 4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shape === 'circle' && (
        <circle cx={rest.cx ?? 32} cy={rest.cy ?? 32} r={rest.r ?? 24} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
      {shape === 'path' && rest.d && (
        <path d={rest.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      )}
    </svg>
  )
}
