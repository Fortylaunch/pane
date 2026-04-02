// ────────────────────────────────────────────
// Request Decomposer
//
// Breaks large requests into composable chunks,
// sends each to the agent independently, and
// progressively assembles the view.
//
// Flow:
//   1. Plan call → manifest (sections + layout)
//   2. Scaffold → skeleton panels rendered immediately
//   3. Dispatch → parallel section calls (concurrency limit)
//   4. Assemble → merge each chunk via applyUpdate
// ────────────────────────────────────────────

import type {
  PaneSession,
  PaneSessionUpdate,
  PanePanel,
  PaneView,
  PaneContextUpdate,
  LayoutConfig,
} from '../spec/types.js'
import { emitTelemetry } from '../telemetry/index.js'

// ── Types ──

export interface SectionManifest {
  id: string
  label: string
  description: string        // what this section should contain
  position: 'left' | 'right' | 'top' | 'bottom' | 'main' | 'full'
}

export interface DecompositionPlan {
  layout: LayoutConfig
  modality: string
  label: string
  sections: SectionManifest[]
}

export interface DecomposeConfig {
  /** Function that calls the agent for planning */
  planCall: (prompt: string, session: PaneSession) => Promise<DecompositionPlan>
  /** Function that calls the agent for a single section */
  sectionCall: (section: SectionManifest, context: string, session: PaneSession) => Promise<PanePanel[]>
  /** Max parallel section calls (default: 3) */
  concurrency?: number
  /** Callback when scaffold is ready (skeleton panels) */
  onScaffold?: (update: PaneSessionUpdate) => void
  /** Callback when a section completes (progressive rendering) */
  onSection?: (sectionId: string, panels: PanePanel[], update: PaneSessionUpdate) => void
  /** Callback when all sections are assembled */
  onComplete?: (update: PaneSessionUpdate) => void
}

// ── Skeleton builder ──

function buildSkeletonPanel(section: SectionManifest, source: string): PanePanel {
  return {
    id: `section-${section.id}`,
    atom: 'box',
    props: {
      gap: 'var(--pane-space-sm)',
      padding: 'var(--pane-space-md)',
      fill: true,
    },
    source,
    children: [
      {
        id: `${section.id}-label`,
        atom: 'text',
        props: { content: section.label, level: 'label' },
        source,
      },
      {
        id: `${section.id}-skeleton-1`,
        atom: 'skeleton',
        props: { variant: 'rect', height: '120px' },
        source,
      },
      {
        id: `${section.id}-skeleton-2`,
        atom: 'skeleton',
        props: { variant: 'text', lines: 3 },
        source,
      },
    ],
  }
}

function buildScaffoldUpdate(plan: DecompositionPlan, source: string): PaneSessionUpdate {
  const panels = plan.sections.map(s => buildSkeletonPanel(s, source))

  return {
    contexts: [{
      id: 'main',
      operation: 'update',
      label: plan.label,
      modality: plan.modality as any,
      view: {
        layout: plan.layout,
        panels,
      },
    }],
    agents: [{ id: source, name: source, state: 'working', currentTask: `Composing ${plan.sections.length} sections...`, lastActive: Date.now() }],
  }
}

// ── Parallel executor with concurrency limit ──

async function parallelMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Main decomposer ──

