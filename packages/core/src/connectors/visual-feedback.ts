// ────────────────────────────────────────────
// Visual Feedback Agent Wrapper
//
// Wraps any PaneAgent and adds a self-correction
// loop: after the agent produces a spec and it
// renders, a screenshot is captured and sent back
// to the agent for evaluation and adjustment.
// ────────────────────────────────────────────

import type {
  PaneAgent,
  PaneInput,
  PaneSession,
  PaneSessionUpdate,
  PaneTrackedAction,
} from '../spec/types.js'
import { emitTelemetry } from '../telemetry/index.js'

export interface VisualFeedbackConfig {
  // The inner agent to wrap
  agent: PaneAgent

  // Function that captures the current screen (provided by renderer)
  captureScreen: () => Promise<string>

  // Function that sends the screenshot to an evaluator and gets corrections
  evaluateVisual: (screenshot: string, session: PaneSession) => Promise<PaneSessionUpdate | null>

  // How many correction rounds to allow (default: 1)
  maxCorrections?: number

  // Minimum delay between render and capture (ms) to let animations settle
  captureDelay?: number

  // Whether visual feedback is enabled (can be toggled at runtime)
  enabled?: boolean
}

export function visualFeedbackAgent(config: VisualFeedbackConfig): PaneAgent & { setEnabled: (v: boolean) => void } {
  const {
    agent,
    captureScreen,
    evaluateVisual,
    maxCorrections = 1,
    captureDelay = 800,
  } = config

  let enabled = config.enabled ?? true

  async function withVisualFeedback(
    update: PaneSessionUpdate,
    session: PaneSession
  ): Promise<PaneSessionUpdate> {
    if (!enabled) return update

    // Let the renderer draw, then capture
    emitTelemetry('visual:capture', {}, { preview: `Waiting ${captureDelay}ms for render to settle...` })
    await delay(captureDelay)

    let currentUpdate = update
    let corrections = 0

    while (corrections < maxCorrections) {
      try {
        const captureStart = performance.now()
        const screenshot = await captureScreen()
        const captureDur = Math.round(performance.now() - captureStart)
        emitTelemetry('visual:capture', { size: screenshot.length }, { duration: captureDur, preview: `Screenshot captured (${Math.round(screenshot.length / 1024)}KB)`, image: screenshot })

        emitTelemetry('visual:evaluate', {}, { preview: 'Sending screenshot to evaluator...' })
        const evalStart = performance.now()
        const correction = await evaluateVisual(screenshot, session)
        const evalDur = Math.round(performance.now() - evalStart)

        if (!correction) {
          emitTelemetry('visual:approved', {}, { duration: evalDur, preview: `Render approved (${evalDur}ms)` })
          break
        }

        emitTelemetry('visual:correction', {
          correctionKeys: Object.keys(correction),
          contextCount: correction.contexts?.length ?? 0,
        }, { duration: evalDur, preview: `Correction needed — ${correction.contexts?.length ?? 0} context updates (${evalDur}ms)` })

        currentUpdate = mergeUpdates(currentUpdate, correction)
        corrections++

        await delay(captureDelay)
      } catch (err) {
        emitTelemetry('system:info', { error: String(err) }, { preview: `Visual feedback error: ${String(err).substring(0, 100)}` })
        break
      }
    }

    return currentUpdate
  }

  return {
    async init(input: PaneInput) {
      const update = await agent.init(input)
      return withVisualFeedback(update, {
        id: '', version: 0, activeContext: '',
        contexts: [], conversation: [], actions: [],
        agents: [], artifacts: [], feedback: [],
      })
    },

    async onInput(input: PaneInput, session: PaneSession) {
      const update = await agent.onInput(input, session)
      return withVisualFeedback(update, session)
    },

    async onActionResult(action: PaneTrackedAction, session: PaneSession) {
      if (!agent.onActionResult) return {}
      const update = await agent.onActionResult(action, session)
      return withVisualFeedback(update, session)
    },

    tick: agent.tick?.bind(agent),
    teardown: agent.teardown?.bind(agent),

    setEnabled(v: boolean) {
      enabled = v
    },
  }
}

// ── Claude-specific visual evaluator ──

export interface ClaudeVisualEvalConfig {
  proxyUrl: string
  model?: string
}

/**
 * Creates an evaluateVisual function that sends screenshots to Claude
 * and asks it to assess and correct the rendered output.
 */
