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

// ── Alert ──
// Props: message, type? (info|success|warning|danger), title?
registerRecipe('alert', (panel) => {
  const typeColors: Record<string, { border: string; icon: string; iconName: string }> = {
    info:    { border: 'var(--pane-color-info)',    icon: 'var(--pane-color-info)',    iconName: 'info' },
    success: { border: 'var(--pane-color-success)', icon: 'var(--pane-color-success)', iconName: 'check' },
    warning: { border: 'var(--pane-color-warning)', icon: 'var(--pane-color-warning)', iconName: 'alert' },
    danger:  { border: 'var(--pane-color-danger)',  icon: 'var(--pane-color-danger)',  iconName: 'alert' },
  }
  const type = String(panel.props.type ?? 'info')
  const colors = typeColors[type] ?? typeColors.info

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      direction: 'row',
      align: 'flex-start',
      gap: 'var(--pane-space-sm)',
      padding: 'var(--pane-space-md)',
      background: 'var(--pane-color-surface)',
      style: { borderLeft: `3px solid ${colors.border}` },
    },
    children: [
      p(`${panel.id}-icon`, 'icon', { name: colors.iconName, size: '18', color: colors.icon }, panel.source),
      {
        id: `${panel.id}-body`,
        atom: 'box' as const,
        props: { gap: 'var(--pane-space-xs)', flex: '1' },
        source: panel.source,
        children: [
          ...(panel.props.title ? [
            p(`${panel.id}-title`, 'text', { content: String(panel.props.title), level: 'label' }, panel.source),
          ] : []),
          p(`${panel.id}-msg`, 'text', { content: String(panel.props.message ?? ''), level: 'body' }, panel.source),
        ],
      },
    ],
  }
})

// ── Key-Value List ──
// Props: items[] ({ key, value })
registerRecipe('key-value', (panel) => {
  const items = (panel.props.items ?? []) as { key: string; value: string }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      gap: '0',
      padding: 'var(--pane-space-sm)',
    },
    children: items.map((item, i) => ({
      id: `${panel.id}-row-${i}`,
      atom: 'box' as const,
      props: {
        direction: 'row',
        justify: 'space-between',
        align: 'baseline',
        padding: 'var(--pane-space-xs) 0',
        gap: 'var(--pane-space-md)',
        style: i < items.length - 1 ? { borderBottom: '1px solid var(--pane-color-border)' } : {},
      },
      source: panel.source,
      children: [
        { id: `${panel.id}-k-${i}`, atom: 'text' as const, props: { content: item.key, level: 'label' }, source: panel.source },
        { id: `${panel.id}-v-${i}`, atom: 'text' as const, props: { content: item.value, level: 'body' }, source: panel.source },
      ],
    })),
  }
})

// ── Progress Tracker ──
// Props: steps[] ({ label, status? (complete|active|pending) })
registerRecipe('progress-tracker', (panel) => {
  const steps = (panel.props.steps ?? []) as { label: string; status?: string }[]
  const variantMap: Record<string, string> = { complete: 'success', active: 'info', pending: 'default' }

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      direction: 'row',
      align: 'flex-start',
      gap: 'var(--pane-space-sm)',
      padding: 'var(--pane-space-sm)',
    },
    children: steps.flatMap((step, i) => {
      const status = step.status ?? 'pending'
      const variant = variantMap[status] ?? 'default'
      const stepPanel: PanePanel = {
        id: `${panel.id}-step-${i}`,
        atom: 'box' as const,
        props: { align: 'center', gap: 'var(--pane-space-xs)', flex: '1' },
        source: panel.source,
        children: [
          { id: `${panel.id}-step-${i}-badge`, atom: 'badge' as const, props: { label: String(i + 1), variant }, source: panel.source },
          { id: `${panel.id}-step-${i}-label`, atom: 'text' as const, props: { content: step.label, level: 'caption' }, source: panel.source },
        ],
      }
      if (i < steps.length - 1) {
        return [
          stepPanel,
          { id: `${panel.id}-sep-${i}`, atom: 'divider' as const, props: { orientation: 'horizontal', spacing: '0', style: { flex: 1, alignSelf: 'center', marginTop: 'var(--pane-space-sm)' } }, source: panel.source },
        ]
      }
      return [stepPanel]
    }),
  }
})

