// ────────────────────────────────────────────
// Mutation Classifier
//
// Deterministic, rule-based. No LLM call.
// Analyzes user input + current view to classify
// the mutation type. Runs in <1ms.
// ────────────────────────────────────────────

import type { PaneView, PanePanel, MutationType, MutationClassification } from '../spec/types.js'
import { MUTATION_LOW_CONFIDENCE_THRESHOLD } from '../limits.js'

// ── Verb lists ──

const ADD_VERBS = ['add', 'include', 'insert', 'put in', 'show me also', 'plus', 'new', 'append', 'attach', 'bring in']
const REMOVE_VERBS = ['remove', 'delete', 'get rid of', 'hide', 'drop', 'take out', 'clear', 'dismiss', 'close']
const UPDATE_VERBS = ['change', 'modify', 'update', 'edit', 'rename', 'resize', 'adjust', 'tweak', 'fix', 'improve', 'add column', 'add row']
const REORDER_VERBS = ['move', 'put above', 'put below', 'put before', 'put after', 'swap', 'reorder', 'rearrange', 'flip', 'reverse']
const REPLACE_VERBS = ['show me', 'create', 'build', 'make', 'generate', 'design', 'compose', 'give me', 'start over', 'from scratch', 'something else', 'different']

// ── Panel index ──

export interface PanelIndex {
  /** Map from searchable token (lowercase) to panel IDs that match */
  tokenToIds: Map<string, string[]>
  /** All panel IDs in the view */
  allIds: string[]
}

export function buildPanelIndex(view: PaneView): PanelIndex {
  const tokenToIds = new Map<string, string[]>()
  const allIds: string[] = []

  function indexPanel(panel: PanePanel) {
    allIds.push(panel.id)

    // Index by atom type
    addToken(tokenToIds, panel.atom, panel.id)

    // Index by recipe name
    if (panel.recipe) addToken(tokenToIds, panel.recipe, panel.id)

    // Index by common names derived from atom
    const atomAliases: Record<string, string[]> = {
      map: ['map', 'world', 'globe', 'geographic'],
      chart: ['chart', 'graph', 'visualization', 'trend'],
      text: ['text', 'heading', 'title', 'label'],
      input: ['input', 'form', 'field', 'search'],
      image: ['image', 'picture', 'photo'],
      skeleton: ['skeleton', 'loader', 'loading', 'placeholder'],
      pill: ['pill', 'filter', 'tag', 'toggle'],
      badge: ['badge', 'status', 'indicator'],
      progress: ['progress', 'bar', 'meter'],
      list: ['list', 'items'],
      divider: ['divider', 'separator', 'line'],
    }
    for (const alias of atomAliases[panel.atom] ?? []) {
      addToken(tokenToIds, alias, panel.id)
    }

    // Index by text content
    const content = String(panel.props?.content ?? '')
    if (content) {
      for (const word of content.toLowerCase().split(/\s+/).filter(w => w.length > 3)) {
        addToken(tokenToIds, word, panel.id)
      }
    }

    // Index by label
    const label = String(panel.props?.label ?? '')
    if (label) {
      for (const word of label.toLowerCase().split(/\s+/).filter(w => w.length > 2)) {
        addToken(tokenToIds, word, panel.id)
      }
    }

    // Recurse children
    if (panel.children) {
      for (const child of panel.children) indexPanel(child)
    }
  }

  for (const panel of view.panels) indexPanel(panel)
  return { tokenToIds, allIds }
}

function addToken(map: Map<string, string[]>, token: string, panelId: string) {
  const key = token.toLowerCase()
  const ids = map.get(key) ?? []
  if (!ids.includes(panelId)) ids.push(panelId)
  map.set(key, ids)
}

// ── Classifier ──

