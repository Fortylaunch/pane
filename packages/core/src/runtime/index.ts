// ────────────────────────────────────────────
// Runtime
//
// The session loop. Input → agent → update →
// state change → renderer observes.
// ────────────────────────────────────────────

import type {
  PaneAgent,
  PaneSession,
  PaneSessionUpdate,
  PaneContextUpdate,
  PaneInput,
  PaneTrackedAction,
  PaneContext,
  PaneFeedback,
  PaneView,
} from '../spec/types.js'
import { ActionManager } from '../actions/index.js'
import { FeedbackStore } from '../feedback/index.js'
import { emitTelemetry } from '../telemetry/index.js'
import { runEval, formatEvalResult } from '../evals/runner.js'
import type { EvalResult } from '../evals/types.js'

export interface VisualEvalConfig {
  captureScreen: () => Promise<string>
  evaluateVisual: (screenshot: string, session: PaneSession) => Promise<PaneSessionUpdate | null>
  captureDelay?: number     // ms to wait after render before capture (default: 1200)
  maxCorrections?: number   // max correction rounds (default: 1)
  enabled?: boolean
}

export interface PaneRuntimeConfig {
  agent: PaneAgent
  tickInterval?: number     // ms — how often to call agent.tick(). 0 = disabled.
  visualEval?: VisualEvalConfig  // post-render visual evaluation
  specEvalEnabled?: boolean // 6D spec eval after each response (default: false)
}

export type SessionListener = (session: PaneSession) => void

export class PaneRuntime {
  private session: PaneSession
  private agent: PaneAgent
  private actions: ActionManager
  private feedbackStore: FeedbackStore
  private listeners: Set<SessionListener> = new Set()
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private initialized = false
  private visualEval: VisualEvalConfig | null = null
  private visualEvalRunning = false
  private lastEvalResult: EvalResult | null = null
  private specEvalEnabled = false
  private _visualEvalEnabled = false

  constructor(config: PaneRuntimeConfig) {
    this.agent = config.agent
    this.visualEval = config.visualEval ?? null
    this.specEvalEnabled = config.specEvalEnabled ?? false
    this._visualEvalEnabled = config.visualEval?.enabled ?? false
    this.actions = new ActionManager()
    this.feedbackStore = new FeedbackStore()

    this.session = {
      id: `session-${Date.now()}`,
      version: 0,
      activeContext: '',
      contexts: [],
      conversation: [],
      actions: [],
      agents: [],
      artifacts: [],
      feedback: [],
    }

    // Wire action changes back into session
    this.actions.onActionChange((action) => {
      this.syncActionsToSession()
      this.notify()

      // Notify agent of action results
      if (action.status === 'completed' || action.status === 'failed' || action.status === 'rolled-back') {
        this.agent.onActionResult?.(action, this.session).then(update => {
          if (update) this.applyUpdate(update)
        })
      }
    })

    // Start tick if configured
    if (config.tickInterval && config.tickInterval > 0 && this.agent.tick) {
      this.tickTimer = setInterval(async () => {
        if (!this.initialized) return
        const update = await this.agent.tick!(this.session)
        if (update) this.applyUpdate(update)
      }, config.tickInterval)
    }
  }

  // ── Public API ──

  async init(input: PaneInput): Promise<PaneSession> {
    const update = await this.agent.init(input)
    this.applyUpdate(update)
    this.addConversationEntry('user', input.content, input.timestamp)
    this.initialized = true
    return this.session
  }

  async handleInput(input: PaneInput): Promise<PaneSession> {
    if (!this.initialized) {
      return this.init(input)
    }

    emitTelemetry('agent:request', {
      content: input.content,
      isInterjection: input.isInterjection,
      modality: input.modality,
    }, { preview: `User: "${input.content.substring(0, 80)}"` })

    this.addConversationEntry('user', input.content, input.timestamp)

    // Attach eval findings from last response so the agent can self-correct
    const sessionForAgent = this.lastEvalResult
      ? Object.assign({}, this.session, {
          __lastEvalFindings: this.lastEvalResult.findings
            .filter(f => f.grade !== 'pass')
            .map(f => `[${f.dimension}] ${f.message}${f.suggestion ? ` → ${f.suggestion}` : ''}`),
        })
      : this.session

    const start = performance.now()
    const update = await this.agent.onInput(input, sessionForAgent)
    const dur = Math.round(performance.now() - start)

    emitTelemetry('agent:response', {
      contexts: update.contexts?.length ?? 0,
      actions: update.actions?.length ?? 0,
      agents: update.agents?.length ?? 0,
    }, { duration: dur, preview: `Agent responded: ${update.contexts?.length ?? 0} contexts, ${update.actions?.length ?? 0} actions (${dur}ms)` })

    this.applyUpdate(update)

    // Run 6D spec eval on the updated session (if enabled)
    if (this.specEvalEnabled) {
      this.runSpecEval(update, dur)
    }

    // Trigger visual eval AFTER render — runs async, doesn't block the return
    if (this._visualEvalEnabled) {
      this.runVisualEval()
    }

    return this.session
  }

