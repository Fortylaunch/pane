import { describe, it, expect } from 'vitest'
import { validateSpec, validateView_, validatePanel_ } from './validate.js'
import type { PanePanel, PaneView, PaneSession } from './types.js'

describe('validatePanel', () => {
  it('accepts a valid panel', () => {
    const panel: PanePanel = {
      id: 'p1',
      atom: 'text',
      props: { content: 'Hello', level: 'heading' },
      source: 'test-agent',
    }
    const result = validatePanel_(panel)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects panel without source (traceability)', () => {
    const panel = {
      id: 'p1',
      atom: 'text',
      props: {},
      source: '',
    }
    const result = validatePanel_(panel)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('source'))).toBe(true)
  })

  it('rejects invalid atom type', () => {
    const panel = {
      id: 'p1',
      atom: 'widget',
      props: {},
      source: 'test-agent',
    }
    const result = validatePanel_(panel)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('atom'))).toBe(true)
  })

  it('validates nested children', () => {
    const panel: PanePanel = {
      id: 'parent',
      atom: 'box',
      props: {},
      source: 'test-agent',
      children: [
        { id: 'child1', atom: 'text', props: { content: 'hello' }, source: 'test-agent' },
        { id: '', atom: 'text', props: {}, source: 'test-agent' }, // invalid: empty id
      ],
    }
    const result = validatePanel_(panel)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('children[1]'))).toBe(true)
  })

  it('accepts all 8 atom types', () => {
    const atoms = ['box', 'text', 'image', 'input', 'shape', 'frame', 'icon', 'spacer'] as const
    for (const atom of atoms) {
      const result = validatePanel_({
        id: `p-${atom}`,
        atom,
        props: {},
        source: 'test-agent',
      })
      expect(result.valid).toBe(true)
    }
  })
})

describe('validateView', () => {
  it('accepts a valid view', () => {
    const view: PaneView = {
      layout: { pattern: 'stack' },
      panels: [
        { id: 'p1', atom: 'text', props: { content: 'hello' }, source: 'agent-a' },
        { id: 'p2', atom: 'box', props: {}, source: 'agent-b' },
      ],
    }
    const result = validateView_(view)
    expect(result.valid).toBe(true)
  })

  it('rejects duplicate panel ids', () => {
    const view: PaneView = {
      layout: { pattern: 'stack' },
      panels: [
        { id: 'same', atom: 'text', props: {}, source: 'agent-a' },
        { id: 'same', atom: 'box', props: {}, source: 'agent-b' },
      ],
    }
    const result = validateView_(view)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true)
  })

  it('rejects invalid layout pattern', () => {
    const view = {
      layout: { pattern: 'carousel' },
      panels: [],
    }
    const result = validateView_(view)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('layout pattern'))).toBe(true)
  })

  it('accepts all 6 layout patterns', () => {
    const patterns = ['stack', 'split', 'grid', 'tabs', 'overlay', 'flow'] as const
    for (const pattern of patterns) {
      const result = validateView_({
        layout: { pattern },
        panels: [],
      })
      expect(result.valid).toBe(true)
    }
  })
})

describe('validateSpec (session)', () => {
  const validSession: PaneSession = {
    id: 'session-1',
    version: 1,
    activeContext: 'ctx-1',
    contexts: [
      {
        id: 'ctx-1',
        label: 'Main',
        modality: 'conversational',
        view: {
          layout: { pattern: 'stack' },
          panels: [
            { id: 'p1', atom: 'text', props: { content: 'Welcome' }, source: 'starter-agent' },
          ],
        },
        status: 'active',
      },
    ],
    conversation: [],
    actions: [],
    agents: [],
    artifacts: [],
    feedback: [],
  }

  it('accepts a valid session', () => {
    const result = validateSpec(validSession)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing id', () => {
    const result = validateSpec({ ...validSession, id: undefined })
    expect(result.valid).toBe(false)
  })

  it('rejects missing version', () => {
    const result = validateSpec({ ...validSession, version: undefined })
    expect(result.valid).toBe(false)
  })

  it('validates nested context views', () => {
    const bad = {
      ...validSession,
      contexts: [
        {
          id: 'ctx-1',
          label: 'Main',
          modality: 'conversational',
          view: {
            layout: { pattern: 'invalid' },
            panels: [],
          },
          status: 'active',
        },
      ],
    }
    const result = validateSpec(bad)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.path.includes('contexts[0].view'))).toBe(true)
  })
})
