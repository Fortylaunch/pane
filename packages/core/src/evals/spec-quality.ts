// ────────────────────────────────────────────
// Dimension 1: Spec Quality
//
// Is the generated spec valid, well-structured,
// and appropriate?
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'
import type { PanePanel, PaneView } from '../spec/types.js'
import { validateSpec, validateView_ } from '../spec/validate.js'

export function evalSpecQuality(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []
  const { session, update } = ctx

  // Rule: Session must be valid
  const validation = validateSpec(session)
  if (!validation.valid) {
    for (const err of validation.errors) {
      findings.push({
        dimension: 'spec-quality',
        grade: 'fail',
        rule: 'valid-spec',
        message: `Spec validation failed: ${err.message}`,
        path: err.path,
        suggestion: 'Fix the structural issue in the spec',
      })
    }
  } else {
    findings.push({
      dimension: 'spec-quality',
      grade: 'pass',
      rule: 'valid-spec',
      message: 'Spec is structurally valid',
    })
  }

  // Rule: Active context must exist in contexts array
  const activeCtx = session.contexts.find(c => c.id === session.activeContext)
  if (!activeCtx) {
    findings.push({
      dimension: 'spec-quality',
      grade: 'fail',
      rule: 'active-context-exists',
      message: `Active context "${session.activeContext}" not found in contexts array`,
      suggestion: 'Ensure activeContext references a valid context id',
    })
  } else {
    findings.push({
      dimension: 'spec-quality',
      grade: 'pass',
      rule: 'active-context-exists',
      message: 'Active context exists',
    })
  }

  // Rule: No empty views (at least one panel in active context)
  if (activeCtx?.view.panels.length === 0) {
    findings.push({
      dimension: 'spec-quality',
      grade: 'warn',
      rule: 'non-empty-view',
      message: 'Active context has zero panels — the user sees nothing',
      suggestion: 'Ensure the agent produces at least one panel for the active view',
    })
  }

  // Rule: Panel ids should be unique across the entire session
  const allPanelIds = new Set<string>()
  const duplicates: string[] = []
  for (const ctx of session.contexts) {
    collectPanelIds(ctx.view.panels, allPanelIds, duplicates)
  }
  if (duplicates.length > 0) {
    findings.push({
      dimension: 'spec-quality',
      grade: 'fail',
      rule: 'unique-panel-ids',
      message: `Duplicate panel ids found across contexts: ${duplicates.join(', ')}`,
      suggestion: 'Panel ids must be unique across the entire session for transitions to work',
    })
  }

  // Rule: Reasonable panel depth (warn at 5, fail at 8)
  const maxDepth = getMaxDepth(activeCtx?.view.panels ?? [])
  if (maxDepth > 8) {
    findings.push({
      dimension: 'spec-quality',
      grade: 'fail',
      rule: 'nesting-depth',
      message: `Panel nesting depth is ${maxDepth} — too deep`,
      suggestion: 'Flatten the panel tree. Deep nesting degrades rendering performance and readability.',
    })
  } else if (maxDepth > 5) {
    findings.push({
      dimension: 'spec-quality',
      grade: 'warn',
      rule: 'nesting-depth',
      message: `Panel nesting depth is ${maxDepth} — approaching limit`,
    })
  }

  // Rule: Update should not be excessively large
  if (update) {
    const contextCount = update.contexts?.length ?? 0
    const actionCount = update.actions?.length ?? 0
    if (contextCount > 10) {
      findings.push({
        dimension: 'spec-quality',
        grade: 'warn',
        rule: 'update-size',
        message: `Update creates/modifies ${contextCount} contexts — unusually large`,
        suggestion: 'Consider whether this many context changes are necessary in a single update',
      })
    }
  }

  return findings
}

function collectPanelIds(panels: PanePanel[], seen: Set<string>, duplicates: string[]) {
  for (const panel of panels) {
    if (seen.has(panel.id)) {
      duplicates.push(panel.id)
    }
    seen.add(panel.id)
    if (panel.children) {
      collectPanelIds(panel.children, seen, duplicates)
    }
  }
}

function getMaxDepth(panels: PanePanel[], depth = 1): number {
  let max = depth
  for (const panel of panels) {
    if (panel.children && panel.children.length > 0) {
      max = Math.max(max, getMaxDepth(panel.children, depth + 1))
    }
  }
  return max
}
