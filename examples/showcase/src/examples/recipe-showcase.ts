import type { PaneSessionUpdate } from '@pane/core'

const SOURCE = 'showcase'

const update: PaneSessionUpdate = {
  contexts: [
    {
      id: 'recipes',
      operation: 'create',
      label: 'Recipe Showcase',
      modality: 'informational',
      status: 'active',
      view: {
        layout: { pattern: 'grid', columns: 2, gap: 'var(--pane-space-lg)' },
        panels: [
          {
            id: 'r-metric',
            atom: 'box',
            recipe: 'metric',
            props: { label: 'Revenue', value: '$482K', trend: '+12.4%' },
            source: SOURCE,
          },
          {
            id: 'r-status',
            atom: 'box',
            recipe: 'status',
            props: { label: 'Primary cluster', state: 'success', detail: 'healthy' },
            source: SOURCE,
          },
          {
            id: 'r-card',
            atom: 'box',
            recipe: 'card',
            props: {
              title: 'Deployment v2.4.1',
              description: 'Rolled out to production at 14:22 UTC across all regions.',
            },
            source: SOURCE,
          },
          {
            id: 'r-alert',
            atom: 'box',
            recipe: 'alert',
            props: {
              title: 'Quota approaching',
              message: 'You are at 84% of monthly API quota.',
              type: 'warning',
            },
            source: SOURCE,
          },
          {
            id: 'r-keyvalue',
            atom: 'box',
            recipe: 'key-value',
            props: {
              items: [
                { key: 'Env', value: 'production' },
                { key: 'Region', value: 'us-west-2' },
                { key: 'Version', value: '2.4.1' },
                { key: 'Uptime', value: '18d 4h' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'r-progress',
            atom: 'box',
            recipe: 'progress-tracker',
            props: {
              steps: [
                { label: 'Build', status: 'complete' },
                { label: 'Test', status: 'complete' },
                { label: 'Deploy', status: 'active' },
                { label: 'Verify', status: 'pending' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'r-navlist',
            atom: 'box',
            recipe: 'nav-list',
            props: {
              items: [
                { label: 'Settings', description: 'Preferences and billing', event: 'nav-settings' },
                { label: 'Members', description: '12 active users', event: 'nav-members' },
                { label: 'Integrations', description: '4 connected', event: 'nav-integrations' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'r-statcomp',
            atom: 'box',
            recipe: 'stat-comparison',
            props: { label: 'Latency p95', before: '420ms', after: '210ms', change: '-50%' },
            source: SOURCE,
          },
          {
            id: 'r-toolbar',
            atom: 'box',
            recipe: 'toolbar',
            props: {
              search: true,
              items: [
                { label: 'All', event: 'filter-all', active: true },
                { label: 'Active', event: 'filter-active' },
                { label: 'Archived', event: 'filter-archived' },
              ],
            },
            source: SOURCE,
          },
          {
            id: 'r-filterbar',
            atom: 'box',
            recipe: 'filter-bar',
            props: {
              event: 'set-filter',
              filters: [
                { label: 'Today', value: 'today', active: true },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Quarter', value: 'quarter' },
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
