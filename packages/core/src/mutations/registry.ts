// ────────────────────────────────────────────
// Mutation Registry
//
// Centralized metadata for each mutation type.
// Independently queryable — not buried in prompts.
// ────────────────────────────────────────────

import type { MutationType, MutationClassification, PaneView, PanePanel } from '../spec/types.js'
import { PANEL_LABEL_MAX_CHARS } from '../limits.js'

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
  userInput?: string,
): string {
  const spec = getMutationSpec(classification.type)

  if (classification.type === 'REPLACE_VIEW') {
    return '' // no special context needed
  }

  const panelSummary = currentView
    ? currentView.panels.map(p => summarizePanel(p)).join('\n')
    : 'No panels'

  // Detect synthetic action triggers and surface them as user interactions
  // rather than mutation requests. This shifts Claude's framing from
  // "the user typed something" to "the user clicked a button — interpret
  // their intent and respond with a small targeted update".
  const isAction = userInput?.startsWith('__action:') ?? false
  if (isAction) {
    const parts = userInput!.substring('__action:'.length).split(':')
    const event = parts[0] ?? 'submit'
    const panelId = parts.slice(1).join(':') || 'unknown'

    return `
USER INTERACTION DETECTED — NOT A NEW REQUEST

The user clicked a UI element. Their intent is encoded in the click, not a typed message.

Event: "${event}"
Source panel ID: "${panelId}"

## Your job
Interpret what the user wanted by clicking that element, then respond with a SMALL, TARGETED update. Do NOT regenerate the entire view.

## Required response shape (UPDATE_PANELS patch)
${spec.claudeInstruction}

## Current view panels
${panelSummary}

## Constraints
- Update at most 3-5 panels. Most actions affect 1-2.
- Keep the existing layout. Don't replace the view.
- The panel ID "${panelId}" gives you the click target. Look at the panel summary above to understand what was clicked.
- If the action implies a state transition (e.g., "run-assessment" should show progress), update the relevant panel to reflect that state. Don't build a new dashboard.
- Response should be SHORT — under 1500 tokens. A button click does not warrant a 30KB response.
`.trim()
  }

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
  const labelStr = label ? ` "${String(label).substring(0, PANEL_LABEL_MAX_CHARS)}"` : ''
  const line = `${indent}- ${panel.id} (${panel.atom}${recipe}${labelStr}${childCount > 0 ? `, ${childCount} children` : ''})`

  if (panel.children && depth < 2) {
    return [line, ...panel.children.map(c => summarizePanel(c, depth + 1))].join('\n')
  }
  return line
}
