import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { onTelemetry, getTelemetryHistory, type TelemetryEvent } from '@pane/core'

// Safe string conversion for rendering unknown data values
function str(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function renderEventDetails(event: TelemetryEvent): ReactNode {
  const d = (event.data ?? {}) as Record<string, any>
  const parts: ReactNode[] = []

  // ── Streaming: extract and format thinking only ──
  if (d.type === 'streaming' || d.type === 'stream-complete') {
    const content = str(d.content)
    if (content) {
      const thinking = extractThinking(content)
      if (thinking) {
        const isComplete = d.type === 'stream-complete'
        parts.push(
          <div key="thinking" style={{
            ...reasoningStyle,
            borderLeft: isComplete ? '2px solid var(--pane-color-success)' : '2px solid var(--pane-color-accent)',
          }}>
            {thinking.intent && <><div style={reasoningLabel}>Intent</div><div style={reasoningValue}>{thinking.intent}</div></>}
            {thinking.modality && <><div style={reasoningLabel}>Modality</div><div style={reasoningValue}>{thinking.modality}</div></>}
            {thinking.layout && <><div style={reasoningLabel}>Layout</div><div style={reasoningValue}>{thinking.layout}</div></>}
            {thinking.decisions && thinking.decisions.length > 0 && <>
              <div style={reasoningLabel}>Decisions</div>
              {thinking.decisions.map((dec: string, i: number) => (
                <div key={i} style={{ ...reasoningValue, paddingLeft: '8px', borderLeft: '2px solid var(--pane-color-border)' }}>• {dec}</div>
              ))}
            </>}
            {thinking.checks && <><div style={reasoningLabel}>Checks</div><div style={reasoningValue}>{thinking.checks}</div></>}
            {!isComplete && <div style={{ fontSize: '9px', color: 'var(--pane-color-accent)', marginTop: '4px' }}>Streaming...</div>}
          </div>
        )
      } else if (!content.includes('"update"')) {
        // Still streaming, haven't reached thinking yet — show progress
        parts.push(
          <div key="progress" style={{ fontSize: '10px', color: 'var(--pane-color-text-muted)', marginTop: '4px' }}>
            Generating... ({d.chars} chars)
          </div>
        )
      }
    }
  }

  // ── Design reasoning from parsed response ──
  if (d.intent && d.type !== 'streaming' && d.type !== 'stream-complete') {
    parts.push(
      <div key="reasoning" style={reasoningStyle}>
        <div style={reasoningLabel}>Intent</div>
        <div style={reasoningValue}>{str(d.intent)}</div>
        {(d.modality_rationale || d.modality) && <><div style={reasoningLabel}>Modality</div><div style={reasoningValue}>{str(d.modality_rationale ?? d.modality)}</div></>}
        {(d.layout_rationale || d.layout) && <><div style={reasoningLabel}>Layout</div><div style={reasoningValue}>{str(d.layout_rationale ?? d.layout)}</div></>}
        {Array.isArray(d.design_decisions ?? d.decisions) && (d.design_decisions ?? d.decisions).length > 0 && <>
          <div style={reasoningLabel}>Decisions</div>
          {(d.design_decisions ?? d.decisions).map((dec: string, i: number) => (
            <div key={i} style={{ ...reasoningValue, paddingLeft: '8px', borderLeft: '2px solid var(--pane-color-border)' }}>• {dec}</div>
          ))}
        </>}
      </div>
    )
  }

  // ── Design checks ──
  if (d.type === 'design-checks' && d.checks) {
    parts.push(
      <div key="checks" style={reasoningStyle}>
        {typeof d.checks === 'string'
          ? <div style={reasoningValue}>{d.checks}</div>
          : Object.entries(d.checks as Record<string, string>).map(([voice, check]) => (
            <div key={voice} style={{ display: 'flex', gap: '6px', fontSize: '10px', marginBottom: '2px' }}>
              <span style={{ color: 'var(--pane-color-accent)', fontWeight: 600, minWidth: '60px' }}>{voice}</span>
              <span style={{ color: 'var(--pane-color-text-muted)' }}>{str(check)}</span>
            </div>
          ))
        }
      </div>
    )
  }

  // ── Visual assessment ──
  if (d.type === 'visual-assessment') {
    parts.push(
      <div key="visual" style={reasoningStyle}>
        {['readability', 'layout', 'density', 'completeness', 'design_quality'].map(key => {
          const val = str(d[key])
          if (!val) return null
          const grade = val.startsWith('pass') ? '✓' : val.startsWith('warn') ? '!' : val.startsWith('fail') ? '✗' : '•'
          const clr = val.startsWith('pass') ? 'var(--pane-color-success)' : val.startsWith('fail') ? 'var(--pane-color-danger)' : 'var(--pane-color-warning)'
          return (
            <div key={key} style={{ display: 'flex', gap: '6px', fontSize: '10px', marginBottom: '2px' }}>
              <span style={{ color: clr, fontWeight: 600 }}>{grade}</span>
              <span style={{ color: 'var(--pane-color-text-muted)', minWidth: '70px' }}>{key.replace('_', ' ')}</span>
              <span style={{ color: 'var(--pane-color-text)' }}>{val}</span>
            </div>
          )
        })}
        {d.overall_assessment && <div style={{ fontSize: '10px', color: 'var(--pane-color-text)', marginTop: '4px', fontStyle: 'italic' }}>{str(d.overall_assessment)}</div>}
      </div>
    )
  }

  // ── Screenshot ──
  if (event.image) {
    parts.push(<img key="img" src={event.image} style={thumbnailStyle} title="Click to enlarge" />)
  }

  // No raw data dumps — telemetry is for human readability
  return parts.length > 0 ? <>{parts}</> : null
}

// Extract thinking fields from streaming JSON text
function extractThinking(text: string): { intent?: string; modality?: string; layout?: string; decisions?: string[]; checks?: string } | null {
  try {
    // Try to find the thinking block in the accumulated text
    const thinkStart = text.indexOf('"thinking"')
    if (thinkStart === -1) return null

    // Find the opening brace after "thinking":
    const braceStart = text.indexOf('{', thinkStart + 10)
    if (braceStart === -1) return null

    // Find matching closing brace
    let depth = 0
    let braceEnd = -1
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === '{') depth++
      if (text[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break } }
    }

    if (braceEnd === -1) {
      // Incomplete — try to parse what we have
      const partial = text.substring(braceStart) + '}'
      try {
        const parsed = JSON.parse(partial)
        return {
          intent: parsed.intent,
          modality: parsed.modality ?? parsed.modality_rationale,
          layout: parsed.layout ?? parsed.layout_rationale,
          decisions: parsed.decisions ?? parsed.design_decisions,
          checks: parsed.checks,
        }
      } catch { return null }
    }

    const thinkingJson = text.substring(braceStart, braceEnd + 1)
    const parsed = JSON.parse(thinkingJson)
    return {
      intent: parsed.intent,
      modality: parsed.modality ?? parsed.modality_rationale,
      layout: parsed.layout ?? parsed.layout_rationale,
      decisions: parsed.decisions ?? parsed.design_decisions,
      checks: parsed.checks,
    }
  } catch {
    return null
  }
}

