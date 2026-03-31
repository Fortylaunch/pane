// ────────────────────────────────────────────
// Modality System
//
// The intelligence Pane owns: what kind of
// workspace does this moment need?
// ────────────────────────────────────────────

import type { ModalityHint, PaneContext } from '../spec/types.js'

export interface ModalityConfig {
  inputPosition: 'primary' | 'ambient' | 'integrated'
  inputSize: 'large' | 'compact'
  panelPriority: 'panels' | 'input' | 'balanced'
  allowCascading: boolean     // depth focus compresses periphery
  allowBlending: boolean      // multiple modalities can coexist
}

const MODALITY_CONFIGS: Record<ModalityHint, ModalityConfig> = {
  conversational: {
    inputPosition: 'primary',
    inputSize: 'large',
    panelPriority: 'input',
    allowCascading: false,
    allowBlending: true,
  },
  informational: {
    inputPosition: 'ambient',
    inputSize: 'compact',
    panelPriority: 'panels',
    allowCascading: true,
    allowBlending: true,
  },
  compositional: {
    inputPosition: 'integrated',
    inputSize: 'large',
    panelPriority: 'balanced',
    allowCascading: true,
    allowBlending: true,
  },
  transactional: {
    inputPosition: 'ambient',
    inputSize: 'compact',
    panelPriority: 'panels',
    allowCascading: false,
    allowBlending: true,
  },
  collaborative: {
    inputPosition: 'integrated',
    inputSize: 'large',
    panelPriority: 'balanced',
    allowCascading: true,
    allowBlending: true,
  },
  environmental: {
    inputPosition: 'integrated',
    inputSize: 'compact',
    panelPriority: 'panels',
    allowCascading: true,
    allowBlending: true,
  },
}

export function getModalityConfig(hint: ModalityHint): ModalityConfig {
  return MODALITY_CONFIGS[hint]
}

export function isModalityShift(prev: ModalityHint, next: ModalityHint): boolean {
  return prev !== next
}

// Determine which modalities are active across all visible contexts
export function getActiveModalities(contexts: PaneContext[]): ModalityHint[] {
  return [...new Set(
    contexts
      .filter(c => c.status === 'active' || c.status === 'preparing')
      .map(c => c.modality)
  )]
}

// When multiple modalities are active, determine the dominant one
export function getDominantModality(modalities: ModalityHint[]): ModalityHint {
  if (modalities.length === 0) return 'conversational'
  if (modalities.length === 1) return modalities[0]

  // Priority: reactive modes > creative modes > passive modes
  const priority: ModalityHint[] = [
    'transactional',    // needs immediate decision
    'compositional',    // active creation
    'collaborative',    // active review
    'environmental',    // deep work
    'conversational',   // back and forth
    'informational',    // passive viewing
  ]

  for (const mode of priority) {
    if (modalities.includes(mode)) return mode
  }

  return modalities[0]
}
