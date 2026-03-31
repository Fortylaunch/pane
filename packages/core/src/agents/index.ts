// ────────────────────────────────────────────
// Agent Interface + Adapters
//
// How any agent drives Pane.
// ────────────────────────────────────────────

import type {
  PaneAgent,
  PaneInput,
  PaneSession,
  PaneSessionUpdate,
  PaneTrackedAction,
} from '../spec/types.js'

// ── Adapters ──

/**
 * Wraps a simple function as a PaneAgent.
 * The function receives input + session and returns an update.
 */
export function functionAgent(
  fn: (input: PaneInput, session: PaneSession) => Promise<PaneSessionUpdate>
): PaneAgent {
  return {
    async init(input: PaneInput) {
      const emptySession = createEmptySession()
      return fn(input, emptySession)
    },
    async onInput(input: PaneInput, session: PaneSession) {
      return fn(input, session)
    },
  }
}

/**
 * Returns the same view forever. For testing/storybook.
 */
export function staticAgent(update: PaneSessionUpdate): PaneAgent {
  return {
    async init() {
      return update
    },
    async onInput() {
      return update
    },
  }
}

/**
 * Wraps a function that produces continuous updates on an interval.
 */
export function tickAgent(
  fn: (session: PaneSession) => Promise<PaneSessionUpdate | null>,
  initUpdate: PaneSessionUpdate
): PaneAgent {
  return {
    async init() {
      return initUpdate
    },
    async onInput(_input: PaneInput, session: PaneSession) {
      return (await fn(session)) ?? {}
    },
    async tick(session: PaneSession) {
      return fn(session)
    },
  }
}

/**
 * Wraps a streaming function. Calls onChunk for partial updates,
 * returns the final update.
 */
export function streamingAgent(
  fn: (
    input: PaneInput,
    session: PaneSession,
    onChunk: (partial: PaneSessionUpdate) => void
  ) => Promise<PaneSessionUpdate>
): PaneAgent {
  let onChunkCallback: ((partial: PaneSessionUpdate) => void) | null = null

  return {
    async init(input: PaneInput) {
      const emptySession = createEmptySession()
      return fn(input, emptySession, (chunk) => onChunkCallback?.(chunk))
    },
    async onInput(input: PaneInput, session: PaneSession) {
      return fn(input, session, (chunk) => onChunkCallback?.(chunk))
    },
    // Expose a way to set the chunk callback (used by the runtime)
    _setOnChunk(cb: (partial: PaneSessionUpdate) => void) {
      onChunkCallback = cb
    },
  } as PaneAgent & { _setOnChunk: (cb: (partial: PaneSessionUpdate) => void) => void }
}

// ── Helpers ──

function createEmptySession(): PaneSession {
  return {
    id: '',
    version: 0,
    activeContext: '',
    contexts: [],
    conversation: [],
    actions: [],
    agents: [],
    artifacts: [],
    feedback: [],
  }
}
