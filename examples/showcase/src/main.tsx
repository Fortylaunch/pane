import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPane, staticAgent } from '@pane/core'
import { PaneProvider, PaneRenderer } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'
import { examples } from './examples/index.js'

function App() {
  const [selectedId, setSelectedId] = useState(examples[0].id)
  const selected = examples.find((e) => e.id === selectedId) ?? examples[0]

  // Rebuild the runtime whenever the selected example changes so the
  // static view is re-initialized.
  const pane = useMemo(
    () =>
      createPane({
        agent: staticAgent(selected.update),
        specEvalEnabled: false,
      }),
    [selected.id],
  )

  // Kick the runtime to init the view.
  useMemo(() => {
    pane.handleInput({
      id: `init-${selected.id}`,
      content: '',
      modality: 'text',
      timestamp: Date.now(),
      isInterjection: false,
    })
  }, [pane])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          background: '#0f0f14',
          borderRight: '1px solid #1e1e24',
          padding: 16,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#00e676',
            marginBottom: 16,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}
        >
          Pane Showcase
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {examples.map((ex) => {
            const active = ex.id === selectedId
            return (
              <button
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                style={{
                  textAlign: 'left',
                  background: active ? '#1a1a22' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? '#00e676' : 'transparent',
                  color: active ? '#e5e5e5' : '#a0a0a8',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderRadius: 2,
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{ex.title}</div>
                <div style={{ fontSize: 11, color: '#6b6b75' }}>{ex.description}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#00e676',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 4,
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  }}
                >
                  {ex.modality}
                </div>
              </button>
            )
          })}
        </nav>
      </aside>
      <main style={{ flex: 1, minWidth: 0, height: '100%' }}>
        <PaneProvider runtime={pane} theme={defaultTheme}>
          <PaneRenderer />
        </PaneProvider>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
