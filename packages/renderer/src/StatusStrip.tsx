// ────────────────────────────────────────────
// StatusStrip
//
// Fixed strip that shows operation lifecycle.
// Reads session.operations from the runtime.
// Renders running/error/timeout states with
// contextual messages and retry affordance.
// ────────────────────────────────────────────

import type { PaneOperation } from '@pane/core'
import { AnimatePresence, motion } from 'motion/react'
import type { CSSProperties } from 'react'

interface StatusStripProps {
  operations: PaneOperation[]
  onDismiss?: (id: string) => void
  onRetry?: () => void
}

export function StatusStrip({ operations, onDismiss, onRetry }: StatusStripProps) {
  const running = operations.filter(op => op.status === 'running')
  const errors = operations.filter(op => op.status === 'error' || op.status === 'timeout')
  const completed = operations.filter(op => op.status === 'complete')

  const hasContent = running.length > 0 || errors.length > 0 || completed.length > 0

  if (!hasContent) return null

  return (
    <div style={stripContainerStyle}>
      <AnimatePresence mode="popLayout">
        {/* Running operations */}
        {running.map(op => (
          <motion.div
            key={op.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={runningItemStyle}
          >
            <div style={shimmerBgStyle} />
            <span style={dotRunningStyle} />
            <span style={messageStyle}>{op.message}</span>
            <span style={elapsedStyle}>
              <ElapsedTime startedAt={op.startedAt} />
            </span>
          </motion.div>
        ))}

        {/* Completed operations — brief flash before removal */}
        {completed.map(op => (
          <motion.div
            key={op.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={completedItemStyle}
          >
            <span style={dotCompleteStyle} />
            <span style={messageStyle}>{op.message}</span>
            <span style={doneLabel}>done</span>
          </motion.div>
        ))}

        {/* Errors and timeouts */}
        {errors.map(op => (
          <motion.div
            key={op.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            style={op.status === 'timeout' ? timeoutItemStyle : errorItemStyle}
          >
            <span style={op.status === 'timeout' ? dotTimeoutStyle : dotErrorStyle} />
            <span style={messageStyle}>
              {op.message} — {op.error}
            </span>
            <div style={errorActionsStyle}>
              {onRetry && (
                <button onClick={onRetry} style={retryBtnStyle}>
                  Retry
                </button>
              )}
              {onDismiss && (
                <button onClick={() => onDismiss(op.id)} style={dismissBtnStyle}>
                  Dismiss
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Elapsed timer ──

import { useState, useEffect } from 'react'

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000))
    }, 1000)
    setElapsed(Math.round((Date.now() - startedAt) / 1000))
    return () => clearInterval(interval)
  }, [startedAt])

  return <>{elapsed}s</>
}

// ── Styles ──

const stripContainerStyle: CSSProperties = {
  borderTop: '1px solid var(--pane-color-border)',
  background: 'var(--pane-color-surface)',
  overflow: 'hidden',
}

const baseItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 12px',
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  position: 'relative',
  overflow: 'hidden',
}

const runningItemStyle: CSSProperties = {
  ...baseItemStyle,
  color: 'var(--pane-color-accent)',
}

const completedItemStyle: CSSProperties = {
  ...baseItemStyle,
  color: 'var(--pane-color-success)',
  opacity: 0.7,
}

const errorItemStyle: CSSProperties = {
  ...baseItemStyle,
  color: 'var(--pane-color-danger)',
  background: 'rgba(239, 68, 68, 0.04)',
}

const timeoutItemStyle: CSSProperties = {
  ...baseItemStyle,
  color: 'var(--pane-color-warning)',
  background: 'rgba(245, 158, 11, 0.04)',
}

const shimmerBgStyle: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.06) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
  animation: 'pane-shimmer 1.5s ease infinite',
  pointerEvents: 'none',
}

const dotBase: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
}

const dotRunningStyle: CSSProperties = {
  ...dotBase,
  background: 'var(--pane-color-accent)',
  animation: 'pane-pulse 1.5s ease infinite',
}

const dotCompleteStyle: CSSProperties = {
  ...dotBase,
  background: 'var(--pane-color-success)',
}

const dotErrorStyle: CSSProperties = {
  ...dotBase,
  background: 'var(--pane-color-danger)',
}

const dotTimeoutStyle: CSSProperties = {
  ...dotBase,
  background: 'var(--pane-color-warning)',
}

const messageStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const elapsedStyle: CSSProperties = {
  marginLeft: 'auto',
  opacity: 0.5,
  position: 'relative',
  zIndex: 1,
}

const doneLabel: CSSProperties = {
  marginLeft: 'auto',
  opacity: 0.5,
}

const errorActionsStyle: CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  gap: '4px',
}

const btnBase: CSSProperties = {
  padding: '1px 6px',
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  border: '1px solid',
  borderRadius: '2px',
  cursor: 'pointer',
  background: 'transparent',
}

const retryBtnStyle: CSSProperties = {
  ...btnBase,
  color: 'var(--pane-color-accent)',
  borderColor: 'var(--pane-color-accent)',
}

const dismissBtnStyle: CSSProperties = {
  ...btnBase,
  color: 'var(--pane-color-text-muted)',
  borderColor: 'var(--pane-color-border)',
}