// ── Nav List ──
// Props: items[] ({ label, description?, event, icon? })
registerRecipe('nav-list', (panel) => {
  const items = (panel.props.items ?? []) as { label: string; description?: string; event: string; icon?: string }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: { gap: '0' },
    children: items.map((item, i) => ({
      id: `${panel.id}-item-${i}`,
      atom: 'box' as const,
      props: {
        direction: 'row',
        align: 'center',
        gap: 'var(--pane-space-sm)',
        padding: 'var(--pane-space-sm) var(--pane-space-md)',
        interactive: true,
        style: i < items.length - 1 ? { borderBottom: '1px solid var(--pane-color-border)' } : {},
      },
      source: panel.source,
      on: { submit: item.event },
      children: [
        ...(item.icon ? [
          { id: `${panel.id}-item-${i}-icon`, atom: 'icon' as const, props: { name: item.icon, size: '16' }, source: panel.source },
        ] : []),
        {
          id: `${panel.id}-item-${i}-text`,
          atom: 'box' as const,
          props: { gap: '2px', flex: '1' },
          source: panel.source,
          children: [
            { id: `${panel.id}-item-${i}-label`, atom: 'text' as const, props: { content: item.label, level: 'body' }, source: panel.source },
            ...(item.description ? [
              { id: `${panel.id}-item-${i}-desc`, atom: 'text' as const, props: { content: item.description, level: 'caption' }, source: panel.source },
            ] : []),
          ],
        },
        { id: `${panel.id}-item-${i}-arrow`, atom: 'icon' as const, props: { name: 'arrow_right', size: '14', color: 'var(--pane-color-text-muted)' }, source: panel.source },
      ],
    })),
  }
})

// ── Stat Comparison ──
// Props: label, before, after, change?
registerRecipe('stat-comparison', (panel) => {
  const change = String(panel.props.change ?? '')
  const changeColor = change.startsWith('+') ? 'var(--pane-color-success)'
    : change.startsWith('-') ? 'var(--pane-color-danger)'
    : 'var(--pane-color-text-muted)'

  return {
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
      p(`${panel.id}-label`, 'text', { content: String(panel.props.label ?? ''), level: 'label' }, panel.source),
      {
        id: `${panel.id}-values`,
        atom: 'box' as const,
        props: { direction: 'row', align: 'center', gap: 'var(--pane-space-sm)' },
        source: panel.source,
        children: [
          p(`${panel.id}-before`, 'text', { content: String(panel.props.before ?? ''), level: 'body', style: { color: 'var(--pane-color-text-muted)' } }, panel.source),
          p(`${panel.id}-arrow`, 'icon', { name: 'arrow_right', size: '14', color: 'var(--pane-color-text-muted)' }, panel.source),
          p(`${panel.id}-after`, 'text', { content: String(panel.props.after ?? ''), level: 'subheading' }, panel.source),
          ...(change ? [
            p(`${panel.id}-change`, 'text', { content: change, level: 'caption', style: { color: changeColor } }, panel.source),
          ] : []),
        ],
      },
    ],
  }
})

// ── Toolbar ──
// Props: items[] ({ label, event, icon?, active? }), search?
registerRecipe('toolbar', (panel) => {
  const items = (panel.props.items ?? []) as { label: string; event: string; icon?: string; active?: boolean }[]
  const hasSearch = !!panel.props.search

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      direction: 'row',
      align: 'center',
      gap: 'var(--pane-space-xs)',
      padding: 'var(--pane-space-xs) var(--pane-space-sm)',
      glass: true,
    },
    children: [
      ...items.map((item, i) => ({
        id: `${panel.id}-pill-${i}`,
        atom: 'pill' as const,
        props: { label: item.label, active: item.active ?? false, dot: !!item.icon, variant: 'default' },
        source: panel.source,
        on: { toggle: item.event },
      })),
      ...(hasSearch ? [
        { id: `${panel.id}-spacer`, atom: 'spacer' as const, props: { size: '1px', direction: 'horizontal' }, source: panel.source },
        { id: `${panel.id}-search`, atom: 'input' as const, props: { type: 'text', placeholder: 'Search...', style: { flex: 1, minWidth: '120px' } }, source: panel.source },
      ] : []),
    ],
  }
})

