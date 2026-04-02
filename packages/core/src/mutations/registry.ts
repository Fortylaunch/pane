// ────────────────────────────────────────────
// Mutation Registry
//
// Centralized metadata for each mutation type.
// Independently queryable — not buried in prompts.
// ────────────────────────────────────────────

import type { MutationType, MutationClassification, PaneView, PanePanel } from '../spec/types.js'

export interface MutationSpec {
  type: MutationType
  label: string
  description: string
  affectsLayout: boolean
  requiresPanelIds: boolean
  claudeInstruction: string
  animationHint: 'slide-in' | 'fade-out' | 'crossfade' | 'reposition' | 'full-fade'
}

const MUTATION_REGISTRY = new Map<MutationType, MutationSpec>([
  ['ADD_PANELS', {
    type: 'ADD_PANELS',
    label: 'Add Panels',
    description: 'Insert new panels into the existing view without regenerating existing content.',
    affectsLayout: true,
    requiresPanelIds: false,
    claudeInstruction: `Return ONLY the new panels to add. Do NOT regenerate existing panels.
Response format: { "update": { "contexts": [{ "id": "main", "operation": "update", "patch": { "type": "ADD_PANELS", "panels": [...new panels...], "position": "end" } }] } }`,
    animationHint: 'slide-in',
  }],
  ['REMOVE_PANELS', {
    type: 'REMOVE_PANELS',
    label: 'Remove Panels',
    description: 'Remove specific panels from the existing view by ID.',
    affectsLayout: true,
    requiresPanelIds: true,
    claudeInstruction: `Return ONLY the panel IDs to remove. Do NOT regenerate the view.
Response format: { "update": { "contexts": [{ "id": "main", "operation": "update", "patch": { "type": "REMOVE_PANELS", "panelIds": ["panel-id-1", "panel-id-2"] } }] } }`,
    animationHint: 'fade-out',
  }],
  ['UPDATE_PANELS', {
    type: 'UPDATE_PANELS',
    label: 'Update Panels',
    description: 'Modify specific panels (props, children) without touching others.',
    affectsLayout: false,
    requiresPanelIds: true,
    claudeInstruction: `Return ONLY the changed panels with their updated props/children. Include the panel ID to match.
Response format: { "update": { "contexts": [{ "id": "main", "operation": "update", "patch": { "type": "UPDATE_PANELS", "panels": [...updated panels with matching IDs...] } }] } }`,
    animationHint: 'crossfade',
  }],
  ['REORDER_PANELS', {
    type: 'REORDER_PANELS',
    label: 'Reorder Panels',
    description: 'Change the order of panels in the view.',
    affectsLayout: false,
    requiresPanelIds: true,
    claudeInstruction: `Return the new panel order as an array of existing panel IDs.
Response format: { "update": { "contexts": [{ "id": "main", "operation": "update", "patch": { "type": "REORDER_PANELS", "order": ["panel-3", "panel-1", "panel-2"] } }] } }`,
    animationHint: 'reposition',
  }],
  ['REPLACE_VIEW', {
    type: 'REPLACE_VIEW',
    label: 'Replace View',
    description: 'Replace the entire view with a new composition.',
    affectsLayout: true,
    requiresPanelIds: false,
    claudeInstruction: `Return a complete view as usual. This is the default behavior.`,
    animationHint: 'full-fade',
  }],
])

export function getMutationSpec(type: MutationType): MutationSpec {
  return MUTATION_REGISTRY.get(type) ?? MUTATION_REGISTRY.get('REPLACE_VIEW')!
}

export function getAllMutationSpecs(): MutationSpec[] {
  return [...MUTATION_REGISTRY.values()]
}

/**
 * Generate the context block injected into the Claude call
 * when a partial mutation is classified.
 */
export function getMutationClaudePrompt(
  classification: MutationClassification,
  currentView: PaneView | null,
): string {
  const spec = getMutationSpec(classification.type)

  if (classification.type === 'REPLACE_VIEW') {
    return '' // no special context needed
  }

  const panelSummary = currentView
    ? currentView.panels.map(p => summarizePanel(p)).join('\n')
    : 'No panels'

  return `
MUTATION MODE: ${classification.type}
${spec.claudeInstruction}

Current view panels:
${panelSummary}

${classification.affectedPanelIds.length > 0
    ? `Affected panels: ${classification.affectedPanelIds.join(', ')}`
    : 'No specific panels identified — use your judgment.'}
`.trim()
}

function summarizePanel(panel: PanePanel, depth = 0): string {
  const indent = '  '.repeat(depth)
  const childCount = panel.children?.length ?? 0
  const recipe = panel.recipe ? ` recipe:${panel.recipe}` : ''
  const label = panel.props?.label ?? panel.props?.content
  const labelStr = label ? ` "${String(label).substring(0, 40)}"` : ''
  const line = `${indent}- ${panel.id} (${panel.atom}${recipe}${labelStr}${childCount > 0 ? `, ${childCount} children` : ''})`

  if (panel.children && depth < 2) {
    return [line, ...panel.children.map(c => summarizePanel(c, depth + 1))].join('\n')
  }
  return line
}