export function TelemetryDrawer() {
  const [open, setOpen] = useState(true)
  const [events, setEvents] = useState<TelemetryEvent[]>(() => getTelemetryHistory())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = onTelemetry((event) => {
      setEvents(prev => {
        // Check if this is an update to an existing event
        const idx = prev.findIndex(e => e.id === event.id)
        if (idx !== -1) {
          const next = [...prev]
          next[idx] = { ...event } // replace with updated event
          return next
        }
        // New event
        return [...prev.slice(-199), event]
      })
    })
    return unsub
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, open])

  return (
    <motion.div
      animate={{ width: open ? 380 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      style={drawerStyle}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={toggleBtnStyle}
        title="Telemetry"
      >
        <span style={{ fontSize: '14px' }}>{ open ? '›' : '‹' }</span>
        {!open && events.length > 0 && (
          <span style={badgeStyle}>{events.length}</span>
        )}
      </button>

      {open && (
        <>
            {/* Header */}
            <div style={headerStyle}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Telemetry</span>
              <span style={countStyle}>{events.length} events</span>
            </div>

            {/* Event list */}
            <div ref={scrollRef} style={listStyle}>
              {events.map(event => (
                <div key={event.id} style={eventStyle}>
                  <div style={eventHeaderStyle}>
                    <span style={{ ...typeBadgeStyle, background: getTypeColor(event.type) }}>
                      {getTypeIcon(event.type)} {event.type.split(':')[1]}
                    </span>
                    {event.duration && (
                      <span style={durationStyle}>{event.duration}ms</span>
                    )}
                    <span style={timeStyle}>
                      {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {event.preview && (
                    <div style={previewStyle}>{event.preview}</div>
                  )}

                  {renderEventDetails(event)}

                  {/* Clickable screenshot */}
                  {event.image && (
                    <div onClick={() => setSelectedImage(event.image!)} style={{ cursor: 'pointer' }} />
                  )}
                </div>
              ))}

              {events.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--pane-color-text-muted)', fontSize: '12px' }}>
                  No events yet. Type something to start.
                </div>
              )}
            </div>
        </>
      )}

      {/* Full-size image viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={overlayStyle}
            onClick={() => setSelectedImage(null)}
          >
            <img src={selectedImage} style={fullImageStyle} />
            <div style={{ color: '#fff', fontSize: '12px', marginTop: '8px' }}>Click to close</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Helpers ──

function getTypeIcon(type: string): string {
  if (type.startsWith('agent')) return '🤖'
  if (type.startsWith('api')) return '🌐'
  if (type.startsWith('visual')) return '👁'
  if (type.startsWith('runtime')) return '⚙️'
  if (type.startsWith('feedback')) return '💬'
  return 'ℹ️'
}

function getTypeColor(type: string): string {
  if (type.includes('error')) return 'rgba(239, 68, 68, 0.2)'
  if (type.includes('correction')) return 'rgba(245, 158, 11, 0.2)'
  if (type.includes('approved')) return 'rgba(34, 197, 94, 0.2)'
  if (type.startsWith('agent')) return 'rgba(59, 130, 246, 0.15)'
  if (type.startsWith('api')) return 'rgba(168, 85, 247, 0.15)'
  if (type.startsWith('visual')) return 'rgba(6, 182, 212, 0.15)'
  if (type.startsWith('runtime')) return 'rgba(161, 161, 170, 0.1)'
  return 'rgba(161, 161, 170, 0.1)'
}

// ── Styles ──

const toggleBtnStyle: CSSProperties = {
  position: 'absolute',
  left: -28,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
  width: 28,
  height: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  background: 'var(--pane-color-surface-raised)',
  border: '1px solid var(--pane-color-border)',
  borderRight: 'none',
  borderRadius: '6px 0 0 6px',
  color: 'var(--pane-color-text-muted)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '11px',
}

const badgeStyle: CSSProperties = {
  fontSize: '9px',
  background: 'var(--pane-color-accent)',
  color: '#fff',
  borderRadius: '8px',
  padding: '1px 4px',
  lineHeight: 1.2,
}

const drawerStyle: CSSProperties = {
  position: 'relative',
  height: '100vh',
  flexShrink: 0,
  background: 'var(--pane-color-surface)',
  borderLeft: '1px solid var(--pane-color-border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: 'var(--pane-font-family)',
  color: 'var(--pane-color-text)',
}

const headerStyle: CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--pane-color-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: 'var(--pane-color-text)',
  flexShrink: 0,
}

const countStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--pane-color-text-muted)',
}

const listStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px',
}

const eventStyle: CSSProperties = {
  padding: '8px',
  marginBottom: '4px',
  borderRadius: '6px',
  background: 'var(--pane-color-background)',
  border: '1px solid transparent',
}

const eventHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '4px',
}

const typeBadgeStyle: CSSProperties = {
  fontSize: '10px',
  padding: '2px 6px',
  borderRadius: '4px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const durationStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--pane-color-text-muted)',
  fontFamily: 'var(--pane-font-mono)',
}

const timeStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--pane-color-text-muted)',
  marginLeft: 'auto',
  fontFamily: 'var(--pane-font-mono)',
}

const previewStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--pane-color-text)',
  lineHeight: 1.4,
  wordBreak: 'break-word',
}

const thumbnailStyle: CSSProperties = {
  width: '100%',
  height: 'auto',
  maxHeight: '120px',
  objectFit: 'cover',
  borderRadius: '4px',
  marginTop: '6px',
  cursor: 'pointer',
  border: '1px solid var(--pane-color-border)',
}

const detailsStyle: CSSProperties = {
  marginTop: '4px',
}

const summaryStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--pane-color-text-muted)',
  cursor: 'pointer',
  userSelect: 'none',
}

const preStyle: CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text-muted)',
  background: 'var(--pane-color-surface)',
  padding: '6px',
  borderRadius: '4px',
  margin: '4px 0 0',
  overflow: 'auto',
  maxHeight: '120px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  background: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const fullImageStyle: CSSProperties = {
  maxWidth: '90%',
  maxHeight: '80%',
  objectFit: 'contain',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
}

const reasoningStyle: CSSProperties = {
  marginTop: '6px',
  padding: '6px 8px',
  background: 'rgba(59, 130, 246, 0.05)',
  borderRadius: '4px',
  border: '1px solid rgba(59, 130, 246, 0.1)',
}

const reasoningLabel: CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--pane-color-accent)',
  marginTop: '4px',
  marginBottom: '1px',
}

const reasoningValue: CSSProperties = {
  fontSize: '11px',
  color: 'var(--pane-color-text)',
  lineHeight: 1.4,
}