// ── Filter Bar ──
// Props: filters[] ({ label, value, active? }), event
registerRecipe('filter-bar', (panel) => {
  const filters = (panel.props.filters ?? []) as { label: string; value: string; active?: boolean }[]
  const event = String(panel.props.event ?? 'filter')

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      direction: 'row',
      align: 'center',
      gap: 'var(--pane-space-xs)',
      padding: 'var(--pane-space-xs) 0',
      style: { overflowX: 'auto', flexWrap: 'nowrap' },
    },
    children: filters.map((f, i) => ({
      id: `${panel.id}-filter-${i}`,
      atom: 'pill' as const,
      props: { label: f.label, active: f.active ?? false, dot: true, variant: f.active ? 'info' : 'default' },
      source: panel.source,
      on: { toggle: `${event}-${f.value}` },
    })),
  }
})

// ── Stat Grid ──
// Props: stats[] ({ label, value, trend?, icon? }), minWidth?
registerRecipe('stat-grid', (panel) => {
  const stats = (panel.props.stats ?? []) as { label: string; value: string; trend?: string; icon?: string }[]
  const minWidth = String(panel.props.minWidth ?? '240px')

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      gap: 'var(--pane-space-md)',
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))`,
      },
    },
    children: stats.map((stat, i) => ({
      id: `${panel.id}-stat-${i}`,
      atom: 'box' as const,
      recipe: 'metric',
      props: { label: stat.label, value: stat.value, trend: stat.trend, flex: '1' },
      source: panel.source,
    })),
  }
})

// ── Map Panel ──
// Props: center, zoom, markers?, title?, controls? ({ label, event }[])
registerRecipe('map-panel', (panel) => {
  const title = panel.props.title ? String(panel.props.title) : undefined
  const controls = (panel.props.controls ?? []) as { label: string; event: string }[]

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      padding: '0',
      gap: '0',
      style: { position: 'relative', overflow: 'hidden', borderRadius: 'var(--pane-radius-lg)' },
    },
    children: [
      // Map
      {
        id: `${panel.id}-map`,
        atom: 'map' as const,
        props: {
          center: panel.props.center,
          zoom: panel.props.zoom,
          markers: panel.props.markers,
          layers: panel.props.layers,
          tileUrl: panel.props.tileUrl,
          height: panel.props.height ?? '400px',
          style: { borderRadius: '0' },
        },
        source: panel.source,
      },
      // Overlay header with title + controls
      ...(title || controls.length > 0 ? [{
        id: `${panel.id}-overlay`,
        atom: 'box' as const,
        props: {
          direction: 'row',
          align: 'center',
          justify: 'space-between',
          padding: 'var(--pane-space-sm) var(--pane-space-md)',
          glass: true,
          style: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, borderRadius: '0' },
        },
        source: panel.source,
        children: [
          ...(title ? [p(`${panel.id}-title`, 'text', { content: title, level: 'label' }, panel.source)] : []),
          ...(controls.length > 0 ? [{
            id: `${panel.id}-controls`,
            atom: 'box' as const,
            props: { direction: 'row', gap: 'var(--pane-space-xs)', align: 'center' },
            source: panel.source,
            children: controls.map((c, i) => ({
              id: `${panel.id}-ctrl-${i}`,
              atom: 'pill' as const,
              props: { label: c.label, active: false, variant: 'default' },
              source: panel.source,
              on: { toggle: c.event },
            })),
          }] : []),
        ],
      }] : []),
    ],
  }
})

// ── Dashboard ──
// Props: title?, metrics? (PanePanel[]), chart? (PanePanel), map? (PanePanel), table? (PanePanel)
registerRecipe('dashboard', (panel) => {
  const title = panel.props.title ? String(panel.props.title) : undefined

  return {
    ...panel,
    atom: 'box',
    recipe: undefined,
    props: {
      gap: 'var(--pane-space-md)',
    },
    children: [
      // Header
      ...(title ? [p(`${panel.id}-title`, 'text', { content: title, level: 'heading' }, panel.source)] : []),
      // Metrics row (passed as children of the recipe panel)
      ...(panel.children ?? []),
    ],
  }
})

// ── Helper ──
function p(id: string, atom: PanePanel['atom'], props: Record<string, unknown>, source: string): PanePanel {
  return { id, atom, props, source }
}
