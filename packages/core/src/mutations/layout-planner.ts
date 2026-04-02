// ────────────────────────────────────────────
// Layout Planner
//
// System-owned, deterministic. No LLM call.
// Decides the grid structure BEFORE content
// generation. Renders skeleton scaffold immediately.
// ────────────────────────────────────────────

import type {
  PaneView,
  PanePanel,
  LayoutConfig,
  MutationType,
  MutationClassification,
  ModalityHint,
} from '../spec/types.js'

// ── Layout Plan ──

export interface LayoutSlot {
  id: string
  label: string
  role: 'primary' | 'secondary' | 'sidebar' | 'header' | 'footer' | 'full'
}

export interface LayoutPlan {
  layout: LayoutConfig
  slots: LayoutSlot[]
  modality: ModalityHint
}

// ── Slot → Skeleton panel ──

export function slotToSkeleton(slot: LayoutSlot, source: string): PanePanel {
  const skeletonChildren: PanePanel[] = [
    {
      id: `${slot.id}-skel-label`,
      atom: 'text',
      props: { content: slot.label, level: 'label' },
      source,
    },
  ]

  // Primary/full slots get more skeleton content
  if (slot.role === 'primary' || slot.role === 'full') {
    skeletonChildren.push(
      { id: `${slot.id}-skel-1`, atom: 'skeleton', props: { variant: 'rect', height: '160px' }, source },
      { id: `${slot.id}-skel-2`, atom: 'skeleton', props: { variant: 'text', lines: 2 }, source },
    )
  } else if (slot.role === 'header' || slot.role === 'footer') {
    skeletonChildren.push(
      { id: `${slot.id}-skel-1`, atom: 'skeleton', props: { variant: 'rect', height: '32px' }, source },
    )
  } else {
    skeletonChildren.push(
      { id: `${slot.id}-skel-1`, atom: 'skeleton', props: { variant: 'rect', height: '100px' }, source },
      { id: `${slot.id}-skel-2`, atom: 'skeleton', props: { variant: 'text', lines: 3 }, source },
    )
  }

  return {
    id: slot.id,
    atom: 'box',
    props: { fill: true, gap: 'var(--pane-space-sm)' },
    source,
    children: skeletonChildren,
  }
}

export function planToScaffold(plan: LayoutPlan, source: string): PaneView {
  return {
    layout: plan.layout,
    panels: plan.slots.map(slot => slotToSkeleton(slot, source)),
  }
}

// ── Input signal detection ──

interface InputSignals {
  hasMap: boolean
  hasChart: boolean
  hasTable: boolean
  hasNews: boolean
  hasList: boolean
  hasStats: boolean
  hasForm: boolean
  hasEditor: boolean
  sectionCount: number
}

function detectSignals(input: string): InputSignals {
  const text = input.toLowerCase()
  const hasMap = /\bmap\b|globe|geographic|geopolitical|location|world/.test(text)
  const hasChart = /\bchart\b|graph|trend|visualization|analytics/.test(text)
  const hasTable = /\btable\b|data|rows|columns|grid of|spreadsheet/.test(text)
  const hasNews = /\bnews\b|feed|stream|updates|live|events|alerts/.test(text)
  const hasList = /\blist\b|items|entries|log|history/.test(text)
  const hasStats = /\bstat|metric|kpi|number|count|score|dashboard/.test(text)
  const hasForm = /\bform\b|input|submit|create|entry/.test(text)
  const hasEditor = /\beditor\b|write|compose|draft|document/.test(text)

  const sections = [hasMap, hasChart, hasTable, hasNews, hasList, hasStats, hasForm, hasEditor]
  const sectionCount = Math.max(1, sections.filter(Boolean).length)

  return { hasMap, hasChart, hasTable, hasNews, hasList, hasStats, hasForm, hasEditor, sectionCount }
}

// ── Planner ──

