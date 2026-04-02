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
import { decomposeAndAssemble, shouldDecompose, type DecomposeConfig } from '../decompose/index.js'
import { patchView } from '../mutations/patch.js'
import { classifyMutation } from '../mutations/classifier.js'
import { getMutationClaudePrompt } from '../mutations/registry.js'
import { planLayout, planToScaffold, type LayoutPlan } from '../mutations/layout-planner.js'

export interface VisualEvalConfig {
  captureScreen: () => Promise<string>
  evaluateVisual: (screenshot: string, session: PaneSession) => Promise<PaneSessionUpdate | null>
  captureDelay?: number     // ms to wait after render before capture (default: 1200)
  maxCorrections?: number   // max correction rounds (default: 1)
  enabled?: boolean
}

/**
 * Pre-render design review loop.
 * After the agent generates a view, send the spec to a design reviewer.
 * If issues are found, feed them back to the agent to fix. Iterate
 * until approved or maxRounds is reached. Optionally validate the
 * final render via Playwright screenshot.
 */
export interface DesignReviewConfig {
  /** Function that reviews a session spec and returns findings (empty = approved) */
  reviewCall: (session: PaneSession) => Promise<string[]>
  /** Function that captures + validates the rendered output (optional) */
  validateRender?: () => Promise<{ passed: boolean; issues: string[] }>
  /** Max review rounds before showing to user (default: 2) */
  maxRounds?: number
  /** Enabled (default: false) */
  enabled?: boolean
}

export interface PaneRuntimeConfig {
  agent: PaneAgent
  tickInterval?: number     // ms — how often to call agent.tick(). 0 = disabled.
  visualEval?: VisualEvalConfig  // post-render visual evaluation
  specEvalEnabled?: boolean // 6D spec eval after each response (default: false)
  decompose?: DecomposeConfig   // request decomposition for complex views
  designReview?: DesignReviewConfig // pre-render design review loop
  captureScreen?: () => Promise<string>  // lightweight screen capture for mutation context
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
  private decomposeConfig: DecomposeConfig | null = null
  private designFeedback: string[] = []
  private designReview: DesignReviewConfig | null = null
  private captureScreenFn: (() => Promise<string>) | null = null

  constructor(config: PaneRuntimeConfig) {
    this.agent = config.agent
    this.visualEval = config.visualEval ?? null
    this.specEvalEnabled = config.specEvalEnabled ?? false
    this._visualEvalEnabled = config.visualEval?.enabled ?? false
    this.decomposeConfig = config.decompose ?? null
    this.designReview = config.designReview ?? null
    this.captureScreenFn = config.captureScreen ?? null
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
    return this.handleInput(input)
  }

