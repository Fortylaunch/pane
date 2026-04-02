import { type CSSProperties, useMemo } from 'react'
import { motion } from 'motion/react'

interface ChartDataset {
  values: number[]
  color?: string
  label?: string
}

interface ChartData {
  labels?: string[]
  datasets: ChartDataset[]
}

interface ChartOptions {
  showGrid?: boolean
  showAxes?: boolean
  showLegend?: boolean
  stacked?: boolean
}

interface ChartProps {
  type: 'bar' | 'line' | 'area' | 'pie' | 'sparkline'
  data: ChartData
  width?: string
  height?: string
  options?: ChartOptions
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const COLORS = [
  'var(--pane-color-accent)',
  'var(--pane-color-success)',
  'var(--pane-color-warning)',
  'var(--pane-color-danger)',
  'var(--pane-color-info)',
  'var(--pane-color-text-muted)',
]

// Layout constants
const PAD_LEFT = 44
const PAD_BOTTOM = 24
const PAD_TOP = 8
const PAD_RIGHT = 8

export function Chart({
  type,
  data,
  width = '100%',
  height = '200px',
  options = {},
  style,
  className,
}: ChartProps) {
  const { showGrid = true, showAxes = true, showLegend = false, stacked = false } = options

  if (type === 'sparkline') {
    return <Sparkline data={data} width={width} height={height ?? '32px'} style={style} className={className} />
  }

  if (type === 'pie') {
    return <PieChart data={data} width={width} height={height} showLegend={showLegend} style={style} className={className} />
  }

  return (
    <div className={className} style={{ width, ...style }}>
      <svg
        viewBox="0 0 400 200"
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <CartesianChart
          type={type}
          data={data}
          showGrid={showGrid}
          showAxes={showAxes}
          stacked={stacked}
          vw={400}
          vh={200}
        />
      </svg>
      {showLegend && data.datasets.length > 1 && (
        <Legend datasets={data.datasets} />
      )}
    </div>
  )
}

// ── Cartesian (bar, line, area) ──

function CartesianChart({ type, data, showGrid, showAxes, stacked, vw, vh }: {
  type: 'bar' | 'line' | 'area'
  data: ChartData
  showGrid: boolean
  showAxes: boolean
  stacked: boolean
  vw: number
  vh: number
}) {
  const plotW = vw - PAD_LEFT - PAD_RIGHT
  const plotH = vh - PAD_TOP - PAD_BOTTOM
  const labels = data.labels ?? data.datasets[0]?.values.map((_, i) => String(i)) ?? []
  const n = labels.length

  // Compute value range
  const allValues = data.datasets.flatMap(d => d.values)
  const maxVal = Math.max(...allValues, 1)
  const minVal = Math.min(0, ...allValues)
  const range = maxVal - minVal || 1

  const yScale = (v: number) => PAD_TOP + plotH - ((v - minVal) / range) * plotH
  const xCenter = (i: number) => PAD_LEFT + (i + 0.5) * (plotW / n)

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: number[] = []
    const step = niceStep(range, 4)
    for (let v = 0; v <= maxVal; v += step) lines.push(v)
    return lines
  }, [range, maxVal])

  return (
    <g>
      {/* Grid */}
      {showGrid && gridLines.map((v, i) => (
        <g key={`grid-${i}`}>
          <line
            x1={PAD_LEFT} x2={vw - PAD_RIGHT}
            y1={yScale(v)} y2={yScale(v)}
            stroke="var(--pane-color-border)" strokeWidth={0.5} opacity={0.4}
            strokeDasharray="4 4"
          />
          {showAxes && (
            <text
              x={PAD_LEFT - 6} y={yScale(v) + 3}
              fill="var(--pane-color-text-muted)" fontSize="9"
              textAnchor="end" fontFamily="var(--pane-font-mono)"
            >
              {formatValue(v)}
            </text>
          )}
        </g>
      ))}

      {/* Axes */}
      {showAxes && (
        <>
          <line x1={PAD_LEFT} x2={PAD_LEFT} y1={PAD_TOP} y2={vh - PAD_BOTTOM} stroke="var(--pane-color-border)" strokeWidth={1} />
          <line x1={PAD_LEFT} x2={vw - PAD_RIGHT} y1={vh - PAD_BOTTOM} y2={vh - PAD_BOTTOM} stroke="var(--pane-color-border)" strokeWidth={1} />
        </>
      )}

      {/* X labels */}
      {showAxes && labels.map((label, i) => (
        <text
          key={`xlabel-${i}`}
          x={xCenter(i)} y={vh - PAD_BOTTOM + 14}
          fill="var(--pane-color-text-muted)" fontSize="9"
          textAnchor="middle" fontFamily="var(--pane-font-mono)"
        >
          {label.length > 6 ? label.slice(0, 5) + '…' : label}
        </text>
      ))}

      {/* Data */}
      {type === 'bar' && <BarSeries data={data} xCenter={xCenter} yScale={yScale} plotW={plotW} plotH={plotH} n={n} yBase={yScale(0)} />}
      {(type === 'line' || type === 'area') && <LineSeries data={data} xCenter={xCenter} yScale={yScale} plotH={plotH} type={type} yBase={yScale(0)} />}
    </g>
  )
}

