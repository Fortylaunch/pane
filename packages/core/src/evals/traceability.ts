// ────────────────────────────────────────────
// Dimension 5: Traceability
//
// Is everything sourced, timed, observable?
// Can the user always answer "where did this
// come from?" and "what happened?"
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'
import type { PanePanel } from '../spec/types.js'

export function evalTraceability(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []
  const { session } = ctx

  // Rule: Every panel must have a source
  for (const context of session.contexts) {
    checkPanelSources(context.view.panels, `contexts["${context.id}"]`, findings)
  }

  if (!findings.some(f => f.rule === 'panel-source' && f.grade === 'fail')) {
    findings.push({
      dimension: 'traceability',
      grade: 'pass',
      rule: 'panel-source',
      message: 'All panels have source attribution',
    })
  }

  // Rule: Every action must have a source
  for (const action of session.actions) {
    if (!action.source || action.source.length === 0) {
      findings.push({
        dimension: 'traceability',
        grade: 'fail',
        rule: 'action-source',
        message: `Action "${action.label}" (${action.id}) has no source — can't trace who initiated it`,
        path: `actions["${action.id}"]`,
        suggestion: 'Every action must be attributed to a source agent',
      })
    }
  }

  if (!findings.some(f => f.rule === 'action-source' && f.grade === 'fail')) {
    findings.push({
      dimension: 'traceability',
      grade: 'pass',
      rule: 'action-source',
      message: 'All actions have source attribution',
    })
  }

  // Rule: Completed actions should have timing
  const completedActions = session.actions.filter(a => a.status === 'completed')
  for (const action of completedActions) {
    if (action.duration === undefined) {
      findings.push({
        dimension: 'traceability',
        grade: 'warn',
        rule: 'action-timing',
        message: `Completed action "${action.label}" has no duration — user can't see how long it took`,
        path: `actions["${action.id}"]`,
        suggestion: 'Populate duration on completion for observability',
      })
    }
    if (action.startedAt === undefined) {
      findings.push({
        dimension: 'traceability',
        grade: 'warn',
        rule: 'action-timing',
        message: `Completed action "${action.label}" has no startedAt timestamp`,
        path: `actions["${action.id}"]`,
      })
    }
  }

  // Rule: Every artifact must have location and retention
  for (const artifact of session.artifacts) {
    if (!artifact.location || artifact.location.length === 0) {
      findings.push({
        dimension: 'traceability',
        grade: 'fail',
        rule: 'artifact-location',
        message: `Artifact "${artifact.label}" has no location — user can't find it`,
        suggestion: 'Every artifact must have a location (URI, path, or service name)',
      })
    }
    if (!artifact.retention) {
      findings.push({
        dimension: 'traceability',
        grade: 'fail',
        rule: 'artifact-retention',
        message: `Artifact "${artifact.label}" has no retention policy — user doesn't know how long it persists`,
        suggestion: 'Every artifact needs a retention policy: "session", "persistent", or { expiresAt }',
      })
    }
    if (!artifact.source || artifact.source.length === 0) {
      findings.push({
        dimension: 'traceability',
        grade: 'fail',
        rule: 'artifact-source',
        message: `Artifact "${artifact.label}" has no source — can't trace who produced it`,
      })
    }
  }

  if (session.artifacts.length > 0 && !findings.some(f => f.rule.startsWith('artifact-') && f.grade === 'fail')) {
    findings.push({
      dimension: 'traceability',
      grade: 'pass',
      rule: 'artifact-complete',
      message: `All ${session.artifacts.length} artifacts have source, location, and retention`,
    })
  }

  // Rule: Agent statuses should be current
  for (const agent of session.agents) {
    if (agent.state === 'working' && !agent.currentTask) {
      findings.push({
        dimension: 'traceability',
        grade: 'warn',
        rule: 'agent-task-visible',
        message: `Agent "${agent.name}" is working but currentTask is empty — user can't see what it's doing`,
        suggestion: 'When an agent is working, describe what it\'s doing in plain language',
      })
    }
  }

  // Rule: Feedback should have view snapshots
  for (const fb of session.feedback) {
    if (!fb.viewSnapshot) {
      findings.push({
        dimension: 'traceability',
        grade: 'warn',
        rule: 'feedback-snapshot',
        message: `Feedback "${fb.signal}" has no view snapshot — can't see what the user was reacting to`,
        suggestion: 'Always capture the view state when feedback is given',
      })
    }
    if (!fb.target || Object.values(fb.target).every(v => !v)) {
      findings.push({
        dimension: 'traceability',
        grade: 'warn',
        rule: 'feedback-target',
        message: `Feedback "${fb.signal}" has no target — not clear what it's about`,
        suggestion: 'Feedback should target at least one of: panelId, actionId, contextId, agentId, recipeId',
      })
    }
  }

  return findings
}

function checkPanelSources(panels: PanePanel[], path: string, findings: EvalFinding[]) {
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i]
    if (!panel.source || panel.source.length === 0) {
      findings.push({
        dimension: 'traceability',
        grade: 'fail',
        rule: 'panel-source',
        message: `Panel "${panel.id}" has no source — content is untraceable`,
        path: `${path}.panels[${i}]`,
        suggestion: 'Every panel must be attributed to a source agent (traceability principle)',
      })
    }
    if (panel.children) {
      checkPanelSources(panel.children, `${path}.panels[${i}].children`, findings)
    }
  }
}
