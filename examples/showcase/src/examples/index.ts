import type { PaneSessionUpdate } from '@pane/core'
import staticDashboard from './static-dashboard.js'
import recipeShowcase from './recipe-showcase.js'
import conversationalThread from './conversational-thread.js'
import modalityShift from './modality-shift.js'
import compositionalEditor from './compositional-editor.js'

export interface ExampleMeta {
  id: string
  title: string
  description: string
  modality: string
  update: PaneSessionUpdate
}

export const examples: ExampleMeta[] = [
  {
    id: 'static-dashboard',
    title: 'Static Dashboard',
    description: 'Stat grid + data table + status panel',
    modality: 'informational',
    update: staticDashboard,
  },
  {
    id: 'recipe-showcase',
    title: 'Recipe Showcase',
    description: 'One of each built-in recipe in a grid',
    modality: 'informational',
    update: recipeShowcase,
  },
  {
    id: 'conversational-thread',
    title: 'Conversational Thread',
    description: 'Chat bubbles with a composer',
    modality: 'conversational',
    update: conversationalThread,
  },
  {
    id: 'modality-shift',
    title: 'Modality Shift',
    description: 'Chat + approval form + dashboard, switchable via tabs',
    modality: 'multi',
    update: modalityShift,
  },
  {
    id: 'compositional-editor',
    title: 'Compositional Editor',
    description: 'Sidebar nav + card-based editor',
    modality: 'compositional',
    update: compositionalEditor,
  },
]
