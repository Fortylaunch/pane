// ────────────────────────────────────────────
// Design Quality Eval
//
// Applies the Pane Composition Ruleset to
// evaluate agent-composed views against the
// six-voice design intelligence.
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'
import type { PanePanel, PaneView } from '../spec/types.js'

export function evalDesignQuality(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []
  const activeCtx = ctx.session.contexts.find(c => c.id === ctx.session.activeContext)
  if (!activeCtx) return findings

  const { view } = activeCtx
  const allPanels = flattenPanels(view.panels)

  // ── Tufte: Data-ink ratio ──

  // Empty boxes (no children, no content)
  const emptyBoxes = allPanels.filter(p => p.atom === 'box' && (!p.children || p.children.length === 0))
  if (emptyBoxes.length > 0) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'tufte:no-empty-boxes',
      message: `${emptyBoxes.length} empty box(es) — every container must hold content`,
      suggestion: 'Remove empty boxes or add children. Use spacer atoms for whitespace.',
    })
  }

  // Unnecessary wrapper boxes (single child, no styling)
  const wrapperBoxes = allPanels.filter(p =>
    p.atom === 'box' && p.children?.length === 1 &&
    !p.props.background && !p.props.borderColor && !p.props.border
  )
  if (wrapperBoxes.length > 0) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'tufte:no-unnecessary-wrappers',
      message: `${wrapperBoxes.length} box(es) wrapping a single child with no styling — unnecessary nesting`,
      suggestion: 'Eliminate wrapper boxes that add no visual structure.',
    })
  }

  // ── Cooper: Goal-directed density ──

  const modality = activeCtx.modality
  const atomCount = allPanels.length
  const densityTargets: Record<string, [number, number]> = {
    conversational: [5, 25],
    informational: [15, 80],
    compositional: [10, 40],
    transactional: [5, 30],
    collaborative: [10, 50],
    environmental: [5, 100],
  }

  const [minAtoms, maxAtoms] = densityTargets[modality] ?? [5, 80]
  if (atomCount > maxAtoms) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'cooper:density-ceiling',
      message: `${atomCount} atoms in "${modality}" modality — exceeds target of ${maxAtoms}. View may overwhelm.`,
      suggestion: 'Reduce atom count. Use progressive disclosure or pagination for dense content.',
    })
  }

  // ── Norman: Signifiers and affordances ──

  // Inputs without labels
  const inputs = allPanels.filter(p => p.atom === 'input' && p.props.type !== 'button')
  const inputsWithoutLabels = inputs.filter(input => {
    // Check if a sibling or parent has a label text
    const hasLabel = input.props.label || input.props.placeholder
    return !hasLabel
  })
  if (inputsWithoutLabels.length > 0) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'norman:input-labels',
      message: `${inputsWithoutLabels.length} input(s) without labels or placeholders`,
      suggestion: 'Every input must have a visible label. Placeholder is supplementary, not primary.',
    })
  }

  // Too many inputs at once
  if (inputs.length > 7) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'yablonski:miller-inputs',
      message: `${inputs.length} inputs visible simultaneously — exceeds Miller's Law threshold of 7`,
      suggestion: 'Use progressive disclosure or multi-step sequencing for >7 inputs.',
    })
  }

  // ── Yablonski: Competing CTAs ──

  const buttons = allPanels.filter(p => p.atom === 'input' && p.props.type === 'button')
  const primaryButtons = buttons.filter(p => p.emphasis === 'primary' || (!p.emphasis && buttons.length <= 1))
  if (buttons.length > 3 && !buttons.some(b => b.emphasis)) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'yablonski:hick-cta',
      message: `${buttons.length} buttons with no emphasis hierarchy — competing calls to action`,
      suggestion: 'Establish hierarchy: one primary, one secondary, rest tertiary or hidden.',
    })
  }

  // ── Tufte: Nesting depth ──

  const maxDepth = getMaxNesting(view.panels)
  if (maxDepth > 4) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'tufte:nesting-depth',
      message: `Nesting depth ${maxDepth} exceeds limit of 4`,
      suggestion: 'Restructure into sibling boxes rather than deep nesting.',
    })
  }

  // ── Yablonski: Row child overflow ──
  // Boxes with direction:row and too many children will compress items to unusable widths

  const rowBoxes = allPanels.filter(p =>
    p.atom === 'box' &&
    p.children && p.children.length > 0 &&
    (p.props?.direction === 'row')
  )

  for (const box of rowBoxes) {
    const childCount = box.children!.length
    const hasMinChildWidth = !!box.props?.minChildWidth
    const hasWrapDisabled = box.props?.wrap === false

    if (childCount > 5 && !hasMinChildWidth) {
      findings.push({
        dimension: 'design-quality' as any,
        grade: 'warn',
        rule: 'yablonski:row-overflow',
        message: `Box "${box.id}" has ${childCount} children in a row without minChildWidth — items will compress to unusable widths`,
        suggestion: `Add minChildWidth: "180px" to use CSS grid auto-fill, or use the stat-grid recipe. Max 4-5 items per row without explicit min-width.`,
      })
    }

    if (childCount > 3 && hasWrapDisabled) {
      findings.push({
        dimension: 'design-quality' as any,
        grade: 'warn',
        rule: 'yablonski:nowrap-overflow',
        message: `Box "${box.id}" has ${childCount} children in a no-wrap row — items will overflow or compress`,
        suggestion: `Remove wrap: false or add minChildWidth. Row containers with >3 items should always wrap.`,
      })
    }
  }

  // ── Tufte: Metric card hierarchy ──

  const metricPanels = allPanels.filter(p => p.recipe === 'metric')
  if (metricPanels.length > 6) {
    const hasPrimaryEmphasis = metricPanels.some(p => p.emphasis === 'primary')
    if (!hasPrimaryEmphasis) {
      findings.push({
        dimension: 'design-quality' as any,
        grade: 'warn',
        rule: 'tufte:metric-hierarchy',
        message: `${metricPanels.length} metric cards with no hierarchy — too many equal-weight items`,
        suggestion: 'Feature 1-2 primary metrics with emphasis, rest secondary or muted.',
      })
    }
  }

  // ── Ive: Single focal point ──

  const headings = allPanels.filter(p => p.atom === 'text' && (p.props.level === 'heading' || p.props.level === 'title'))
  if (headings.length > 2) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'ive:focal-point',
      message: `${headings.length} heading-level texts — view may lack a clear primary focal point`,
      suggestion: 'One primary heading, use subheading for secondary sections.',
    })
  }

  // ── Norman: Text hierarchy ──

  const textLevels = new Set(allPanels.filter(p => p.atom === 'text').map(p => p.props.level))
  if (textLevels.size > 4) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'norman:type-hierarchy',
      message: `${textLevels.size} typographic levels — max recommended is 3-4`,
      suggestion: 'Simplify to title + body + caption. Add subheading only for distinct sections.',
    })
  }

  // ── Van Cleef: Context awareness ──

  // Check if the view has any action/next-step orientation
  const hasActions = allPanels.some(p => p.on && Object.keys(p.on).length > 0) || buttons.length > 0
  if (!hasActions && modality !== 'informational' && atomCount > 5) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'warn',
      rule: 'vanclef:action-orientation',
      message: 'View has no interactive elements — user has no clear next action',
      suggestion: 'Every view should orient toward the next step. Add actions or navigation.',
    })
  }

  // All pass
  if (findings.length === 0) {
    findings.push({
      dimension: 'design-quality' as any,
      grade: 'pass',
      rule: 'six-voice-test',
      message: 'View passes all six-voice design checks',
    })
  }

  return findings
}

// ── Helpers ──

function flattenPanels(panels: PanePanel[]): PanePanel[] {
  const flat: PanePanel[] = []
  for (const p of panels) {
    flat.push(p)
    if (p.children) flat.push(...flattenPanels(p.children))
  }
  return flat
}

function getMaxNesting(panels: PanePanel[], depth = 1): number {
  let max = depth
  for (const p of panels) {
    if (p.children && p.children.length > 0) {
      max = Math.max(max, getMaxNesting(p.children, depth + 1))
    }
  }
  return max
}
