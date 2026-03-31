/**
 * Quick demo — run with: npx tsx scripts/demo.ts
 *
 * This shows the spec types and validator in action.
 * It builds a session like what you'd see when a user opens Pane.
 */

import {
  validateSpec,
  validateView_,
  validatePanel_,
  type PaneSession,
  type PanePanel,
  type PaneView,
} from '../packages/core/src/index.js'

// ── Build a panel from atoms ──

const welcomeText: PanePanel = {
  id: 'welcome',
  atom: 'text',
  props: { content: 'Pane is running. This surface adapts to whatever you need.', level: 'body' },
  source: 'starter-agent',
}

const inputField: PanePanel = {
  id: 'main-input',
  atom: 'input',
  props: { type: 'text', placeholder: 'Type below to start.' },
  source: 'pane-system',
  on: { submit: 'user-input' },
}

// ── Compose into a view ──

const initialView: PaneView = {
  layout: { pattern: 'stack', gap: '1rem' },
  panels: [welcomeText, inputField],
}

console.log('\n── Validate a view ──')
const viewResult = validateView_(initialView)
console.log('Valid:', viewResult.valid)

// ── Build a full session ──

const session: PaneSession = {
  id: 'session-001',
  version: 1,
  activeContext: 'main',
  contexts: [
    {
      id: 'main',
      label: 'Getting Started',
      modality: 'conversational',
      view: initialView,
      status: 'active',
    },
  ],
  conversation: [],
  actions: [],
  agents: [
    {
      id: 'starter-agent',
      name: 'Starter Agent',
      state: 'idle',
      lastActive: Date.now(),
    },
  ],
  artifacts: [],
  feedback: [],
}

console.log('\n── Validate full session ──')
const sessionResult = validateSpec(session)
console.log('Valid:', sessionResult.valid)

// ── Show what a composed recipe looks like ──

const metricCard: PanePanel = {
  id: 'revenue-metric',
  atom: 'box',
  recipe: 'metric', // hint to renderer to expand this recipe
  props: { label: 'Revenue', value: '$42,000', trend: '+12%' },
  source: 'finance-agent',
  emphasis: 'primary',
}

const dashboardView: PaneView = {
  layout: { pattern: 'grid', columns: 3, gap: '1rem' },
  panels: [
    metricCard,
    {
      id: 'users-metric',
      atom: 'box',
      recipe: 'metric',
      props: { label: 'Active Users', value: '1,247', trend: '+34%' },
      source: 'analytics-agent',
    },
    {
      id: 'churn-metric',
      atom: 'box',
      recipe: 'metric',
      props: { label: 'Churn Rate', value: '2.1%', trend: '-0.3%' },
      source: 'analytics-agent',
      emphasis: 'muted',
    },
  ],
}

console.log('\n── Validate a dashboard view (3 metric cards in grid) ──')
const dashResult = validateView_(dashboardView)
console.log('Valid:', dashResult.valid)

// ── Show what happens with bad data ──

console.log('\n── Validate bad data (missing source = traceability violation) ──')
const badPanel = {
  id: 'untraceable',
  atom: 'text',
  props: { content: 'Where did I come from?' },
  source: '', // empty — violates traceability
}
const badResult = validatePanel_(badPanel)
console.log('Valid:', badResult.valid)
console.log('Errors:', badResult.errors)

console.log('\n── Validate bad atom type ──')
const badAtom = {
  id: 'fake',
  atom: 'carousel', // not a real atom
  props: {},
  source: 'some-agent',
}
const atomResult = validatePanel_(badAtom)
console.log('Valid:', atomResult.valid)
console.log('Errors:', atomResult.errors)

console.log('\n✓ Demo complete. The types and validator are working.\n')
