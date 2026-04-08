import type { PaneSessionUpdate } from '@pane/core'

const SOURCE = 'showcase'

const update: PaneSessionUpdate = {
  contexts: [
    // 1. Conversational (active)
    {
      id: 'chat',
      operation: 'create',
      label: 'Chat',
      modality: 'conversational',
      status: 'active',
      view: {
        layout: { pattern: 'stack', gap: 'var(--pane-space-sm)' },
        panels: [
          {
            id: 'chat-greeting',
            atom: 'box',
            props: {
              background: 'var(--pane-color-surface)',
              borderColor: 'var(--pane-color-border)',
              padding: 'var(--pane-space-md)',
              gap: 'var(--pane-space-xs)',
            },
            source: SOURCE,
            children: [
              { id: 'chat-from', atom: 'text', props: { content: 'PANE', level: 'caption', style: { opacity: 0.6 } }, source: SOURCE },
              { id: 'chat-text', atom: 'text', props: { content: 'You have a pending approval and a live ops dashboard. Switch tabs to see them.', level: 'body' }, source: SOURCE },
            ],
          },
          {
            id: 'chat-composer',
            atom: 'box',
            props: { direction: 'row', gap: 'var(--pane-space-sm)', padding: 'var(--pane-space-sm)' },
            source: SOURCE,
            children: [
              { id: 'chat-input', atom: 'input', props: { type: 'text', placeholder: 'Ask anything...', style: { flex: 1 } }, source: SOURCE },
              { id: 'chat-send', atom: 'input', props: { type: 'button', label: 'Send' }, source: SOURCE, on: { submit: 'send' } },
            ],
          },
        ],
      },
    },

    // 2. Transactional (approval form)
    {
      id: 'approval',
      operation: 'create',
      label: 'Approval',
      modality: 'transactional',
      status: 'background',
      view: {
        layout: { pattern: 'stack', gap: 'var(--pane-space-md)' },
        panels: [
          {
            id: 'a-alert',
            atom: 'box',
            recipe: 'alert',
            props: {
              type: 'warning',
              title: 'Approval required',
              message: 'Vendor wire transfer exceeds your standing limit. Confirm or reject below.',
            },
            source: SOURCE,
          },
          {
            id: 'a-details',
            atom: 'box',
            recipe: 'key-value',
            props: {
              items: [
                { key: 'Vendor', value: 'Acme Industrial' },
                { key: 'Amount', value: '$84,200 USD' },
                { key: 'Invoice', value: 'INV-2301-9114' },
                { key: 'Due', value: '2026-04-08' },
                { key: 'Requester', value: 'Jordan Kim' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'a-form',
            atom: 'box',
            recipe: 'form',
            props: {
              submitLabel: 'Approve Transfer',
              fields: [
                { label: 'Approval note', name: 'note', type: 'textarea', placeholder: 'Optional justification...' },
                { label: 'Notify', name: 'notify', type: 'select', options: [
                  { label: 'Requester only', value: 'requester' },
                  { label: 'Team', value: 'team' },
                  { label: 'All stakeholders', value: 'all' },
                ] },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'a-actions',
            atom: 'box',
            recipe: 'action-group',
            props: {
              actions: [
                { label: 'Reject', event: 'reject-transfer' },
                { label: 'Request changes', event: 'request-changes' },
              ],
            },
            source: SOURCE,
          },
        ],
      },
    },

    // 3. Informational dashboard
    {
      id: 'ops',
      operation: 'create',
      label: 'Ops',
      modality: 'informational',
      status: 'background',
      view: {
        layout: { pattern: 'stack', gap: 'var(--pane-space-lg)' },
        panels: [
          {
            id: 'ops-title',
            atom: 'text',
            props: { content: 'LIVE OPERATIONS', level: 'heading' },
            source: SOURCE,
          },
          {
            id: 'ops-stats',
            atom: 'box',
            recipe: 'stat-grid',
            props: {
              minWidth: '200px',
              stats: [
                { label: 'Requests/s', value: '4,210', trend: '+6.2%' },
                { label: 'Error rate', value: '0.04%', trend: '-0.01%' },
                { label: 'p95 Latency', value: '182ms', trend: '-12ms' },
                { label: 'Active users', value: '28,104', trend: '+1,204' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'ops-timeline',
            atom: 'box',
            recipe: 'timeline',
            props: {
              items: [
                { label: 'Deploy v2.4.1', description: 'Rolled out to us-west-2', time: '14:22' },
                { label: 'Auto-scale up', description: '+4 instances', time: '14:31' },
                { label: 'Cache warmed', description: 'Edge PoPs synced', time: '14:33' },
                { label: 'Health check passed', description: 'All regions green', time: '14:35' },
              ],
            },
            source: SOURCE,
          },
        ],
      },
    },
  ],
}

export default update
