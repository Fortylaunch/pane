// ────────────────────────────────────────────
// Recipe Registry
//
// Recipes are pre-composed atom patterns.
// Agents reference them by name, the renderer
// expands them to atom trees at render time.
// ────────────────────────────────────────────

import type { PanePanel } from '@pane/core'

export type RecipeExpander = (panel: PanePanel) => PanePanel

const registry = new Map<string, RecipeExpander>()

export function registerRecipe(name: string, expander: RecipeExpander) {
  registry.set(name, expander)
}

export function expandRecipe(panel: PanePanel): PanePanel {
  if (!panel.recipe) return panel

  const expander = registry.get(panel.recipe)
  if (!expander) {
    // Unknown recipe — return as-is, the atom will render
    console.warn(`[pane:recipes] Unknown recipe: "${panel.recipe}"`)
    return panel
  }

  return expander(panel)
}

export function hasRecipe(name: string): boolean {
  return registry.has(name)
}

export function listRecipes(): string[] {
  return [...registry.keys()]
}
