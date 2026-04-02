// ────────────────────────────────────────────
// View Patcher
//
// Pure function: takes a PaneView and a ViewPatch,
// returns a new PaneView with the patch applied.
// ────────────────────────────────────────────

import type { PaneView, PanePanel, ViewPatch, LayoutConfig } from '../spec/types.js'

/**
 * Apply a ViewPatch to an existing PaneView.
 * Returns a new PaneView — does not mutate the input.
 */
export function patchView(view: PaneView, patch: ViewPatch): PaneView {
  const layout = patch.layout ?? view.layout

  switch (patch.type) {
    case 'ADD_PANELS':
      return { layout, panels: addPanels(view.panels, patch) }

    case 'REMOVE_PANELS':
      return { layout, panels: removePanels(view.panels, patch.panelIds ?? []) }

    case 'UPDATE_PANELS':
      return { layout, panels: updatePanels(view.panels, patch.panels ?? []) }

    case 'REORDER_PANELS':
      return { layout, panels: reorderPanels(view.panels, patch.order ?? []) }

    case 'REPLACE_VIEW':
      // Should not reach here — REPLACE_VIEW uses the view field, not patch.
      // Safety fallback: return the patch's panels if present.
      return { layout, panels: patch.panels ?? view.panels }

    default:
      return view
  }
}

// ── ADD ──

function addPanels(existing: PanePanel[], patch: ViewPatch): PanePanel[] {
  const newPanels = patch.panels ?? []
  if (newPanels.length === 0) return existing

  const position = patch.position ?? 'end'
  const relativeTo = patch.relativeTo

  if (position === 'start') {
    return [...newPanels, ...existing]
  }

  if (position === 'end') {
    return [...existing, ...newPanels]
  }

  if (relativeTo) {
    const idx = existing.findIndex(p => p.id === relativeTo)
    if (idx === -1) return [...existing, ...newPanels] // fallback to end

    const insertAt = position === 'before' ? idx : idx + 1
    return [
      ...existing.slice(0, insertAt),
      ...newPanels,
      ...existing.slice(insertAt),
    ]
  }

  return [...existing, ...newPanels]
}

// ── REMOVE ──

function removePanels(panels: PanePanel[], idsToRemove: string[]): PanePanel[] {
  const idSet = new Set(idsToRemove)

  return panels
    .filter(p => !idSet.has(p.id))
    .map(p => {
      if (p.children) {
        const filteredChildren = removePanels(p.children, idsToRemove)
        return { ...p, children: filteredChildren.length > 0 ? filteredChildren : undefined }
      }
      return p
    })
}

// ── UPDATE ──

function updatePanels(existing: PanePanel[], patches: PanePanel[]): PanePanel[] {
  const patchMap = new Map(patches.map(p => [p.id, p]))

  return existing.map(panel => {
    const patch = patchMap.get(panel.id)
    if (patch) {
      // Merge: patch fields override existing, children are replaced if present
      return {
        ...panel,
        ...patch,
        props: { ...panel.props, ...patch.props },
      }
    }

    // Recurse into children
    if (panel.children) {
      const updatedChildren = updatePanels(panel.children, patches)
      return { ...panel, children: updatedChildren }
    }

    return panel
  })
}

// ── REORDER ──

function reorderPanels(panels: PanePanel[], order: string[]): PanePanel[] {
  const panelMap = new Map(panels.map(p => [p.id, p]))
  const ordered: PanePanel[] = []

  // Place panels in the specified order
  for (const id of order) {
    const panel = panelMap.get(id)
    if (panel) {
      ordered.push(panel)
      panelMap.delete(id)
    }
  }

  // Append any panels not in the order list (preserve them)
  for (const remaining of panelMap.values()) {
    ordered.push(remaining)
  }

  return ordered
}
