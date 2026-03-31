import { describe, it, expect } from 'vitest'
import { createPane } from './index.js'
import { functionAgent, staticAgent } from '../agents/index.js'
import { createInput, createFeedback } from '../interaction/index.js'
import { runEval, formatEvalResult } from '../evals/runner.js'
import type { PaneSession, PaneSessionUpdate, PaneView, PaneInput } from '../spec/types.js'

const simpleView: PaneView = {
  layout: { pattern: 'stack' },
  panels: [
    { id: 'welcome', atom: 'text', props: { content: 'Hello' }, source: 'test-agent' },
    { id: 'input', atom: 'input', props: { type: 'text' }, source: 'pane-system' },
  ],
}

describe('PaneRuntime', () => {
  it('initializes with first input', async () => {
    const agent = functionAgent(async () => ({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Main',
        modality: 'conversational' as const,
        view: simpleView,
      }],
    }))

    const pane = createPane({ agent })
    const input = createInput('hello')
    const session = await pane.init(input)

    expect(session.version).toBeGreaterThan(0)
    expect(session.contexts).toHaveLength(1)
    expect(session.contexts[0].id).toBe('main')
    expect(session.activeContext).toBe('main')
    expect(session.conversation).toHaveLength(1)
    expect(session.conversation[0].content).toBe('hello')
  })

  it('handles subsequent input', async () => {
    const agent = functionAgent(async (input: PaneInput, session: PaneSession) => {
      if (session.contexts.length === 0) {
        return {
          contexts: [{
            id: 'main',
            operation: 'create' as const,
            label: 'Main',
            modality: 'conversational' as const,
            view: simpleView,
          }],
        }
      }
      // Update the view with user's message
      return {
        contexts: [{
          id: 'main',
          operation: 'update' as const,
          view: {
            layout: { pattern: 'stack' as const },
            panels: [
              { id: 'response', atom: 'text' as const, props: { content: `You said: ${input.content}` }, source: 'test-agent' },
              { id: 'input', atom: 'input' as const, props: { type: 'text' }, source: 'pane-system' },
            ],
          },
        }],
      }
    })

    const pane = createPane({ agent })
    await pane.init(createInput('hello'))
    const session = await pane.handleInput(createInput('how are you'))

    expect(session.conversation).toHaveLength(2)
    const activeCtx = session.contexts.find(c => c.id === session.activeContext)
    expect(activeCtx?.view.panels[0].props.content).toBe('You said: how are you')
  })

  it('manages context shifts', async () => {
    const agent = functionAgent(async (input: PaneInput, session: PaneSession) => {
      if (session.contexts.length === 0) {
        return {
          contexts: [{
            id: 'marketing',
            operation: 'create' as const,
            label: 'Marketing',
            modality: 'informational' as const,
            view: simpleView,
          }],
        }
      }
      if (input.content.includes('engineering')) {
        return {
          contexts: [
            { id: 'marketing', operation: 'activate' as const },
            {
              id: 'engineering',
              operation: 'create' as const,
              label: 'Engineering',
              modality: 'environmental' as const,
              view: {
                layout: { pattern: 'stack' as const },
                panels: [
                  { id: 'eng-status', atom: 'text' as const, props: { content: 'Platform Status' }, source: 'eng-agent' },
                ],
              },
            },
            { id: 'engineering', operation: 'activate' as const },
          ],
        }
      }
      return {}
    })

    const pane = createPane({ agent })
    await pane.init(createInput('show me marketing'))
    const session = await pane.handleInput(createInput('switch to engineering'))

    expect(session.contexts).toHaveLength(2)
    expect(session.activeContext).toBe('engineering')
    // Marketing should be backgrounded
    const marketing = session.contexts.find(c => c.id === 'marketing')
    expect(marketing?.status).toBe('background')
  })

  it('tracks actions through lifecycle', async () => {
    const agent = functionAgent(async () => ({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Main',
        modality: 'transactional' as const,
        view: simpleView,
      }],
      actions: [{
        id: 'deploy',
        label: 'Deploy auth-svc',
        source: 'eng-agent',
        status: 'proposed' as const,
        requiresConfirmation: true,
        reversible: true,
      }],
    }))

    const pane = createPane({ agent })
    await pane.init(createInput('deploy'))

    let session = pane.getSession()
    expect(session.actions).toHaveLength(1)
    expect(session.actions[0].status).toBe('proposed')

    // Confirm the action
    const result = await pane.confirmAction('deploy')
    expect(result.status).toBe('completed')
    expect(result.duration).toBeGreaterThanOrEqual(0)

    session = pane.getSession()
    expect(session.actions.find(a => a.id === 'deploy')?.status).toBe('completed')
  })

  it('captures interjections', async () => {
    const agent = functionAgent(async () => ({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Main',
        modality: 'conversational' as const,
        view: simpleView,
      }],
      actions: [{
        id: 'long-task',
        label: 'Processing',
        source: 'test-agent',
        status: 'proposed' as const,
        requiresConfirmation: false,
        reversible: false,
      }],
    }))

    const pane = createPane({ agent })
    await pane.init(createInput('start'))

    // Confirm the action to move it to executing (auto-confirms since requiresConfirmation: false)
    // But since confirm() runs to completion, we test with the proposed action still in flight
    // by treating all non-completed actions as in-flight for interjection detection
    const allActions = pane.getSession().actions
    // Manually create an executing action for the test
    const mockExecuting = [{ ...allActions[0], status: 'executing' as const }]
    const interjection = createInput('wait, stop', 'text', mockExecuting)

    expect(interjection.isInterjection).toBe(true)
    expect(interjection.interruptedActionIds).toContain('long-task')
  })

  it('manages feedback', async () => {
    const agent = staticAgent({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Main',
        modality: 'informational' as const,
        view: simpleView,
      }],
    })

    const pane = createPane({ agent })
    await pane.init(createInput('show me data'))

    // Add feedback
    const feedback = createFeedback(
      'negative',
      'too dense',
      simpleView,
      { contextId: 'main' }
    )
    pane.addFeedback(feedback)

    let session = pane.getSession()
    expect(session.feedback).toHaveLength(1)
    expect(session.feedback[0].signal).toBe('too dense')

    // Retract feedback
    pane.retractFeedback(feedback.id)
    session = pane.getSession()
    expect(session.feedback).toHaveLength(0)
  })

  it('notifies subscribers on state changes', async () => {
    const agent = functionAgent(async () => ({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Main',
        modality: 'conversational' as const,
        view: simpleView,
      }],
    }))

    const pane = createPane({ agent })
    const updates: PaneSession[] = []
    pane.subscribe(session => updates.push(session))

    await pane.init(createInput('hello'))

    expect(updates.length).toBeGreaterThan(0)
    expect(updates[updates.length - 1].contexts).toHaveLength(1)
  })

  it('passes eval on well-formed session', async () => {
    const agent = functionAgent(async () => ({
      contexts: [{
        id: 'main',
        operation: 'create' as const,
        label: 'Dashboard',
        modality: 'informational' as const,
        view: {
          layout: { pattern: 'grid' as const, columns: 2 },
          panels: [
            { id: 'metric1', atom: 'box' as const, recipe: 'metric', props: { label: 'Revenue', value: '$42k' }, source: 'finance-agent' },
            { id: 'metric2', atom: 'box' as const, recipe: 'metric', props: { label: 'Users', value: '1247' }, source: 'analytics-agent' },
            { id: 'input', atom: 'input' as const, props: { type: 'text' }, source: 'pane-system' },
          ],
        },
      }],
      agents: [
        { id: 'finance-agent', name: 'Finance', state: 'idle' as const, lastActive: Date.now() },
        { id: 'analytics-agent', name: 'Analytics', state: 'idle' as const, lastActive: Date.now() },
        { id: 'pane-system', name: 'Pane System', state: 'idle' as const, lastActive: Date.now() },
      ],
    }))

    const pane = createPane({ agent })
    const input = createInput('show me the dashboard')
    const start = performance.now()
    await pane.init(input)
    const elapsed = performance.now() - start

    const session = pane.getSession()
    const evalResult = runEval({
      input,
      session,
      update: { contexts: [{ id: 'main', operation: 'create' as const }] },
      elapsedMs: elapsed,
    })

    // Log findings for debugging
    const issues = evalResult.findings.filter(f => f.grade === 'fail')
    if (issues.length > 0) {
      console.log('Eval failures:', issues.map(f => `[${f.dimension}] ${f.message}`))
    }

    expect(evalResult.overallGrade).not.toBe('fail')
    for (const dim of Object.values(evalResult.dimensions)) {
      expect(dim.grade).not.toBe('fail')
    }
  })
})
