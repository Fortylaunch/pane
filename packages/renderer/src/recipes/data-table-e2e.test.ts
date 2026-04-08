import { describe, it, expect } from 'vitest'
import { createPane, functionAgent, createInput, validateView_, patchView } from '@pane/core'
import type { PaneInput, PaneSession, PaneSessionUpdate, PanePanel } from '@pane/core'
import { expandRecipe } from './registry.js'

// Side-effect: registers all built-in recipes
import './builtins.js'

// ────────────────────────────────────────────
// End-to-end: multi-turn data-table flow
//
// Simulates a 3-turn conversation:
//   Turn 1: "Show me vendor risk data" → creates data-table view
//   Turn 2: "Add a summary metric above" → patches view with ADD_PANELS
//   Turn 3: "Filter to critical vendors only" → updates table in-place
//
// Verifies:
//   - Recipe expansion produces a single CSS Grid (not nested flexbox rows)
//   - All cells share gridColumns so columns can never drift
//   - Patches preserve grid structure
//   - Spec validation passes at every step
// ────────────────────────────────────────────

const VENDOR_COLUMNS = ['Vendor', 'Category', 'Region', 'Risk Score', 'Cyber', 'Compliance', 'Status']

const VENDOR_ROWS = [
  ['Nexlify Ltd', 'Technology', 'Europe', '91', '96', '88', 'Critical'],
  ['DataSynapse Corp', 'Cloud SaaS', 'N. America', '87', '82', '95', 'Critical'],
  ['SupplyBridge Inc', 'Logistics', 'MENA', '79', '61', '72', 'High'],
  ['CloudVault AG', 'Storage', 'Europe', '76', '70', '84', 'High'],
  ['LogiRoute GmbH', 'Logistics', 'Europe', '72', '58', '65', 'High'],
]

const CRITICAL_ROWS = VENDOR_ROWS.filter(r => r[6] === 'Critical')

function makeTablePanel(id: string, columns: string[], rows: string[][]): PanePanel {
  return {
    id,
    atom: 'box' as const,
    recipe: 'data-table',
    props: { columns, rows },
    source: 'test-agent',
  }
}

function makeMetricPanel(id: string, label: string, value: string): PanePanel {
  return {
    id,
    atom: 'box' as const,
    recipe: 'metric',
    props: { label, value },
    source: 'test-agent',
  }
}

// ── Multi-turn agent that responds to different inputs ──
const vendorAgent = functionAgent(async (input: PaneInput, session: PaneSession): Promise<PaneSessionUpdate> => {
  const text = input.content.toLowerCase()

  // Turn 1: Create the initial data-table view
  if (session.contexts.length === 0 || text.includes('vendor risk')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'create',
        label: 'Vendor Watch List',
        modality: 'informational',
        view: {
          layout: { pattern: 'stack', gap: 'var(--pane-space-md)' },
          panels: [
            { id: 'title', atom: 'text', props: { content: 'High Priority Vendor Watch List', level: 'heading' }, source: 'test-agent' },
            makeTablePanel('vendor-table', VENDOR_COLUMNS, VENDOR_ROWS),
          ],
        },
      }],
      agents: [{ id: 'test-agent', name: 'Test Agent', state: 'idle', lastActive: Date.now() }],
    }
  }

  // Turn 2: Add summary metrics above the table (ADD_PANELS patch)
  if (text.includes('summary') || text.includes('metric')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        patch: {
          type: 'ADD_PANELS',
          panels: [
            makeMetricPanel('critical-count', 'Critical Vendors', String(CRITICAL_ROWS.length)),
            makeMetricPanel('total-count', 'Total Monitored', String(VENDOR_ROWS.length)),
          ],
          position: 'after',
          relativeTo: 'title',
        },
      }],
    }
  }

  // Turn 3: Filter to critical vendors — full view replacement
  // (runtime classifies "filter" as REPLACE_VIEW, so agent must return full view)
  if (text.includes('filter') || text.includes('critical')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        view: {
          layout: { pattern: 'stack', gap: 'var(--pane-space-md)' },
          panels: [
            { id: 'title', atom: 'text', props: { content: 'Critical Vendors Only', level: 'heading' }, source: 'test-agent' },
            makeMetricPanel('critical-count', 'Critical Vendors', String(CRITICAL_ROWS.length)),
            makeMetricPanel('total-count', 'Total Monitored', String(VENDOR_ROWS.length)),
            makeTablePanel('vendor-table', VENDOR_COLUMNS, CRITICAL_ROWS),
          ],
        },
      }],
    }
  }

  return {}
})


