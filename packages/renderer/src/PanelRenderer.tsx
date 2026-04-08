import { Component, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { PanePanel } from '@pane/core'
import { Box } from './atoms/Box.js'
import { Text } from './atoms/Text.js'
import { Image } from './atoms/Image.js'
import { Input } from './atoms/Input.js'
import { Shape } from './atoms/Shape.js'
import { Frame } from './atoms/Frame.js'
import { Icon } from './atoms/Icon.js'
import { Spacer } from './atoms/Spacer.js'
import { Badge } from './atoms/Badge.js'
import { Divider } from './atoms/Divider.js'
import { Progress } from './atoms/Progress.js'
import { List } from './atoms/List.js'
import { Chart } from './atoms/Chart.js'
import { Skeleton } from './atoms/Skeleton.js'
import { Pill } from './atoms/Pill.js'
import { Map } from './atoms/Map.js'
import { expandRecipe } from './recipes/index.js'

interface PanelRendererProps {
  panel: PanePanel
  onAction?: (event: string, panelId: string, payload?: Record<string, unknown>) => void
  onFeedback?: (panelId: string, type: 'positive' | 'negative', source: string) => void
  /** Set by parent Layout when this panel is a direct child of a stretch layout */
  fill?: boolean
  /** Mutation type hint for animation overrides */
  mutationHint?: string
}

// Spring configs
const PANEL_SPRING = { type: 'spring' as const, stiffness: 400, damping: 35 }

// ── Per-panel error boundary ──
// Catches render errors in a single panel so they don't blank the whole view.
// Renders a small inline error card with the panel id and error message.
// React requires class components for error boundaries.

interface PanelErrorBoundaryProps {
  panelId: string
  panelAtom: string
  children: ReactNode
}

interface PanelErrorBoundaryState {
  error: Error | null
}

class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[pane] Panel "${this.props.panelId}" (${this.props.panelAtom}) crashed:`, error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={errorPanelStyle}>
          <div style={errorPanelLabelStyle}>RENDER ERROR · {this.props.panelAtom}</div>
          <div style={errorPanelIdStyle}>{this.props.panelId}</div>
          <div style={errorPanelMessageStyle}>{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

const errorPanelStyle: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--pane-color-danger, #ef4444)',
  background: 'rgba(239, 68, 68, 0.06)',
  fontFamily: 'var(--pane-font-mono)',
  fontSize: 11,
  color: 'var(--pane-color-text)',
  overflow: 'hidden',
}

const errorPanelLabelStyle: CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: 'var(--pane-color-danger, #ef4444)',
  marginBottom: 4,
}

const errorPanelIdStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--pane-color-text-muted)',
  marginBottom: 4,
}

const errorPanelMessageStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--pane-color-text-muted)',
  wordBreak: 'break-word',
}

export function PanelRenderer(props: PanelRendererProps) {
  // Wrap each panel in an error boundary so a single bad panel can't blank
  // the entire view. The boundary catches render errors and shows an inline
  // error card with the panel id and message — surgical, not catastrophic.
  return (
    <PanelErrorBoundary panelId={props.panel.id} panelAtom={props.panel.atom}>
      <PanelRendererInner {...props} />
    </PanelErrorBoundary>
  )
}

function PanelRendererInner({ panel: rawPanel, onAction, onFeedback, fill, mutationHint }: PanelRendererProps) {
  // Expand recipe to atom tree if present
  const panel = rawPanel.recipe ? expandRecipe(rawPanel) : rawPanel
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null)
  const { atom, props, children, emphasis, on } = panel

  // Build event handlers from `on` bindings
  const handlers: Record<string, () => void> = {}
  if (on) {
    for (const [event, actionId] of Object.entries(on)) {
      handlers[event] = () => onAction?.(actionId, panel.id)
    }
  }

  // Render children recursively
  const renderedChildren = children?.map(child => (
    <PanelRenderer key={child.id} panel={child} onAction={onAction} onFeedback={onFeedback} />
  ))

  // Emphasis styles
  const emphasisStyle = emphasis === 'urgent'
    ? { borderLeft: '3px solid var(--pane-color-danger)', background: 'rgba(239, 68, 68, 0.05)' }
    : emphasis === 'primary'
    ? { borderLeft: '3px solid var(--pane-color-accent)', background: 'rgba(59, 130, 246, 0.05)' }
    : emphasis === 'muted'
    ? { opacity: 0.6 }
    : {}

  const content = (() => {
    switch (atom) {
      case 'box':
        return (
          <Box {...props as any} fill={fill}>
            {renderedChildren}
          </Box>
        )

      case 'text':
        return <Text content={String(props.content ?? '')} level={props.level as any} {...props as any} />

      case 'image':
        return <Image src={String(props.src ?? '')} {...props as any} />

      case 'input': {
        // Text-like inputs: change events are LOCAL ONLY. Every keystroke
        // would otherwise hit the agent → 8 concurrent Claude calls per
        // typed character. Only `submit` (Enter, button click) reaches
        // the agent for these types.
        //
        // Discrete-choice inputs (toggle, select, date): change is a
        // meaningful user decision and DOES reach the agent.
        const inputType = String((props as any).type ?? 'text')
        const isLocalChange = inputType === 'text' || inputType === 'textarea' || inputType === 'number'

        return (
          <Input
            {...props as any}
            onSubmit={(v) => {
              if (handlers['submit']) {
                handlers['submit']()
              } else {
                onAction?.('submit', panel.id, { value: v })
              }
            }}
            onChange={isLocalChange ? undefined : (v) => {
              if (handlers['change']) {
                handlers['change']()
              } else {
                onAction?.('change', panel.id, { value: v })
              }
            }}
          />
        )
      }

      case 'shape':
        return <Shape shape={String(props.shape ?? 'line') as any} {...props as any} />

      case 'frame':
        return <Frame {...props as any} />

      case 'icon':
        return <Icon name={String(props.name ?? '')} {...props as any} />

      case 'spacer':
        return <Spacer {...props as any} />

      case 'badge':
        return <Badge label={String(props.label ?? '')} {...props as any} />

      case 'divider':
        return <Divider {...props as any} />

      case 'progress':
        return <Progress value={Number(props.value ?? 0)} {...props as any} />

      case 'list':
        return <List items={(props.items ?? []) as string[]} {...props as any} />

      case 'chart':
        return <Chart type={String(props.type ?? 'bar') as any} data={props.data as any} {...props as any} />

      case 'skeleton':
        return <Skeleton {...props as any} />

      case 'pill':
        return <Pill label={String(props.label ?? '')} {...props as any} onToggle={handlers['toggle']} />

      case 'map':
        return <Map center={(props.center ?? [0, 0]) as [number, number]} {...props as any} />

      default:
        // Fallback recovery: render as box with a caption identifying the unknown atom
        console.warn(`[pane] Unknown atom "${atom}" in panel "${panel.id}" — rendering as box`)
        return (
          <Box {...props as any}>
            {renderedChildren}
          </Box>
        )
    }
  })()

  // Only show feedback on top-level container panels with children (not leaf atoms)
  const canFeedback = onFeedback && panel.atom === 'box' && panel.children && panel.children.length > 0

  return (
    <motion.div
      layout
      layoutId={panel.id}
      initial={mutationHint === 'UPDATE_PANELS' ? { opacity: 0.7 } : { opacity: 0, y: 4 }}
      animate={mutationHint === 'UPDATE_PANELS' ? { opacity: [0.7, 1] } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={mutationHint === 'REORDER_PANELS' ? { layout: { type: 'spring', stiffness: 300, damping: 30 } } : PANEL_SPRING}
      style={{
        position: 'relative',
        paddingLeft: emphasis ? 'var(--pane-space-sm)' : undefined,
        ...emphasisStyle,
        // Fill protocol: stretch wrapper to fill parent cell
        ...(fill ? { flex: 1, minHeight: 0, overflow: 'hidden' } : {}),
      }}
      onMouseEnter={() => canFeedback && setShowFeedback(true)}
      onMouseLeave={() => setShowFeedback(false)}
    >
      {content}

      {/* Feedback — subtle, appears on hover of container panels only */}
      {canFeedback && showFeedback && !feedbackGiven && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          style={feedbackControlsStyle}
        >
          <button
            style={feedbackBtnStyle}
            onClick={(e) => { e.stopPropagation(); setFeedbackGiven('positive'); onFeedback(panel.id, 'positive', panel.source) }}
            title="This is helpful"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            ▲
          </button>
          <button
            style={feedbackBtnStyle}
            onClick={(e) => { e.stopPropagation(); setFeedbackGiven('negative'); onFeedback(panel.id, 'negative', panel.source) }}
            title="Not useful"
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            ▼
          </button>
        </motion.div>
      )}
      {feedbackGiven && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          style={{ ...feedbackControlsStyle, padding: '2px 5px', fontSize: '9px', color: 'var(--pane-color-text-muted)' }}
        >
          ✓
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Feedback Styles ──

const feedbackControlsStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  zIndex: 10,
}

const feedbackBtnStyle: CSSProperties = {
  width: 16,
  height: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--pane-color-text-muted)',
  cursor: 'pointer',
  fontSize: '8px',
  fontFamily: 'inherit',
  opacity: 0.6,
  transition: 'opacity 0.15s ease',
  padding: 0,
}