export async function decomposeAndAssemble(
  userRequest: string,
  session: PaneSession,
  config: DecomposeConfig,
): Promise<PaneSessionUpdate> {
  const source = 'decomposer'
  const { planCall, sectionCall, concurrency = 3, onScaffold, onSection, onComplete } = config

  // Step 1: Plan
  emitTelemetry('agent:request', { type: 'decompose-plan' }, { preview: `Decomposing: "${userRequest.substring(0, 60)}..."` })
  const planStart = performance.now()
  const plan = await planCall(userRequest, session)
  const planDur = Math.round(performance.now() - planStart)

  emitTelemetry('agent:response', {
    type: 'decompose-plan',
    sections: plan.sections.length,
    layout: plan.layout.pattern,
  }, { duration: planDur, preview: `Plan: ${plan.sections.length} sections, ${plan.layout.pattern} layout (${planDur}ms)` })

  // Step 2: Scaffold
  const scaffoldUpdate = buildScaffoldUpdate(plan, source)
  onScaffold?.(scaffoldUpdate)

  emitTelemetry('agent:response', { type: 'scaffold' }, { preview: `Scaffold rendered: ${plan.sections.length} skeleton sections` })

  // Step 3: Dispatch sections in parallel
  const contextDescription = `Layout: ${plan.layout.pattern}. Label: "${plan.label}". Modality: ${plan.modality}. Total sections: ${plan.sections.length}: ${plan.sections.map(s => s.label).join(', ')}.`

  const assembledPanels: PanePanel[] = new Array(plan.sections.length)
  let completedCount = 0

  await parallelMap(plan.sections, async (section, ) => {
    const sectionIdx = plan.sections.indexOf(section)
    emitTelemetry('agent:request', { type: 'section', section: section.id }, { preview: `Generating section: ${section.label}` })

    const sectionStart = performance.now()
    const panels = await sectionCall(section, contextDescription, session)
    const sectionDur = Math.round(performance.now() - sectionStart)

    completedCount++
    emitTelemetry('agent:response', {
      type: 'section',
      section: section.id,
      panelCount: panels.length,
    }, { duration: sectionDur, preview: `Section "${section.label}": ${panels.length} panels (${sectionDur}ms) [${completedCount}/${plan.sections.length}]` })

    // Build the replacement panel — a box wrapping the section's panels
    const sectionPanel: PanePanel = {
      id: `section-${section.id}`,
      atom: 'box',
      props: { fill: true },
      source: panels[0]?.source ?? source,
      children: panels,
    }

    assembledPanels[sectionIdx] = sectionPanel

    // Progressive update — replace the skeleton with real content
    const progressUpdate: PaneSessionUpdate = {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: plan.label,
        modality: plan.modality as any,
        view: {
          layout: plan.layout,
          panels: assembledPanels.map((p, i) =>
            p ?? buildSkeletonPanel(plan.sections[i], source)
          ),
        },
      }],
      agents: [{
        id: source,
        name: source,
        state: completedCount < plan.sections.length ? 'working' : 'idle',
        currentTask: completedCount < plan.sections.length
          ? `${completedCount}/${plan.sections.length} sections complete`
          : undefined,
        lastActive: Date.now(),
      }],
    }

    onSection?.(section.id, panels, progressUpdate)
    return panels
  }, concurrency)

  // Step 4: Final assembled view
  const finalUpdate: PaneSessionUpdate = {
    contexts: [{
      id: 'main',
      operation: 'update',
      label: plan.label,
      modality: plan.modality as any,
      view: {
        layout: plan.layout,
        panels: assembledPanels,
      },
    }],
    agents: [{ id: source, name: source, state: 'idle', lastActive: Date.now() }],
  }

  onComplete?.(finalUpdate)
  return finalUpdate
}

// ── Complexity heuristic ──

/**
 * Determines if a request is complex enough to warrant decomposition.
 * Simple messages ("hello", "thanks") go direct. Complex ones
 * ("build me a risk monitor with map and news feed") get decomposed.
 */
export function shouldDecompose(input: string): boolean {
  const text = input.toLowerCase().trim()

  // Too short to be complex
  if (text.length < 30) return false

  // Explicit composition signals
  const compositionSignals = [
    'dashboard', 'monitor', 'with .* and', 'build me', 'create a',
    'show me .* with', 'sections', 'panels', 'split', 'sidebar',
    'map .* and', 'chart .* and', 'table .* and',
    'multiple', 'several', 'along with', 'including',
  ]

  const signalCount = compositionSignals.filter(s => new RegExp(s).test(text)).length
  return signalCount >= 2
}
