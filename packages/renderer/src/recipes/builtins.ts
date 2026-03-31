// ────────────────────────────────────────────
// Built-in Recipes
//
// Pre-composed atom patterns for common UI needs.
// Each recipe takes a PanePanel (with props) and
// returns an expanded atom tree.
// ────────────────────────────────────────────

import type { PanePanel } from '@pane/core'
import { registerRecipe } from './registry.js'

// ── Metric Card ──
// Props: label, value, trend, icon
registerRecipe('metric', (panel) => ({
  ...panel,
  atom: 'box',
  recipe: undefined,
  props: {
    background: 'var(--pane-color-surface)',
    borderColor: 'var(--pane-color-border)',
    padding: 'var(--pane-space-lg)',
    gap: 'var(--pane-space-xs)',
    flex: panel.props.flex ?? '1',
  },
  children: [
    p(`${panel.id}-label`, 'text', { content: String(panel.props.label ?? ''), level: 'label' }, panel.source),
    p(`${panel.id}-value`, 'text', { content: String(panel.props.value ?? ''), level: 'heading' }, panel.source),
    ...(panel.props.trend ? [
      p(`${panel.id}-trend`, 'text', {
        content: String(panel.props.trend),
        level: 'caption',
        style: {
          color: String(panel.props.trend).startsWith('+') ? 'var(--pane-color-success)'
            : String(panel.props.trend).startsWith('-') ? 'var(--pane-color-danger)'
            : 'var(--pane-color-text-muted)',
        },
      }, panel.source),
    ] : []),
  ],
}))

// ── Status Indicator ──
// Props: label, state (success|warning|danger|info|idle), detail
registerRecipe('status', (panel) => {
  const stateColors: Record<string, string> = {
    success: 'var(--pane-color-success)',
    warning: 'var(--pane-color-warning)',
    danger: 'var(--pane-color-danger)',
    info: 'var(--pane-color-accent)',
    idle: 'var(--pane-color-text-muted)',
  }
  const color = stateColors[String(panel.props.state ?? 'idle')] ?? stateColors.idle

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: { direction: 'row', align: 'center', gap: 'var(--pane-space-sm)', padding: 'var(--pane-space-sm)' },
    children: [
      p(`${panel.id}-dot`, 'icon', { name: 'check', size: '10', color }, panel.source),
      p(`${panel.id}-label`, 'text', { content: String(panel.props.label ?? ''), level: 'body' }, panel.source),
      ...(panel.props.detail ? [
        p(`${panel.id}-detail`, 'text', { content: String(panel.props.detail), level: 'caption' }, panel.source),
      ] : []),
    ],
  }
})

// ── Card ──
// Props: title, description, actions[]
registerRecipe('card', (panel) => ({
  ...panel,
  atom: 'box',
  recipe: undefined,
  props: {
    background: 'var(--pane-color-surface)',
    borderColor: 'var(--pane-color-border)',
    padding: 'var(--pane-space-lg)',
    gap: 'var(--pane-space-sm)',
  },
  children: [
    ...(panel.props.title ? [
      p(`${panel.id}-title`, 'text', { content: String(panel.props.title), level: 'subheading' }, panel.source),
    ] : []),
    ...(panel.props.description ? [
      p(`${panel.id}-desc`, 'text', { content: String(panel.props.description), level: 'body' }, panel.source),
    ] : []),
    ...(panel.children ?? []),
  ],
}))

// ── Data Table ──
// Props: columns (string[]), rows (string[][])
registerRecipe('data-table', (panel) => {
  const columns = (panel.props.columns ?? []) as string[]
  const rows = (panel.props.rows ?? []) as string[][]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      background: 'var(--pane-color-surface)',
      borderColor: 'var(--pane-color-border)',
      padding: '0',
      gap: '0',
      style: { overflow: 'auto' },
    },
    children: [
      // Header row
      {
        id: `${panel.id}-header`,
        atom: 'box' as const,
        props: {
          direction: 'row',
          gap: '0',
          padding: '0',
          background: 'var(--pane-color-surface-raised)',
          style: { borderBottom: '1px solid var(--pane-color-border)' },
        },
        source: panel.source,
        children: columns.map((col, i) => ({
          id: `${panel.id}-h-${i}`,
          atom: 'text' as const,
          props: { content: col, level: 'label', style: { padding: '10px 14px', flex: '1', minWidth: '100px' } },
          source: panel.source,
        })),
      },
      // Data rows
      ...rows.map((row, ri) => ({
        id: `${panel.id}-r-${ri}`,
        atom: 'box' as const,
        props: {
          direction: 'row',
          gap: '0',
          padding: '0',
          style: { borderBottom: ri < rows.length - 1 ? '1px solid var(--pane-color-border)' : 'none' },
        },
        source: panel.source,
        children: row.map((cell, ci) => ({
          id: `${panel.id}-r${ri}-c${ci}`,
          atom: 'text' as const,
          props: { content: cell, level: 'body', style: { padding: '10px 14px', flex: '1', minWidth: '100px' } },
          source: panel.source,
        })),
      })),
    ],
  }
})

