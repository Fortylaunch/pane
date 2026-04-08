// ────────────────────────────────────────────
// Context Budget Manager
//
// Measures token usage per component and prunes
// to fit within the model's context window.
// Prune order: old conversation → eval findings →
// screen capture → session detail → mutation context.
// Never prunes: system prompt, user message.
// ────────────────────────────────────────────

import type { PaneSession } from '../spec/types.js'
import { emitTelemetry } from '../telemetry/index.js'
import {
  CHARS_PER_TOKEN,
  IMAGE_TOKENS_PER_100KB,
  DEFAULT_TOKEN_BUDGET,
  CONVERSATION_WINDOW,
  CONVERSATION_WINDOW_PRUNED,
  SESSION_CONTEXT_COMPRESS_THRESHOLD,
  SESSION_CONTEXT_MAX_CHARS,
  MUTATION_PROMPT_COMPRESS_THRESHOLD,
  MUTATION_PROMPT_MAX_CHARS,
} from '../limits.js'

export interface BudgetConfig {
  /** Max input tokens before pruning (default: 80K) */
  maxInputTokens?: number
}

export interface ContextComponents {
  systemPrompt: string
  userMessage: string
  sessionContext?: string
  mutationPrompt?: string
  screenCapture?: string          // base64 data URI or raw base64
  evalFindings?: string[]
  conversation?: Array<{ role: string; content: string }>
}

export interface BudgetResult {
  /** Components after pruning */
  components: ContextComponents
  /** Estimated total tokens */
  totalTokens: number
  /** What was pruned and why */
  pruned: string[]
  /** Was anything pruned? */
  wasPruned: boolean
}

/** Estimate token count for a text string */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/** Estimate token count for a base64 image */
function estimateImageTokens(base64: string): number {
  // Strip data URI prefix if present
  const raw = base64.includes(',') ? base64.split(',')[1] : base64
  const bytes = Math.ceil(raw.length * 0.75) // base64 → bytes
  return Math.ceil((bytes / 100_000) * IMAGE_TOKENS_PER_100KB)
}

/** Compress session state to a compact summary */
export function compressSession(session: PaneSession): string {
  return JSON.stringify({
    activeContext: session.activeContext,
    contexts: session.contexts.map(c => ({
      id: c.id,
      label: c.label,
      modality: c.modality,
      status: c.status,
      layout: c.view.layout.pattern,
      panelCount: c.view.panels.length,
      panels: c.view.panels.map(function summarize(p: any): any {
        return {
          id: p.id,
          atom: p.atom,
          recipe: p.recipe,
          childCount: p.children?.length ?? 0,
          ...(p.children?.length ? { children: p.children.map(summarize) } : {}),
        }
      }),
    })),
    activeActions: session.actions
      .filter(a => a.status === 'executing' || a.status === 'proposed')
      .map(a => ({ id: a.id, label: a.label, status: a.status })),
  })
}

/** Full session context (pre-compression format) */
export function fullSessionContext(session: PaneSession): string {
  return JSON.stringify({
    activeContext: session.activeContext,
    contexts: session.contexts.map(c => ({
      id: c.id, label: c.label, modality: c.modality, status: c.status,
    })),
    recentConversation: session.conversation.slice(-CONVERSATION_WINDOW),
    activeActions: session.actions.filter(a => a.status === 'executing' || a.status === 'proposed'),
  }, null, 2)
}

/**
 * Apply the context budget — prune components in priority order
 * to fit within the token limit.
 *
 * Prune order (most expendable first):
 * 1. Old conversation entries (keep last 3)
 * 2. Eval findings
 * 3. Screen capture
 * 4. Session detail (compress to summary)
 * 5. Mutation context (trim to essentials)
 *
 * Never pruned: system prompt, user message.
 */
