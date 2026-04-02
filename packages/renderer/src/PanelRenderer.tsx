import { useState, type CSSProperties } from 'react'
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
import { expandRecipe } from './recipes/index.js'

interface PanelRendererProps {
  panel: PanePanel
  onAction?: (event: string, panelId: string, payload?: Record<string, unknown>) => void
  onFeedback?: (panelId: string, type: 'positive' | 'negative', source: string) => void
}

// Spring configs
const PANEL_SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function PanelRenderer({ panel: rawPanel, onAction, onFeedback }: PanelRendererProps) {
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
          <Box {...props as any}>
            {renderedChildren}
          </Box>
        )

      case 'text':
        return <Text content={String(props.content ?? '')} level={props.level as any} {...props as any} />

      case 'image':
        return <Image src={String(props.src ?? '')} {...props as any} />

      case 'input':
        return (
          <Input
            {...props as any}
            onSubmit={handlers['submit'] ? (v) => { handlers['submit'](); onAction?.('submit', panel.id, { value: v }) } : (v) => onAction?.('submit', panel.id, { value: v })}
            onChange={handlers['change'] ? (v) => { handlers['change'](); onAction?.('change', panel.id, { value: v }) } : undefined}
          />
        )

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

      default:
        return <div style={{ color: 'var(--pane-color-danger)', fontSize: 'var(--pane-text-xs-size)' }}>Unknown atom: {atom}</div>
    }
  })()

  // Only show feedback on top-level container panels with children (not leaf atoms)
  const canFeedback = onFeedback && panel.atom === 'box' && panel.children && panel.children.length > 0

  return (
    <motion.div
      layout
      layoutId={panel.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={PANEL_SPRING}
      style={{
        position: 'relative',
        paddingLeft: emphasis ? 'var(--pane-space-sm)' : undefined,
        ...emphasisStyle,
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
