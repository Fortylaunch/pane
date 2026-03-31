// ────────────────────────────────────────────
// Pane Eval Framework
//
// Measures whether the system is producing good
// outcomes across 5 dimensions:
//   1. Spec quality
//   2. Modality fit
//   3. Visual outcome
//   4. Interaction quality
//   5. Traceability
// ────────────────────────────────────────────

import type {
  PaneSession,
  PaneSessionUpdate,
  PaneView,
  PanePanel,
  PaneInput,
  PaneTrackedAction,
  PaneFeedback,
  ModalityHint,
} from '../spec/types.js'

// ── Eval Scoring ──

export type EvalGrade = 'pass' | 'warn' | 'fail'

export interface EvalFinding {
  dimension: EvalDimension
  grade: EvalGrade
  rule: string              // what was checked
  message: string           // human-readable result
  path?: string             // where in the spec the issue is
  suggestion?: string       // how to fix it
}

export type EvalDimension =
  | 'spec-quality'
  | 'modality-fit'
  | 'visual-outcome'
  | 'interaction-quality'
  | 'traceability'
  | 'design-quality'

export interface EvalResult {
  timestamp: number
  duration: number          // ms — how long the eval took
  dimensions: Record<EvalDimension, DimensionScore>
  findings: EvalFinding[]
  overallGrade: EvalGrade
}

export interface DimensionScore {
  grade: EvalGrade
  score: number             // 0-1
  findingCount: { pass: number; warn: number; fail: number }
}

// ── Eval Context ──

// Everything the eval needs to assess a moment in the system
export interface EvalContext {
  input?: PaneInput                   // what the user said
  session: PaneSession                // current session state
  update?: PaneSessionUpdate          // what the agent returned
  previousSession?: PaneSession       // session before the update (for diffing)
  elapsedMs?: number                  // how long the agent took to respond
}

// ── Eval Scenario ──

// A scripted test case for the eval framework
export interface EvalScenario {
  id: string
  name: string
  description: string
  steps: EvalStep[]
  expectations: EvalExpectation[]
}

export interface EvalStep {
  input: PaneInput
  expectedModality?: ModalityHint
  expectedPanelCount?: { min?: number; max?: number }
  expectedActions?: string[]          // action ids that should be proposed
  description: string                 // what this step tests
}

export interface EvalExpectation {
  dimension: EvalDimension
  rule: string
  description: string
  check: (ctx: EvalContext) => EvalFinding
}
