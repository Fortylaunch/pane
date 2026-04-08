// ────────────────────────────────────────────
// Operation Tracker
//
// Registers async operations, tracks lifecycle,
// enforces deadlines. The runtime calls start/complete/fail,
// the watchdog flips expired operations to 'timeout'.
// ────────────────────────────────────────────

import type { PaneOperation, OperationType, OperationStatus } from '../spec/types.js'
import { emitTelemetry } from '../telemetry/index.js'
import {
  TIMEOUT_API_CALL,
  TIMEOUT_SPEC_EVAL,
  TIMEOUT_VISUAL_EVAL,
  TIMEOUT_DESIGN_REVIEW,
  TIMEOUT_DECOMPOSE,
  TIMEOUT_LAYOUT_PLAN,
  WATCHDOG_INTERVAL,
  OPERATION_CLEANUP_DELAY,
} from '../limits.js'

/** Default deadlines per operation type (ms) */
const DEFAULT_DEADLINES: Record<OperationType, number> = {
  'api-call':      TIMEOUT_API_CALL,
  'spec-eval':     TIMEOUT_SPEC_EVAL,
  'visual-eval':   TIMEOUT_VISUAL_EVAL,
  'design-review': TIMEOUT_DESIGN_REVIEW,
  'decompose':     TIMEOUT_DECOMPOSE,
  'layout-plan':   TIMEOUT_LAYOUT_PLAN,
}

/** User-facing messages per operation type */
const DEFAULT_MESSAGES: Record<OperationType, string> = {
  'api-call':       'Generating...',
  'spec-eval':      'Evaluating spec...',
  'visual-eval':    'Evaluating render...',
  'design-review':  'Reviewing design...',
  'decompose':      'Decomposing request...',
  'layout-plan':    'Planning layout...',
}

export type OperationChangeListener = (operations: PaneOperation[]) => void

export class OperationTracker {
  private operations: Map<string, PaneOperation> = new Map()
  private listeners: Set<OperationChangeListener> = new Set()
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private idCounter = 0

  constructor() {
    // Watchdog checks periodically for expired operations
    this.watchdogTimer = setInterval(() => this.checkDeadlines(), WATCHDOG_INTERVAL)
  }

  /**
   * Register a new operation. Returns the operation ID.
   */
  start(type: OperationType, message?: string): string {
    const id = `op-${type}-${++this.idCounter}`
    const now = Date.now()
    const op: PaneOperation = {
      id,
      type,
      status: 'running',
      message: message ?? DEFAULT_MESSAGES[type],
      startedAt: now,
      deadline: now + DEFAULT_DEADLINES[type],
    }
    this.operations.set(id, op)

    emitTelemetry('system:info', {
      type: 'operation-start',
      opId: id,
      opType: type,
    }, { preview: `Operation started: ${op.message}` })

    this.notify()
    return id
  }

  /**
   * Mark an operation as successfully completed.
   * Overrides 'timeout' — a successful result always wins over a deadline.
   */
  complete(id: string) {
    const op = this.operations.get(id)
    if (!op || (op.status !== 'running' && op.status !== 'timeout')) return

    op.status = 'complete'
    op.completedAt = Date.now()

    emitTelemetry('system:info', {
      type: 'operation-complete',
      opId: id,
      duration: op.completedAt - op.startedAt,
    }, { preview: `Operation complete: ${op.message} (${op.completedAt - op.startedAt}ms)` })

    this.notify()

    // Auto-remove completed operations after fade-out delay
    setTimeout(() => {
      if (this.operations.get(id)?.status === 'complete') {
        this.operations.delete(id)
        this.notify()
      }
    }, OPERATION_CLEANUP_DELAY)
  }

  /**
   * Mark an operation as failed with an error message.
   */
  fail(id: string, error: string) {
    const op = this.operations.get(id)
    if (!op || op.status !== 'running') return

    op.status = 'error'
    op.completedAt = Date.now()
    op.error = error

    emitTelemetry('system:info', {
      type: 'operation-error',
      opId: id,
      error,
    }, { preview: `Operation failed: ${op.message} — ${error}` })

    this.notify()
  }

  /**
   * Update the user-facing message for a running operation.
   */
  updateMessage(id: string, message: string) {
    const op = this.operations.get(id)
    if (!op || op.status !== 'running') return
    op.message = message
    this.notify()
  }

  /**
   * Dismiss an error/timeout operation (user clicked retry or dismiss).
   */
  dismiss(id: string) {
    this.operations.delete(id)
    this.notify()
  }

  /**
   * Get all operations as a sorted array (running first, then recent).
   */
  getAll(): PaneOperation[] {
    return [...this.operations.values()].sort((a, b) => {
      // Running operations first
      if (a.status === 'running' && b.status !== 'running') return -1
      if (b.status === 'running' && a.status !== 'running') return 1
      // Then by start time (newest first)
      return b.startedAt - a.startedAt
    })
  }

  onChange(listener: OperationChangeListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  destroy() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
    this.listeners.clear()
    this.operations.clear()
  }

  // ── Internal ──

  private checkDeadlines() {
    const now = Date.now()
    let changed = false

    for (const op of this.operations.values()) {
      if (op.status === 'running' && now >= op.deadline) {
        op.status = 'timeout'
        op.completedAt = now
        op.error = `Timed out after ${Math.round((now - op.startedAt) / 1000)}s`
        changed = true

        emitTelemetry('system:info', {
          type: 'operation-timeout',
          opId: op.id,
          opType: op.type,
          elapsed: now - op.startedAt,
        }, { preview: `Operation timed out: ${op.message} (${Math.round((now - op.startedAt) / 1000)}s)` })
      }
    }

    if (changed) this.notify()
  }

  private notify() {
    const ops = this.getAll()
    for (const listener of this.listeners) {
      listener(ops)
    }
  }
}