  async confirmAction(actionId: string): Promise<PaneTrackedAction> {
    return this.actions.confirm(actionId)
  }

  cancelAction(actionId: string) {
    this.actions.cancel(actionId)
    this.syncActionsToSession()
    this.notify()
  }

  async rollbackAction(actionId: string): Promise<PaneTrackedAction> {
    return this.actions.rollback(actionId)
  }

  addFeedback(feedback: PaneFeedback) {
    this.feedbackStore.add(feedback)
    this.session = {
      ...this.session,
      version: this.session.version + 1,
      feedback: this.feedbackStore.getAll(),
    }
    this.notify()
  }

  retractFeedback(feedbackId: string): boolean {
    const result = this.feedbackStore.retract(feedbackId)
    if (result) {
      this.session = {
        ...this.session,
        version: this.session.version + 1,
        feedback: this.feedbackStore.getAll(),
      }
      this.notify()
    }
    return result
  }

  getSession(): PaneSession {
    return this.session
  }

  getLastEvalResult(): EvalResult | null {
    return this.lastEvalResult
  }

  setSpecEvalEnabled(enabled: boolean) {
    this.specEvalEnabled = enabled
  }

  isSpecEvalEnabled(): boolean {
    return this.specEvalEnabled
  }

  setVisualEvalEnabled(enabled: boolean) {
    this._visualEvalEnabled = enabled
    if (this.visualEval) {
      this.visualEval.enabled = enabled
    }
  }

  isVisualEvalEnabled(): boolean {
    return this._visualEvalEnabled
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  destroy() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    this.listeners.clear()
    this.agent.teardown?.(this.session)
  }

  // ── Internal ──

  private runSpecEval(update: PaneSessionUpdate, elapsedMs: number) {
    try {
      const result = runEval({
        session: this.session,
        update,
        elapsedMs,
      })

      this.lastEvalResult = result

      // Emit eval results as telemetry
      const issues = result.findings.filter(f => f.grade !== 'pass')
      emitTelemetry('eval:result', {
        overallGrade: result.overallGrade,
        dimensions: result.dimensions,
        issueCount: issues.length,
      }, {
        duration: result.duration,
        preview: `6D Eval: ${result.overallGrade.toUpperCase()} (${issues.length} issues, ${result.duration}ms)`,
      })

      // Log individual issues for observability
      for (const issue of issues) {
        emitTelemetry('eval:finding', {
          dimension: issue.dimension,
          grade: issue.grade,
          rule: issue.rule,
          message: issue.message,
          suggestion: issue.suggestion,
        }, {
          preview: `[${issue.dimension}] ${issue.grade}: ${issue.message}`,
        })
      }
    } catch (err) {
      emitTelemetry('system:info', { error: String(err) }, { preview: `Eval error: ${String(err).substring(0, 100)}` })
    }
  }

  private async runVisualEval() {
    if (!this.visualEval || !this._visualEvalEnabled || this.visualEvalRunning) return
    this.visualEvalRunning = true

    const { captureScreen, evaluateVisual, captureDelay = 1200, maxCorrections = 1 } = this.visualEval

    try {
      // Wait for React to paint and animations to settle
      emitTelemetry('visual:capture', {}, { preview: `Waiting ${captureDelay}ms for render to paint...` })
      await new Promise(r => setTimeout(r, captureDelay))

      let corrections = 0
      while (corrections < maxCorrections) {
        const captureStart = performance.now()
        const screenshot = await captureScreen()
        const captureDur = Math.round(performance.now() - captureStart)
        emitTelemetry('visual:capture', { size: screenshot.length }, {
          duration: captureDur,
          preview: `Screenshot captured (${Math.round(screenshot.length / 1024)}KB)`,
          image: screenshot,
        })

        emitTelemetry('visual:evaluate', {}, { preview: 'Sending screenshot to evaluator...' })
        const evalStart = performance.now()
        const correction = await evaluateVisual(screenshot, this.session)
        const evalDur = Math.round(performance.now() - evalStart)

        if (!correction) {
          emitTelemetry('visual:approved', {}, { duration: evalDur, preview: `Render approved (${evalDur}ms)` })
          break
        }

        emitTelemetry('visual:correction', {
          contextCount: correction.contexts?.length ?? 0,
        }, { duration: evalDur, preview: `Correction applied — ${correction.contexts?.length ?? 0} context updates (${evalDur}ms)` })

        this.applyUpdate(correction)
        corrections++

        // Wait for correction to paint
        await new Promise(r => setTimeout(r, captureDelay))
      }
    } catch (err) {
      emitTelemetry('system:info', { error: String(err) }, { preview: `Visual eval error: ${String(err).substring(0, 100)}` })
    } finally {
      this.visualEvalRunning = false
    }
  }

