import {
  functionAgent,
  type PaneInput,
  type PaneSession,
  type PaneSessionUpdate,
  type PanePanel,
  type PaneView,
} from '@pane/core'

/**
 * Starter agent — demonstrates the surface.
 *
 * This agent responds to user input by composing views
 * from atoms and recipes. It shows:
 * - Conversational mode (text response + input)
 * - Informational mode (metrics, data)
 * - Compositional mode (editor)
 * - Context shifts
 */
export const starterAgent = functionAgent(async (input: PaneInput, session: PaneSession): Promise<PaneSessionUpdate> => {
  const text = input.content.toLowerCase().trim()

  // First input — welcome
  if (session.contexts.length === 0) {
    return {
      contexts: [{
        id: 'main',
        operation: 'create',
        label: 'Welcome',
        modality: 'conversational',
        view: makeConversationalView(`Hey! I'm Pane. This surface adapts to whatever you need.\n\nTry: "show me a dashboard", "let me write something", or "show me what you can do".`),
      }],
      agents: [
        { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
      ],
    }
  }

  // Dashboard demo
  if (text.includes('dashboard') || text.includes('metrics') || text.includes('data')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: 'Dashboard',
        modality: 'informational',
        view: makeDashboardView(),
      }],
      agents: [
        { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
      ],
    }
  }

  // Editor demo
  if (text.includes('write') || text.includes('draft') || text.includes('edit') || text.includes('compose')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: 'Editor',
        modality: 'compositional',
        view: makeEditorView(),
      }],
      agents: [
        { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
      ],
    }
  }

  // Capability showcase
  if (text.includes('what you can do') || text.includes('capabilities') || text.includes('show me')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: 'Capabilities',
        modality: 'informational',
        view: makeCapabilitiesView(),
      }],
      agents: [
        { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
      ],
    }
  }

  // Action demo
  if (text.includes('action') || text.includes('deploy') || text.includes('send')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: 'Actions',
        modality: 'transactional',
        view: makeConversationalView('I just proposed an action. In a real system, you\'d see a confirmation prompt and could approve or cancel it.'),
      }],
      actions: [{
        id: `action-${Date.now()}`,
        label: 'Example Action — Deploy to staging',
        source: 'starter-agent',
        status: 'proposed',
        requiresConfirmation: true,
        reversible: true,
      }],
      agents: [
        { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
      ],
    }
  }

  // Default: conversational response
  return {
    contexts: [{
      id: 'main',
      operation: 'update',
      label: 'Chat',
      modality: 'conversational',
      view: makeConversationalView(`You said: "${input.content}"\n\nI'm the starter agent. Try "dashboard", "write something", "show me what you can do", or "trigger an action".`),
    }],
    agents: [
      { id: 'starter-agent', name: 'Starter Agent', state: 'idle', lastActive: Date.now() },
    ],
  }
})

// ── View Builders ──

function makeConversationalView(message: string): PaneView {
  return {
    layout: { pattern: 'stack' },
    panels: [
      {
        id: 'response',
        atom: 'text',
        props: { content: message, level: 'body' },
        source: 'starter-agent',
      },
    ],
  }
}

function makeDashboardView(): PaneView {
  return {
    layout: { pattern: 'stack' },
    panels: [
      {
        id: 'dash-header',
        atom: 'text',
        props: { content: 'Dashboard', level: 'heading' },
        source: 'starter-agent',
      },
      {
        id: 'metrics-row',
        atom: 'box',
        props: { direction: 'row', gap: 'var(--pane-space-md)' },
        source: 'starter-agent',
        children: [
          makeMetricPanel('revenue', 'Revenue', '$42,000', '+12%'),
          makeMetricPanel('users', 'Active Users', '1,247', '+34%'),
          makeMetricPanel('churn', 'Churn Rate', '2.1%', '-0.3%'),
        ],
      },
      {
        id: 'chart-area',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', padding: 'var(--pane-space-lg)', borderColor: 'var(--pane-color-border)' },
        source: 'starter-agent',
        children: [
          {
            id: 'chart-label',
            atom: 'text',
            props: { content: 'Revenue Trend (7 days)', level: 'label' },
            source: 'starter-agent',
          },
          {
            id: 'chart-viz',
            atom: 'shape',
            props: {
              shape: 'path',
              d: 'M 0 50 Q 30 20, 60 35 T 120 25 T 180 15 T 200 10',
              height: '80',
              stroke: 'var(--pane-color-accent)',
              strokeWidth: 2,
            },
            source: 'starter-agent',
          },
        ],
      },
    ],
  }
}

