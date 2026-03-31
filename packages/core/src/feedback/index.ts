// ────────────────────────────────────────────
// Feedback Store
//
// Append-only feedback storage.
// Transparent, retractable.
// ────────────────────────────────────────────

import type { PaneFeedback } from '../spec/types.js'

export class FeedbackStore {
  private entries: PaneFeedback[] = []

  add(feedback: PaneFeedback) {
    this.entries.push(feedback)
  }

  retract(feedbackId: string): boolean {
    const idx = this.entries.findIndex(f => f.id === feedbackId)
    if (idx === -1) return false
    this.entries.splice(idx, 1)
    return true
  }

  getAll(): PaneFeedback[] {
    return [...this.entries]
  }

  getByAgent(agentId: string): PaneFeedback[] {
    return this.entries.filter(f => f.target.agentId === agentId)
  }

  getByContext(contextId: string): PaneFeedback[] {
    return this.entries.filter(f => f.target.contextId === contextId)
  }

  getByType(type: PaneFeedback['type']): PaneFeedback[] {
    return this.entries.filter(f => f.type === type)
  }

  count(): number {
    return this.entries.length
  }
}
