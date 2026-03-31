// ────────────────────────────────────────────
// Action Layer
//
// Domain-agnostic side-effect execution.
// Lifecycle, concurrency, confirmation, rollback.
// ────────────────────────────────────────────

import type { PaneTrackedAction, ActionStatus } from '../spec/types.js'

export interface ActionExecutor {
  execute: (params: Record<string, unknown>) => Promise<unknown>
  rollback?: (params: Record<string, unknown>) => Promise<void>
}

export class ActionManager {
  private actions: Map<string, PaneTrackedAction> = new Map()
  private executors: Map<string, ActionExecutor> = new Map()
  private listeners: Set<(action: PaneTrackedAction) => void> = new Set()

  registerExecutor(actionId: string, executor: ActionExecutor) {
    this.executors.set(actionId, executor)
  }

  onActionChange(listener: (action: PaneTrackedAction) => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private notify(action: PaneTrackedAction) {
    for (const listener of this.listeners) {
      listener(action)
    }
  }

  propose(action: PaneTrackedAction): PaneTrackedAction {
    const proposed = { ...action, status: 'proposed' as ActionStatus }
    this.actions.set(action.id, proposed)
    this.notify(proposed)
    return proposed
  }

  async confirm(actionId: string, params?: Record<string, unknown>): Promise<PaneTrackedAction> {
    const action = this.actions.get(actionId)
    if (!action) throw new Error(`Action ${actionId} not found`)
    if (action.status !== 'proposed') throw new Error(`Action ${actionId} is ${action.status}, expected proposed`)

    // Confirm
    const confirmed: PaneTrackedAction = { ...action, status: 'confirmed' }
    this.actions.set(actionId, confirmed)
    this.notify(confirmed)

    // Execute
    const executing: PaneTrackedAction = {
      ...confirmed,
      status: 'executing',
      startedAt: Date.now(),
    }
    this.actions.set(actionId, executing)
    this.notify(executing)

    const executor = this.executors.get(actionId)
    if (!executor) {
      // No executor registered — mark as completed with no result
      const completed: PaneTrackedAction = {
        ...executing,
        status: 'completed',
        completedAt: Date.now(),
        duration: Date.now() - executing.startedAt!,
      }
      this.actions.set(actionId, completed)
      this.notify(completed)
      return completed
    }

    try {
      const result = await executor.execute(params ?? {})
      const completed: PaneTrackedAction = {
        ...executing,
        status: 'completed',
        result,
        completedAt: Date.now(),
        duration: Date.now() - executing.startedAt!,
      }
      this.actions.set(actionId, completed)
      this.notify(completed)
      return completed
    } catch (err) {
      const failed: PaneTrackedAction = {
        ...executing,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: Date.now(),
        duration: Date.now() - executing.startedAt!,
      }
      this.actions.set(actionId, failed)
      this.notify(failed)
      return failed
    }
  }

  async rollback(actionId: string): Promise<PaneTrackedAction> {
    const action = this.actions.get(actionId)
    if (!action) throw new Error(`Action ${actionId} not found`)
    if (!action.reversible) throw new Error(`Action ${actionId} is not reversible`)

    const executor = this.executors.get(actionId)
    if (executor?.rollback) {
      await executor.rollback({})
    }

    const rolledBack: PaneTrackedAction = { ...action, status: 'rolled-back' }
    this.actions.set(actionId, rolledBack)
    this.notify(rolledBack)
    return rolledBack
  }

  cancel(actionId: string) {
    const action = this.actions.get(actionId)
    if (!action) return
    if (action.status === 'proposed') {
      this.actions.delete(actionId)
    }
  }

  updateProgress(actionId: string, progress: number) {
    const action = this.actions.get(actionId)
    if (!action || action.status !== 'executing') return
    const updated = { ...action, progress }
    this.actions.set(actionId, updated)
    this.notify(updated)
  }

  getAction(id: string): PaneTrackedAction | undefined {
    return this.actions.get(id)
  }

  getAllActions(): PaneTrackedAction[] {
    return [...this.actions.values()]
  }

  getActionLog(): PaneTrackedAction[] {
    return [...this.actions.values()].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
  }
}