export function applyBudget(
  components: ContextComponents,
  config?: BudgetConfig,
): BudgetResult {
  const budget = config?.maxInputTokens ?? DEFAULT_TOKEN_BUDGET
  const pruned: string[] = []

  // Start with a mutable copy
  const result: ContextComponents = { ...components }
  if (components.evalFindings) result.evalFindings = [...components.evalFindings]
  if (components.conversation) result.conversation = [...components.conversation]

  function totalTokens(): number {
    let total = estimateTokens(result.systemPrompt)
    total += estimateTokens(result.userMessage)
    if (result.sessionContext) total += estimateTokens(result.sessionContext)
    if (result.mutationPrompt) total += estimateTokens(result.mutationPrompt)
    if (result.screenCapture) total += estimateImageTokens(result.screenCapture)
    if (result.evalFindings?.length) {
      total += estimateTokens(result.evalFindings.join('\n'))
    }
    if (result.conversation?.length) {
      total += estimateTokens(result.conversation.map(c => c.content).join('\n'))
    }
    return total
  }

  let current = totalTokens()

  // Already within budget
  if (current <= budget) {
    return { components: result, totalTokens: current, pruned, wasPruned: false }
  }

  // 1. Trim conversation to last N entries
  if (result.conversation && result.conversation.length > CONVERSATION_WINDOW_PRUNED) {
    const removed = result.conversation.length - CONVERSATION_WINDOW_PRUNED
    result.conversation = result.conversation.slice(-CONVERSATION_WINDOW_PRUNED)
    pruned.push(`conversation: kept last ${CONVERSATION_WINDOW_PRUNED} of ${removed + CONVERSATION_WINDOW_PRUNED}`)
    current = totalTokens()
    if (current <= budget) {
      return { components: result, totalTokens: current, pruned, wasPruned: true }
    }
  }

  // 2. Drop eval findings
  if (result.evalFindings && result.evalFindings.length > 0) {
    pruned.push(`evalFindings: dropped ${result.evalFindings.length} findings`)
    result.evalFindings = []
    current = totalTokens()
    if (current <= budget) {
      return { components: result, totalTokens: current, pruned, wasPruned: true }
    }
  }

  // 3. Drop screen capture
  if (result.screenCapture) {
    const imgTokens = estimateImageTokens(result.screenCapture)
    pruned.push(`screenCapture: dropped (${imgTokens} tokens)`)
    result.screenCapture = undefined
    current = totalTokens()
    if (current <= budget) {
      return { components: result, totalTokens: current, pruned, wasPruned: true }
    }
  }

  // 4. Compress session context (if it looks like the full format)
  if (result.sessionContext && result.sessionContext.length > SESSION_CONTEXT_COMPRESS_THRESHOLD) {
    const before = estimateTokens(result.sessionContext)
    // Re-compress — caller should have used compressSession already,
    // but if they didn't, we truncate aggressively
    const truncated = result.sessionContext.substring(0, SESSION_CONTEXT_MAX_CHARS) + '...(truncated)'
    result.sessionContext = truncated
    const after = estimateTokens(result.sessionContext)
    pruned.push(`sessionContext: ${before} → ${after} tokens`)
    current = totalTokens()
    if (current <= budget) {
      return { components: result, totalTokens: current, pruned, wasPruned: true }
    }
  }

  // 5. Drop conversation entirely
  if (result.conversation && result.conversation.length > 0) {
    pruned.push(`conversation: dropped all ${result.conversation.length} entries`)
    result.conversation = []
    current = totalTokens()
    if (current <= budget) {
      return { components: result, totalTokens: current, pruned, wasPruned: true }
    }
  }

  // 6. Trim mutation prompt
  if (result.mutationPrompt && result.mutationPrompt.length > MUTATION_PROMPT_COMPRESS_THRESHOLD) {
    const before = estimateTokens(result.mutationPrompt)
    result.mutationPrompt = result.mutationPrompt.substring(0, MUTATION_PROMPT_MAX_CHARS) + '...(truncated)'
    const after = estimateTokens(result.mutationPrompt)
    pruned.push(`mutationPrompt: ${before} → ${after} tokens`)
    current = totalTokens()
  }

  emitTelemetry('system:info', {
    type: 'context-budget',
    totalTokens: current,
    budget,
    pruned,
    overBudget: current > budget,
  }, {
    preview: current > budget
      ? `Context budget exceeded: ${current} > ${budget} tokens after pruning`
      : `Context pruned to ${current} tokens (budget: ${budget})`,
  })

  return { components: result, totalTokens: current, pruned, wasPruned: true }
}