function makeMetricPanel(id: string, label: string, value: string, trend: string): PanePanel {
  const isPositive = trend.startsWith('+') || trend.startsWith('-') && parseFloat(trend) < 0
  return {
    id: `metric-${id}`,
    atom: 'box',
    props: {
      background: 'var(--pane-color-surface)',
      padding: 'var(--pane-space-lg)',
      borderColor: 'var(--pane-color-border)',
      flex: '1',
    },
    source: 'starter-agent',
    children: [
      { id: `${id}-label`, atom: 'text', props: { content: label, level: 'label' }, source: 'starter-agent' },
      { id: `${id}-value`, atom: 'text', props: { content: value, level: 'heading' }, source: 'starter-agent' },
      { id: `${id}-trend`, atom: 'text', props: { content: trend, level: 'caption' }, source: 'starter-agent' },
    ],
  }
}

function makeEditorView(): PaneView {
  return {
    layout: { pattern: 'stack' },
    panels: [
      {
        id: 'editor-header',
        atom: 'text',
        props: { content: 'Compose', level: 'heading' },
        source: 'starter-agent',
      },
      {
        id: 'editor-area',
        atom: 'input',
        props: { type: 'textarea', placeholder: 'Start writing...' },
        source: 'starter-agent',
      },
      {
        id: 'editor-actions',
        atom: 'box',
        props: { direction: 'row', gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'btn-save', atom: 'input', props: { type: 'button', label: 'Save Draft' }, source: 'starter-agent', on: { submit: 'save-draft' } },
          { id: 'btn-send', atom: 'input', props: { type: 'button', label: 'Send' }, source: 'starter-agent', on: { submit: 'send' } },
        ],
      },
    ],
  }
}

function makeCapabilitiesView(): PaneView {
  return {
    layout: { pattern: 'grid', columns: 2 },
    panels: [
      makeCapabilityCard('atoms', '8 Atoms', 'box, text, image, input, shape, frame, icon, spacer — compose anything from these'),
      makeCapabilityCard('modality', '6 Modalities', 'conversational, informational, compositional, transactional, collaborative, environmental'),
      makeCapabilityCard('actions', 'Action Layer', 'Propose, confirm, execute, rollback — tracked side effects with full observability'),
      makeCapabilityCard('feedback', 'Feedback Loop', 'Thumbs up/down, dismiss tracking, verbal feedback — the surface learns from use'),
      makeCapabilityCard('contexts', 'Context Shifting', 'Switch between workspaces fluidly — previous state preserved in background'),
      makeCapabilityCard('trace', 'Traceability', 'Every panel, action, and artifact traces to its source agent — nothing is hidden'),
    ],
  }
}

function makeCapabilityCard(id: string, title: string, description: string): PanePanel {
  return {
    id: `cap-${id}`,
    atom: 'box',
    props: {
      background: 'var(--pane-color-surface)',
      padding: 'var(--pane-space-lg)',
      borderColor: 'var(--pane-color-border)',
    },
    source: 'starter-agent',
    children: [
      { id: `${id}-title`, atom: 'text', props: { content: title, level: 'subheading' }, source: 'starter-agent' },
      { id: `${id}-desc`, atom: 'text', props: { content: description, level: 'body' }, source: 'starter-agent' },
    ],
  }
}