  private applyUpdate(update: PaneSessionUpdate) {
    console.log('[pane:runtime] Applying update:', {
      contexts: update.contexts?.length ?? 0,
      actions: update.actions?.length ?? 0,
      agents: update.agents?.length ?? 0,
    })
    let nextSession = { ...this.session }

    // Apply context updates
    if (update.contexts) {
      let contexts = [...nextSession.contexts]
      for (const cu of update.contexts) {
        contexts = applyContextUpdate(contexts, cu)
        if (cu.operation === 'activate') {
          nextSession.activeContext = cu.id
        }
      }
      nextSession.contexts = contexts

      // If no active context set yet, use the first one
      if (!nextSession.activeContext && contexts.length > 0) {
        nextSession.activeContext = contexts[0].id
      }
    }

    // Apply action updates
    if (update.actions) {
      for (const action of update.actions) {
        if (action.status === 'proposed') {
          this.actions.propose(action)
        }
      }
    }

    // Apply agent status updates
    if (update.agents) {
      const agentMap = new Map(nextSession.agents.map(a => [a.id, a]))
      for (const agent of update.agents) {
        agentMap.set(agent.id, agent)
      }
      nextSession.agents = [...agentMap.values()]
    }

    // Apply artifact updates
    if (update.artifacts) {
      const artifactMap = new Map(nextSession.artifacts.map(a => [a.id, a]))
      for (const artifact of update.artifacts) {
        artifactMap.set(artifact.id, artifact)
      }
      nextSession.artifacts = [...artifactMap.values()]
    }

    nextSession.version = nextSession.version + 1
    this.session = nextSession
    this.syncActionsToSession()
    this.notify()
  }

  private syncActionsToSession() {
    this.session = {
      ...this.session,
      actions: this.actions.getAllActions(),
    }
  }

  private addConversationEntry(role: 'user' | 'agent', content: string, timestamp: number) {
    this.session = {
      ...this.session,
      conversation: [
        ...this.session.conversation,
        {
          id: `conv-${this.session.conversation.length}`,
          role,
          content,
          timestamp,
          contextId: this.session.activeContext,
        },
      ],
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.session)
    }
  }
}

// ── Context Update Logic ──

function applyContextUpdate(contexts: PaneContext[], update: PaneContextUpdate): PaneContext[] {
  switch (update.operation) {
    case 'create': {
      const existing = contexts.find(c => c.id === update.id)
      if (existing) return contexts // don't duplicate
      const newCtx: PaneContext = {
        id: update.id,
        label: update.label ?? '',
        modality: update.modality ?? 'conversational',
        view: update.view ?? { layout: { pattern: 'stack' }, panels: [] },
        status: update.status ?? 'active',
      }
      return [...contexts, newCtx]
    }

    case 'update': {
      return contexts.map(c => {
        if (c.id !== update.id) return c
        return {
          ...c,
          ...(update.label !== undefined && { label: update.label }),
          ...(update.modality !== undefined && { modality: update.modality }),
          ...(update.view !== undefined && { view: update.view }),
          ...(update.status !== undefined && { status: update.status }),
        }
      })
    }

    case 'remove': {
      return contexts.filter(c => c.id !== update.id)
    }

    case 'activate': {
      return contexts.map(c => ({
        ...c,
        status: c.id === update.id ? 'active' as const : c.status === 'active' ? 'background' as const : c.status,
      }))
    }

    default:
      return contexts
  }
}

// ── Factory ──

export function createPane(config: PaneRuntimeConfig): PaneRuntime {
  return new PaneRuntime(config)
}
