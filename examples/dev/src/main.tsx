import { createRoot } from 'react-dom/client'
import { createPane, claudeAgent, createClaudeVisualEvaluator, createClaudePlanCall, createClaudeSectionCall } from '@pane/core'
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

const agent = useStarter
  ? starterAgent
  : claudeAgent({
      proxyUrl: 'http://localhost:3001/api/claude',
      model: 'claude-sonnet-4-6',
      maxTokens: 16384,
    })

// Visual eval — runs AFTER render, captures what the user actually sees
const visualEvaluator = useStarter ? undefined : createClaudeVisualEvaluator({
  proxyUrl: 'http://localhost:3001/api/claude',
  model: 'claude-haiku-4-5-20251001',
})

const claudeConfig = {
  proxyUrl: 'http://localhost:3001/api/claude',
  model: 'claude-sonnet-4-6' as const,
  maxTokens: 16384,
}

const pane = createPane({
  agent,
  specEvalEnabled: false,
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
