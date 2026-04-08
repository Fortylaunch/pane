import { createRoot } from 'react-dom/client'
import { createPane, claudeAgent, createClaudeVisualEvaluator, createClaudePlanCall, createClaudeSectionCall, createClaudeDesignReview } from '@pane/core'
import { PaneProvider, PaneRenderer, capturePane } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'
import { starterAgent } from './agent.js'

// Agent selection via URL params:
// ?agent=starter     → local starter agent (fast, no API)
// ?agent=claude      → Claude with visual feedback
// Default: claude

const params = new URLSearchParams(window.location.search)
const agentParam = params.get('agent')
const useStarter = agentParam === 'starter'

// Phase 2: deferred reference to the runtime so the connector callbacks
// can call streamLayout/streamPanel as panels arrive from the SSE stream.
// `pane` is constructed below — these callbacks fire after that.
let runtimeRef: any = null
let panelArrivalCount = 0

const agent = useStarter
  ? starterAgent
  : claudeAgent({
      proxyUrl: 'http://localhost:3001/api/claude',
      model: 'claude-sonnet-4-6',
      maxTokens: 16384,
      onStreamChunk: (_chunk, accumulated) => {
        // Update the status strip with streaming progress
        const kb = (accumulated.length / 1024).toFixed(1)
        console.log(`[stream] ${kb}KB received`)
      },
      // Phase 2: progressive rendering hooks
      onStreamLayout: (layout) => {
        panelArrivalCount = 0
        console.log(`[stream] ⚡ layout ready: ${layout.pattern}`)
        runtimeRef?.streamLayout(layout)
      },
      onStreamPanel: (panel) => {
        panelArrivalCount++
        console.log(`[stream] ⚡ panel ${panelArrivalCount}: ${panel.id} (${panel.atom})`)
        runtimeRef?.streamPanel(panel)
      },
    })

// Visual eval — runs AFTER render, captures what the user actually sees
const visualEvaluator = useStarter ? undefined : createClaudeVisualEvaluator({
  proxyUrl: 'http://localhost:3001/api/claude',
  model: 'claude-haiku-4-5-20251001',
})

const claudeConfig = {
  proxyUrl: 'http://localhost:3001/api/claude',
  model: 'claude-sonnet-4-6' as const,
  maxTokens: 8192,
}

const pane = createPane({
  agent,
  specEvalEnabled: false,
  designReview: useStarter ? undefined : {
    reviewCall: createClaudeDesignReview(claudeConfig),
    maxRounds: 2,
    enabled: false,  // Toggle via UI — default off
  },
  captureScreen: () => capturePane({ scale: 0.5, quality: 0.5, format: 'jpeg' }),
  decompose: useStarter ? undefined : {
    planCall: createClaudePlanCall(claudeConfig),
    sectionCall: createClaudeSectionCall(claudeConfig),
    concurrency: 3,
  },
  visualEval: visualEvaluator ? {
    captureScreen: () => capturePane({ scale: 0.5, quality: 0.6, format: 'jpeg' }),
    evaluateVisual: visualEvaluator,
    captureDelay: 1500,
    maxCorrections: 1,
    enabled: false,  // Toggle via UI — default off
  } : undefined,
})

// Phase 2: bind the runtime ref so connector callbacks can find it
runtimeRef = pane

// Expose runtime for visual eval script
;(window as any).__paneRuntime = pane

console.log(`Pane: ${useStarter ? 'Starter agent' : 'Claude + visual eval'}`)

function App() {
  return (
    <PaneProvider runtime={pane} theme={defaultTheme}>
      <PaneRenderer proxyUrl="http://localhost:3001/api/claude" />
    </PaneProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
