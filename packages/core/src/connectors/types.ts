// ────────────────────────────────────────────
// Pane Agent Protocol
//
// Universal connector — any backend that speaks
// this format can drive the surface.
// ────────────────────────────────────────────

import type { PaneInput, PaneSession, PaneSessionUpdate } from '../spec/types.js'

// ── Wire Format ──

// What Pane sends to the backend
export interface PaneRequest {
  type: 'init' | 'input' | 'action-result' | 'tick'
  input?: PaneInput
  session: PaneSession
  timestamp: number
}

// What the backend sends back
export interface PaneResponse {
  update: PaneSessionUpdate
  timestamp: number
  latency?: number        // ms — backend self-reports how long it took
}

// Streaming: the backend sends partial responses
export interface PaneStreamChunk {
  partial: PaneSessionUpdate
  done: boolean
  timestamp: number
}

// ── Connector Config ──

export interface HttpConnectorConfig {
  url: string
  headers?: Record<string, string>
  timeout?: number          // ms, default 30000
}

export interface WsConnectorConfig {
  url: string
  protocols?: string[]
  reconnect?: boolean       // auto-reconnect on disconnect, default true
  tickInterval?: number     // ms — ask backend for tick updates
}

export interface ClaudeConnectorConfig {
  apiKey?: string           // required if calling API directly; omit if using proxy
  proxyUrl?: string         // proxy endpoint (e.g., http://localhost:3001/api/claude)
  model?: string            // default: claude-sonnet-4-6
  systemPrompt?: string     // instructions for how Claude should produce specs
  maxTokens?: number        // default: 4096
  stream?: boolean          // enable streaming responses (default: true)
  onStreamChunk?: (text: string, accumulated: string) => void  // callback for each chunk
  // Phase 2: progressive panel rendering
  onStreamPanel?: (panel: any, ctxHint: { id?: string; label?: string; modality?: string; layout?: string }) => void
  onStreamLayout?: (layout: { pattern: string; label?: string; modality?: string }) => void
}
