import type { PaneSessionUpdate, PanePanel } from '@pane/core'

const SOURCE = 'showcase'

type Msg = { from: 'user' | 'agent'; text: string }

const messages: Msg[] = [
  { from: 'agent', text: "Hey — I'm Pane. What are we working on today?" },
  { from: 'user', text: "I want to review last quarter's vendor performance." },
  { from: 'agent', text: 'Got it. I can pull the Q3 report with on-time rate, defect rate, and spend. Should I focus on top 10 vendors?' },
  { from: 'user', text: 'Yes, top 10 by spend. And flag anything trending down.' },
  { from: 'agent', text: 'Pulling now. I see 2 vendors trending down: Corundum Mfg (-4.1% on-time) and Forge & Foundry (-6.8%). Want a drill-down?' },
  { from: 'user', text: 'Drill into Corundum.' },
]

function bubble(i: number, m: Msg): PanePanel {
  const isUser = m.from === 'user'
  return {
    id: `msg-${i}`,
    atom: 'box',
    props: {
      direction: 'row',
      justify: isUser ? 'flex-end' : 'flex-start',
      padding: 'var(--pane-space-xs) var(--pane-space-md)',
    },
    source: SOURCE,
    children: [
      {
        id: `msg-${i}-bubble`,
        atom: 'box',
        props: {
          background: isUser ? 'var(--pane-color-accent)' : 'var(--pane-color-surface)',
          borderColor: 'var(--pane-color-border)',
          padding: 'var(--pane-space-sm) var(--pane-space-md)',
          gap: '2px',
          style: { maxWidth: '70%', borderRadius: '2px' },
        },
        source: SOURCE,
        children: [
          {
            id: `msg-${i}-from`,
            atom: 'text',
            props: {
              content: isUser ? 'YOU' : 'PANE',
              level: 'caption',
              style: { opacity: 0.6 },
            },
            source: SOURCE,
          },
          {
            id: `msg-${i}-text`,
            atom: 'text',
            props: {
              content: m.text,
              level: 'body',
              style: isUser ? { color: '#0b0b0e' } : undefined,
            },
            source: SOURCE,
          },
        ],
      },
    ],
  }
}

const update: PaneSessionUpdate = {
  contexts: [
    {
      id: 'chat',
      operation: 'create',
      label: 'Conversation',
      modality: 'conversational',
      status: 'active',
      view: {
        layout: { pattern: 'stack', gap: '0' },
        panels: [
          ...messages.map((m, i) => bubble(i, m)),
          {
            id: 'composer',
            atom: 'box',
            props: {
              direction: 'row',
              gap: 'var(--pane-space-sm)',
              padding: 'var(--pane-space-md)',
              background: 'var(--pane-color-surface)',
              borderColor: 'var(--pane-color-border)',
            },
            source: SOURCE,
            children: [
              {
                id: 'composer-input',
                atom: 'input',
                props: {
                  type: 'text',
                  placeholder: 'Message Pane...',
                  style: { flex: 1 },
                },
                source: SOURCE,
              },
              {
                id: 'composer-send',
                atom: 'input',
                props: { type: 'button', label: 'Send' },
                source: SOURCE,
                on: { submit: 'send-message' },
              },
            ],
          },
        ],
      },
    },
  ],
}

export default update
