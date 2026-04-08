// ────────────────────────────────────────────
// Image Gating
//
// Screen capture only when it adds value:
// - Partial mutation with high confidence
// - Design review enabled
// Not on every call.
// ────────────────────────────────────────────

import type { MutationClassification } from '../spec/types.js'
import { IMAGE_MIN_CONFIDENCE } from '../limits.js'

export interface ImageGateConfig {
  /** Opt-in: enable vision context for partial mutations (default: false — Phase 1) */
  enabled?: boolean
  /** Minimum confidence for partial mutations to include image */
  minConfidence?: number
  /** Is design review currently enabled? */
  designReviewEnabled?: boolean
}

/**
 * Decides whether to include a screen capture in the API call.
 *
 * Phase 1 default: OFF. Vision adds significant token overhead (~750 tokens
 * per 100KB of base64 image) and Claude already has the spec — the screenshot
 * is rarely worth the latency cost. Opt in via { enabled: true } per call,
 * or implicitly via designReviewEnabled.
 */
export function shouldIncludeImage(
  classification: MutationClassification,
  config?: ImageGateConfig,
): boolean {
  // Always include if design review is active — reviewer needs visual context
  if (config?.designReviewEnabled) return true

  // Phase 1: vision is opt-in. Default off.
  if (!config?.enabled) return false

  const minConfidence = config?.minConfidence ?? IMAGE_MIN_CONFIDENCE

  // Full replacement doesn't need the current screenshot
  if (classification.type === 'REPLACE_VIEW') return false

  // Partial mutations benefit from seeing current state,
  // but only when we're confident about the classification
  if (classification.confidence >= minConfidence) return true

  // Low confidence partial — skip image to save tokens
  return false
}
