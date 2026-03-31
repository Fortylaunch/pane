// ────────────────────────────────────────────
// Interaction & Feedback
//
// Persistent input, interjection signaling,
// feedback capture.
// ────────────────────────────────────────────

import type {
  PaneInput,
  PaneFeedback,
  PaneView,
  PaneTrackedAction,
  InputModality,
  FeedbackType,
} from '../spec/types.js'

let inputCounter = 0

export function createInput(
  content: string,
  modality: InputModality = 'text',
  inFlightActions: PaneTrackedAction[] = []
): PaneInput {
  const executing = inFlightActions.filter(a => a.status === 'executing')

  return {
    id: `input-${++inputCounter}`,
    content,
    modality,
    timestamp: Date.now(),
    isInterjection: executing.length > 0,
    interruptedActionIds: executing.length > 0 ? executing.map(a => a.id) : undefined,
  }
}

let feedbackCounter = 0

export function createFeedback(
  type: FeedbackType,
  signal: string,
  viewSnapshot: PaneView,
  target: PaneFeedback['target'] = {}
): PaneFeedback {
  return {
    id: `feedback-${++feedbackCounter}`,
    timestamp: Date.now(),
    type,
    target,
    signal,
    viewSnapshot,
  }
}

// Reset counters (for testing)
export function resetCounters() {
  inputCounter = 0
  feedbackCounter = 0
}