  async handleInput(input: PaneInput): Promise<PaneSession> {
    const isFirst = !this.initialized
    if (isFirst) {
      this.initialized = true
    }

    emitTelemetry('agent:request', {
      content: input.content,
      isInterjection: input.isInterjection,
      modality: input.modality,
    }, { preview: `User: "${input.content.substring(0, 80)}"` })

    this.addConversationEntry('user', input.content, input.timestamp)

    // Attach eval + design council findings so the agent can self-correct
    const evalFindings = this.lastEvalResult
      ? this.lastEvalResult.findings
          .filter(f => f.grade !== 'pass')
          .map(f => `[${f.dimension}] ${f.message}${f.suggestion ? ` → ${f.suggestion}` : ''}`)
      : []

    const allFeedback = [...evalFindings, ...this.designFeedback]

    // Classify mutation type (deterministic, <1ms)
    const activeCtx = this.session.contexts.find(c => c.id === this.session.activeContext)
    const currentView = activeCtx?.view ?? null
    const classification = classifyMutation(input.content, currentView)

    emitTelemetry('agent:request', {
      type: 'mutation-classify',
      mutationType: classification.type,
      confidence: classification.confidence,
      affectedPanelIds: classification.affectedPanelIds,
    }, { preview: `Mutation: ${classification.type} (${Math.round(classification.confidence * 100)}%) — ${classification.reason}` })

    // Capture screen for partial mutations (lightweight JPEG)
    let screenCapture: string | undefined
    if (this.captureScreenFn && currentView && classification.type !== 'REPLACE_VIEW') {
      try {
        screenCapture = await this.captureScreenFn()
      } catch {}
    }

    // Build mutation context for Claude
    const mutationPrompt = getMutationClaudePrompt(classification, currentView)

    // Layout planning — for REPLACE_VIEW on existing views, plan grid and scaffold
    let layoutPlan: LayoutPlan | null = null
    if (classification.type === 'REPLACE_VIEW' && !isFirst) {
      layoutPlan = planLayout(input.content, classification, activeCtx?.modality)

      emitTelemetry('agent:request', {
        type: 'layout-plan',
        layout: layoutPlan.layout.pattern,
        slotCount: layoutPlan.slots.length,
        modality: layoutPlan.modality,
      }, { preview: `Layout: ${layoutPlan.layout.pattern} with ${layoutPlan.slots.length} slots (${layoutPlan.slots.map(s => s.label).join(', ')})` })

      // Render scaffold immediately — user sees the grid with loading indicators
      const scaffold = planToScaffold(layoutPlan, 'layout-planner')
      this.applyUpdate({
        contexts: [{
          id: this.session.activeContext || 'main',
          operation: this.session.contexts.length === 0 ? 'create' : 'update',
          label: layoutPlan.slots[0]?.label ?? 'Loading',
          modality: layoutPlan.modality,
          view: scaffold,
        }],
        agents: [{ id: 'claude', name: 'Claude', state: 'working', currentTask: 'Generating content...', lastActive: Date.now() }],
      })
    }

    // Build session context for agent — include layout plan so Claude fills slots
    const layoutContext = layoutPlan
      ? `\nLAYOUT PLAN: ${layoutPlan.layout.pattern} layout with slots: ${layoutPlan.slots.map(s => `${s.id} (${s.label}, ${s.role})`).join(', ')}. Generate panels matching these slot IDs. Use slot ID as the panel ID prefix.`
      : ''

    const sessionForAgent = Object.assign({}, this.session, {
      ...(allFeedback.length > 0 ? { __lastEvalFindings: allFeedback } : {}),
      __mutationClassification: classification,
      __mutationPrompt: mutationPrompt + layoutContext,
      __screenCapture: screenCapture,
    })

    // Clear design feedback after it's been sent (one-shot)
    if (this.designFeedback.length > 0) {
      this.designFeedback = []
    }

    // Route: decompose complex requests or go direct
    if (this.decomposeConfig && shouldDecompose(input.content)) {
      emitTelemetry('agent:request', { type: 'decompose' }, { preview: `Decomposing complex request...` })

      const decomposeCfg: DecomposeConfig = {
        ...this.decomposeConfig,
        onScaffold: (scaffoldUpdate) => {
          this.applyUpdate(scaffoldUpdate)
        },
        onSection: (sectionId, panels, progressUpdate) => {
          this.applyUpdate(progressUpdate)
        },
        onComplete: (finalUpdate) => {
          // Final update handled below
        },
      }

      const start = performance.now()
      const update = await decomposeAndAssemble(input.content, sessionForAgent, decomposeCfg)
      const dur = Math.round(performance.now() - start)

      emitTelemetry('agent:response', {
        type: 'decompose-complete',
        contexts: update.contexts?.length ?? 0,
      }, { duration: dur, preview: `Decomposition complete (${dur}ms)` })

      this.applyUpdate(update)
      if (this.specEvalEnabled) this.runSpecEval(update, dur)
    } else {
      const start = performance.now()
      const update = isFirst
        ? await this.agent.init(input)
        : await this.agent.onInput(input, sessionForAgent)
      const dur = Math.round(performance.now() - start)

      emitTelemetry('agent:response', {
        contexts: update.contexts?.length ?? 0,
        actions: update.actions?.length ?? 0,
        agents: update.agents?.length ?? 0,
      }, { duration: dur, preview: `Agent responded: ${update.contexts?.length ?? 0} contexts, ${update.actions?.length ?? 0} actions (${dur}ms)` })

      this.applyUpdate(update)
      if (this.specEvalEnabled) this.runSpecEval(update, dur)
    }

    // Design review loop — iterate spec with council before user sees it
    if (this.designReview?.enabled) {
      await this.runDesignReviewLoop(input, sessionForAgent)
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

  /**
   * Store design council feedback so it's included in the next agent call.
   * This closes the loop: user consults design council → findings inform
   * the next Claude response.
   */
  setDesignFeedback(findings: string[]) {
    this.designFeedback = findings
  }

  getDesignFeedback(): string[] {
    return this.designFeedback
  }

  setDesignReviewEnabled(enabled: boolean) {
    if (this.designReview) this.designReview.enabled = enabled
  }

  isDesignReviewEnabled(): boolean {
    return this.designReview?.enabled ?? false
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

  private async runDesignReviewLoop(originalInput: PaneInput, sessionForAgent: PaneSession) {
    if (!this.designReview) return
    const { reviewCall, validateRender, maxRounds = 2 } = this.designReview

    for (let round = 0; round < maxRounds; round++) {
      emitTelemetry('eval:result', {
        type: 'design-review',
        round: round + 1,
      }, { preview: `Design review round ${round + 1}/${maxRounds}...` })

      // Review current spec
      const reviewStart = performance.now()
      const issues = await reviewCall(this.session)
      const reviewDur = Math.round(performance.now() - reviewStart)

      if (issues.length === 0) {
        emitTelemetry('eval:result', {
          type: 'design-review-approved',
          round: round + 1,
        }, { duration: reviewDur, preview: `Design review approved (round ${round + 1}, ${reviewDur}ms)` })
        break
      }

      emitTelemetry('eval:finding', {
        type: 'design-review-issues',
        round: round + 1,
        issueCount: issues.length,
        issues: issues.slice(0, 5),
      }, { duration: reviewDur, preview: `Design review: ${issues.length} issues found (round ${round + 1}) — regenerating` })

      // Feed findings back to agent and regenerate
      const fixSession = Object.assign({}, this.session, {
        __lastEvalFindings: issues.map(i => `[design-review] ${i}`),
      })

      const fixStart = performance.now()
      const fixUpdate = await this.agent.onInput(originalInput, fixSession)
      const fixDur = Math.round(performance.now() - fixStart)

      emitTelemetry('agent:response', {
        type: 'design-review-fix',
        round: round + 1,
      }, { duration: fixDur, preview: `Agent regenerated after design review (round ${round + 1}, ${fixDur}ms)` })

      this.applyUpdate(fixUpdate)
    }

    // Optional: Playwright render validation
    if (validateRender) {
      emitTelemetry('eval:result', { type: 'render-validation' }, { preview: 'Validating rendered output...' })

      const valStart = performance.now()
      const validation = await validateRender()
      const valDur = Math.round(performance.now() - valStart)

      if (validation.passed) {
        emitTelemetry('eval:result', { type: 'render-validation-passed' }, { duration: valDur, preview: `Render validation passed (${valDur}ms)` })
      } else {
        emitTelemetry('eval:finding', {
          type: 'render-validation-failed',
          issues: validation.issues,
        }, { duration: valDur, preview: `Render validation: ${validation.issues.length} issues (${valDur}ms)` })
      }
    }
  }

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

    // Track last mutation for renderer animation decisions
    if (update.contexts) {
      const patchUpdate = update.contexts.find(cu => cu.patch)
      if (patchUpdate?.patch) {
        nextSession.lastMutation = {
          type: patchUpdate.patch.type,
          affectedPanelIds: patchUpdate.patch.panelIds ?? patchUpdate.patch.panels?.map(p => p.id) ?? [],
          timestamp: Date.now(),
        }
      } else {
        nextSession.lastMutation = {
          type: 'REPLACE_VIEW',
          affectedPanelIds: [],
          timestamp: Date.now(),
        }
      }
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

        // Patch-based mutation — apply ViewPatch instead of replacing view
        if (update.patch) {
          const patchedView = patchView(c.view, update.patch)
          return {
            ...c,
            ...(update.label !== undefined && { label: update.label }),
            ...(update.modality !== undefined && { modality: update.modality }),
            view: patchedView,
            ...(update.status !== undefined && { status: update.status }),
          }
        }

        // Full view replacement (existing behavior)
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
