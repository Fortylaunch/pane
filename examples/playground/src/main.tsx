import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPane,
  functionAgent,
  createInput,
  onTelemetry,
  type PaneSession,
  type PaneSessionUpdate,
  type PaneView,
  type TelemetryEvent,
} from '@pane/core'
import { PaneProvider, PaneRenderer } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'

// ── Sample starter spec ──

const SAMPLE_VIEW: PaneView = {
  layout: { pattern: 'stack', gap: 'md' },
  panels: [
    {
      id: 'heading',
      atom: 'text',
      source: 'playground',
      props: { text: 'PLAYGROUND DASHBOARD', variant: 'heading', emphasis: 'primary' },
    },
    {
      id: 'metric-1',
      atom: 'box',
      recipe: 'metric',
      source: 'playground',
      props: {
        label: 'ACTIVE SESSIONS',
        value: '1,284',
        delta: '+12.4%',
        trend: 'up',
      },
    },
    {
      id: 'metric-2',
      atom: 'box',
      recipe: 'metric',
      source: 'playground',
      props: {
        label: 'REQUESTS / MIN',
        value: '8,932',
        delta: '-2.1%',
        trend: 'down',
      },
    },
    {
      id: 'table-1',
      atom: 'box',
      recipe: 'data-table',
      source: 'playground',
      props: {
        title: 'RECENT EVENTS',
        columns: ['TIME', 'EVENT', 'STATUS'],
        rows: [
          ['12:04', 'session.start', 'ok'],
          ['12:03', 'agent.response', 'ok'],
          ['12:02', 'eval.complete', 'ok'],
          ['12:01', 'mutation.apply', 'ok'],
        ],
      },
    },
  ],
}

const SAMPLE_UPDATE: PaneSessionUpdate = {
  contexts: [
    {
      id: 'playground',
      operation: 'create',
      label: 'Playground',
      modality: 'informational',
      view: SAMPLE_VIEW,
    },
  ],
}

const SAMPLE_JSON = JSON.stringify(SAMPLE_UPDATE, null, 2)

// ── Mutable agent: returns whatever the editor last pushed ──

let currentUpdate: PaneSessionUpdate = SAMPLE_UPDATE
const agent = functionAgent(async () => currentUpdate)

const pane = createPane({
  agent,
  specEvalEnabled: false,
})

;(window as any).__paneRuntime = pane

// ── UI ──

