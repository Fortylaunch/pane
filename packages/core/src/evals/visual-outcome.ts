// ────────────────────────────────────────────
// Dimension 3: Visual Outcome
//
// Does the composed view make sense visually?
// Density, balance, readability, action clarity.
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'
import type { PanePanel } from '../spec/types.js'

export function evalVisualOutcome(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []

  const activeCtx = ctx.session.contexts.find(c => c.id === ctx.session.activeContext)
  if (!activeCtx) return findings

  const { panels } = activeCtx.view
  const layout = activeCtx.view.layout

  // Rule: Panel count should be reasonable for the layout
  const panelCount = panels.length
  if (layout.pattern === 'grid' && layout.columns) {
    const expectedMax = layout.columns * 4 // 4 rows max before scroll
    if (panelCount > expectedMax) {
      findings.push({
        dimension: 'visual-outcome',
        grade: 'warn',
        rule: 'grid-density',
        message: `Grid has ${panelCount} panels in ${layout.columns} columns — likely requires excessive scrolling`,
        suggestion: `Consider tabs or pagination for more than ${expectedMax} items in a ${layout.columns}-column grid`,
      })
    }
  }

  if (layout.pattern === 'stack' && panelCount > 8) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'stack-length',
      message: `Stack has ${panelCount} panels — long vertical scroll`,
      suggestion: 'Consider grouping panels into containers or using tabs for better scanability',
    })
  }

  if (layout.pattern === 'split' && panelCount !== 2) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'split-panel-count',
      message: `Split layout has ${panelCount} panels — split expects exactly 2`,
      suggestion: 'Use a container (box) to group multiple panels into each split pane',
    })
  }

  // Rule: Views shouldn't be all one atom type (low variety = low utility)
  const atomCounts = countAtoms(panels)
  const uniqueAtoms = Object.keys(atomCounts).length
  if (panelCount > 3 && uniqueAtoms === 1) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'atom-variety',
      message: `All ${panelCount} panels use the same atom type "${Object.keys(atomCounts)[0]}" — visually monotonous`,
      suggestion: 'Mix atom types for a more useful and scannable interface',
    })
  } else if (panelCount > 1) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'pass',
      rule: 'atom-variety',
      message: `View uses ${uniqueAtoms} different atom types across ${panelCount} panels`,
    })
  }

  // Rule: Emphasis should be used sparingly
  const emphasisCounts = countEmphasis(panels)
  const urgentCount = emphasisCounts['urgent'] ?? 0
  const primaryCount = emphasisCounts['primary'] ?? 0
  if (urgentCount > 2) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'emphasis-overuse',
      message: `${urgentCount} panels marked "urgent" — if everything is urgent, nothing is`,
      suggestion: 'Reserve "urgent" emphasis for at most 1-2 items that truly need immediate attention',
    })
  }
  if (primaryCount > 3) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'emphasis-overuse',
      message: `${primaryCount} panels marked "primary" — too many competing for attention`,
      suggestion: 'Limit primary emphasis to 1-2 panels that represent the main focus',
    })
  }

  // Rule: Actions should have clear hierarchy
  const allActions = collectActions(panels)
  const primaryActions = allActions.filter(a => a === 'primary')
  if (primaryActions.length > 3) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'action-hierarchy',
      message: `${primaryActions.length} primary actions visible — unclear what the main action is`,
      suggestion: 'Limit to 1-2 primary actions. Use secondary/ghost for the rest.',
    })
  }

  // Rule: Text-heavy views should have structure
  const textPanels = panels.filter(p => p.atom === 'text')
  if (textPanels.length > 5 && uniqueAtoms <= 2) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'warn',
      rule: 'text-structure',
      message: `View has ${textPanels.length} text panels with little visual structure`,
      suggestion: 'Break text-heavy views with spacers, containers with borders, or data-display atoms',
    })
  }

  if (findings.length === 0) {
    findings.push({
      dimension: 'visual-outcome',
      grade: 'pass',
      rule: 'overall',
      message: 'View composition looks balanced',
    })
  }

  return findings
}

function countAtoms(panels: PanePanel[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of panels) {
    counts[p.atom] = (counts[p.atom] ?? 0) + 1
    if (p.children) {
      const childCounts = countAtoms(p.children)
      for (const [k, v] of Object.entries(childCounts)) {
        counts[k] = (counts[k] ?? 0) + v
      }
    }
  }
  return counts
}

function countEmphasis(panels: PanePanel[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of panels) {
    if (p.emphasis) {
      counts[p.emphasis] = (counts[p.emphasis] ?? 0) + 1
    }
    if (p.children) {
      const childCounts = countEmphasis(p.children)
      for (const [k, v] of Object.entries(childCounts)) {
        counts[k] = (counts[k] ?? 0) + v
      }
    }
  }
  return counts
}

function collectActions(panels: PanePanel[]): string[] {
  const actions: string[] = []
  for (const p of panels) {
    if (p.on) {
      // panels with event bindings are actionable
      actions.push(p.emphasis ?? 'default')
    }
    if (p.children) actions.push(...collectActions(p.children))
  }
  return actions
}
