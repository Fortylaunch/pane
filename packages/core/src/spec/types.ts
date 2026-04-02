// ────────────────────────────────────────────
// @pane/core — Spec Types
// The contract everything speaks.
// ────────────────────────────────────────────

// ── Atoms ──

export type AtomType =
  | 'box'
  | 'text'
  | 'image'
  | 'input'
  | 'shape'
  | 'frame'
  | 'icon'
  | 'spacer'
  | 'badge'
  | 'divider'
  | 'progress'
  | 'list'
  | 'chart'
  | 'skeleton'
  | 'pill'
  | 'map'

// ── Layout ──

export type LayoutPattern =
  | 'stack'
  | 'split'
  | 'grid'
  | 'tabs'
  | 'overlay'
  | 'flow'
  | 'sidebar'
  | 'dashboard'

export interface LayoutConfig {
  pattern: LayoutPattern
  ratio?: string            // for split: "1:1", "1:2", "2:1"
  columns?: number          // for grid
  gap?: string              // spacing between panels
  autoFill?: boolean        // for grid: use repeat(auto-fill, minmax(...))
  minWidth?: string         // for grid autoFill: min column width, e.g. "280px"
  sidebarWidth?: string     // for sidebar: e.g. "280px"
  sidebarPosition?: 'left' | 'right'  // for sidebar: default 'left'
}

// ── Panels ──

export interface PanePanel {
  id: string
  atom: AtomType
  recipe?: string
  props: Record<string, unknown>
  source: string             // REQUIRED — which agent owns this panel
  data?: string              // data binding reference
  children?: PanePanel[]
  emphasis?: Emphasis
  reactive?: ReactiveBehavior[]
  on?: Record<string, string> // event bindings: { "click": "action-id" }
}

export type Emphasis = 'default' | 'primary' | 'muted' | 'urgent'

export interface ReactiveBehavior {
  watches: string            // panel id or action event
  trigger: string            // what event triggers reaction
  effect: 'refresh' | 'update' | 'collapse' | 'emphasize'
}

// ── Views ──

export interface PaneView {
  layout: LayoutConfig
  panels: PanePanel[]
}

// ── Actions ──

export interface PaneAction {
  id: string
  label: string
  type: 'primary' | 'secondary' | 'danger' | 'ghost'
  event: string
  payload?: Record<string, unknown>
  inline?: boolean
}

export type ActionStatus =
  | 'proposed'
  | 'confirmed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled-back'

export interface PaneTrackedAction {
  id: string
  label: string
  source: string
  status: ActionStatus
  requiresConfirmation: boolean
  reversible: boolean
  progress?: number          // 0-1
  result?: unknown
  error?: string
  startedAt?: number
  completedAt?: number
  duration?: number          // ms — always populated on completion
}

// ── Observability ──

export type AgentState = 'idle' | 'working' | 'waiting' | 'error'

export interface AgentStatus {
  id: string
  name: string
  state: AgentState
  currentTask?: string       // what it's doing, in plain language
  lastActive: number
  latency?: number           // ms
}

export type ArtifactRetention =
  | 'session'
  | 'persistent'
  | { expiresAt: number }

export interface PaneArtifact {
  id: string
  label: string
  source: string
  contextId: string
  createdAt: number
  location: string           // URI, path, service name
  retention: ArtifactRetention
  type: string               // "document" | "image" | "data" | "code" | etc.
}

// ── Feedback ──

export type FeedbackType = 'positive' | 'negative' | 'correction' | 'preference'

export interface FeedbackTarget {
  panelId?: string
  actionId?: string
  contextId?: string
  recipeId?: string
  agentId?: string
}

export interface PaneFeedback {
  id: string
  timestamp: number
  type: FeedbackType
  target: FeedbackTarget
  signal: string             // what the user said/did
  viewSnapshot: PaneView     // what the view looked like
}

// ── Interaction ──

export type InputModality = 'text' | 'voice' | 'camera' | 'gesture'

export interface PaneInput {
  id: string
  content: string
  modality: InputModality
  timestamp: number
  isInterjection: boolean
  interruptedActionIds?: string[]
}

// ── Modality ──

export type ModalityHint =
  | 'conversational'
  | 'informational'
  | 'compositional'
  | 'transactional'
  | 'collaborative'
  | 'environmental'

// ── Context ──

export type ContextStatus = 'active' | 'background' | 'preparing'

export interface PaneContext {
  id: string
  label: string
  modality: ModalityHint
  meta?: Record<string, unknown>
  view: PaneView
  status: ContextStatus
}

// ── Session ──

export interface ConversationEntry {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: number
  contextId: string
}

export interface PaneSession {
  id: string
  version: number
  activeContext: string
  contexts: PaneContext[]
  conversation: ConversationEntry[]
  actions: PaneTrackedAction[]
  agents: AgentStatus[]
  artifacts: PaneArtifact[]
  feedback: PaneFeedback[]
}

// ── Agent Interface ──

export type ContextOperation = 'create' | 'update' | 'remove' | 'activate'

export interface PaneContextUpdate {
  id: string
  operation: ContextOperation
  label?: string
  modality?: ModalityHint
  view?: PaneView
  status?: ContextStatus
}

export interface PaneSessionUpdate {
  contexts?: PaneContextUpdate[]
  actions?: PaneTrackedAction[]
  agents?: AgentStatus[]
  artifacts?: PaneArtifact[]
  feedback?: PaneFeedback[]
}

export interface PaneAgent {
  init(input: PaneInput): Promise<PaneSessionUpdate>
  onInput(input: PaneInput, session: PaneSession): Promise<PaneSessionUpdate>
  onActionResult?(action: PaneTrackedAction, session: PaneSession): Promise<PaneSessionUpdate>
  tick?(session: PaneSession): Promise<PaneSessionUpdate | null>
  teardown?(session: PaneSession): Promise<void>
}

// ── Events ──

export type PaneEventType = 'action' | 'input' | 'navigation' | 'feedback'

export interface PaneEvent {
  type: PaneEventType
  actionId?: string
  panelId?: string
  payload?: Record<string, unknown>
  timestamp: number
}

// ── Recipes ──

export interface RecipeDefinition {
  id: string
  name: string
  description: string
  expand: (props: Record<string, unknown>) => PanePanel
}
