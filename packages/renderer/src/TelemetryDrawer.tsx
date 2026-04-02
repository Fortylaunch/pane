import { useState, useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { onTelemetry, getTelemetryHistory, type TelemetryEvent } from '@pane/core'
import { usePaneRuntime, usePaneSession } from './context.js'

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

// ── Design Chat types ──
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const DESIGN_SYSTEM_PROMPT = `You are the Pane Design Council — a panel of six design experts who advise on the current UI surface. You speak concisely, directly, and with authority.

Your voices:
**TUFTE** — Data-ink ratio. Is every pixel earning its keep?
**COOPER** — Goal-directed. Does the UI serve the user's current goal?
**IVE** — Inevitability. Does this feel like it could not be arranged any other way?
**NORMAN** — Usability. Can the user tell what to do and what happened?
**YABLONSKI** — Cognitive law. Hick's, Fitts's, Miller's Law.
**VAN CLEEF** — Strategic context. Where is the user in their workflow?

Analyze through all six lenses. Reference exact panel IDs, atom types, layout patterns, and token values from the session state. Keep responses short (2-5 lines per voice). Lead with the most critical issue.

You also act as a Product Designer who suggests concrete improvements: token adjustments, new recipes, layout changes, atom refinements. Be specific enough to implement.

Respond in plain text, not JSON. Use voice names as headers.`

interface TelemetryDrawerProps {
  proxyUrl?: string
}

export function TelemetryDrawer({ proxyUrl }: TelemetryDrawerProps) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<'telemetry' | 'design'>('telemetry')
  const [events, setEvents] = useState<TelemetryEvent[]>(() => getTelemetryHistory())
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Design chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const runtime = usePaneRuntime()
  const session = usePaneSession()

  useEffect(() => {
    const unsub = onTelemetry((event) => {
      setEvents(prev => {
        const idx = prev.findIndex(e => e.id === event.id)
        if (idx !== -1) {
          const next = [...prev]
          next[idx] = { ...event }
          return next
        }
        return [...prev.slice(-199), event]
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (scrollRef.current && open && tab === 'telemetry') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, open, tab])

  useEffect(() => {
    if (chatScrollRef.current && open && tab === 'design') {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, open, tab])

  const sendChatMessage = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatLoading || !proxyUrl) return

    setChatMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }])
    setChatInput('')
    setChatLoading(true)

    try {
      const activeCtx = session.contexts.find(c => c.id === session.activeContext)
      const sessionSummary = JSON.stringify({
        activeContext: session.activeContext,
        modality: activeCtx?.modality,
        label: activeCtx?.label,
        panelCount: activeCtx?.view?.panels?.length ?? 0,
        panels: activeCtx?.view?.panels?.map(p => ({
          id: p.id, atom: p.atom, recipe: p.recipe, emphasis: p.emphasis, childCount: p.children?.length ?? 0,
        })),
        layout: activeCtx?.view?.layout,
        evalResult: runtime.getLastEvalResult?.(),
      }, null, 2)

      const apiMessages = [
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: `Session state:\n${sessionSummary}\n\nUser: ${text}` },
      ]

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, system: DESIGN_SYSTEM_PROMPT, messages: apiMessages }),
      })

      const data = await res.json()
      const reply = data.content?.[0]?.text ?? 'No response'
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }])

      // Feed design council findings back into runtime so Claude's next response incorporates them
      const findings = reply
        .split('\n')
        .filter((line: string) => line.trim().length > 10)
        .slice(0, 8)
        .map((line: string) => `[design-council] ${line.trim()}`)
      runtime.setDesignFeedback?.(findings)
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, chatMessages, session, runtime, proxyUrl])

  return (
    <motion.div
      animate={{ width: open ? 360 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      style={drawerStyle}
    >
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={toggleBtnStyle}
        title="Sidebar"
      >
        <span style={{ fontSize: '14px' }}>{ open ? '›' : '‹' }</span>
        {!open && events.length > 0 && (
          <span style={badgeStyle}>{events.length}</span>
        )}
      </button>

      {open && (
        <>
          {/* Tab bar */}
          <div style={tabBarStyle}>
            <button onClick={() => setTab('telemetry')} style={{ ...tabStyle, ...(tab === 'telemetry' ? tabActiveStyle : {}) }}>
              TELEMETRY
              {events.length > 0 && <span style={{ opacity: 0.5, marginLeft: '4px' }}>{events.length}</span>}
            </button>
            {proxyUrl && (
              <button onClick={() => setTab('design')} style={{ ...tabStyle, ...(tab === 'design' ? tabActiveStyle : {}) }}>
                DESIGN
              </button>
            )}
          </div>

          {/* Telemetry tab */}
          {tab === 'telemetry' && (
            <div ref={scrollRef} style={listStyle}>
              {events.map(event => (
                <div key={event.id} style={eventStyle}>
                  <div style={eventHeaderStyle}>
                    <span style={{ ...typeBadgeStyle, background: getTypeColor(event.type) }}>
                      {getTypeIcon(event.type)} {event.type.split(':')[1]}
                    </span>
                    {event.duration && <span style={durationStyle}>{event.duration}ms</span>}
                    <span style={timeStyle}>
                      {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  {event.preview && <div style={previewStyle}>{event.preview}</div>}
                  {renderEventDetails(event)}
                  {event.image && <div onClick={() => setSelectedImage(event.image!)} style={{ cursor: 'pointer' }} />}
                </div>
              ))}
              {events.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--pane-color-text-muted)', fontSize: '11px', fontFamily: 'var(--pane-font-mono)' }}>
                  No events yet. Type something to start.
                </div>
              )}
            </div>
          )}

          {/* Design chat tab */}
          {tab === 'design' && proxyUrl && (
            <>
              <div ref={chatScrollRef} style={listStyle}>
                {chatMessages.length === 0 && (
                  <div style={{ padding: '12px 8px', fontSize: '10px', fontFamily: 'var(--pane-font-mono)', color: 'var(--pane-color-text-muted)', lineHeight: '1.5' }}>
                    Ask the design council about the current UI. They analyze through six design lenses.
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={msg.role === 'user' ? chatUserStyle : chatAssistantStyle}>
                    {msg.role === 'assistant' ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ ...chatAssistantStyle, opacity: 0.5 }}>
                    <span style={{ animation: 'pane-pulse 1.5s ease infinite' }}>Consulting...</span>
                  </div>
                )}
              </div>
              <div style={{ padding: '4px 8px', borderTop: '1px solid var(--pane-color-border)' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about this UI..."
                  disabled={chatLoading}
                  style={chatInputStyle}
                />
              </div>
            </>
          )}
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

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: '0',
  borderBottom: '1px solid var(--pane-color-border)',
  flexShrink: 0,
}

const tabStyle: CSSProperties = {
  flex: 1,
  padding: '6px 0',
  fontSize: '9px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--pane-color-text-muted)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 0.15s ease, background 0.15s ease',
}

const tabActiveStyle: CSSProperties = {
  color: 'var(--pane-color-accent-text)',
  background: 'var(--pane-color-accent)',
}

const chatUserStyle: CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text)',
  padding: '4px 8px',
  background: 'var(--pane-color-surface-raised)',
  borderRadius: '2px',
  alignSelf: 'flex-end',
  maxWidth: '85%',
  marginBottom: '4px',
}

const chatAssistantStyle: CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--pane-font-family)',
  color: 'var(--pane-color-text)',
  padding: '6px 8px',
  lineHeight: '1.5',
  maxWidth: '95%',
  marginBottom: '4px',
}

const chatInputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: '11px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text)',
  background: 'var(--pane-color-background)',
  border: '1px solid var(--pane-color-border)',
  borderRadius: '0px',
  outline: 'none',
  boxSizing: 'border-box',
}

const toggleBtnStyle: CSSProperties = {
  position: 'absolute',
  left: -20,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
  width: 20,
  height: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  background: 'var(--pane-color-surface)',
  border: '1px solid var(--pane-color-border)',
  borderRight: 'none',
  borderRadius: '2px 0 0 2px',
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
