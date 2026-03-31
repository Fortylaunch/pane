/**
 * Eval demo — run with: npx tsx scripts/eval-demo.ts
 *
 * Runs the 5-dimension eval against example sessions
 * to show what good and bad look like.
 */

import { runEval, formatEvalResult } from '../packages/core/src/evals/runner.js'
import type { EvalContext } from '../packages/core/src/evals/types.js'
import type { PaneSession, PaneInput } from '../packages/core/src/spec/types.js'

// ── Scenario 1: Good session ──

console.log('═══════════════════════════════════════')
console.log(' SCENARIO 1: Well-formed session')
console.log('═══════════════════════════════════════')

const goodSession: PaneSession = {
  id: 'session-good',
  version: 3,
  activeContext: 'main',
  contexts: [
    {
      id: 'main',
      label: 'Dashboard',
      modality: 'informational',
      view: {
        layout: { pattern: 'grid', columns: 3 },
        panels: [
          {
            id: 'revenue',
            atom: 'box',
            recipe: 'metric',
            props: { label: 'Revenue', value: '$42k', trend: '+12%' },
            source: 'finance-agent',
            emphasis: 'primary',
          },
          {
            id: 'users',
            atom: 'box',
            recipe: 'metric',
            props: { label: 'Users', value: '1,247', trend: '+34%' },
            source: 'analytics-agent',
          },
          {
            id: 'churn',
            atom: 'box',
            recipe: 'metric',
            props: { label: 'Churn', value: '2.1%', trend: '-0.3%' },
            source: 'analytics-agent',
            emphasis: 'muted',
          },
          {
            id: 'chart',
            atom: 'box',
            recipe: 'chart',
            props: { type: 'line', data: '$revenue_trend' },
            source: 'finance-agent',
          },
          {
            id: 'actions',
            atom: 'input',
            props: { type: 'text', placeholder: 'What do you need?' },
            source: 'pane-system',
          },
        ],
      },
      status: 'active',
    },
  ],
  conversation: [],
  actions: [
    {
      id: 'a1',
      label: 'Refresh analytics',
      source: 'analytics-agent',
      status: 'completed',
      requiresConfirmation: false,
      reversible: false,
      startedAt: Date.now() - 1200,
      completedAt: Date.now(),
      duration: 1200,
    },
  ],
  agents: [
    { id: 'finance-agent', name: 'Finance', state: 'idle', lastActive: Date.now() },
    { id: 'analytics-agent', name: 'Analytics', state: 'idle', lastActive: Date.now() },
  ],
  artifacts: [],
  feedback: [],
}

const goodInput: PaneInput = {
  id: 'i1',
  content: 'Show me how the business is doing',
  modality: 'text',
  timestamp: Date.now(),
  isInterjection: false,
}

const goodCtx: EvalContext = {
  input: goodInput,
  session: goodSession,
  update: { contexts: [{ id: 'main', operation: 'update', view: goodSession.contexts[0].view }] },
  elapsedMs: 850,
}

const goodResult = runEval(goodCtx)
console.log(formatEvalResult(goodResult))

// ── Scenario 2: Bad session — traceability violations ──

console.log('═══════════════════════════════════════')
console.log(' SCENARIO 2: Traceability violations')
console.log('═══════════════════════════════════════')

