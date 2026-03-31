// ────────────────────────────────────────────
// Theme Enforcement
//
// Silent adaptation — the renderer adapts,
// never rejects. Flattens, adjusts, collapses.
// ────────────────────────────────────────────

import type { PaneTheme } from './index.js'

interface Panel {
  id: string
  atom: string
  props: Record<string, unknown>
  children?: Panel[]
  [key: string]: unknown
}

interface View {
  layout: { pattern: string; [key: string]: unknown }
  panels: Panel[]
}

/**
 * Enforce theme rules on a view. Returns a new view with rules applied.
 * Silent — no errors thrown.
 */
export function enforceTheme(view: View, theme: PaneTheme): View {
  let panels = view.panels

  // Rule: max nesting depth
  panels = flattenBeyondDepth(panels, theme.rules.maxNestingDepth)

  // Rule: max actions per group — collapse excess into a "more" indicator
  panels = enforceActionGroupLimit(panels, theme.rules.maxActionsPerGroup)

  return { ...view, panels }
}

/**
 * Flatten panels that exceed max nesting depth.
 * Children beyond the limit are pulled up to the parent level.
 */
function flattenBeyondDepth(panels: Panel[], maxDepth: number, currentDepth = 1): Panel[] {
  return panels.map(panel => {
    if (!panel.children || panel.children.length === 0) return panel

    if (currentDepth >= maxDepth) {
      // Flatten: pull children up, remove nesting
      const flatChildren = collectAllLeaves(panel.children)
      return { ...panel, children: undefined, _flattenedChildren: flatChildren } as any
    }

    return {
      ...panel,
      children: flattenBeyondDepth(panel.children, maxDepth, currentDepth + 1),
    }
  })
}

function collectAllLeaves(panels: Panel[]): Panel[] {
  const leaves: Panel[] = []
  for (const panel of panels) {
    if (panel.children && panel.children.length > 0) {
      leaves.push(...collectAllLeaves(panel.children))
    } else {
      leaves.push(panel)
    }
  }
  return leaves
}

/**
 * If an action-group recipe has more buttons than maxActionsPerGroup,
 * truncate and add a count indicator.
 */
function enforceActionGroupLimit(panels: Panel[], max: number): Panel[] {
  return panels.map(panel => {
    // Check if this is an action group (box with multiple button children)
    if (panel.atom === 'box' && panel.children) {
      const buttons = panel.children.filter(c => c.atom === 'input' && c.props.type === 'button')

      if (buttons.length > max) {
        const kept = panel.children.slice(0, max)
        const overflow = panel.children.length - max
        kept.push({
          id: `${panel.id}-overflow`,
          atom: 'text',
          props: { content: `+${overflow} more`, level: 'caption' },
          source: (panel as any).source ?? 'pane-system',
        } as any)

        return { ...panel, children: kept }
      }
    }

    // Recurse
    if (panel.children) {
      return { ...panel, children: enforceActionGroupLimit(panel.children, max) }
    }

    return panel
  })
}