// ── Editor ──
// Props: placeholder, content, submitLabel
registerRecipe('editor', (panel) => ({
  ...panel,
  atom: 'box',
  recipe: undefined,
  props: {
    gap: 'var(--pane-space-sm)',
  },
  children: [
    p(`${panel.id}-textarea`, 'input', {
      type: 'textarea',
      placeholder: panel.props.placeholder ?? 'Start writing...',
      value: panel.props.content ?? '',
    }, panel.source),
    {
      id: `${panel.id}-actions`,
      atom: 'box' as const,
      props: { direction: 'row', gap: 'var(--pane-space-sm)', justify: 'flex-end' },
      source: panel.source,
      children: [
        {
          id: `${panel.id}-submit`,
          atom: 'input' as const,
          props: { type: 'button', label: panel.props.submitLabel ?? 'Submit' },
          source: panel.source,
          on: { submit: `${panel.id}-submit` },
        },
      ],
    },
  ],
}))

// ── Action Group ──
// Props: actions[] ({ label, event, type? })
registerRecipe('action-group', (panel) => {
  const actions = (panel.props.actions ?? []) as { label: string; event: string; type?: string }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: { direction: 'row', gap: 'var(--pane-space-sm)', align: 'center' },
    children: actions.map((action, i) => ({
      id: `${panel.id}-action-${i}`,
      atom: 'input' as const,
      props: { type: 'button', label: action.label },
      source: panel.source,
      on: { submit: action.event },
    })),
  }
})

// ── Timeline ──
// Props: items[] ({ label, description?, time?, state? })
registerRecipe('timeline', (panel) => {
  const items = (panel.props.items ?? []) as { label: string; description?: string; time?: string; state?: string }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: { gap: '0', padding: 'var(--pane-space-sm)' },
    children: items.map((item, i) => ({
      id: `${panel.id}-item-${i}`,
      atom: 'box' as const,
      props: {
        direction: 'row',
        gap: 'var(--pane-space-md)',
        align: 'flex-start',
        padding: 'var(--pane-space-sm) 0',
        style: { borderLeft: '2px solid var(--pane-color-border)', paddingLeft: 'var(--pane-space-md)', marginLeft: '4px' },
      },
      source: panel.source,
      children: [
        {
          id: `${panel.id}-item-${i}-content`,
          atom: 'box' as const,
          props: { gap: '2px', flex: '1' },
          source: panel.source,
          children: [
            { id: `${panel.id}-item-${i}-label`, atom: 'text' as const, props: { content: item.label, level: 'body' }, source: panel.source },
            ...(item.description ? [{ id: `${panel.id}-item-${i}-desc`, atom: 'text' as const, props: { content: item.description, level: 'caption' }, source: panel.source }] : []),
          ],
        },
        ...(item.time ? [{
          id: `${panel.id}-item-${i}-time`,
          atom: 'text' as const,
          props: { content: item.time, level: 'caption' },
          source: panel.source,
        }] : []),
      ],
    })),
  }
})

// ── Form ──
// Props: fields[] ({ label, name, type?, placeholder?, options? }), submitLabel
registerRecipe('form', (panel) => {
  const fields = (panel.props.fields ?? []) as { label: string; name: string; type?: string; placeholder?: string; options?: { label: string; value: string }[] }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      background: 'var(--pane-color-surface)',
      borderColor: 'var(--pane-color-border)',
      padding: 'var(--pane-space-lg)',
      gap: 'var(--pane-space-md)',
    },
    children: [
      ...fields.map((field, i) => ({
        id: `${panel.id}-field-${i}`,
        atom: 'box' as const,
        props: { gap: 'var(--pane-space-xs)' },
        source: panel.source,
        children: [
          { id: `${panel.id}-field-${i}-label`, atom: 'text' as const, props: { content: field.label, level: 'label' }, source: panel.source },
          { id: `${panel.id}-field-${i}-input`, atom: 'input' as const, props: { type: field.type ?? 'text', placeholder: field.placeholder, options: field.options }, source: panel.source },
        ],
      })),
      {
        id: `${panel.id}-submit`,
        atom: 'input' as const,
        props: { type: 'button', label: panel.props.submitLabel ?? 'Submit' },
        source: panel.source,
        on: { submit: `${panel.id}-submit` },
      },
    ],
  }
})

// ── Helper ──
function p(id: string, atom: PanePanel['atom'], props: Record<string, unknown>, source: string): PanePanel {
  return { id, atom, props, source }
}
