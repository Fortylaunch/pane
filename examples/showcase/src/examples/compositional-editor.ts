import type { PaneSessionUpdate } from '@pane/core'

const SOURCE = 'showcase'

const update: PaneSessionUpdate = {
  contexts: [
    {
      id: 'editor',
      operation: 'create',
      label: 'Compositional Editor',
      modality: 'compositional',
      status: 'active',
      view: {
        layout: {
          pattern: 'sidebar',
          sidebarWidth: '260px',
          sidebarPosition: 'left',
          gap: 'var(--pane-space-lg)',
        },
        panels: [
          // First panel is the sidebar
          {
            id: 'sidebar',
            atom: 'box',
            props: {
              background: 'var(--pane-color-surface)',
              borderColor: 'var(--pane-color-border)',
              padding: 'var(--pane-space-sm)',
              gap: 'var(--pane-space-md)',
            },
            source: SOURCE,
            children: [
              {
                id: 'sidebar-title',
                atom: 'text',
                props: { content: 'DOCUMENTS', level: 'label' },
                source: SOURCE,
              },
              {
                id: 'sidebar-nav',
                atom: 'box',
                recipe: 'nav-list',
                props: {
                  items: [
                    { label: 'Project Brief', description: 'Last edited 2h ago', event: 'open-brief', icon: 'check' },
                    { label: 'Design Spec', description: 'Draft', event: 'open-spec', icon: 'check' },
                    { label: 'Launch Plan', description: 'Shared with 4', event: 'open-launch', icon: 'check' },
                    { label: 'Retro Notes', description: 'Yesterday', event: 'open-retro', icon: 'check' },
                    { label: 'Archive', description: '18 items', event: 'open-archive', icon: 'check' },
                  ],
                },
                source: SOURCE,
              },
            ],
          },
          // Content area
          {
            id: 'content',
            atom: 'box',
            props: {
              gap: 'var(--pane-space-md)',
            },
            source: SOURCE,
            children: [
              {
                id: 'doc-card',
                atom: 'box',
                recipe: 'card',
                props: {
                  title: 'Project Brief — Q2 Launch',
                  description: 'A cross-functional plan for the Q2 launch spanning design, engineering, and go-to-market.',
                },
                source: SOURCE,
                children: [
                  {
                    id: 'doc-meta',
                    atom: 'box',
                    recipe: 'key-value',
                    props: {
                      items: [
                        { key: 'Owner', value: 'Sam Liu' },
                        { key: 'Status', value: 'In review' },
                        { key: 'Updated', value: '2h ago' },
                        { key: 'Collaborators', value: '6' },
                      ],
                    },
                    source: SOURCE,
                  },
                ],
              },
              {
                id: 'doc-editor',
                atom: 'box',
                recipe: 'card',
                props: { title: 'Draft' },
                source: SOURCE,
                children: [
                  {
                    id: 'doc-editor-body',
                    atom: 'box',
                    recipe: 'editor',
                    props: {
                      placeholder: 'Start writing the brief...',
                      content:
                        'Goals\n- Ship the new workspace surface to 20% of accounts\n- Reduce onboarding time by 30%\n- Instrument all new flows with telemetry\n\nRisks\n- Integration with legacy billing\n- Mobile polish\n',
                      submitLabel: 'Save draft',
                    },
                    source: SOURCE,
                  },
                ],
              },
              {
                id: 'doc-actions',
                atom: 'box',
                recipe: 'action-group',
                props: {
                  actions: [
                    { label: 'Share', event: 'share-doc' },
                    { label: 'Export', event: 'export-doc' },
                    { label: 'Archive', event: 'archive-doc' },
                  ],
                },
                source: SOURCE,
              },
            ],
          },
        ],
      },
    },
  ],
}

export default update
