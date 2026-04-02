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
 * - Informational mode (metrics, data, recipes)
 * - Compositional mode (editor)
 * - Context shifts
 * - New atoms: badge, divider, progress, list
 * - New recipes: alert, key-value, progress-tracker, nav-list, stat-comparison
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
        view: makeConversationalView(`Hey! I'm Pane. This surface adapts to whatever you need.\n\nTry: "dashboard", "write something", "show me what you can do", "components", or "trigger an action".`),
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

  // Components showcase — new atoms + recipes
  if (text.includes('component') || text.includes('new') || text.includes('recipe') || text.includes('atom')) {
    return {
      contexts: [{
        id: 'main',
        operation: 'update',
        label: 'Components',
        modality: 'informational',
        view: makeComponentsView(),
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
      view: makeConversationalView(`You said: "${input.content}"\n\nI'm the starter agent. Try "dashboard", "write something", "components", "show me what you can do", or "trigger an action".`),
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
  const s = 'starter-agent'
  return {
    layout: { pattern: 'stack', gap: 'var(--pane-space-md)' },
    panels: [
      // Header with toolbar
      {
        id: 'dash-header', atom: 'box', props: { direction: 'row', align: 'center', justify: 'space-between' }, source: s,
        children: [
          {
            id: 'dash-title-row', atom: 'box', props: { direction: 'row', align: 'center', gap: 'var(--pane-space-sm)' }, source: s,
            children: [
              { id: 'dash-title', atom: 'text', props: { content: 'Dashboard', level: 'heading' }, source: s },
              { id: 'dash-badge', atom: 'badge', props: { label: 'Live', variant: 'success' }, source: s },
            ],
          },
          {
            id: 'dash-filters', atom: 'box', props: { direction: 'row', gap: 'var(--pane-space-xs)', align: 'center' }, source: s,
            children: [
              { id: 'pill-7d', atom: 'pill', props: { label: '7d', active: true, variant: 'info' }, source: s },
              { id: 'pill-30d', atom: 'pill', props: { label: '30d', variant: 'default' }, source: s },
              { id: 'pill-90d', atom: 'pill', props: { label: '90d', variant: 'default' }, source: s },
            ],
          },
        ],
      },
      // Alert
      { id: 'dash-alert', atom: 'box', recipe: 'alert', props: { title: 'Revenue milestone', message: 'Monthly revenue exceeded $40k target.', type: 'success' }, source: s },
      // Stat grid (auto-fill)
      {
        id: 'dash-stats', atom: 'box', recipe: 'stat-grid',
        props: { stats: [
          { label: 'Revenue', value: '$42,000', trend: '+12%' },
          { label: 'Active Users', value: '1,247', trend: '+34%' },
          { label: 'Churn Rate', value: '2.1%', trend: '-0.3%' },
          { label: 'NPS Score', value: '72', trend: '+5' },
        ], minWidth: '200px' },
        source: s,
      },
      // Chart + Map side by side
      {
        id: 'dash-main', atom: 'box', props: { direction: 'row', gap: 'var(--pane-space-md)', style: { flexWrap: 'wrap' } }, source: s,
        children: [
          {
            id: 'dash-chart-card', atom: 'box', props: { background: 'var(--pane-color-surface)', borderColor: 'var(--pane-color-border)', padding: 'var(--pane-space-lg)', gap: 'var(--pane-space-sm)', flex: '1', style: { minWidth: '300px' } }, source: s,
            children: [
              { id: 'chart-label', atom: 'text', props: { content: 'Revenue Trend', level: 'label' }, source: s },
              { id: 'chart-main', atom: 'chart', props: {
                type: 'area',
                data: {
                  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                  datasets: [{ values: [28000, 32000, 35000, 33000, 38000, 42000], color: 'var(--pane-color-accent)', label: 'Revenue' }],
                },
                height: '180px',
                options: { showGrid: true, showAxes: true },
              }, source: s },
            ],
          },
          {
            id: 'dash-map-card', atom: 'box', props: { padding: '0', flex: '1', style: { minWidth: '300px', overflow: 'hidden', borderRadius: 'var(--pane-radius-lg)' } }, source: s,
            children: [
              { id: 'dash-map', atom: 'map', props: {
                center: [20, 0] as [number, number],
                zoom: 2,
                markers: [
                  { position: [40.7, -74.0], label: 'New York — 312 users', color: '#3b82f6' },
                  { position: [51.5, -0.1], label: 'London — 247 users', color: '#22c55e' },
                  { position: [35.7, 139.7], label: 'Tokyo — 189 users', color: '#f59e0b' },
                  { position: [-33.9, 151.2], label: 'Sydney — 94 users', color: '#ef4444' },
                ],
                height: '260px',
              }, source: s },
            ],
          },
        ],
      },
      // Progress + Key-value row
      {
        id: 'dash-bottom', atom: 'box', props: { direction: 'row', gap: 'var(--pane-space-md)', style: { flexWrap: 'wrap' } }, source: s,
        children: [
          {
            id: 'dash-progress-card', atom: 'box', props: { background: 'var(--pane-color-surface)', borderColor: 'var(--pane-color-border)', padding: 'var(--pane-space-lg)', gap: 'var(--pane-space-md)', flex: '1', style: { minWidth: '250px' } }, source: s,
            children: [
              { id: 'prog-label', atom: 'text', props: { content: 'Targets', level: 'label' }, source: s },
              { id: 'prog-q', atom: 'progress', props: { value: 84, label: 'Quarterly Revenue', variant: 'success' }, source: s },
              { id: 'prog-u', atom: 'progress', props: { value: 62, label: 'User Growth', variant: 'default' }, source: s },
              { id: 'prog-c', atom: 'progress', props: { value: 91, label: 'Uptime SLA', variant: 'warning' }, source: s },
            ],
          },
          {
            id: 'dash-kv', atom: 'box', recipe: 'key-value',
            props: { items: [
              { key: 'Avg. Order Value', value: '$128' },
              { key: 'Conversion Rate', value: '3.2%' },
              { key: 'Active Subscriptions', value: '847' },
              { key: 'Support Tickets', value: '23 open' },
            ] },
            source: s,
          },
        ],
      },
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
      makeCapabilityCard('atoms', '16 Atoms', 'box, text, image, input, shape, frame, icon, spacer, badge, divider, progress, list, chart, skeleton, pill, map'),
      makeCapabilityCard('recipes', '18 Recipes', 'metric, status, card, data-table, editor, action-group, timeline, form, alert, key-value, progress-tracker, nav-list, stat-comparison, toolbar, filter-bar, stat-grid, map-panel, dashboard'),
      makeCapabilityCard('modality', '6 Modalities', 'conversational, informational, compositional, transactional, collaborative, environmental'),
      makeCapabilityCard('actions', 'Action Layer', 'Propose, confirm, execute, rollback — tracked side effects with full observability'),
      makeCapabilityCard('feedback', 'Feedback Loop', 'Thumbs up/down, dismiss tracking, verbal feedback — the surface learns from use'),
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

function makeComponentsView(): PaneView {
  return {
    layout: { pattern: 'stack', gap: 'var(--pane-space-lg)' },
    panels: [
      // Header
      {
        id: 'comp-header',
        atom: 'text',
        props: { content: 'New Components', level: 'heading' },
        source: 'starter-agent',
      },

      // Badges
      {
        id: 'comp-badges',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', padding: 'var(--pane-space-lg)', borderColor: 'var(--pane-color-border)', gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'badges-label', atom: 'text', props: { content: 'Badge Atom', level: 'subheading' }, source: 'starter-agent' },
          {
            id: 'badges-row', atom: 'box', props: { direction: 'row', gap: 'var(--pane-space-sm)', align: 'center' }, source: 'starter-agent',
            children: [
              { id: 'b-default', atom: 'badge', props: { label: 'Default' }, source: 'starter-agent' },
              { id: 'b-success', atom: 'badge', props: { label: 'Success', variant: 'success' }, source: 'starter-agent' },
              { id: 'b-warning', atom: 'badge', props: { label: 'Warning', variant: 'warning' }, source: 'starter-agent' },
              { id: 'b-danger', atom: 'badge', props: { label: 'Danger', variant: 'danger' }, source: 'starter-agent' },
              { id: 'b-info', atom: 'badge', props: { label: 'Info', variant: 'info' }, source: 'starter-agent' },
            ],
          },
        ],
      },

      // Progress bars
      {
        id: 'comp-progress',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', padding: 'var(--pane-space-lg)', borderColor: 'var(--pane-color-border)', gap: 'var(--pane-space-md)' },
        source: 'starter-agent',
        children: [
          { id: 'progress-label', atom: 'text', props: { content: 'Progress Atom', level: 'subheading' }, source: 'starter-agent' },
          { id: 'p-default', atom: 'progress', props: { value: 65, label: 'Upload' }, source: 'starter-agent' },
          { id: 'p-success', atom: 'progress', props: { value: 100, label: 'Complete', variant: 'success' }, source: 'starter-agent' },
          { id: 'p-warning', atom: 'progress', props: { value: 45, label: 'Storage', variant: 'warning' }, source: 'starter-agent' },
          { id: 'p-danger', atom: 'progress', props: { value: 92, label: 'CPU Usage', variant: 'danger' }, source: 'starter-agent' },
        ],
      },

      // Divider
      { id: 'comp-div', atom: 'divider', props: { label: 'Recipes' }, source: 'starter-agent' },

      // Alert recipes
      {
        id: 'comp-alerts',
        atom: 'box',
        props: { gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'alerts-label', atom: 'text', props: { content: 'Alert Recipe', level: 'subheading' }, source: 'starter-agent' },
          { id: 'alert-info', atom: 'box', recipe: 'alert', props: { message: 'System update scheduled for tonight.', type: 'info' }, source: 'starter-agent' },
          { id: 'alert-success', atom: 'box', recipe: 'alert', props: { title: 'Deployed', message: 'v2.4.1 is live on production.', type: 'success' }, source: 'starter-agent' },
          { id: 'alert-warning', atom: 'box', recipe: 'alert', props: { message: 'API rate limit at 80% of quota.', type: 'warning' }, source: 'starter-agent' },
          { id: 'alert-danger', atom: 'box', recipe: 'alert', props: { title: 'Error', message: 'Database connection pool exhausted.', type: 'danger' }, source: 'starter-agent' },
        ],
      },

      // Progress tracker recipe
      {
        id: 'comp-tracker',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', padding: 'var(--pane-space-lg)', borderColor: 'var(--pane-color-border)', gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'tracker-label', atom: 'text', props: { content: 'Progress Tracker Recipe', level: 'subheading' }, source: 'starter-agent' },
          {
            id: 'tracker',
            atom: 'box',
            recipe: 'progress-tracker',
            props: {
              steps: [
                { label: 'Plan', status: 'complete' },
                { label: 'Build', status: 'complete' },
                { label: 'Test', status: 'active' },
                { label: 'Deploy', status: 'pending' },
              ],
            },
            source: 'starter-agent',
          },
        ],
      },

      // Nav list recipe
      {
        id: 'comp-nav',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', borderColor: 'var(--pane-color-border)', gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'nav-label', atom: 'text', props: { content: 'Nav List Recipe', level: 'subheading', style: { padding: 'var(--pane-space-lg) var(--pane-space-lg) 0' } }, source: 'starter-agent' },
          {
            id: 'nav',
            atom: 'box',
            recipe: 'nav-list',
            props: {
              items: [
                { label: 'Settings', description: 'Configure workspace preferences', event: 'nav-settings', icon: 'search' },
                { label: 'Team', description: 'Manage collaborators and roles', event: 'nav-team', icon: 'plus' },
                { label: 'Integrations', description: 'Connect external services', event: 'nav-integrations', icon: 'info' },
              ],
            },
            source: 'starter-agent',
          },
        ],
      },

      // List atom
      {
        id: 'comp-list',
        atom: 'box',
        props: { background: 'var(--pane-color-surface)', padding: 'var(--pane-space-lg)', borderColor: 'var(--pane-color-border)', gap: 'var(--pane-space-sm)' },
        source: 'starter-agent',
        children: [
          { id: 'list-label', atom: 'text', props: { content: 'List Atom', level: 'subheading' }, source: 'starter-agent' },
          { id: 'list-demo', atom: 'list', props: { items: ['Badge — status tags and labels', 'Divider — section separators with optional labels', 'Progress — animated progress bars', 'List — semantic ordered and unordered lists'] }, source: 'starter-agent' },
        ],
      },
    ],
  }
}
