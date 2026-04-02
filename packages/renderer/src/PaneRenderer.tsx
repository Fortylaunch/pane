import { usePaneSession, usePaneTheme, usePaneRuntime } from './context.js'
import { PanelRenderer } from './PanelRenderer.js'
import { Layout } from './layout/Layout.js'
import { Input } from './atoms/Input.js'
import { themeToStyleString } from '@pane/theme'
import { createInput, createFeedback, LAYOUT_FILL_DEFAULTS } from '@pane/core'
import { useCallback, useState, useMemo, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TelemetryDrawer } from './TelemetryDrawer.js'

interface PaneRendererProps {
  proxyUrl?: string
}

export function PaneRenderer({ proxyUrl }: PaneRendererProps = {}) {
  const session = usePaneSession()
  const theme = usePaneTheme()
  const runtime = usePaneRuntime()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showObservability, setShowObservability] = useState(false)

  const activeContext = session.contexts.find(c => c.id === session.activeContext)
  const modality = activeContext?.modality ?? 'conversational'
  const hasMultipleContexts = session.contexts.length > 1

  const handleAction = useCallback((event: string, panelId: string, payload?: Record<string, unknown>) => {
    const input = createInput(`__action:${event}:${panelId}`, 'text', session.actions)
    runtime.handleInput(input).catch(err => {
      console.error('Pane action error:', err)
      setError(String(err))
    })
  }, [runtime, session.actions])

  const handleUserInput = useCallback(async (value: string) => {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    try {
      const input = createInput(value, 'text', session.actions)
      await runtime.handleInput(input)
    } catch (err) {
      console.error('Pane input error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [runtime, session.actions])

  const handleFeedback = useCallback((panelId: string, type: 'positive' | 'negative', agentSource: string) => {
    if (!activeContext) return
    const feedback = createFeedback(
      type,
      type === 'positive' ? 'Helpful' : 'Not useful',
      activeContext.view,
      { panelId, contextId: activeContext.id, agentId: agentSource }
    )
    runtime.addFeedback(feedback)
  }, [runtime, activeContext])

  // Modality-adaptive input config
  const inputConfig = useMemo(() => {
    switch (modality) {
      case 'conversational':
        return { placeholder: 'Type a message...', size: 'large' as const, position: 'bottom' as const }
      case 'informational':
        return { placeholder: 'Ask about this data...', size: 'compact' as const, position: 'bottom' as const }
      case 'compositional':
        return { placeholder: 'Describe what to create...', size: 'large' as const, position: 'bottom' as const }
      case 'transactional':
        return { placeholder: 'Confirm or adjust...', size: 'compact' as const, position: 'bottom' as const }
      case 'collaborative':
        return { placeholder: 'Add feedback...', size: 'large' as const, position: 'bottom' as const }
      case 'environmental':
        return { placeholder: 'Command...', size: 'compact' as const, position: 'bottom' as const }
      default:
        return { placeholder: 'What do you need?', size: 'large' as const, position: 'bottom' as const }
    }
  }, [modality])

  const workingAgents = session.agents.filter(a => a.state === 'working')
  const completedActions = session.actions.filter(a => a.status === 'completed')
  const inFlightActions = session.actions.filter(a => a.status === 'executing')

  // Eval feedback
  const evalResult = runtime.getLastEvalResult?.()
  const evalIssues = evalResult?.findings?.filter((f: any) => f.grade !== 'pass') ?? []
  const [showEval, setShowEval] = useState(false)
  const [specEvalOn, setSpecEvalOn] = useState(() => runtime.isSpecEvalEnabled?.() ?? false)
  const [visualEvalOn, setVisualEvalOn] = useState(() => runtime.isVisualEvalEnabled?.() ?? false)
  const [designReviewOn, setDesignReviewOn] = useState(() => runtime.isDesignReviewEnabled?.() ?? false)

  const toggleSpecEval = useCallback(() => {
    const next = !specEvalOn
    setSpecEvalOn(next)
    runtime.setSpecEvalEnabled?.(next)
  }, [specEvalOn, runtime])

  const toggleVisualEval = useCallback(() => {
    const next = !visualEvalOn
    setVisualEvalOn(next)
    runtime.setVisualEvalEnabled?.(next)
  }, [visualEvalOn, runtime])

  const toggleDesignReview = useCallback(() => {
    const next = !designReviewOn
    setDesignReviewOn(next)
    runtime.setDesignReviewEnabled?.(next)
  }, [designReviewOn, runtime])

  return (
    <div style={shellStyle} data-pane-root>
    <div style={rootStyle}>
      <style>{`
        :root { ${themeToStyleString(theme)} }
        @keyframes pane-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes pane-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--pane-color-border); border-radius: 0; }
      `}</style>

      {/* Context tabs — show when multiple contexts exist */}
      <AnimatePresence>
        {hasMultipleContexts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={contextTabsStyle}
          >
            {session.contexts.map(ctx => (
              <button
                key={ctx.id}
                onClick={() => {
                  const input = createInput(`__context:activate:${ctx.id}`, 'text', session.actions)
                  runtime.handleInput(input)
                }}
                style={{
                  ...contextTabStyle,
                  ...(ctx.id === session.activeContext ? contextTabActiveStyle : {}),
                  ...(ctx.status === 'preparing' ? { opacity: 0.5 } : {}),
                }}
              >
                <span style={modalityDotStyle(ctx.modality)} />
                {ctx.label || ctx.id}
              </button>
            ))}

            {/* Observability toggle */}
            <button
              onClick={() => setShowObservability(v => !v)}
              style={{ ...contextTabStyle, marginLeft: 'auto', fontSize: '11px', opacity: 0.6 }}
            >
              {showObservability ? 'Hide' : 'Status'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Observability panel */}
      <AnimatePresence>
        {showObservability && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={observabilityStyle}
          >
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {/* Agents */}
              <div>
                <div style={obsLabelStyle}>Agents</div>
                {session.agents.length === 0 && <span style={obsMutedStyle}>None</span>}
                {session.agents.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: a.state === 'working' ? 'var(--pane-color-accent)'
                        : a.state === 'error' ? 'var(--pane-color-danger)'
                        : 'var(--pane-color-text-muted)',
                    }} />
                    <span>{a.name}</span>
                    <span style={obsMutedStyle}>{a.state}{a.currentTask ? `: ${a.currentTask}` : ''}</span>
                    {a.latency && <span style={obsMutedStyle}>{a.latency}ms</span>}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div>
                <div style={obsLabelStyle}>Actions</div>
                {session.actions.length === 0 && <span style={obsMutedStyle}>None</span>}
                {session.actions.slice(-5).map(a => (
                  <div key={a.id} style={{ fontSize: '11px', display: 'flex', gap: '8px' }}>
                    <span style={{
                      color: a.status === 'completed' ? 'var(--pane-color-success)'
                        : a.status === 'failed' ? 'var(--pane-color-danger)'
                        : a.status === 'executing' ? 'var(--pane-color-accent)'
                        : 'var(--pane-color-text-muted)',
                    }}>{a.status}</span>
                    <span>{a.label}</span>
                    {a.duration && <span style={obsMutedStyle}>{a.duration}ms</span>}
                    <span style={obsMutedStyle}>via {a.source}</span>
                  </div>
                ))}
              </div>

              {/* Artifacts */}
              {session.artifacts.length > 0 && (
                <div>
                  <div style={obsLabelStyle}>Artifacts</div>
                  {session.artifacts.map(a => (
                    <div key={a.id} style={{ fontSize: '11px', display: 'flex', gap: '8px' }}>
                      <span>{a.label}</span>
                      <span style={obsMutedStyle}>{a.location}</span>
                      <span style={obsMutedStyle}>{typeof a.retention === 'string' ? a.retention : 'expires'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Session */}
              <div>
                <div style={obsLabelStyle}>Session</div>
                <div style={{ fontSize: '11px', color: 'var(--pane-color-text-muted)' }}>
                  v{session.version} · {session.contexts.length} ctx · {session.conversation.length} msgs · {session.feedback.length} feedback
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar — always visible */}
      <div style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {activeContext ? (
            <>
              <span style={modalityDotStyle(modality)} />
              <span style={{ fontSize: '10px', fontFamily: 'var(--pane-font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pane-color-text-muted)' }}>
                {activeContext.label || modality}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '10px', fontFamily: 'var(--pane-font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pane-color-text-muted)' }}>
              PANE
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onClick={toggleSpecEval} style={{ ...toggleBtnStyle, color: specEvalOn ? 'var(--pane-color-accent)' : 'var(--pane-color-text-muted)' }}>
            6D {specEvalOn ? 'ON' : 'OFF'}
          </button>
          <button onClick={toggleVisualEval} style={{ ...toggleBtnStyle, color: visualEvalOn ? 'var(--pane-color-accent)' : 'var(--pane-color-text-muted)' }}>
            VIS {visualEvalOn ? 'ON' : 'OFF'}
          </button>
          <button onClick={toggleDesignReview} style={{ ...toggleBtnStyle, color: designReviewOn ? 'var(--pane-color-accent)' : 'var(--pane-color-text-muted)' }}>
            REV {designReviewOn ? 'ON' : 'OFF'}
          </button>
          {evalResult && specEvalOn && (
            <button
              onClick={() => setShowEval(v => !v)}
              style={{
                ...toggleBtnStyle,
                color: evalResult.overallGrade === 'pass' ? 'var(--pane-color-success)'
                  : evalResult.overallGrade === 'warn' ? 'var(--pane-color-warning)'
                  : 'var(--pane-color-danger)',
              }}
            >
              {evalResult.overallGrade.toUpperCase()} · {evalIssues.length}
            </button>
          )}
        </div>
      </div>

      {/* Eval findings panel */}
      <AnimatePresence>
        {showEval && specEvalOn && evalIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={evalBarStyle}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'var(--pane-font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                EVAL FINDINGS
              </span>
            </div>
            {evalIssues.slice(0, 6).map((issue: any, i: number) => (
              <div key={i} style={{ fontSize: '10px', fontFamily: 'var(--pane-font-mono)', display: 'flex', gap: '6px', padding: '2px 0', color: issue.grade === 'fail' ? 'var(--pane-color-danger)' : 'var(--pane-color-warning)' }}>
                <span style={{ opacity: 0.6 }}>[{issue.dimension}]</span>
                <span>{issue.message}</span>
                {issue.suggestion && <span style={{ color: 'var(--pane-color-text-muted)' }}>→ {issue.suggestion}</span>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* View area — overflow adapts to layout fill contract */}
      <div style={getViewAreaStyle(activeContext?.view?.layout)} data-pane-view>
        <AnimatePresence mode="wait">
          {activeContext ? (
            <motion.div
              key={activeContext.id + '-' + session.version}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={getViewContentStyle(modality)}
            >
              <Layout config={activeContext.view.layout}>
                {activeContext.view.panels.map(panel => {
                  const layoutDefaults = LAYOUT_FILL_DEFAULTS[activeContext.view.layout.pattern as keyof typeof LAYOUT_FILL_DEFAULTS]
                  const layoutFill = activeContext.view.layout.fill ?? layoutDefaults?.fill ?? 'start'
                  return (
                    <PanelRenderer key={panel.id} panel={panel} onAction={handleAction} onFeedback={handleFeedback} fill={layoutFill === 'stretch'} />
                  )
                })}
              </Layout>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={emptyStateStyle}
            >
              <div style={logoStyle}>Pane</div>
              <div style={subtitleStyle}>Type below and press Enter</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* In-flight actions */}
      <AnimatePresence>
        {inFlightActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={actionBarStyle}
          >
            {inFlightActions.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={pulsingDotStyle} />
                <span>{a.label}</span>
                {a.progress !== undefined && (
                  <div style={progressBarOuter}>
                    <motion.div
                      style={progressBarInner}
                      initial={{ width: 0 }}
                      animate={{ width: `${a.progress * 100}%` }}
                    />
                  </div>
                )}
                <span style={obsMutedStyle}>via {a.source}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading bar */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={loadingBarStyle}
          >
            <div style={shimmerStyle} />
            <span style={{ position: 'relative', zIndex: 1 }}>Working...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={errorBarStyle}
            onClick={() => setError(null)}
          >
            {error} <span style={{ opacity: 0.5 }}>(click to dismiss)</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent status */}
      <AnimatePresence>
        {workingAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={statusBarStyle}
          >
            {workingAgents.map(a => (
              <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={pulsingDotStyle} />
                {a.name}: {a.currentTask ?? 'working...'}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={inputBarStyle}>
        <Input
          type="text"
          placeholder={loading ? 'Working...' : inputConfig.placeholder}
          onSubmit={handleUserInput}
          style={{
            background: 'var(--pane-color-background)',
            opacity: loading ? 0.5 : 1,
          }}
        />
      </div>
    </div>

    {/* Sidebar — telemetry + design chat */}
    <TelemetryDrawer proxyUrl={proxyUrl} />
    </div>
  )
}

const shellStyle: CSSProperties = {
  width: '100%',
  height: '100vh',
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden',
  background: 'var(--pane-color-background)',
}

// ── Styles ──

const rootStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--pane-color-background)',
  color: 'var(--pane-color-text)',
  fontFamily: 'var(--pane-font-family)',
  overflow: 'hidden',
  transition: 'flex 0.3s ease',
}

const topBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '3px 12px',
  borderBottom: '1px solid var(--pane-color-border)',
  background: 'var(--pane-color-surface)',
  minHeight: '24px',
}

const evalBarStyle: CSSProperties = {
  padding: '6px 12px',
  background: 'var(--pane-color-surface)',
  borderBottom: '1px solid var(--pane-color-border)',
  overflow: 'hidden',
}

/**
 * View area adapts to the layout's fill contract:
 * - 'stretch' layouts: view area doesn't scroll — children fill it and manage own overflow
 * - 'start' layouts: view area scrolls — content flows naturally and overflows vertically
 */
function getViewAreaStyle(layout?: { pattern: string; fill?: string }): CSSProperties {
  const pattern = (layout?.pattern ?? 'stack') as keyof typeof LAYOUT_FILL_DEFAULTS
  const defaults = LAYOUT_FILL_DEFAULTS[pattern] ?? LAYOUT_FILL_DEFAULTS.stack
  const fill = layout?.fill ?? defaults.fill
  const isStretch = fill === 'stretch'

  return {
    flex: 1,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    // Fill contract: stretch layouts don't scroll at the view level
    overflow: isStretch ? 'hidden' : 'auto',
  }
}

// Modality-driven content sizing — conversational gets a centered column,
// informational/environmental fill the viewport, others get a comfortable max-width
function getViewContentStyle(modality: string): CSSProperties {
  const base: CSSProperties = { width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }

  switch (modality) {
    case 'conversational':
      return { ...base, maxWidth: '680px', margin: '0 auto', overflow: 'auto' }
    case 'compositional':
      return { ...base, maxWidth: '900px', margin: '0 auto', overflow: 'auto' }
    case 'informational':
    case 'environmental':
    case 'collaborative':
      return { ...base } // full width, overflow handled by children
    case 'transactional':
      return { ...base, maxWidth: '560px', margin: '0 auto', overflow: 'auto' }
    default:
      return { ...base, maxWidth: '800px', margin: '0 auto', overflow: 'auto' }
  }
}

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  gap: '12px',
}

const logoStyle: CSSProperties = {
  fontSize: '2.5rem',
  fontWeight: 700,
  letterSpacing: '-0.03em',
  background: 'linear-gradient(135deg, var(--pane-color-text) 0%, var(--pane-color-text-muted) 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const subtitleStyle: CSSProperties = {
  fontSize: 'var(--pane-text-sm-size)',
  color: 'var(--pane-color-text-muted)',
}

const inputBarStyle: CSSProperties = {
  padding: '4px 8px',
  borderTop: '1px solid var(--pane-color-border)',
  background: 'var(--pane-color-surface)',
}

const contextTabsStyle: CSSProperties = {
  display: 'flex',
  gap: '0px',
  padding: '0 8px',
  background: 'var(--pane-color-surface)',
  borderBottom: '1px solid var(--pane-color-border)',
  overflowX: 'auto',
}

const contextTabStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--pane-color-text-muted)',
  background: 'transparent',
  border: 'none',
  borderRadius: '0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s ease, background 0.15s ease',
}

const contextTabActiveStyle: CSSProperties = {
  color: 'var(--pane-color-accent-text)',
  background: 'var(--pane-color-accent)',
}

const MODALITY_COLORS: Record<string, string> = {
  conversational: '#3b82f6',
  informational: '#22c55e',
  compositional: '#f59e0b',
  transactional: '#ef4444',
  collaborative: '#a855f7',
  environmental: '#06b6d4',
}

function modalityDotStyle(modality: string): CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: MODALITY_COLORS[modality] ?? 'var(--pane-color-text-muted)',
    display: 'inline-block',
    flexShrink: 0,
  }
}

const toggleBtnStyle: CSSProperties = {
  padding: '2px 6px',
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 0.15s ease',
}

const observabilityStyle: CSSProperties = {
  padding: '6px 12px',
  background: 'var(--pane-color-surface)',
  borderBottom: '1px solid var(--pane-color-border)',
  overflow: 'hidden',
}

const obsLabelStyle: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--pane-color-text-muted)',
  marginBottom: '4px',
}

const obsMutedStyle: CSSProperties = {
  color: 'var(--pane-color-text-muted)',
  fontSize: '11px',
}

const loadingBarStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '12px',
  color: 'var(--pane-color-accent)',
  background: 'var(--pane-color-surface)',
  borderTop: '1px solid var(--pane-color-border)',
  position: 'relative',
  overflow: 'hidden',
}

const shimmerStyle: CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.08) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
  animation: 'pane-shimmer 1.5s ease infinite',
}

const errorBarStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '10px',
  color: 'var(--pane-color-danger)',
  background: 'rgba(239, 68, 68, 0.06)',
  borderTop: '1px solid rgba(239, 68, 68, 0.2)',
  cursor: 'pointer',
}

const statusBarStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '10px',
  color: 'var(--pane-color-text-muted)',
  background: 'var(--pane-color-surface)',
  borderTop: '1px solid var(--pane-color-border)',
  display: 'flex',
  gap: '16px',
}

const actionBarStyle: CSSProperties = {
  padding: '4px 12px',
  fontSize: '10px',
  color: 'var(--pane-color-text)',
  background: 'var(--pane-color-surface)',
  borderTop: '1px solid var(--pane-color-border)',
}

const pulsingDotStyle: CSSProperties = {
  width: 6, height: 6,
  borderRadius: '50%',
  background: 'var(--pane-color-accent)',
  animation: 'pane-pulse 1.5s ease infinite',
  flexShrink: 0,
}

const progressBarOuter: CSSProperties = {
  width: '60px',
  height: '4px',
  background: 'var(--pane-color-border)',
  borderRadius: '2px',
  overflow: 'hidden',
}

const progressBarInner: CSSProperties = {
  height: '100%',
  background: 'var(--pane-color-accent)',
  borderRadius: '2px',
}