export function planLayout(
  input: string,
  mutation: MutationClassification,
  currentModality?: ModalityHint,
): LayoutPlan {
  // Partial mutations don't need a new layout
  if (mutation.type !== 'REPLACE_VIEW') {
    return {
      layout: { pattern: 'stack' },
      slots: [{ id: 'content', label: 'CONTENT', role: 'full' }],
      modality: currentModality ?? 'conversational',
    }
  }

  const signals = detectSignals(input)

  // ── Modality detection ──
  let modality: ModalityHint = currentModality ?? 'conversational'

  if (signals.hasMap || signals.hasChart || signals.hasStats || signals.hasTable) {
    modality = 'informational'
  } else if (signals.hasEditor || signals.hasForm) {
    modality = 'compositional'
  } else if (signals.hasNews && signals.hasMap) {
    modality = 'environmental'
  }

  // ── Layout selection by signal combination ──

  // Map + something → split layout
  if (signals.hasMap && signals.sectionCount >= 2) {
    const slots: LayoutSlot[] = [
      { id: 'map-section', label: 'MAP', role: 'primary' },
    ]

    if (signals.hasNews || signals.hasList) {
      slots.push({ id: 'feed-section', label: signals.hasNews ? 'LIVE FEED' : 'LIST', role: 'secondary' })
    } else if (signals.hasChart) {
      slots.push({ id: 'chart-section', label: 'ANALYTICS', role: 'secondary' })
    } else if (signals.hasTable) {
      slots.push({ id: 'data-section', label: 'DATA', role: 'secondary' })
    } else {
      slots.push({ id: 'details-section', label: 'DETAILS', role: 'secondary' })
    }

    return {
      layout: { pattern: 'split', ratio: '3:2' },
      slots,
      modality,
    }
  }

  // Dashboard/stats with multiple sections → stack with stat grid at top
  if (signals.hasStats && signals.sectionCount >= 2) {
    const slots: LayoutSlot[] = [
      { id: 'stats-section', label: 'METRICS', role: 'header' },
    ]

    if (signals.hasChart && signals.hasTable) {
      slots.push(
        { id: 'chart-section', label: 'CHART', role: 'primary' },
        { id: 'table-section', label: 'DATA', role: 'secondary' },
      )
    } else if (signals.hasChart) {
      slots.push({ id: 'chart-section', label: 'CHART', role: 'primary' })
    } else if (signals.hasTable) {
      slots.push({ id: 'table-section', label: 'DATA', role: 'primary' })
    } else if (signals.hasMap) {
      slots.push({ id: 'map-section', label: 'MAP', role: 'primary' })
    } else {
      slots.push({ id: 'main-section', label: 'MAIN', role: 'primary' })
    }

    return {
      layout: { pattern: 'stack' },
      slots,
      modality,
    }
  }

  // Chart + table → split
  if (signals.hasChart && signals.hasTable) {
    return {
      layout: { pattern: 'split', ratio: '1:1' },
      slots: [
        { id: 'chart-section', label: 'CHART', role: 'primary' },
        { id: 'table-section', label: 'DATA', role: 'secondary' },
      ],
      modality,
    }
  }

  // Single content type or conversational → stack
  if (signals.sectionCount <= 1) {
    return {
      layout: { pattern: 'stack' },
      slots: [{ id: 'main-section', label: 'MAIN', role: 'full' }],
      modality,
    }
  }

  // Multiple sections, no clear split → stack
  const slots: LayoutSlot[] = []
  if (signals.hasStats) slots.push({ id: 'stats-section', label: 'METRICS', role: 'header' })
  if (signals.hasMap) slots.push({ id: 'map-section', label: 'MAP', role: 'primary' })
  if (signals.hasChart) slots.push({ id: 'chart-section', label: 'CHART', role: 'primary' })
  if (signals.hasNews) slots.push({ id: 'feed-section', label: 'LIVE FEED', role: 'secondary' })
  if (signals.hasTable) slots.push({ id: 'table-section', label: 'DATA', role: 'secondary' })
  if (signals.hasList) slots.push({ id: 'list-section', label: 'LIST', role: 'secondary' })
  if (signals.hasForm) slots.push({ id: 'form-section', label: 'FORM', role: 'secondary' })
  if (signals.hasEditor) slots.push({ id: 'editor-section', label: 'EDITOR', role: 'primary' })

  if (slots.length === 0) {
    slots.push({ id: 'main-section', label: 'MAIN', role: 'full' })
  }

  return {
    layout: { pattern: 'stack' },
    slots,
    modality,
  }
}