export function createClaudeVisualEvaluator(config: ClaudeVisualEvalConfig) {
  const { proxyUrl, model = 'claude-haiku-4-5-20251001' } = config

  return async function evaluateVisual(
    screenshotBase64: string,
    session: PaneSession
  ): Promise<PaneSessionUpdate | null> {
    // Strip data URL prefix if present
    const base64 = screenshotBase64.includes(',')
      ? screenshotBase64.split(',')[1]
      : screenshotBase64

    const mediaType = screenshotBase64.includes('image/png') ? 'image/png' : 'image/jpeg'

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: `You are a visual quality evaluator for a dynamic workspace called Pane. You apply six design voices: Tufte (data-ink ratio), Cooper (goal-directed), Ive (inevitability), Norman (usability), Yablonski (cognitive law), Van Cleef (context/experience).

You will receive a screenshot of the current rendered surface. Evaluate it against:
1. Readability — can you see all content clearly? Is contrast sufficient?
2. Layout — is the layout structured? Is there a clear focal point? Is hierarchy evident?
3. Density — is information density appropriate for the modality?
4. Completeness — does the view look complete? Is content missing/cut off?
5. Design quality — would Tufte, Cooper, Ive, Norman, Yablonski, and Van Cleef approve?

Respond with JSON:

If APPROVED:
{
  "approved": true,
  "evaluation": {
    "readability": "pass|warn|fail — explanation",
    "layout": "pass|warn|fail — explanation",
    "density": "pass|warn|fail — explanation",
    "completeness": "pass|warn|fail — explanation",
    "design_quality": "pass|warn|fail — explanation",
    "overall_assessment": "Summary of what works and what could improve"
  }
}

If CORRECTION NEEDED:
{
  "approved": false,
  "evaluation": { ...same as above... },
  "correction_reasoning": "What I'm fixing and why",
  "update": { ...PaneSessionUpdate with fixes... }
}

Respond ONLY with valid JSON.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Current session has ${session.contexts.length} contexts, active: "${session.activeContext}". Evaluate this screenshot.`,
            },
          ],
        }],
      }),
    })

    if (!res.ok) {
      console.warn('[pane:visual-eval] API error:', res.status)
      return null
    }

    const data = await res.json()
    const text = data.content?.[0]?.text

    if (!text) return null

    try {
      const cleaned = text.replace(/^```json?\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
      const result = JSON.parse(cleaned)

      // Emit evaluation details as telemetry
      if (result.evaluation) {
        emitTelemetry('visual:evaluate', {
          type: 'visual-assessment',
          approved: result.approved,
          ...result.evaluation,
        }, {
          preview: result.approved
            ? `✓ Visual approved: ${result.evaluation.overall_assessment ?? 'looks good'}`
            : `✗ Visual issues: ${result.evaluation.overall_assessment ?? 'corrections needed'}`,
        })
      }

      if (result.approved) {
        return null
      }

      // Emit correction reasoning
      if (result.correction_reasoning) {
        emitTelemetry('visual:correction', {
          reasoning: result.correction_reasoning,
        }, {
          preview: `Correcting: ${result.correction_reasoning}`,
        })
      }

      // Return the correction update
      const update = result.update
      if (update) {
        return normalizeVisualCorrection(update, session)
      }

      return null
    } catch {
      return null
    }
  }
}

// Normalize corrections the same way we normalize main responses
function normalizeVisualCorrection(raw: any, session: PaneSession): PaneSessionUpdate {
  const update: PaneSessionUpdate = {}
  if (raw.contexts && Array.isArray(raw.contexts)) {
    update.contexts = raw.contexts.map((ctx: any) => ({
      id: ctx.id ?? session.activeContext ?? 'main',
      operation: ctx.operation ?? 'update',
      label: ctx.label,
      modality: ctx.modality,
      view: ctx.view,
      status: ctx.status,
    }))
  }
  return update
}

// ── Helpers ──

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mergeUpdates(a: PaneSessionUpdate, b: PaneSessionUpdate): PaneSessionUpdate {
  return {
    contexts: [...(a.contexts ?? []), ...(b.contexts ?? [])],
    actions: [...(a.actions ?? []), ...(b.actions ?? [])],
    agents: [...(a.agents ?? []), ...(b.agents ?? [])],
    artifacts: [...(a.artifacts ?? []), ...(b.artifacts ?? [])],
    feedback: [...(a.feedback ?? []), ...(b.feedback ?? [])],
  }
}
