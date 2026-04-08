// ────────────────────────────────────────────
// System Limits — Single Source of Truth
//
// Every context window limit, token budget,
// timeout, truncation threshold, and concurrency
// cap lives here. No magic numbers elsewhere.
// ────────────────────────────────────────────

// ── Token Estimation ──

/** Rough chars-per-token estimate. Claude averages ~3.5 chars/token for JSON. */
export const CHARS_PER_TOKEN = 3.5

/** Vision pricing: ~750 tokens per 100KB of base64 image data */
export const IMAGE_TOKENS_PER_100KB = 750

// ── Context Budget ──

/** Default max input tokens before pruning kicks in */
export const DEFAULT_TOKEN_BUDGET = 80_000

/** Max output tokens for main Claude calls */
export const MAX_OUTPUT_TOKENS = 4096

/** Max output tokens for layout planner / design review calls */
export const MAX_OUTPUT_TOKENS_SHORT = 1024

/** Max output tokens per decomposed section (enforced at API level) */
export const MAX_OUTPUT_TOKENS_SECTION = 1500

/** Max output tokens for visual evaluator (Haiku) */
export const MAX_OUTPUT_TOKENS_VISUAL_EVAL = 2048

// ── Conversation Truncation ──

/** Conversation entries sent to Claude on each call (Phase 1: reduced from 10) */
export const CONVERSATION_WINDOW = 3

/** Conversation entries kept during first budget prune step */
export const CONVERSATION_WINDOW_PRUNED = 2

// ── Context Compression Thresholds ──

/** Session context above this char count triggers aggressive truncation */
export const SESSION_CONTEXT_COMPRESS_THRESHOLD = 500

/** Max chars for session context after aggressive truncation */
export const SESSION_CONTEXT_MAX_CHARS = 1000

/** Mutation prompt above this char count gets truncated */
export const MUTATION_PROMPT_COMPRESS_THRESHOLD = 500

/** Max chars for mutation prompt after truncation */
export const MUTATION_PROMPT_MAX_CHARS = 500

/** Max chars of system prompt included in section calls */
export const SECTION_SYSTEM_PROMPT_MAX_CHARS = 3000

// ── Image Gating ──

/** Minimum mutation confidence to include a screenshot */
export const IMAGE_MIN_CONFIDENCE = 0.7

// ── Mutation Classifier ──

/** Below this confidence, classifier defaults to REPLACE_VIEW */
export const MUTATION_LOW_CONFIDENCE_THRESHOLD = 0.3

// ── Operation Timeouts (ms) ──

export const TIMEOUT_API_CALL = 120_000
export const TIMEOUT_SPEC_EVAL = 8_000
export const TIMEOUT_VISUAL_EVAL = 15_000
export const TIMEOUT_DESIGN_REVIEW = 20_000
export const TIMEOUT_DECOMPOSE = 90_000
export const TIMEOUT_LAYOUT_PLAN = 5_000
export const TIMEOUT_HTTP_REQUEST = 30_000
export const TIMEOUT_SCREEN_CAPTURE = 5_000

/** Watchdog interval — checks for expired operations */
export const WATCHDOG_INTERVAL = 1_000

/** Completed operations auto-remove after this delay */
export const OPERATION_CLEANUP_DELAY = 2_000

// ── Visual Eval & Design Review ──

/** Default delay (ms) to wait for render before screen capture */
export const CAPTURE_DELAY = 1200

/** Visual feedback wrapper default capture delay */
export const CAPTURE_DELAY_VISUAL_FEEDBACK = 800

/** Max visual correction rounds */
export const MAX_VISUAL_CORRECTIONS = 1

/** Max design review rounds before showing to user */
export const MAX_DESIGN_REVIEW_ROUNDS = 2

// ── Decomposition ──

/** Max parallel section calls for decomposed requests */
export const DECOMPOSE_CONCURRENCY = 3

/** Don't decompose requests shorter than this (Phase 1: lowered from 30) */
export const DECOMPOSE_MIN_INPUT_LENGTH = 25

/** Require this many composition signals to trigger decompose (Phase 1: lowered from 2) */
export const DECOMPOSE_MIN_SIGNALS = 1

// ── Telemetry ──

/** Max telemetry history entries kept in memory */
export const TELEMETRY_MAX_HISTORY = 200

// ── Eval Thresholds ──

/** Response time (ms) that triggers interaction-quality FAIL */
export const EVAL_RESPONSE_TIME_FAIL = 10_000

/** Response time (ms) that triggers interaction-quality WARN */
export const EVAL_RESPONSE_TIME_WARN = 5_000

/** Max input fields before Miller's Law warning */
export const EVAL_MAX_INPUTS = 7

/**
 * Max panel nesting depth — runtime safety net only.
 *
 * Per proposal_nesting_depth.md: depth is no longer a shaping force, just a
 * runaway-spec safety net. Set high enough that legitimate deep content
 * (file trees, rich editors, nested forms) doesn't trip it. The eval system
 * surfaces depth concerns as warnings before this limit is reached.
 */
export const MAX_NESTING_DEPTH = 12

/** Panel label truncation in mutation context */
export const PANEL_LABEL_MAX_CHARS = 40

// ── Density Targets (atoms per modality) ──

export const DENSITY_TARGETS: Record<string, { min: number; max: number }> = {
  conversational:  { min: 5,  max: 25 },
  informational:   { min: 15, max: 80 },
  compositional:   { min: 10, max: 40 },
  transactional:   { min: 5,  max: 30 },
  collaborative:   { min: 10, max: 50 },
  environmental:   { min: 5,  max: 100 },
}
