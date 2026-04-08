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
import { DECOMPOSE_CONCURRENCY, DECOMPOSE_MIN_INPUT_LENGTH, DECOMPOSE_MIN_SIGNALS } from '../limits.js'

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
// Resilient: a single failure must not abort sibling work. Errors are
// returned in-band as { error } so callers can render fallback panels
// for failed sections while successful ones still land.

export type ParallelResult<R> = { ok: true; value: R } | { ok: false; error: Error }

async function parallelMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<ParallelResult<R>[]> {
  const results: ParallelResult<R>[] = new Array(items.length)
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try {
        const value = await fn(items[i])
        results[i] = { ok: true, value }
      } catch (err) {
        results[i] = { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
      }
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
  const { planCall, sectionCall, concurrency = DECOMPOSE_CONCURRENCY, onScaffold, onSection, onComplete } = config

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

  await parallelMap(plan.sections, async (section) => {
    const sectionIdx = plan.sections.indexOf(section)
    emitTelemetry('agent:request', { type: 'section', section: section.id }, { preview: `Generating section: ${section.label}` })

    const sectionStart = performance.now()
    let panels: PanePanel[]
    try {
      panels = await sectionCall(section, contextDescription, session)
    } catch (err) {
      const sectionDur = Math.round(performance.now() - sectionStart)
      completedCount++
      emitTelemetry('agent:response', {
        type: 'section-error',
        section: section.id,
        error: String(err),
      }, {
        duration: sectionDur,
        preview: `Section "${section.label}" failed (${sectionDur}ms): ${String(err).substring(0, 80)}`,
      })

      // Render a fallback panel so the section is visible as failed,
      // not just an empty hole. The user always gets feedback.
      const fallback: PanePanel = {
        id: `section-${section.id}`,
        atom: 'box',
        props: { fill: true, padding: 'var(--pane-space-md)' },
        source,
        children: [
          {
            id: `${section.id}-error-label`,
            atom: 'text',
            props: { content: section.label, level: 'label' },
            source,
          },
          {
            id: `${section.id}-error-msg`,
            atom: 'text',
            props: {
              content: `Section failed to generate. ${String(err).substring(0, 120)}`,
              level: 'caption',
            },
            source,
            emphasis: 'urgent',
          },
        ],
      }
      assembledPanels[sectionIdx] = fallback
      const progressUpdate = buildProgressUpdate(plan, assembledPanels, source, completedCount)
      onSection?.(section.id, fallback.children ?? [], progressUpdate)
      throw err  // re-throw so parallelMap captures it; we still rendered the fallback
    }

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
    const progressUpdate = buildProgressUpdate(plan, assembledPanels, source, completedCount)
    onSection?.(section.id, panels, progressUpdate)
    return panels
  }, concurrency)

  // Step 4: Final assembled view — fill any holes with skeletons so the
  // user never sees an empty panel array. The runtime's quality gate would
  // catch this anyway, but explicit is better.
  const finalPanels = assembledPanels.map((p, i) =>
    p ?? buildSkeletonPanel(plan.sections[i], source)
  )

  const finalUpdate: PaneSessionUpdate = {
    contexts: [{
      id: 'main',
      operation: 'update',
      label: plan.label,
      modality: plan.modality as any,
      view: {
        layout: plan.layout,
        panels: finalPanels,
      },
    }],
    agents: [{ id: source, name: source, state: 'idle', lastActive: Date.now() }],
  }

  onComplete?.(finalUpdate)
  return finalUpdate
}

// Builds a progressive update with current state of assembled panels.
// Holes get filled with skeletons so the layout never collapses.
function buildProgressUpdate(
  plan: DecompositionPlan,
  assembledPanels: PanePanel[],
  source: string,
  completedCount: number,
): PaneSessionUpdate {
  return {
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
}

// ── Complexity heuristic ──

/**
 * Determines if a request is complex enough to warrant decomposition.
 *
 * Decomposition splits a request into sections rendered in parallel. It only
 * helps when the request has MULTIPLE DISTINCT CONCERNS — not just a single
 * dashboard. A single noun (even "dashboard") should go direct because
 * decomposing it into 3 sections produces 3 calls each as expensive as the
 * original would have been.
 *
 * Heuristic: require explicit plurality signals — conjunctions joining
 * distinct concerns ("X and Y", "X with Y", "X plus Y"), or explicit
 * multi-section language ("multiple", "several", "sections", "panels").
 */
export function shouldDecompose(input: string): boolean {
  const text = input.toLowerCase().trim()

  // Too short to be complex
  if (text.length < DECOMPOSE_MIN_INPUT_LENGTH) return false

  // Plurality signals — multiple distinct concerns joined together
  const pluralitySignals = [
    /\bwith\b.*\band\b/,                  // "X with Y and Z"
    /\b\w+\s+and\s+\w+\s+and\s+\w+/,      // "X and Y and Z"
    /\b\w+,\s*\w+,?\s*and\s+\w+/,         // "X, Y, and Z"
    /\bplus\b/,                           // "X plus Y"
    /\balong with\b/,                     // "X along with Y"
    /\bincluding\b/,                      // "X including Y, Z"
    /\bmultiple\b/,                       // "multiple panels"
    /\bseveral\b/,                        // "several sections"
    /\bsections?\b/,                      // explicit sections
    /\b\d+\s+(panels?|sections?|charts?|tables?|widgets?)\b/, // "3 panels"
  ]

  const signalCount = pluralitySignals.filter(re => re.test(text)).length
  return signalCount >= DECOMPOSE_MIN_SIGNALS
}