const C = {
  bg: '#0b0b0e',
  panel: '#111114',
  border: '#1f1f24',
  text: '#e6e6e6',
  muted: '#7a7a82',
  accent: '#00e676',
  danger: '#ff5252',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: C.mono,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: C.muted,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

function Editor({ onApply }: { onApply: (u: PaneSessionUpdate) => void }) {
  const [text, setText] = useState(SAMPLE_JSON)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(text)
        setError(null)
        onApply(parsed)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [text, onApply])

  const manualApply = () => {
    try {
      const parsed = JSON.parse(text)
      setError(null)
      onApply(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Spec Editor</Label>
        <button
          onClick={manualApply}
          style={{
            background: C.accent,
            color: '#000',
            border: 'none',
            padding: '4px 10px',
            fontFamily: C.mono,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          background: C.bg,
          color: C.text,
          border: `1px solid ${C.border}`,
          borderRadius: 0,
          padding: 10,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.5,
          resize: 'none',
          outline: 'none',
        }}
      />
      {error && (
        <div
          style={{
            color: C.danger,
            fontFamily: C.mono,
            fontSize: 10,
            padding: 8,
            border: `1px solid ${C.danger}`,
            background: 'rgba(255,82,82,0.05)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

interface RepairRecord {
  type: string
  panelId: string
  atom?: string
  detail?: string
  ts: number
}

const DESTRUCTIVE_REPAIRS = new Set([
  'missing-id',
  'duplicate-id',
  'leaf-with-children',
  'empty-required-prop',
  'missing-source',
])

function Diagnostics({
  session,
  repairs,
  lastEvent,
}: {
  session: PaneSession | null
  repairs: RepairRecord[]
  lastEvent: TelemetryEvent | null
}) {
  const activeCtx = session?.contexts.find(c => c.id === session.activeContext)
  const panels = activeCtx?.view.panels ?? []

  const atomCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const walk = (ps: typeof panels) => {
      for (const p of ps) {
        counts[p.atom] = (counts[p.atom] ?? 0) + 1
        if (p.children) walk(p.children)
      }
    }
    walk(panels)
    return counts
  }, [panels])

  // Most recent eval event
  const evalData = lastEvent?.type === 'system:info' ? null : null
  void evalData

  const row = (k: string, v: React.ReactNode) => (
    <div
      key={k}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: C.mono,
        fontSize: 11,
        padding: '4px 0',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>{k}</span>
      <span style={{ color: C.text }}>{v}</span>
    </div>
  )

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <Label>Diagnostics</Label>

      <div style={{ marginTop: 8 }}>
        <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Session
        </div>
        {row('version', session?.version ?? 0)}
        {row('context', activeCtx?.id ?? '—')}
        {row('modality', activeCtx?.modality ?? '—')}
        {row('panels', panels.length)}
        {row('layout', activeCtx?.view.layout.pattern ?? '—')}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Atoms
        </div>
        {Object.keys(atomCounts).length === 0
          ? <div style={{ color: C.muted, fontFamily: C.mono, fontSize: 11 }}>—</div>
          : Object.entries(atomCounts).map(([k, v]) => row(k, v))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Last Event
        </div>
        {lastEvent ? (
          <>
            {row('type', lastEvent.type)}
            {lastEvent.duration != null && row('duration', `${lastEvent.duration}ms`)}
            {lastEvent.preview && (
              <div style={{ color: C.muted, fontFamily: C.mono, fontSize: 10, marginTop: 4, wordBreak: 'break-word' }}>
                {lastEvent.preview.substring(0, 160)}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: C.muted, fontFamily: C.mono, fontSize: 11 }}>—</div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {(() => {
          const destructive = repairs.filter(r => DESTRUCTIVE_REPAIRS.has(r.type))
          const info = repairs.filter(r => !DESTRUCTIVE_REPAIRS.has(r.type))
          const headline = destructive.length === 0
            ? `clean${info.length > 0 ? ` · ${info.length} info` : ''}`
            : `${destructive.length} repair${destructive.length === 1 ? '' : 's'}${info.length > 0 ? ` · ${info.length} info` : ''}`
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ color: C.accent, fontFamily: C.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Quality Gate
              </span>
              <span style={{
                color: destructive.length === 0 ? C.accent : (destructive.length > 5 ? C.danger : '#f59e0b'),
                fontFamily: C.mono,
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                {headline}
              </span>
            </div>
          )
        })()}
        {repairs.length === 0 ? (
          <div style={{ color: C.muted, fontFamily: C.mono, fontSize: 11 }}>no repairs</div>
        ) : (
          <>
            {/* Aggregated by category — destructive first, info dimmed */}
            {Object.entries(
              repairs.reduce<Record<string, number>>((acc, r) => {
                acc[r.type] = (acc[r.type] ?? 0) + 1
                return acc
              }, {})
            )
              .sort((a, b) => {
                const aDestr = DESTRUCTIVE_REPAIRS.has(a[0]) ? 0 : 1
                const bDestr = DESTRUCTIVE_REPAIRS.has(b[0]) ? 0 : 1
                if (aDestr !== bDestr) return aDestr - bDestr
                return b[1] - a[1]
              })
              .map(([type, count]) => {
                const isDestr = DESTRUCTIVE_REPAIRS.has(type)
                return (
                  <div
                    key={type}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontFamily: C.mono,
                      fontSize: 11,
                      padding: '4px 0',
                      borderBottom: `1px solid ${C.border}`,
                      opacity: isDestr ? 1 : 0.6,
                    }}
                  >
                    <span style={{ color: C.text }}>{type}{!isDestr ? ' (info)' : ''}</span>
                    <span style={{ color: !isDestr ? C.muted : count > 5 ? C.danger : count > 1 ? '#f59e0b' : C.muted }}>
                      {count}
                    </span>
                  </div>
                )
              })}

            {/* Recent details — last 5 */}
            <div style={{
              marginTop: 8,
              fontSize: 9,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              recent
            </div>
            {repairs.slice(-5).reverse().map((r, i) => (
              <div
                key={`${r.ts}-${i}`}
                style={{
                  color: C.text,
                  fontFamily: C.mono,
                  fontSize: 9,
                  padding: '2px 0',
                  borderBottom: `1px solid ${C.border}`,
                  wordBreak: 'break-word',
                }}
              >
                <span style={{ color: '#f59e0b' }}>{r.type}</span>
                <span style={{ color: C.muted }}> · {r.panelId}{r.atom ? ` (${r.atom})` : ''}</span>
                {r.detail && <div style={{ color: C.muted, paddingLeft: 8 }}>{r.detail}</div>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

type DockMode = 'left' | 'bottom' | 'popout'

const DOCK_KEY = 'pane-playground-dock'

function App() {
  const [session, setSession] = useState<PaneSession | null>(() => pane.getSession())
  const [repairs, setRepairs] = useState<RepairRecord[]>([])
  const [lastEvent, setLastEvent] = useState<TelemetryEvent | null>(null)
  const [dock, setDock] = useState<DockMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(DOCK_KEY) : null
    return (saved as DockMode) ?? 'left'
  })
  const popoutRef = useRef<Window | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    localStorage.setItem(DOCK_KEY, dock)
  }, [dock])

  useEffect(() => {
    const unsub = pane.subscribe(s => setSession(s))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onTelemetry(e => {
      setLastEvent(e)
      // Phase 4: structured per-repair events
      if (e.type === 'system:info' && (e.data as any)?.type === 'quality-gate:repair') {
        const d = e.data as any
        setRepairs(prev => [...prev, {
          type: d.repairType,
          panelId: d.panelId,
          atom: d.atom,
          detail: d.detail,
          ts: e.timestamp ?? Date.now(),
        }])
      }
    })
    return unsub
  }, [])

  // Kick off initial render
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    pane.handleInput(createInput('init', 'text', [])).catch(err => console.error(err))
  }, [])

  // Manage popout window lifecycle
  useEffect(() => {
    if (dock !== 'popout') {
      if (popoutRef.current && !popoutRef.current.closed) {
        popoutRef.current.close()
      }
      popoutRef.current = null
      return
    }

    const win = window.open('', 'pane-playground-editor', 'width=600,height=800')
    if (!win) {
      // Popup blocked — fall back to left dock
      setDock('left')
      return
    }
    popoutRef.current = win
    win.document.title = 'Pane Editor'
    win.document.body.style.margin = '0'
    win.document.body.style.background = C.bg
    win.document.body.style.color = C.text

    // If user closes popout window, snap back to left dock
    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed)
        setDock('left')
      }
    }, 500)

    return () => clearInterval(checkClosed)
  }, [dock])

  const applySpec = useCallback((update: PaneSessionUpdate) => {
    currentUpdate = update
    pane.handleInput(createInput('update', 'text', [])).catch(err => console.error(err))
  }, [])

  const editorPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <DockBar dock={dock} setDock={setDock} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor onApply={applySpec} />
      </div>
    </div>
  )

  const rendererPanel = (
    <div style={{ minWidth: 0, overflow: 'hidden', position: 'relative', height: '100%' }}>
      <PaneProvider runtime={pane} theme={defaultTheme}>
        <PaneRenderer />
      </PaneProvider>
    </div>
  )

  const diagnosticsPanel = (
    <div style={{ background: C.panel, minWidth: 0, height: '100%', borderLeft: `1px solid ${C.border}` }}>
      <Diagnostics session={session} repairs={repairs} lastEvent={lastEvent} />
    </div>
  )

  // ── Layouts ──
  const containerBase: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: C.bg,
    color: C.text,
  }

  if (dock === 'left') {
    return (
      <div style={{ ...containerBase, display: 'grid', gridTemplateColumns: '380px 1fr 240px' }}>
        <div style={{ borderRight: `1px solid ${C.border}`, background: C.panel, minWidth: 0 }}>
          {editorPanel}
        </div>
        {rendererPanel}
        {diagnosticsPanel}
      </div>
    )
  }

  if (dock === 'bottom') {
    return (
      <div style={{ ...containerBase, display: 'grid', gridTemplateRows: '1fr 280px', gridTemplateColumns: '1fr 240px' }}>
        <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <PaneProvider runtime={pane} theme={defaultTheme}>
            <PaneRenderer />
          </PaneProvider>
        </div>
        {diagnosticsPanel}
        <div style={{
          gridColumn: '1 / -1',
          borderTop: `1px solid ${C.border}`,
          background: C.panel,
          minHeight: 0,
        }}>
          {editorPanel}
        </div>
      </div>
    )
  }

  // popout
  return (
    <>
      <div style={{ ...containerBase, display: 'grid', gridTemplateColumns: '1fr 240px' }}>
        {rendererPanel}
        {diagnosticsPanel}
      </div>
      {popoutRef.current && <PopoutEditor win={popoutRef.current} editorPanel={editorPanel} />}
    </>
  )
}

function DockBar({ dock, setDock }: { dock: DockMode; setDock: (d: DockMode) => void }) {
  const btn = (mode: DockMode, label: string): React.CSSProperties => ({
    background: dock === mode ? C.accent : 'transparent',
    color: dock === mode ? '#000' : C.muted,
    border: `1px solid ${dock === mode ? C.accent : C.border}`,
    padding: '3px 8px',
    fontFamily: C.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    cursor: 'pointer',
  })
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '8px 12px 0',
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 8,
    }}>
      <span style={{
        fontFamily: C.mono,
        fontSize: 9,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: C.muted,
        marginRight: 'auto',
        alignSelf: 'center',
      }}>
        Dock
      </span>
      <button onClick={() => setDock('left')} style={btn('left', 'Left')}>Left</button>
      <button onClick={() => setDock('bottom')} style={btn('bottom', 'Bottom')}>Bottom</button>
      <button onClick={() => setDock('popout')} style={btn('popout', 'Pop Out')}>Pop Out</button>
    </div>
  )
}

function PopoutEditor({ win, editorPanel }: { win: Window; editorPanel: React.ReactNode }) {
  const [container] = useState(() => {
    const div = win.document.createElement('div')
    div.style.height = '100vh'
    win.document.body.appendChild(div)
    return div
  })

  useEffect(() => {
    return () => {
      try { win.document.body.removeChild(container) } catch {}
    }
  }, [container, win])

  return createPortal(editorPanel, container)
}

createRoot(document.getElementById('root')!).render(<App />)