function BarSeries({ data, xCenter, yScale, plotW, n, yBase }: {
  data: ChartData; xCenter: (i: number) => number; yScale: (v: number) => number
  plotW: number; plotH: number; n: number; yBase: number
}) {
  const ds = data.datasets
  const barGroupW = plotW / n * 0.7
  const barW = barGroupW / ds.length

  return (
    <g>
      {ds.map((dataset, di) => (
        <g key={`ds-${di}`}>
          {dataset.values.map((v, i) => {
            const x = xCenter(i) - barGroupW / 2 + di * barW
            const y = yScale(v)
            const h = yBase - y
            return (
              <motion.rect
                key={`bar-${di}-${i}`}
                x={x} width={barW - 1}
                rx={2}
                fill={dataset.color ?? COLORS[di % COLORS.length]}
                initial={{ y: yBase, height: 0 }}
                animate={{ y, height: Math.max(0, h) }}
                transition={{ type: 'spring', stiffness: 200, damping: 25, delay: i * 0.03 }}
              />
            )
          })}
        </g>
      ))}
    </g>
  )
}

function LineSeries({ data, xCenter, yScale, type, yBase }: {
  data: ChartData; xCenter: (i: number) => number; yScale: (v: number) => number
  plotH: number; type: 'line' | 'area'; yBase: number
}) {
  return (
    <g>
      {data.datasets.map((dataset, di) => {
        const color = dataset.color ?? COLORS[di % COLORS.length]
        const points = dataset.values.map((v, i) => `${xCenter(i)},${yScale(v)}`).join(' ')

        return (
          <g key={`line-${di}`}>
            {type === 'area' && (
              <motion.polygon
                points={`${xCenter(0)},${yBase} ${points} ${xCenter(dataset.values.length - 1)},${yBase}`}
                fill={color} opacity={0.12}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.12 }}
              />
            )}
            <motion.polyline
              points={points}
              fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            {dataset.values.map((v, i) => (
              <motion.circle
                key={`dot-${di}-${i}`}
                cx={xCenter(i)} cy={yScale(v)} r={3}
                fill="var(--pane-color-background)" stroke={color} strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              />
            ))}
          </g>
        )
      })}
    </g>
  )
}

// ── Pie Chart ──

function PieChart({ data, width, height, showLegend, style, className }: {
  data: ChartData; width: string; height: string; showLegend: boolean
  style?: CSSProperties; className?: string
}) {
  const values = data.datasets[0]?.values ?? []
  const labels = data.labels ?? values.map((_, i) => `Slice ${i + 1}`)
  const total = values.reduce((s, v) => s + v, 0) || 1
  const cx = 100, cy = 100, r = 80

  let startAngle = -Math.PI / 2
  const slices = values.slice(0, 6).map((v, i) => {
    const angle = (v / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const largeArc = angle > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    startAngle = endAngle
    return { d, color: COLORS[i % COLORS.length], label: labels[i], value: v }
  })

  return (
    <div className={className} style={{ width, ...style }}>
      <svg viewBox="0 0 200 200" width="100%" height={height} style={{ display: 'block' }}>
        {slices.map((s, i) => (
          <motion.path
            key={i} d={s.d} fill={s.color}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
      </svg>
      {showLegend && <Legend datasets={slices.map(s => ({ values: [s.value], color: s.color, label: s.label }))} />}
    </div>
  )
}

// ── Sparkline ──

function Sparkline({ data, width, height, style, className }: {
  data: ChartData; width: string; height: string; style?: CSSProperties; className?: string
}) {
  const values = data.datasets[0]?.values ?? []
  const color = data.datasets[0]?.color ?? COLORS[0]
  const max = Math.max(...values, 1)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const w = 100, h = 28

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <div className={className} style={{ width, ...style }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height ?? '32px'} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Legend ──

function Legend({ datasets }: { datasets: { color?: string; label?: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--pane-space-md)', flexWrap: 'wrap', padding: 'var(--pane-space-xs) 0' }}>
      {datasets.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--pane-space-xs)' }}>
          <div style={{ width: 8, height: 8, borderRadius: 'var(--pane-radius-full)', background: d.color ?? COLORS[i % COLORS.length] }} />
          <span style={{ fontSize: 'var(--pane-text-xs-size)', color: 'var(--pane-color-text-muted)', fontFamily: 'var(--pane-font-family)' }}>
            {d.label ?? `Series ${i + 1}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ──

function niceStep(range: number, targetSteps: number): number {
  const rough = range / targetSteps
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const normalized = rough / magnitude
  const nice = normalized <= 1.5 ? 1 : normalized <= 3.5 ? 2 : normalized <= 7.5 ? 5 : 10
  return nice * magnitude
}

function formatValue(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}