const badSession: PaneSession = {
  id: 'session-bad',
  version: 1,
  activeContext: 'main',
  contexts: [
    {
      id: 'main',
      label: 'Untraceable',
      modality: 'informational',
      view: {
        layout: { pattern: 'stack' },
        panels: [
          {
            id: 'ghost',
            atom: 'text',
            props: { content: 'Where did I come from?' },
            source: '', // violation
          },
          {
            id: 'orphan',
            atom: 'box',
            props: {},
            source: '', // violation
            children: [
              { id: 'nested-ghost', atom: 'text', props: {}, source: '' }, // nested violation
            ],
          },
        ],
      },
      status: 'active',
    },
  ],
  conversation: [],
  actions: [
    {
      id: 'mystery-action',
      label: 'Something happened',
      source: '', // violation
      status: 'completed',
      requiresConfirmation: false,
      reversible: false,
      completedAt: Date.now(),
      // missing duration, missing startedAt
    },
  ],
  agents: [
    { id: 'unknown', name: 'Unknown Agent', state: 'working', lastActive: Date.now() },
    // working but no currentTask — violation
  ],
  artifacts: [
    {
      id: 'art1',
      label: 'Mystery file',
      source: '', // violation
      contextId: 'main',
      createdAt: Date.now(),
      location: '', // violation
      retention: 'session',
      type: 'document',
    },
  ],
  feedback: [],
}

const badCtx: EvalContext = {
  session: badSession,
  elapsedMs: 15000, // very slow
}

const badResult = runEval(badCtx)
console.log(formatEvalResult(badResult))

// ── Scenario 3: Modality mismatch ──

console.log('═══════════════════════════════════════')
console.log(' SCENARIO 3: Modality mismatch')
console.log('═══════════════════════════════════════')

const mismatchSession: PaneSession = {
  id: 'session-mismatch',
  version: 1,
  activeContext: 'main',
  contexts: [
    {
      id: 'main',
      label: 'Says conversational, shows dashboard',
      modality: 'conversational', // says conversational...
      view: {
        layout: { pattern: 'grid', columns: 4 },
        panels: [
          // ...but all content is informational with no input
          { id: 'm1', atom: 'box', recipe: 'metric', props: { value: '100' }, source: 'agent-a' },
          { id: 'm2', atom: 'box', recipe: 'metric', props: { value: '200' }, source: 'agent-a' },
          { id: 'm3', atom: 'box', recipe: 'chart', props: { type: 'bar' }, source: 'agent-a' },
          { id: 'm4', atom: 'box', recipe: 'data-table', props: { columns: ['a', 'b'] }, source: 'agent-a' },
        ],
      },
      status: 'active',
    },
  ],
  conversation: [],
  actions: [],
  agents: [{ id: 'agent-a', name: 'Agent A', state: 'idle', lastActive: Date.now() }],
  artifacts: [],
  feedback: [],
}

const mismatchCtx: EvalContext = {
  session: mismatchSession,
  input: { id: 'i2', content: 'hello', modality: 'text', timestamp: Date.now(), isInterjection: false },
  update: { contexts: [{ id: 'main', operation: 'update' }] },
  elapsedMs: 400,
}

const mismatchResult = runEval(mismatchCtx)
console.log(formatEvalResult(mismatchResult))

// ── Scenario 4: Visual overload ──

console.log('═══════════════════════════════════════')
console.log(' SCENARIO 4: Visual overload')
console.log('═══════════════════════════════════════')

const overloadSession: PaneSession = {
  id: 'session-overload',
  version: 1,
  activeContext: 'main',
  contexts: [
    {
      id: 'main',
      label: 'Too much',
      modality: 'informational',
      view: {
        layout: { pattern: 'stack' },
        panels: Array.from({ length: 12 }, (_, i) => ({
          id: `text-${i}`,
          atom: 'text' as const,
          props: { content: `Item ${i}` },
          source: 'agent-a',
          emphasis: i < 4 ? 'urgent' as const : i < 7 ? 'primary' as const : 'default' as const,
        })),
      },
      status: 'active',
    },
  ],
  conversation: [],
  actions: [],
  agents: [{ id: 'agent-a', name: 'Agent A', state: 'idle', lastActive: Date.now() }],
  artifacts: [],
  feedback: [],
}

const overloadCtx: EvalContext = {
  session: overloadSession,
  elapsedMs: 300,
}

const overloadResult = runEval(overloadCtx)
console.log(formatEvalResult(overloadResult))

console.log('═══════════════════════════════════════')
console.log(' EVAL DEMO COMPLETE')
console.log('═══════════════════════════════════════\n')
