// @pane/core — the system

// Spec
export * from './spec/types.js'
export { validateSpec, validateView_, validatePanel_ } from './spec/validate.js'
export type { ValidationError, ValidationResult } from './spec/validate.js'

// Modality
export { getModalityConfig, isModalityShift, getActiveModalities, getDominantModality } from './modality/index.js'
export type { ModalityConfig } from './modality/index.js'

// Agents
export { functionAgent, staticAgent, tickAgent, streamingAgent } from './agents/index.js'

// Actions
export { ActionManager } from './actions/index.js'
export type { ActionExecutor } from './actions/index.js'

// Interaction
export { createInput, createFeedback } from './interaction/index.js'

// Feedback
export { FeedbackStore } from './feedback/index.js'

// Runtime
export { PaneRuntime, createPane } from './runtime/index.js'
export type { PaneRuntimeConfig, SessionListener, VisualEvalConfig } from './runtime/index.js'

// Connectors
export { httpAgent } from './connectors/http.js'
export { wsAgent } from './connectors/ws.js'
export { claudeAgent, createClaudePlanCall, createClaudeSectionCall, createClaudeDesignReview } from './connectors/claude.js'
export type { HttpConnectorConfig, WsConnectorConfig, ClaudeConnectorConfig, PaneRequest, PaneResponse, PaneStreamChunk } from './connectors/types.js'

// Visual Feedback
export { visualFeedbackAgent, createClaudeVisualEvaluator } from './connectors/visual-feedback.js'
export type { VisualFeedbackConfig, ClaudeVisualEvalConfig } from './connectors/visual-feedback.js'

// Telemetry
export { emitTelemetry, updateTelemetry, onTelemetry, getTelemetryHistory, clearTelemetry } from './telemetry/index.js'
export type { TelemetryEvent, TelemetryEventType } from './telemetry/index.js'

// Evals
export { runEval, formatEvalResult } from './evals/runner.js'
export type { EvalContext, EvalResult, EvalFinding, EvalDimension, EvalScenario } from './evals/types.js'

// Decompose
export { decomposeAndAssemble, shouldDecompose } from './decompose/index.js'
export type { DecomposeConfig, DecompositionPlan, SectionManifest } from './decompose/index.js'
