// ────────────────────────────────────────────
// Dimension 4: Interaction Quality
//
// Did the system respond appropriately to
// interjections, feedback, context shifts?
// Is the agent responsive and respectful of
// user sovereignty?
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'

export function evalInteractionQuality(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []
  const { session, update, input, previousSession, elapsedMs } = ctx

  // Rule: Agent response time should be reasonable
  if (elapsedMs !== undefined) {
    if (elapsedMs > 10000) {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'fail',
        rule: 'response-time',
        message: `Agent took ${(elapsedMs / 1000).toFixed(1)}s to respond — too slow for interactive use`,
        suggestion: 'Agent should respond in under 3s for conversational, under 5s for complex operations',
      })
    } else if (elapsedMs > 5000) {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'warn',
        rule: 'response-time',
        message: `Agent took ${(elapsedMs / 1000).toFixed(1)}s to respond`,
        suggestion: 'Consider streaming partial updates for long operations',
      })
    } else {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'pass',
        rule: 'response-time',
        message: `Agent responded in ${elapsedMs}ms`,
      })
    }
  }

  // Rule: Interjections should be acknowledged
  if (input?.isInterjection && update) {
    const interruptedActions = input.interruptedActionIds ?? []
    if (interruptedActions.length > 0) {
      // Check if the interrupted actions are still in the update or session
      const updatedActionIds = (update.actions ?? []).map(a => a.id)
      const acknowledged = interruptedActions.some(id =>
        updatedActionIds.includes(id) || session.actions.some(a => a.id === id)
      )
      if (!acknowledged) {
        findings.push({
          dimension: 'interaction-quality',
          grade: 'warn',
          rule: 'interjection-acknowledged',
          message: `User interjected during actions [${interruptedActions.join(', ')}] but they disappeared from the session`,
          suggestion: 'Interrupted work should be preserved (paused/background) unless the user explicitly cancelled',
        })
      } else {
        findings.push({
          dimension: 'interaction-quality',
          grade: 'pass',
          rule: 'interjection-acknowledged',
          message: 'Interjection handled — interrupted work preserved',
        })
      }
    }
  }

  // Rule: Agent should produce an update (not ignore input)
  if (input && !update) {
    findings.push({
      dimension: 'interaction-quality',
      grade: 'fail',
      rule: 'input-not-ignored',
      message: 'User provided input but agent returned no update',
      suggestion: 'Every user input should produce at least a minimal response',
    })
  } else if (input && update) {
    const hasContent = (update.contexts?.length ?? 0) > 0 ||
                       (update.actions?.length ?? 0) > 0 ||
                       (update.agents?.length ?? 0) > 0
    if (!hasContent) {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'warn',
        rule: 'meaningful-response',
        message: 'Agent returned an update but it contains no context changes, actions, or status updates',
        suggestion: 'Even a simple acknowledgment should produce a visible change on the surface',
      })
    }
  }

  // Rule: Context shifts should preserve previous state
  if (previousSession && session.activeContext !== previousSession.activeContext) {
    const prevContextIds = previousSession.contexts.map(c => c.id)
    const currContextIds = session.contexts.map(c => c.id)
    const lostContexts = prevContextIds.filter(id => !currContextIds.includes(id))

    if (lostContexts.length > 0) {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'warn',
        rule: 'context-preservation',
        message: `Context shift dropped contexts: [${lostContexts.join(', ')}]`,
        suggestion: 'Previous contexts should move to "background" status, not be removed, so the user can return',
      })
    } else {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'pass',
        rule: 'context-preservation',
        message: 'Context shift preserved all previous contexts',
      })
    }
  }

  // Rule: Feedback should accumulate, not be lost
  if (previousSession) {
    const prevFeedbackCount = previousSession.feedback.length
    const currFeedbackCount = session.feedback.length
    if (currFeedbackCount < prevFeedbackCount) {
      findings.push({
        dimension: 'interaction-quality',
        grade: 'fail',
        rule: 'feedback-preserved',
        message: `Feedback entries decreased from ${prevFeedbackCount} to ${currFeedbackCount} — user feedback was lost`,
        suggestion: 'Feedback is append-only. Never remove feedback entries unless the user explicitly retracts.',
      })
    }
  }

  // Rule: Actions in flight should have progress
  const executingActions = session.actions.filter(a => a.status === 'executing')
  for (const action of executingActions) {
    if (action.progress === undefined && action.startedAt) {
      const elapsed = Date.now() - action.startedAt
      if (elapsed > 5000) {
        findings.push({
          dimension: 'interaction-quality',
          grade: 'warn',
          rule: 'action-progress',
          message: `Action "${action.label}" has been executing for ${(elapsed / 1000).toFixed(0)}s with no progress indicator`,
          suggestion: 'Long-running actions should report progress so the user knows the system is working',
        })
      }
    }
  }

  return findings
}
