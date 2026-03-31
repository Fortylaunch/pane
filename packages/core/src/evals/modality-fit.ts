// ────────────────────────────────────────────
// Dimension 2: Modality Fit
//
// Did the agent pick the right workspace type
// for the user's intent?
// ────────────────────────────────────────────

import type { EvalContext, EvalFinding } from './types.js'
import type { PanePanel, ModalityHint } from '../spec/types.js'

// Heuristic: what atoms/patterns suggest which modality
const MODALITY_SIGNALS: Record<ModalityHint, { atoms: string[]; recipes: string[]; props: string[] }> = {
  conversational: {
    atoms: ['input', 'text'],
    recipes: ['editor', 'feedback-loop'],
    props: ['placeholder', 'content'],
  },
  informational: {
    atoms: ['text', 'shape', 'image'],
    recipes: ['chart', 'data-table', 'metric', 'status'],
    props: ['value', 'trend', 'columns'],
  },
  compositional: {
    atoms: ['input', 'frame'],
    recipes: ['editor', 'canvas', 'preview', 'terminal'],
    props: ['editable', 'interactive'],
  },
  transactional: {
    atoms: ['input', 'text'],
    recipes: ['form', 'action-group'],
    props: ['confirmLabel', 'cancelLabel', 'price', 'total'],
  },
  collaborative: {
    atoms: ['text', 'input', 'frame'],
    recipes: ['feedback-loop', 'preview'],
    props: ['annotation', 'comment', 'reviewer'],
  },
  environmental: {
    atoms: ['frame', 'input', 'shape'],
    recipes: ['canvas', 'terminal', 'editor', 'preview'],
    props: [],
  },
}

export function evalModalityFit(ctx: EvalContext): EvalFinding[] {
  const findings: EvalFinding[] = []
  const { session, input } = ctx

  const activeCtx = session.contexts.find(c => c.id === session.activeContext)
  if (!activeCtx) return findings

  const declaredModality = activeCtx.modality
  const panels = activeCtx.view.panels

  // Rule: Modality must be set
  if (!declaredModality) {
    findings.push({
      dimension: 'modality-fit',
      grade: 'warn',
      rule: 'modality-declared',
      message: 'Active context has no modality hint set',
      suggestion: 'The agent should set a modality hint so the surface can adapt',
    })
    return findings
  }

  // Rule: Panel content should match declared modality
  const signals = MODALITY_SIGNALS[declaredModality]
  const panelAtoms = collectAtoms(panels)
  const panelRecipes = collectRecipes(panels)
  const panelProps = collectPropKeys(panels)

  const atomMatch = panelAtoms.some(a => signals.atoms.includes(a))
  const recipeMatch = panelRecipes.some(r => signals.recipes.includes(r))
  const propMatch = panelProps.some(p => signals.props.includes(p))

  const matchScore = [atomMatch, recipeMatch, propMatch].filter(Boolean).length

  if (matchScore === 0 && panels.length > 0) {
    findings.push({
      dimension: 'modality-fit',
      grade: 'warn',
      rule: 'content-matches-modality',
      message: `Modality is "${declaredModality}" but panel content doesn't match — atoms: [${panelAtoms.join(', ')}], recipes: [${panelRecipes.join(', ')}]`,
      suggestion: `For "${declaredModality}" modality, expected to see atoms like [${signals.atoms.join(', ')}] or recipes like [${signals.recipes.join(', ')}]`,
    })
  } else {
    findings.push({
      dimension: 'modality-fit',
      grade: 'pass',
      rule: 'content-matches-modality',
      message: `Panel content aligns with "${declaredModality}" modality (${matchScore}/3 signal match)`,
    })
  }

  // Rule: Conversational modality should have an input atom
  if (declaredModality === 'conversational') {
    const hasInput = panelAtoms.includes('input')
    if (!hasInput) {
      findings.push({
        dimension: 'modality-fit',
        grade: 'warn',
        rule: 'conversational-has-input',
        message: 'Conversational modality but no input atom in the view',
        suggestion: 'Conversational mode should include an input field for user interaction',
      })
    }
  }

  // Rule: Transactional modality should have actions
  if (declaredModality === 'transactional') {
    const hasActions = panels.some(p => p.on && Object.keys(p.on).length > 0)
    const hasActionRecipe = panelRecipes.includes('action-group') || panelRecipes.includes('form')
    if (!hasActions && !hasActionRecipe) {
      findings.push({
        dimension: 'modality-fit',
        grade: 'warn',
        rule: 'transactional-has-actions',
        message: 'Transactional modality but no actionable elements in the view',
        suggestion: 'Transactional mode should include confirm/cancel or form elements',
      })
    }
  }

  // Rule: Modality should change when context shifts significantly
  if (ctx.previousSession) {
    const prevCtx = ctx.previousSession.contexts.find(c => c.id === session.activeContext)
    if (prevCtx && prevCtx.modality === activeCtx.modality) {
      // Same modality — check if content changed dramatically
      const prevPanelCount = prevCtx.view.panels.length
      const currPanelCount = panels.length
      const prevRecipes = collectRecipes(prevCtx.view.panels)
      const currRecipes = panelRecipes

      const recipeOverlap = currRecipes.filter(r => prevRecipes.includes(r)).length
      const totalRecipes = new Set([...prevRecipes, ...currRecipes]).size

      if (totalRecipes > 0 && recipeOverlap === 0 && Math.abs(currPanelCount - prevPanelCount) > 3) {
        findings.push({
          dimension: 'modality-fit',
          grade: 'warn',
          rule: 'modality-reflects-change',
          message: `View content changed significantly but modality stayed "${declaredModality}"`,
          suggestion: 'Consider whether the modality should shift to match the new content',
        })
      }
    }
  }

  return findings
}

function collectAtoms(panels: PanePanel[]): string[] {
  const atoms: string[] = []
  for (const p of panels) {
    atoms.push(p.atom)
    if (p.children) atoms.push(...collectAtoms(p.children))
  }
  return atoms
}

function collectRecipes(panels: PanePanel[]): string[] {
  const recipes: string[] = []
  for (const p of panels) {
    if (p.recipe) recipes.push(p.recipe)
    if (p.children) recipes.push(...collectRecipes(p.children))
  }
  return recipes
}

function collectPropKeys(panels: PanePanel[]): string[] {
  const keys: string[] = []
  for (const p of panels) {
    keys.push(...Object.keys(p.props))
    if (p.children) keys.push(...collectPropKeys(p.children))
  }
  return keys
}