export function classifyMutation(
  input: string,
  currentView: PaneView | null,
): MutationClassification {
  const text = input.toLowerCase().trim()

  // ── Action trigger fast path ──
  // Synthetic action messages from button clicks (`__action:event:panelId`) are
  // not natural language. Don't run keyword matching against them — that's how
  // we ended up with REPLACE_VIEW (100%) on a button click. Instead, treat them
  // as targeted UPDATE_PANELS with the source panel as affected.
  if (text.startsWith('__action:')) {
    const parts = input.substring('__action:'.length).split(':')
    const event = parts[0] ?? 'submit'
    const panelId = parts.slice(1).join(':') || 'unknown'
    return {
      type: 'UPDATE_PANELS',
      confidence: 1,
      affectedPanelIds: [panelId],
      reason: `Action trigger: "${event}" on panel "${panelId}" — targeted update, not full replacement`,
    }
  }

  // No current view → always REPLACE_VIEW
  if (!currentView || currentView.panels.length === 0) {
    return { type: 'REPLACE_VIEW', confidence: 1, affectedPanelIds: [], reason: 'No existing view to mutate' }
  }

  const index = buildPanelIndex(currentView)

  // Score each mutation type
  const scores: Record<MutationType, number> = {
    ADD_PANELS: 0,
    REMOVE_PANELS: 0,
    UPDATE_PANELS: 0,
    REORDER_PANELS: 0,
    REPLACE_VIEW: 0,
  }

  // Match verbs
  for (const verb of ADD_VERBS)     { if (text.includes(verb)) scores.ADD_PANELS += 2 }
  for (const verb of REMOVE_VERBS)  { if (text.includes(verb)) scores.REMOVE_PANELS += 2 }
  for (const verb of UPDATE_VERBS)  { if (text.includes(verb)) scores.UPDATE_PANELS += 2 }
  for (const verb of REORDER_VERBS) { if (text.includes(verb)) scores.REORDER_PANELS += 2 }
  for (const verb of REPLACE_VERBS) { if (text.includes(verb)) scores.REPLACE_VIEW += 1 }

  // Match panel references → boost partial mutation scores
  const affectedPanelIds: string[] = []
  const words = text.split(/\s+/)
  for (const word of words) {
    const ids = index.tokenToIds.get(word)
    if (ids) {
      for (const id of ids) {
        if (!affectedPanelIds.includes(id)) affectedPanelIds.push(id)
      }
      // Panel reference found — boost non-replace types
      scores.ADD_PANELS += 0.5
      scores.REMOVE_PANELS += 0.5
      scores.UPDATE_PANELS += 0.5
      scores.REORDER_PANELS += 0.5
    }
  }

  // If no panel references and no strong partial verbs → REPLACE_VIEW
  if (affectedPanelIds.length === 0) {
    scores.REPLACE_VIEW += 2
  }

  // Positional language boosts reorder
  if (/above|below|before|after|left of|right of/.test(text)) {
    scores.REORDER_PANELS += 3
  }

  // "also" or "too" boosts additive
  if (/also|too|as well|along with/.test(text)) {
    scores.ADD_PANELS += 2
  }

  // Find winner
  let best: MutationType = 'REPLACE_VIEW'
  let bestScore = scores.REPLACE_VIEW
  for (const [type, score] of Object.entries(scores) as [MutationType, number][]) {
    if (score > bestScore) {
      best = type
      bestScore = score
    }
  }

  // Confidence: normalize score
  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0)
  const confidence = totalScore > 0 ? bestScore / totalScore : 0.5

  // If confidence is too low, default to REPLACE_VIEW
  if (confidence < MUTATION_LOW_CONFIDENCE_THRESHOLD && best !== 'REPLACE_VIEW') {
    return {
      type: 'REPLACE_VIEW',
      confidence: 0.5,
      affectedPanelIds: [],
      reason: `Low confidence (${Math.round(confidence * 100)}%) — defaulting to full replacement`,
    }
  }

  return {
    type: best,
    confidence: Math.round(confidence * 100) / 100,
    affectedPanelIds,
    reason: `Matched ${best} with score ${bestScore}/${totalScore}`,
  }
}
