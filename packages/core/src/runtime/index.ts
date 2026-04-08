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
import { shouldIncludeImage } from '../context/image-gate.js'
import { OperationTracker } from '../operations/tracker.js'
import { validateView_ } from '../spec/validate.js'
import { MAX_NESTING_DEPTH, CAPTURE_DELAY, MAX_VISUAL_CORRECTIONS, MAX_DESIGN_REVIEW_ROUNDS } from '../limits.js'

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
  private ops: OperationTracker
  // Phase 2: tracks panel IDs that arrived via streamPanel during the current
  // turn. The final agent response's apply uses this to skip already-rendered
  // panels and avoid double-render thrash.
  private streamedPanelIds: Set<string> = new Set()
  private streamingActive = false

  constructor(config: PaneRuntimeConfig) {
    this.agent = config.agent
    this.visualEval = config.visualEval ?? null
    this.specEvalEnabled = config.specEvalEnabled ?? true
    this._visualEvalEnabled = config.visualEval?.enabled ?? false
    this.decomposeConfig = config.decompose ?? null
    this.designReview = config.designReview ?? null
    this.captureScreenFn = config.captureScreen ?? null
    this.actions = new ActionManager()
    this.feedbackStore = new FeedbackStore()
    this.ops = new OperationTracker()

    // Sync operations into session whenever they change
    this.ops.onChange((operations) => {
      this.session = { ...this.session, operations, version: this.session.version + 1 }
      this.notify()
    })

    this.session = {
      id: `session-${Date.now()}`,
      version: 0,
      activeContext: '',
      contexts: [],
      operations: [],
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

    // ── Phase 1: end-to-end timing baseline ──
    perfMark('pane:handleInput:start')

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

    // Capture screen — gated by mutation type and confidence
    let screenCapture: string | undefined
    const gateResult = shouldIncludeImage(classification, {
      designReviewEnabled: this.designReview?.enabled,
    })
    if (this.captureScreenFn && currentView && gateResult) {
      try {
        screenCapture = await this.captureScreenFn()
      } catch {}
    }

    // Build mutation context for Claude — pass the raw input so action
    // triggers (`__action:event:panelId`) can be reframed as interactions.
    const mutationPrompt = getMutationClaudePrompt(classification, currentView, input.content)

    // Layout planning — generate the plan to inform Claude's response, but DO NOT
    // render a scaffold. Phase 2 streaming + the THINKING indicator give the user
    // loading feedback. The scaffold caused a race condition where patches with
    // mismatched panel IDs would leave the scaffold visible forever.
    let layoutPlan: LayoutPlan | null = null
    if (classification.type === 'REPLACE_VIEW' && !isFirst) {
      layoutPlan = planLayout(input.content, classification, activeCtx?.modality)

      emitTelemetry('agent:request', {
        type: 'layout-plan',
        layout: layoutPlan.layout.pattern,
        slotCount: layoutPlan.slots.length,
        modality: layoutPlan.modality,
      }, { preview: `Layout: ${layoutPlan.layout.pattern} with ${layoutPlan.slots.length} slots (${layoutPlan.slots.map(s => s.label).join(', ')})` })

      // Mark Claude as "working" so the agent state shows the activity
      this.applyUpdate({
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
    const willDecompose = !!(this.decomposeConfig && shouldDecompose(input.content))
    if (willDecompose) {
      const decomposeOp = this.ops.start('decompose')
      emitTelemetry('agent:request', { type: 'decompose' }, { preview: `Decomposing complex request...` })

      const decomposeCfg: DecomposeConfig = {
        ...this.decomposeConfig!,
        onScaffold: (scaffoldUpdate) => {
          this.applyUpdate(scaffoldUpdate)
        },
        onSection: (sectionId, panels, progressUpdate) => {
          this.ops.updateMessage(decomposeOp, `Building section: ${sectionId}...`)
          this.applyUpdate(progressUpdate)
        },
        onComplete: (finalUpdate) => {
          // Final update handled below
        },
      }

      try {
        const start = performance.now()
        const update = await decomposeAndAssemble(input.content, sessionForAgent, decomposeCfg)
        const dur = Math.round(performance.now() - start)

        emitTelemetry('agent:response', {
          type: 'decompose-complete',
          contexts: update.contexts?.length ?? 0,
        }, { duration: dur, preview: `Decomposition complete (${dur}ms)` })

        this.ops.complete(decomposeOp)
        this.applyUpdate(update)
        if (this.specEvalEnabled) this.runSpecEval(update, dur)
      } catch (err) {
        this.ops.fail(decomposeOp, String(err))
        throw err
      }
    } else {
      const apiOp = this.ops.start('api-call', isFirst ? 'Generating view...' : 'Updating view...')

      try {
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

        // Quality gate: empty responses are a failure, not a success
        const hasContent = (update.contexts?.length ?? 0) > 0 || (update.actions?.length ?? 0) > 0
        if (!hasContent) {
          this.ops.fail(apiOp, 'Agent returned empty update — no contexts or actions')
          // Surface a visible error to the user instead of silently leaving the view stale
          const errorView: PaneView = {
            layout: { pattern: 'stack' },
            panels: [{
              id: 'empty-response-error',
              atom: 'text' as const,
              props: {
                content: `Agent returned an empty response after ${(dur / 1000).toFixed(1)}s. Try rephrasing your request.`,
                level: 'body',
              },
              source: 'pane-system',
              emphasis: 'urgent',
            }],
          }
          this.applyUpdate({
            contexts: [{
              id: this.session.activeContext || 'main',
              operation: this.session.contexts.length === 0 ? 'create' : 'update',
              view: errorView,
            }],
          })
          if (this.specEvalEnabled) this.runSpecEval(update, dur)
          perfMeasure('pane:handleInput', 'pane:handleInput:start')
          return this.session
        }

        this.ops.complete(apiOp)

        // Phase 2: if streaming already delivered all panels, skip the
        // redundant final apply (which would replace the streamed view with
        // an identical one, causing render thrash and animation flicker).
        // Reconcile any panels that didn't make it through the stream.
        if (this.streamingActive && this.streamedPanelIds.size > 0) {
          const reconciled = this.reconcileStreamedUpdate(update)
          if (reconciled) {
            this.applyUpdate(reconciled)
          }
          this.streamingActive = false
          this.streamedPanelIds.clear()
        } else {
          // Patch-to-replace coercion: when the user/classifier intended
          // REPLACE_VIEW but the agent returned a patch (often happens when
          // the layout planner gave Claude a slot ID prefix and Claude
          // interpreted it as an UPDATE_PANELS target), force the patch's
          // panels into a full view replacement so the new content actually
          // lands instead of being silently no-op'd by mismatched IDs.
          const coerced = classification.type === 'REPLACE_VIEW'
            ? coercePatchToReplace(update, activeCtx?.view ?? null)
            : update
          this.applyUpdate(coerced)
        }
        if (this.specEvalEnabled) this.runSpecEval(update, dur)
      } catch (err) {
        this.ops.fail(apiOp, String(err))
        throw err
      }
    }

    // Design review loop — iterate spec with council before user sees it
    if (this.designReview?.enabled) {
      const reviewOp = this.ops.start('design-review')
      try {
        await this.runDesignReviewLoop(input, sessionForAgent)
        this.ops.complete(reviewOp)
      } catch (err) {
        this.ops.fail(reviewOp, String(err))
      }
    }

    // Trigger visual eval AFTER render — runs async, doesn't block the return
    if (this._visualEvalEnabled) {
      this.runVisualEval()
    }

    perfMeasure('pane:handleInput', 'pane:handleInput:start')
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

  // ── Phase 2: Streaming Panel API ──
  // The Claude connector calls these as it parses panels out of the SSE stream.
  // This is the progressive rendering hook — panels appear as they arrive
  // instead of waiting for the full response.

  /** Receive an early layout hint — sets up the context shell so panels can land. */
  streamLayout(layout: { pattern: string; label?: string; modality?: string }): void {
    perfMark('pane:streamLayout')
    this.streamingActive = true
    this.streamedPanelIds.clear()
    const ctxId = this.session.activeContext || 'main'
    const existing = this.session.contexts.find(c => c.id === ctxId)
    if (existing) {
      // Replace the existing view with an empty shell at the new layout —
      // the streamed panels will fill it in
      this.applyUpdate({
        contexts: [{
          id: ctxId,
          operation: 'update' as const,
          label: layout.label ?? existing.label,
          modality: (layout.modality as any) ?? existing.modality,
          view: { layout: { pattern: layout.pattern as any }, panels: [] },
        }],
      })
      return
    }
    this.applyUpdate({
      contexts: [{
        id: ctxId,
        operation: 'create' as const,
        label: layout.label ?? 'Loading',
        modality: (layout.modality as any) ?? 'informational',
        view: { layout: { pattern: layout.pattern as any }, panels: [] },
      }],
    })
  }

  /**
   * Reconcile the final agent response with what was already streamed.
   * Returns null if everything is already in place. Otherwise returns
   * a minimal patch update for the panels that didn't stream through.
   */
  private reconcileStreamedUpdate(update: PaneSessionUpdate): PaneSessionUpdate | null {
    if (!update.contexts || update.contexts.length === 0) return null
    const ctx = update.contexts[0]
    if (!ctx.view) return null

    const fullPanels = ctx.view.panels ?? []
    const missingPanels = fullPanels.filter((p: any) => p.id && !this.streamedPanelIds.has(p.id))

    emitTelemetry('system:info', {
      type: 'stream-reconcile',
      streamed: this.streamedPanelIds.size,
      total: fullPanels.length,
      missing: missingPanels.length,
    }, {
      preview: `Stream reconcile: ${this.streamedPanelIds.size}/${fullPanels.length} streamed, ${missingPanels.length} to add`,
    })

    if (missingPanels.length === 0) return null

    return {
      contexts: [{
        id: ctx.id,
        operation: 'update' as const,
        patch: {
          type: 'ADD_PANELS' as const,
          panels: missingPanels,
          position: 'end' as const,
        },
      }],
      agents: update.agents,
    }
  }

  /** Receive a single completed panel from the stream. Appends it to the active view. */
  streamPanel(panel: any): void {
    perfMark('pane:streamPanel:start')
    if (panel?.id) this.streamedPanelIds.add(panel.id)
    const ctxId = this.session.activeContext || 'main'
    this.applyUpdate({
      contexts: [{
        id: ctxId,
        operation: 'update' as const,
        patch: {
          type: 'ADD_PANELS' as const,
          panels: [panel],
          position: 'end' as const,
        },
      }],
    })
    perfMeasure('pane:streamPanel', 'pane:streamPanel:start')
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
    this.ops.destroy()
    this.listeners.clear()
    this.agent.teardown?.(this.session)
  }

  // ── Internal ──

  private async runDesignReviewLoop(originalInput: PaneInput, sessionForAgent: PaneSession) {
    if (!this.designReview) return
    const { reviewCall, validateRender, maxRounds = MAX_DESIGN_REVIEW_ROUNDS } = this.designReview

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
    const evalOp = this.ops.start('spec-eval')
    try {
      const result = runEval({
        session: this.session,
        update,
        elapsedMs,
      })

      this.lastEvalResult = result
      this.ops.complete(evalOp)

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
      this.ops.fail(evalOp, String(err))
      emitTelemetry('system:info', { error: String(err) }, { preview: `Eval error: ${String(err).substring(0, 100)}` })
    }
  }

  private async runVisualEval() {
    if (!this.visualEval || !this._visualEvalEnabled || this.visualEvalRunning) return
    this.visualEvalRunning = true

    const visualOp = this.ops.start('visual-eval')
    const { captureScreen, evaluateVisual, captureDelay = CAPTURE_DELAY, maxCorrections = MAX_VISUAL_CORRECTIONS } = this.visualEval

    try {
      // Wait for React to paint and animations to settle
      emitTelemetry('visual:capture', {}, { preview: `Waiting ${captureDelay}ms for render to paint...` })
      await new Promise(r => setTimeout(r, captureDelay))

      let corrections = 0
      while (corrections < maxCorrections) {
        this.ops.updateMessage(visualOp, corrections > 0 ? `Applying correction ${corrections}...` : 'Capturing screenshot...')

        const captureStart = performance.now()
        const screenshot = await captureScreen()
        const captureDur = Math.round(performance.now() - captureStart)
        emitTelemetry('visual:capture', { size: screenshot.length }, {
          duration: captureDur,
          preview: `Screenshot captured (${Math.round(screenshot.length / 1024)}KB)`,
          image: screenshot,
        })

        this.ops.updateMessage(visualOp, 'Evaluating render...')
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

      this.ops.complete(visualOp)
    } catch (err) {
      this.ops.fail(visualOp, String(err))
      emitTelemetry('system:info', { error: String(err) }, { preview: `Visual eval error: ${String(err).substring(0, 100)}` })
    } finally {
      this.visualEvalRunning = false
    }
  }

  private applyUpdate(update: PaneSessionUpdate) {
    // ── Phase 1: baseline timing instrumentation ──
    perfMark('pane:applyUpdate:start')
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
    perfMeasure('pane:applyUpdate', 'pane:applyUpdate:start')
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
      const rawView = update.view ?? { layout: { pattern: 'stack' }, panels: [] }
      const { view: repairedView } = validateAndRepairView(rawView)
      const newCtx: PaneContext = {
        id: update.id,
        label: update.label ?? '',
        modality: update.modality ?? 'conversational',
        view: repairedView,
        status: update.status ?? 'active',
      }
      return [...contexts, newCtx]
    }

    case 'update': {
      return contexts.map(c => {
        if (c.id !== update.id) return c

        // Patch-based mutation — apply ViewPatch then validate
        if (update.patch) {
          const patchedView = patchView(c.view, update.patch)
          const { view: repairedView } = validateAndRepairView(patchedView)
          return {
            ...c,
            ...(update.label !== undefined && { label: update.label }),
            ...(update.modality !== undefined && { modality: update.modality }),
            view: repairedView,
            ...(update.status !== undefined && { status: update.status }),
          }
        }

        // Full view replacement — validate before applying
        if (update.view) {
          const { view: repairedView } = validateAndRepairView(update.view)
          return {
            ...c,
            ...(update.label !== undefined && { label: update.label }),
            ...(update.modality !== undefined && { modality: update.modality }),
            view: repairedView,
            ...(update.status !== undefined && { status: update.status }),
          }
        }

        return {
          ...c,
          ...(update.label !== undefined && { label: update.label }),
          ...(update.modality !== undefined && { modality: update.modality }),
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

// ── Patch coercion ──
// When the mutation classifier said REPLACE_VIEW but the agent returned
// a patch update (often because the layout planner's slot-ID hint nudged
// Claude toward UPDATE_PANELS semantics), convert the patch into a full
// view replacement. The patch's panels become the new view's panels.
// This guarantees the new content lands even when the agent's response
// shape doesn't match what the runtime expected.

function coercePatchToReplace(update: PaneSessionUpdate, currentView: PaneView | null): PaneSessionUpdate {
  if (!update.contexts || update.contexts.length === 0) return update

  const coercedContexts = update.contexts.map(cu => {
    // Already a full view replacement — leave alone
    if (cu.view) return cu
    // No patch either — leave alone (might be label/modality only)
    if (!cu.patch) return cu

    // Extract panels from the patch
    const patchPanels = (cu.patch.panels ?? []) as any[]
    if (patchPanels.length === 0) return cu

    // Build a new view from the patch's panels.
    // Inherit the layout from the current view if available, else stack.
    const layout = currentView?.layout ?? { pattern: 'stack' as const }

    return {
      ...cu,
      patch: undefined,
      view: { layout, panels: patchPanels },
    }
  })

  return { ...update, contexts: coercedContexts }
}

// ── Phase 1: Performance Instrumentation ──
// Lightweight wrappers around the User Timing API. Safe in Node (no-op) and
// browsers. Marks/measures show up in Chrome DevTools → Performance and
// can be queried via `performance.getEntriesByName()`.

function perfMark(name: string): void {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try { performance.mark(name) } catch {}
  }
}

function perfMeasure(name: string, startMark: string): void {
  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(name, startMark)
      const entries = performance.getEntriesByName(name, 'measure')
      const last = entries[entries.length - 1]
      if (last) {
        emitTelemetry('system:info', {
          type: 'perf-measure',
          name,
          duration: Math.round(last.duration),
        }, { duration: Math.round(last.duration), preview: `⏱  ${name}: ${Math.round(last.duration)}ms` })
      }
      // Clean up so marks don't accumulate
      performance.clearMarks(startMark)
      performance.clearMeasures(name)
    } catch {}
  }
}

// ── Quality Gate ──
// Validates and repairs views before they reach the renderer.
// The system owns correctness — agents advise, the runtime enforces.
//
// Phase 4: every repair is a structured record so the diagnostics panel
// can aggregate by category. Categories tell us where to tighten the prompt.

import type { PanePanel } from '../spec/types.js'

export type RepairType =
  | 'missing-id'              // panel had no id → generated one
  | 'duplicate-id'            // duplicate id in same view → removed
  | 'leaf-with-children'      // leaf atom had children → stripped
  | 'empty-required-prop'     // required prop missing → replaced with skeleton
  | 'missing-source'          // panel had no source attribution → defaulted to 'unknown'
  | 'depth-hoist'             // INFORMATIONAL — nesting hit safety net, children hoisted (no data lost)

/** Repair types that represent destructive corrections, vs informational notices */
export const DESTRUCTIVE_REPAIR_TYPES: Set<RepairType> = new Set([
  'missing-id',
  'duplicate-id',
  'leaf-with-children',
  'empty-required-prop',
  'missing-source',
])

export interface RepairRecord {
  type: RepairType
  panelId: string
  atom?: string
  detail?: string
}

function emitRepair(record: RepairRecord): void {
  emitTelemetry('system:info', {
    type: 'quality-gate:repair',
    repairType: record.type,
    panelId: record.panelId,
    atom: record.atom,
    detail: record.detail,
  }, {
    preview: `🔧 ${record.type} on ${record.panelId}${record.atom ? ` (${record.atom})` : ''}${record.detail ? ` — ${record.detail}` : ''}`,
  })
}

function validateAndRepairView(view: PaneView): { view: PaneView; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = []

  // 1. Validate — catch structural errors
  const result = validateView_(view)

  // 2. Repair what we can, reject what we can't
  let panels = view.panels

  // Remove panels with empty ids (generate if missing)
  panels = panels.map(p => {
    if (!p.id || p.id.length === 0) {
      const newId = `auto-${Math.random().toString(36).slice(2, 8)}`
      repairs.push({ type: 'missing-id', panelId: newId, atom: p.atom, detail: 'generated' })
      return { ...p, id: newId }
    }
    return p
  })

  // Flatten excessive nesting
  panels = flattenDeep(panels, 1, MAX_NESTING_DEPTH, repairs)

  // Strip children from atoms that don't accept them
  panels = panels.map(p => repairPanel(p, repairs))

  // Deduplicate panel ids (keep first occurrence)
  const seenIds = new Set<string>()
  panels = panels.filter(p => {
    if (seenIds.has(p.id)) {
      repairs.push({ type: 'duplicate-id', panelId: p.id, atom: p.atom })
      return false
    }
    seenIds.add(p.id)
    return true
  })

  // Emit one event per repair so diagnostics can aggregate
  for (const r of repairs) emitRepair(r)

  if (repairs.length > 0) {
    // Summary event for status strip / quick glance.
    // Only DESTRUCTIVE repairs count toward the headline number — depth-hoist
    // is informational and shouldn't pollute the signal.
    const counts: Record<string, number> = {}
    let destructiveCount = 0
    for (const r of repairs) {
      counts[r.type] = (counts[r.type] ?? 0) + 1
      if (DESTRUCTIVE_REPAIR_TYPES.has(r.type)) destructiveCount++
    }
    const breakdown = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')
    emitTelemetry('system:info', {
      type: 'quality-gate',
      repairCount: destructiveCount,
      totalEvents: repairs.length,
      breakdown: counts,
    }, {
      preview: destructiveCount > 0
        ? `Quality gate: ${destructiveCount} repair(s) — ${breakdown}`
        : `Quality gate: clean (${repairs.length} info notice${repairs.length === 1 ? '' : 's'})`,
    })
  }

  return { view: { ...view, panels }, repairs }
}

/** Atoms that must not have children */
const LEAF_ATOMS: Set<string> = new Set([
  'text', 'image', 'input', 'shape', 'icon', 'spacer',
  'badge', 'divider', 'progress', 'skeleton', 'pill', 'frame',
])

/**
 * Required props per atom — if ALL listed props are empty/missing,
 * the panel is replaced with a skeleton. Uses OR logic: at least one
 * prop in the list must have a truthy value.
 */
const REQUIRED_PROPS: Record<string, string[]> = {
  text:     ['content'],
  image:    ['src'],
  frame:    ['src', 'html'],
  icon:     ['name'],
  badge:    ['label'],
  pill:     ['label'],
  chart:    ['data'],
  progress: ['value', 'max'],
  list:     ['items'],
  map:      ['center'],
}

function repairPanel(panel: PanePanel, repairs: RepairRecord[]): PanePanel {
  let p = panel

  // Strip children from leaf atoms
  if (LEAF_ATOMS.has(p.atom) && p.children && p.children.length > 0) {
    repairs.push({
      type: 'leaf-with-children',
      panelId: p.id,
      atom: p.atom,
      detail: `${p.children.length} children stripped`,
    })
    p = { ...p, children: undefined }
  }

  // Replace atoms with empty required props with skeleton
  const required = REQUIRED_PROPS[p.atom]
  if (required) {
    const props = (p.props ?? {}) as Record<string, unknown>
    const hasContent = required.some(key => {
      const val = props[key]
      if (val === undefined || val === null || val === '') return false
      if (Array.isArray(val) && val.length === 0) return false
      return true
    })
    if (!hasContent) {
      repairs.push({
        type: 'empty-required-prop',
        panelId: p.id,
        atom: p.atom,
        detail: `missing: ${required.join('|')}`,
      })
      p = { ...p, atom: 'skeleton' as any, props: { variant: 'rect', height: '32px' } }
    }
  }

  // Ensure source attribution
  if (!p.source) {
    repairs.push({ type: 'missing-source', panelId: p.id, atom: p.atom })
    p = { ...p, source: 'unknown' }
  }

  // Recurse into children
  if (p.children && p.children.length > 0) {
    p = { ...p, children: p.children.map(c => repairPanel(c, repairs)) }
  }

  return p
}

/**
 * Flattens panels that exceed max nesting depth by HOISTING their children
 * up to the current level instead of stripping them. Preserves all content;
 * just collapses one level of structure. Recursive — children of flattened
 * panels are themselves flattened if still over limit.
 *
 * Example with maxDepth=3:
 *   [box A [box B [box C [text "x"], text "y"]]]
 *   becomes
 *   [box A [box B [text "x", text "y"]]]   (box C dropped, its children promoted)
 */
function flattenDeep(panels: PanePanel[], depth: number, maxDepth: number, repairs: RepairRecord[]): PanePanel[] {
  const result: PanePanel[] = []

  for (const p of panels) {
    if (!p.children || p.children.length === 0) {
      result.push(p)
      continue
    }

    if (depth >= maxDepth) {
      // We're at the safety net — this panel's children would push past it.
      // Hoist its children to the current level. This is INFORMATIONAL, not
      // a quality failure: all content is preserved, just at one shallower level.
      repairs.push({
        type: 'depth-hoist',
        panelId: p.id,
        atom: p.atom,
        detail: `depth ${depth} >= max ${maxDepth} (hoisted ${p.children.length} children)`,
      })
      // Keep the panel itself but drop its children, then push its children
      // as siblings at the current level. This preserves both the panel's
      // own visual presence (its props, styling) AND its content.
      result.push({ ...p, children: undefined })
      // Recursively flatten the hoisted children at the SAME depth — they'll
      // be re-checked against maxDepth.
      const hoisted = flattenDeep(p.children, depth, maxDepth, repairs)
      result.push(...hoisted)
      continue
    }

    // Within budget — recurse into children at depth+1
    result.push({ ...p, children: flattenDeep(p.children, depth + 1, maxDepth, repairs) })
  }

  return result
}

// ── Factory ──

export function createPane(config: PaneRuntimeConfig): PaneRuntime {
  return new PaneRuntime(config)
}