describe('Data-table end-to-end: multi-turn flow', () => {

  // ── Turn 1: Create view with data-table ──
  it('Turn 1: creates a data-table view with valid spec', async () => {
    const pane = createPane({ agent: vendorAgent })
    const session = await pane.init(createInput('Show me vendor risk data'))

    expect(session.contexts).toHaveLength(1)
    expect(session.activeContext).toBe('main')

    const ctx = session.contexts[0]
    expect(ctx.label).toBe('Vendor Watch List')
    expect(ctx.view.panels).toHaveLength(2)

    // The table panel should still have recipe at spec level
    const tablePanel = ctx.view.panels[1]
    expect(tablePanel.recipe).toBe('data-table')
    expect(tablePanel.props.columns).toEqual(VENDOR_COLUMNS)
    expect(tablePanel.props.rows).toEqual(VENDOR_ROWS)

    // Spec validation passes
    const validation = validateView_(ctx.view)
    expect(validation.valid).toBe(true)
  })

  // ── Recipe expansion: verify grid structure ──
  it('Recipe expansion produces a single CSS Grid, not nested flexbox rows', () => {
    const tablePanel = makeTablePanel('test-table', VENDOR_COLUMNS, VENDOR_ROWS)
    const expanded = expandRecipe(tablePanel)

    // Should be a box atom with recipe cleared
    expect(expanded.atom).toBe('box')
    expect(expanded.recipe).toBeUndefined()

    // Must have gridColumns prop — the structural fix
    expect(expanded.props.gridColumns).toBe(`repeat(${VENDOR_COLUMNS.length}, 1fr)`)

    // All children should be flat (no nesting) — header cells + data cells
    const expectedCellCount = VENDOR_COLUMNS.length + (VENDOR_ROWS.length * VENDOR_COLUMNS.length)
    expect(expanded.children).toHaveLength(expectedCellCount)

    // No child should have its own children (flat grid, not nested rows)
    for (const child of expanded.children!) {
      expect(child.children).toBeUndefined()
    }

    // Header cells should have level: 'label'
    const headerCells = expanded.children!.slice(0, VENDOR_COLUMNS.length)
    for (let i = 0; i < VENDOR_COLUMNS.length; i++) {
      expect(headerCells[i].atom).toBe('text')
      expect(headerCells[i].props.content).toBe(VENDOR_COLUMNS[i])
      expect(headerCells[i].props.level).toBe('label')
    }

    // Data cells should have level: 'body'
    const dataCells = expanded.children!.slice(VENDOR_COLUMNS.length)
    for (let i = 0; i < dataCells.length; i++) {
      expect(dataCells[i].atom).toBe('text')
      expect(dataCells[i].props.level).toBe('body')
    }

    // Verify data content maps correctly (row-major order)
    expect(dataCells[0].props.content).toBe('Nexlify Ltd')     // row 0, col 0
    expect(dataCells[1].props.content).toBe('Technology')       // row 0, col 1
    expect(dataCells[VENDOR_COLUMNS.length].props.content).toBe('DataSynapse Corp') // row 1, col 0
  })

  // ── Column alignment guarantee ──
  it('All cells in the same column share the same grid track', () => {
    const columns = ['Name', 'Score', 'Status']
    const rows = [
      ['A very long vendor name here', '9', 'OK'],
      ['B', '100', 'Critical — needs review'],
    ]
    const expanded = expandRecipe(makeTablePanel('align-test', columns, rows))

    // gridColumns ensures all cells snap to the same 3-column track
    expect(expanded.props.gridColumns).toBe('repeat(3, 1fr)')
    expect(expanded.children).toHaveLength(3 + 6) // 3 headers + 2 rows × 3 cols

    // No flex:1 on any cell (the old broken approach)
    for (const child of expanded.children!) {
      expect((child.props.style as Record<string, unknown>)?.flex).toBeUndefined()
    }
  })

  // ── Turn 2: ADD_PANELS patch ──
  it('Turn 2: patches view to add metrics above table', async () => {
    const pane = createPane({ agent: vendorAgent })
    await pane.init(createInput('Show me vendor risk data'))

    const session = await pane.handleInput(createInput('Add a summary metric above'))
    const ctx = session.contexts.find(c => c.id === 'main')!

    // Should now have: title, critical-count, total-count, vendor-table
    expect(ctx.view.panels).toHaveLength(4)
    expect(ctx.view.panels[0].id).toBe('title')
    expect(ctx.view.panels[1].id).toBe('critical-count')
    expect(ctx.view.panels[2].id).toBe('total-count')
    expect(ctx.view.panels[3].id).toBe('vendor-table')

    // Table should still be intact
    expect(ctx.view.panels[3].recipe).toBe('data-table')
    expect(ctx.view.panels[3].props.rows).toEqual(VENDOR_ROWS)

    // Spec still valid
    expect(validateView_(ctx.view).valid).toBe(true)
  })

  // ── Turn 3: REPLACE_VIEW — filter to critical vendors ──
  it('Turn 3: replaces view with filtered critical vendors', async () => {
    const pane = createPane({ agent: vendorAgent })
    await pane.init(createInput('Show me vendor risk data'))
    await pane.handleInput(createInput('Add a summary metric above'))

    const session = await pane.handleInput(createInput('Filter to critical only'))
    const ctx = session.contexts.find(c => c.id === 'main')!

    // Find the table panel — may be nested inside a scaffold wrapper
    function findPanel(panels: PanePanel[], id: string): PanePanel | undefined {
      for (const p of panels) {
        if (p.id === id) return p
        if (p.children) {
          const found = findPanel(p.children, id)
          if (found) return found
        }
      }
      return undefined
    }

    const table = findPanel(ctx.view.panels, 'vendor-table')!
    expect(table).toBeDefined()
    expect(table.props.rows).toEqual(CRITICAL_ROWS)
    expect((table.props.rows as string[][]).length).toBe(2)

    // Expand and verify grid still correct with fewer rows
    const expanded = expandRecipe(table)
    const expectedCells = VENDOR_COLUMNS.length + (CRITICAL_ROWS.length * VENDOR_COLUMNS.length)
    expect(expanded.children).toHaveLength(expectedCells)
    expect(expanded.props.gridColumns).toBe(`repeat(${VENDOR_COLUMNS.length}, 1fr)`)

    // Spec still valid
    expect(validateView_(ctx.view).valid).toBe(true)
  })

  // ── Conversation tracking ──
  it('tracks all 3 turns in conversation history', async () => {
    const pane = createPane({ agent: vendorAgent })
    await pane.init(createInput('Show me vendor risk data'))
    await pane.handleInput(createInput('Add a summary metric above'))
    const session = await pane.handleInput(createInput('Filter to critical only'))

    expect(session.conversation).toHaveLength(3)
    expect(session.conversation[0].content).toBe('Show me vendor risk data')
    expect(session.conversation[1].content).toBe('Add a summary metric above')
    expect(session.conversation[2].content).toBe('Filter to critical only')
    expect(session.version).toBeGreaterThanOrEqual(3)
  })

  // ── Edge case: single-column table ──
  it('handles single-column table correctly', () => {
    const expanded = expandRecipe(makeTablePanel('single-col', ['Name'], [['Alice'], ['Bob']]))
    expect(expanded.props.gridColumns).toBe('repeat(1, 1fr)')
    expect(expanded.children).toHaveLength(3) // 1 header + 2 data
  })

  // ── Edge case: empty rows ──
  it('handles table with no data rows', () => {
    const expanded = expandRecipe(makeTablePanel('empty', ['A', 'B', 'C'], []))
    expect(expanded.props.gridColumns).toBe('repeat(3, 1fr)')
    expect(expanded.children).toHaveLength(3) // headers only
  })

  // ── Edge case: wide table (many columns) ──
  it('handles wide table with many columns', () => {
    const cols = Array.from({ length: 20 }, (_, i) => `Col ${i}`)
    const rows = [Array.from({ length: 20 }, (_, i) => `val-${i}`)]
    const expanded = expandRecipe(makeTablePanel('wide', cols, rows))
    expect(expanded.props.gridColumns).toBe('repeat(20, 1fr)')
    expect(expanded.children).toHaveLength(40) // 20 headers + 20 data
  })

  // ── Row border styling ──
  it('applies row-separating borders to data cells but not last row', () => {
    const expanded = expandRecipe(makeTablePanel('borders', ['A', 'B'], [['1', '2'], ['3', '4'], ['5', '6']]))
    const dataCells = expanded.children!.slice(2) // skip 2 header cells
    const style = (i: number) => dataCells[i].props.style as Record<string, string>

    // Row 0 cells (index 0,1) — should have border
    expect(style(0).borderBottom).toContain('1px solid')
    expect(style(1).borderBottom).toContain('1px solid')

    // Row 1 cells (index 2,3) — should have border
    expect(style(2).borderBottom).toContain('1px solid')

    // Row 2 cells (last row, index 4,5) — no border
    expect(style(4).borderBottom).toBe('none')
    expect(style(5).borderBottom).toBe('none')
  })
})
