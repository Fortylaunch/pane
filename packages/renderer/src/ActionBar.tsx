// ────────────────────────────────────────────
// ActionBar — Confirm / Cancel / Progress / Completion
//
// Replaces the basic in-flight action display
// with a full lifecycle UI for tracked actions.
// ────────────────────────────────────────────

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { PaneTrackedAction } from '@pane/core'
import { PaneRuntime } from '@pane/core'

interface ActionBarProps {
  actions: PaneTrackedAction[]
  runtime: PaneRuntime
}

export function ActionBar({ actions, runtime }: ActionBarProps) {
  const proposed = actions.filter(a => a.status === 'proposed')
  const executing = actions.filter(a => a.status === 'executing')
  const completed = actions.filter(a => a.status === 'completed')
  const failed = actions.filter(a => a.status === 'failed')
  const rolledBack = actions.filter(a => a.status === 'rolled-back')

  // Track recently completed/failed/rolled-back actions to show briefly
  const [fading, setFading] = useState<Set<string>>(new Set())

  useEffect(() => {
    const terminal = [...completed, ...failed, ...rolledBack]
    const newIds = terminal.map(a => a.id).filter(id => !fading.has(id))
    if (newIds.length === 0) return

    setFading(prev => {
      const next = new Set(prev)
      newIds.forEach(id => next.add(id))
      return next
    })

    const timer = setTimeout(() => {
      setFading(prev => {
        const next = new Set(prev)
        newIds.forEach(id => next.delete(id))
        return next
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [completed.length, failed.length, rolledBack.length])

  const handleConfirm = useCallback((actionId: string) => {
    runtime.confirmAction(actionId).catch(err => {
      console.error('Action confirm error:', err)
    })
  }, [runtime])

  const handleCancel = useCallback((actionId: string) => {
    runtime.cancelAction(actionId)
  }, [runtime])

  const visibleTerminal = [...completed, ...failed, ...rolledBack].filter(a => fading.has(a.id))
  const hasContent = proposed.length > 0 || executing.length > 0 || visibleTerminal.length > 0

  if (!hasContent) return null

  return (
    <div style={containerStyle}>
      <AnimatePresence>
        {/* Proposed actions — waiting for confirmation */}
        {proposed.map(action => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={rowStyle}
          >
            <div style={rowInnerStyle}>
              <span style={proposedDotStyle} />
              <span style={labelStyle}>{action.label}</span>
              <span style={sourceStyle}>via {action.source}</span>
              {action.requiresConfirmation && (
                <span style={confirmTagStyle}>REQUIRES CONFIRM</span>
              )}
              {action.reversible && (
                <span style={reversibleTagStyle}>REVERSIBLE</span>
              )}
            </div>
            <div style={buttonGroupStyle}>
              <button
                onClick={() => handleConfirm(action.id)}
                style={confirmBtnStyle}
              >
                CONFIRM
              </button>
              <button
                onClick={() => handleCancel(action.id)}
                style={cancelBtnStyle}
              >
                CANCEL
              </button>
            </div>
          </motion.div>
        ))}

        {/* Executing actions — in progress */}
        {executing.map(action => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={rowStyle}
          >
            <div style={rowInnerStyle}>
              <span style={executingDotStyle} />
              <span style={labelStyle}>{action.label}</span>
              {action.progress !== undefined && (
                <div style={progressTrackStyle}>
                  <motion.div
                    style={progressFillStyle}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(action.progress * 100)}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              )}
              {action.progress !== undefined && (
                <span style={progressTextStyle}>
                  {Math.round(action.progress * 100)}%
                </span>
              )}
              <span style={sourceStyle}>via {action.source}</span>
              {action.startedAt && (
                <ElapsedTime startedAt={action.startedAt} />
              )}
            </div>
          </motion.div>
        ))}

        {/* Terminal actions — fade out after 3s */}
        {visibleTerminal.map(action => (
          <motion.div
            key={`terminal-${action.id}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
            style={rowStyle}
          >
            <div style={rowInnerStyle}>
              <span style={getTerminalDotStyle(action.status)} />
              <span style={labelStyle}>{action.label}</span>
              <span style={getTerminalStatusStyle(action.status)}>
                {action.status.toUpperCase()}
              </span>
              {action.duration !== undefined && (
                <span style={sourceStyle}>{action.duration}ms</span>
              )}
              {action.error && (
                <span style={errorTextStyle}>{action.error}</span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Elapsed time counter ──

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 100) / 10)
    }, 100)
    return () => clearInterval(interval)
  }, [startedAt])

  return <span style={sourceStyle}>{elapsed.toFixed(1)}s</span>
}

// ── Styles ──

const containerStyle: CSSProperties = {
  borderTop: '1px solid var(--pane-color-border)',
  background: 'var(--pane-color-surface)',
}

const rowStyle: CSSProperties = {
  padding: '5px 12px',
  borderBottom: '1px solid var(--pane-color-border)',
  overflow: 'hidden',
}

const rowInnerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '20px',
}

const labelStyle: CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text)',
  whiteSpace: 'nowrap',
}

const sourceStyle: CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text-muted)',
  whiteSpace: 'nowrap',
}

const proposedDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--pane-color-warning, #f59e0b)',
  flexShrink: 0,
}

const executingDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--pane-color-accent)',
  animation: 'pane-pulse 1.5s ease infinite',
  flexShrink: 0,
}

function getTerminalDotStyle(status: string): CSSProperties {
  const color = status === 'completed'
    ? 'var(--pane-color-success, #22c55e)'
    : status === 'failed'
    ? 'var(--pane-color-danger, #ef4444)'
    : 'var(--pane-color-text-muted)'

  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }
}

function getTerminalStatusStyle(status: string): CSSProperties {
  const color = status === 'completed'
    ? 'var(--pane-color-success, #22c55e)'
    : status === 'failed'
    ? 'var(--pane-color-danger, #ef4444)'
    : 'var(--pane-color-text-muted)'

  return {
    fontSize: '9px',
    fontFamily: 'var(--pane-font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color,
  }
}

const confirmTagStyle: CSSProperties = {
  fontSize: '8px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--pane-color-warning, #f59e0b)',
  border: '1px solid var(--pane-color-warning, #f59e0b)',
  padding: '1px 4px',
  lineHeight: 1,
}

const reversibleTagStyle: CSSProperties = {
  fontSize: '8px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--pane-color-text-muted)',
  border: '1px solid var(--pane-color-border)',
  padding: '1px 4px',
  lineHeight: 1,
}

const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginTop: '4px',
  marginLeft: '14px', // align with label (past the dot)
}

const confirmBtnStyle: CSSProperties = {
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '3px 10px',
  background: 'var(--pane-color-accent)',
  color: 'var(--pane-color-accent-text, #000)',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  lineHeight: 1,
}

const cancelBtnStyle: CSSProperties = {
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '3px 10px',
  background: 'transparent',
  color: 'var(--pane-color-text-muted)',
  border: '1px solid var(--pane-color-border)',
  cursor: 'pointer',
  fontWeight: 400,
  lineHeight: 1,
}

const progressTrackStyle: CSSProperties = {
  width: '60px',
  height: '4px',
  background: 'var(--pane-color-border)',
  overflow: 'hidden',
  flexShrink: 0,
}

const progressFillStyle: CSSProperties = {
  height: '100%',
  background: 'var(--pane-color-accent)',
}

const progressTextStyle: CSSProperties = {
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-accent)',
  minWidth: '28px',
}

const errorTextStyle: CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-danger, #ef4444)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '300px',
}
