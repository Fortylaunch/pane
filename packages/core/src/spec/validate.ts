import type { PanePanel, PaneView, PaneSession, AtomType, LayoutPattern, PaneTrackedAction } from './types.js'

// ────────────────────────────────────────────
// Spec Validator
// Returns typed errors, not just pass/fail.
// ────────────────────────────────────────────

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

const VALID_ATOMS: AtomType[] = ['box', 'text', 'image', 'input', 'shape', 'frame', 'icon', 'spacer', 'badge', 'divider', 'progress', 'list']
const VALID_LAYOUTS: LayoutPattern[] = ['stack', 'split', 'grid', 'tabs', 'overlay', 'flow']

function validatePanel(panel: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (!panel || typeof panel !== 'object') {
    errors.push({ path, message: 'Panel must be an object' })
    return errors
  }

  const p = panel as Record<string, unknown>

  if (typeof p.id !== 'string' || p.id.length === 0) {
    errors.push({ path: `${path}.id`, message: 'Panel must have a non-empty string id' })
  }

  if (!VALID_ATOMS.includes(p.atom as AtomType)) {
    errors.push({ path: `${path}.atom`, message: `Invalid atom type: ${String(p.atom)}. Must be one of: ${VALID_ATOMS.join(', ')}` })
  }

  if (typeof p.source !== 'string' || p.source.length === 0) {
    errors.push({ path: `${path}.source`, message: 'Panel must have a non-empty source (agent attribution is required)' })
  }

  if (p.props !== undefined && (typeof p.props !== 'object' || p.props === null)) {
    errors.push({ path: `${path}.props`, message: 'Panel props must be an object' })
  }

  if (p.children !== undefined) {
    if (!Array.isArray(p.children)) {
      errors.push({ path: `${path}.children`, message: 'Panel children must be an array' })
    } else {
      for (let i = 0; i < p.children.length; i++) {
        errors.push(...validatePanel(p.children[i], `${path}.children[${i}]`))
      }
    }
  }

  return errors
}

function validateView(view: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (!view || typeof view !== 'object') {
    errors.push({ path, message: 'View must be an object' })
    return errors
  }

  const v = view as Record<string, unknown>

  if (!v.layout || typeof v.layout !== 'object') {
    errors.push({ path: `${path}.layout`, message: 'View must have a layout config' })
  } else {
    const layout = v.layout as Record<string, unknown>
    if (!VALID_LAYOUTS.includes(layout.pattern as LayoutPattern)) {
      errors.push({ path: `${path}.layout.pattern`, message: `Invalid layout pattern: ${String(layout.pattern)}` })
    }
  }

  if (!Array.isArray(v.panels)) {
    errors.push({ path: `${path}.panels`, message: 'View must have a panels array' })
  } else {
    const ids = new Set<string>()
    for (let i = 0; i < v.panels.length; i++) {
      const panel = v.panels[i] as PanePanel
      errors.push(...validatePanel(panel, `${path}.panels[${i}]`))
      if (panel?.id) {
        if (ids.has(panel.id)) {
          errors.push({ path: `${path}.panels[${i}].id`, message: `Duplicate panel id: ${panel.id}` })
        }
        ids.add(panel.id)
      }
    }
  }

  return errors
}

export function validateSpec(session: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (!session || typeof session !== 'object') {
    return { valid: false, errors: [{ path: '', message: 'Session must be an object' }] }
  }

  const s = session as Record<string, unknown>

  if (typeof s.id !== 'string') {
    errors.push({ path: 'id', message: 'Session must have a string id' })
  }

  if (typeof s.version !== 'number') {
    errors.push({ path: 'version', message: 'Session must have a numeric version' })
  }

  if (typeof s.activeContext !== 'string') {
    errors.push({ path: 'activeContext', message: 'Session must have an activeContext string' })
  }

  if (!Array.isArray(s.contexts)) {
    errors.push({ path: 'contexts', message: 'Session must have a contexts array' })
  } else {
    for (let i = 0; i < s.contexts.length; i++) {
      const ctx = s.contexts[i] as Record<string, unknown>
      if (typeof ctx?.id !== 'string') {
        errors.push({ path: `contexts[${i}].id`, message: 'Context must have a string id' })
      }
      if (ctx?.view !== undefined) {
        errors.push(...validateView(ctx.view, `contexts[${i}].view`))
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateView_(view: unknown): ValidationResult {
  const errors = validateView(view, 'view')
  return { valid: errors.length === 0, errors }
}

export function validatePanel_(panel: unknown): ValidationResult {
  const errors = validatePanel(panel, 'panel')
  return { valid: errors.length === 0, errors }
}
