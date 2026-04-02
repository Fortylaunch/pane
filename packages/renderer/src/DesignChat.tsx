import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { usePaneRuntime, usePaneSession } from './context.js'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface DesignChatProps {
  proxyUrl: string
}

const SYSTEM_PROMPT = `You are the Pane Design Council — a panel of six design experts who advise on the current UI surface. You speak concisely, directly, and with authority.

Your voices:

**TUFTE** — Data-ink ratio. Is every pixel earning its keep? Remove what doesn't inform.
**COOPER** — Goal-directed. What is the user trying to do RIGHT NOW? Does the UI serve that?
**IVE** — Inevitability. Does this feel like it could not be arranged any other way?
**NORMAN** — Usability. Can the user tell what to do and what happened? Affordances, signifiers, feedback.
**YABLONSKI** — Cognitive law. Hick's Law (fewer choices = faster), Fitts's Law (bigger targets = easier), Miller's Law (7±2 chunks).
**VAN CLEEF** — Strategic context. Where is the user in their workflow? What comes next?

When the user asks about the current UI, analyze it through all six lenses and give specific, actionable feedback. Reference exact panel IDs, atom types, layout patterns, and token values from the session state.

Keep responses short (3-8 lines per voice). Lead with the most critical issue. If the UI is good, say so — don't invent problems.

You also act as a **Product Designer** who can suggest concrete improvements: new recipes to create, token adjustments, layout pattern changes, atom refinements. When suggesting changes, be specific enough that an engineer could implement them.

Respond in plain text, not JSON. Use the voice names as headers when multiple voices weigh in.`

export function DesignChat({ proxyUrl }: DesignChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const runtime = usePaneRuntime()
  const session = usePaneSession()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // Build context from current session
      const activeCtx = session.contexts.find(c => c.id === session.activeContext)
      const sessionSummary = JSON.stringify({
        activeContext: session.activeContext,
        modality: activeCtx?.modality,
        label: activeCtx?.label,
        panelCount: activeCtx?.view?.panels?.length ?? 0,
        panels: activeCtx?.view?.panels?.map(p => ({
          id: p.id,
          atom: p.atom,
          recipe: p.recipe,
          emphasis: p.emphasis,
          childCount: p.children?.length ?? 0,
        })),
        layout: activeCtx?.view?.layout,
        contextCount: session.contexts.length,
        agentCount: session.agents.length,
        evalResult: runtime.getLastEvalResult?.(),
      }, null, 2)

      // Build conversation history
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        {
          role: 'user' as const,
          content: `Current session state:\n${sessionSummary}\n\nUser question: ${text}`,
        },
      ]

      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      const reply = data.content?.[0]?.text ?? 'No response'

      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, session, runtime, proxyUrl])

  return (
    <>
      {/* Toggle button — always visible on the right edge */}
      <button
        onClick={() => setOpen(v => !v)}
        style={toggleStyle}
        title="Design Council Chat"
      >
        <span style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-block', transition: 'transform 0.2s' }}>◀</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={panelStyle}
          >
            {/* Header */}
            <div style={headerStyle}>
              <span>DESIGN COUNCIL</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={messagesStyle}>
              {messages.length === 0 && (
                <div style={emptyStyle}>
                  Ask the design council about the current UI.
                  They'll analyze it through six design lenses.
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={msg.role === 'user' ? userMsgStyle : assistantMsgStyle}>
                  {msg.role === 'assistant' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ ...assistantMsgStyle, opacity: 0.5 }}>
                  <span style={{ animation: 'pane-pulse 1.5s ease infinite' }}>Consulting...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={inputAreaStyle}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about this UI..."
                style={chatInputStyle}
                disabled={loading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Styles ──

const toggleStyle: CSSProperties = {
  position: 'fixed',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 20,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--pane-color-surface)',
  border: '1px solid var(--pane-color-border)',
  borderRight: 'none',
  borderRadius: '2px 0 0 2px',
  color: 'var(--pane-color-text-muted)',
  fontSize: '10px',
  cursor: 'pointer',
  zIndex: 100,
}

const panelStyle: CSSProperties = {
  height: '100vh',
  background: 'var(--pane-color-surface)',
  borderLeft: '1px solid var(--pane-color-border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  flexShrink: 0,
}

const headerStyle: CSSProperties = {
  padding: '6px 10px',
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 500,
  color: 'var(--pane-color-text-muted)',
  borderBottom: '1px solid var(--pane-color-border)',
}

const messagesStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const emptyStyle: CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text-muted)',
  padding: '12px 4px',
  lineHeight: '1.5',
}

const userMsgStyle: CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--pane-font-mono)',
  color: 'var(--pane-color-text)',
  padding: '4px 8px',
  background: 'var(--pane-color-surface-raised)',
  borderRadius: '2px',
  alignSelf: 'flex-end',
  maxWidth: '85%',
}

const assistantMsgStyle: CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--pane-font-family)',
  color: 'var(--pane-color-text)',
  padding: '6px 8px',
  lineHeight: '1.5',
  maxWidth: '95%',
}

const inputAreaStyle: CSSProperties = {
  padding: '4px 8px',
  borderTop: '1px solid var(--pane-color-border)',
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
