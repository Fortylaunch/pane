import type { PaneSessionUpdate } from '@pane/core'

const SOURCE = 'showcase'

const update: PaneSessionUpdate = {
  contexts: [
    {
      id: 'dashboard',
      operation: 'create',
      label: 'Static Dashboard',
      modality: 'informational',
      status: 'active',
      view: {
        layout: { pattern: 'stack', gap: 'var(--pane-space-lg)' },
        panels: [
          {
            id: 'header',
            atom: 'text',
            props: { content: 'VENDOR OPERATIONS', level: 'heading' },
            source: SOURCE,
          },
          {
            id: 'stats',
            atom: 'box',
            recipe: 'stat-grid',
            props: {
              minWidth: '220px',
              stats: [
                { label: 'Active Vendors', value: '142', trend: '+8 this week' },
                { label: 'Open Orders', value: '3,821', trend: '+12.4%' },
                { label: 'Avg Lead Time', value: '4.2d', trend: '-0.3d' },
                { label: 'On-Time Rate', value: '96.8%', trend: '+1.2%' },
                { label: 'Spend MTD', value: '$1.24M', trend: '+3.1%' },
                { label: 'Defect Rate', value: '0.42%', trend: '-0.08%' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'split',
            atom: 'box',
            props: {
              style: {
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 'var(--pane-space-lg)',
              },
            },
            source: SOURCE,
            children: [
              {
                id: 'vendors-table',
                atom: 'box',
                recipe: 'data-table',
                props: {
                  columns: ['Vendor', 'Region', 'Orders', 'On-Time', 'Status'],
                  rows: [
                    ['Acme Industrial', 'NA-West', '412', '98.1%', 'Active'],
                    ['Borealis Supply', 'EU-North', '287', '95.4%', 'Active'],
                    ['Corundum Mfg', 'APAC', '198', '89.2%', 'Watch'],
                    ['Delta Parts Co', 'NA-East', '356', '97.6%', 'Active'],
                    ['Evergreen Logistics', 'EU-South', '142', '92.1%', 'Active'],
                    ['Forge & Foundry', 'NA-West', '94', '88.0%', 'Watch'],
                  ],
                },
                source: SOURCE,
              },
              {
                id: 'status-panel',
                atom: 'box',
                props: {
                  background: 'var(--pane-color-surface)',
                  borderColor: 'var(--pane-color-border)',
                  padding: 'var(--pane-space-md)',
                  gap: 'var(--pane-space-sm)',
                },
                source: SOURCE,
                children: [
                  {
                    id: 'status-title',
                    atom: 'text',
                    props: { content: 'SYSTEM STATUS', level: 'label' },
                    source: SOURCE,
                  },
                  {
                    id: 'st-1',
                    atom: 'box',
                    recipe: 'status',
                    props: { label: 'Order pipeline', state: 'success', detail: 'nominal' },
                    source: SOURCE,
                  },
                  {
                    id: 'st-2',
                    atom: 'box',
                    recipe: 'status',
                    props: { label: 'Vendor API', state: 'success', detail: '210ms' },
                    source: SOURCE,
                  },
                  {
                    id: 'st-3',
                    atom: 'box',
                    recipe: 'status',
                    props: { label: 'Customs feed', state: 'warning', detail: 'degraded' },
                    source: SOURCE,
                  },
                  {
                    id: 'st-4',
                    atom: 'box',
                    recipe: 'status',
                    props: { label: 'Billing sync', state: 'danger', detail: '3 retries' },
                    source: SOURCE,
                  },
                  {
                    id: 'st-5',
                    atom: 'box',
                    recipe: 'status',
                    props: { label: 'Archive job', state: 'idle', detail: 'scheduled' },
                    source: SOURCE,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
}

export default update
