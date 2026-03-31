// ────────────────────────────────────────────
// Telemetry
//
// Every bit of work under the hood is logged
// here. The renderer subscribes and displays it.
// ────────────────────────────────────────────

export type TelemetryEventType =
  | 'agent:request'        // sending input to agent
  | 'agent:response'       // agent returned an update
  | 'agent:error'          // agent call failed
  | 'api:request'          // outgoing HTTP/WS call
  | 'api:response'         // incoming response
  | 'api:error'            // API error
  | 'visual:capture'       // screenshot taken
  | 'visual:evaluate'      // screenshot sent for eval
  | 'visual:approved'      // eval says looks good
  | 'visual:correction'    // eval says fix needed
  | 'runtime:update'       // session update applied
  | 'runtime:context'      // context created/activated/removed
  | 'runtime:action'       // action lifecycle change
  | 'feedback:captured'    // user feedback recorded
  | 'system:info'          // general info

export interface TelemetryEvent {
  id: string
  type: TelemetryEventType
  timestamp: number
  duration?: number         // ms — how long this took
  data?: Record<string, unknown>
  preview?: string          // short text preview of the content
  image?: string            // base64 screenshot if applicable
}

type TelemetryListener = (event: TelemetryEvent) => void

let eventCounter = 0
const listeners = new Set<TelemetryListener>()
const history: TelemetryEvent[] = []
const MAX_HISTORY = 200

export function updateTelemetry(
  id: string,
  updates: { data?: Record<string, unknown>; preview?: string; duration?: number; image?: string }
) {
  const event = history.find(e => e.id === id)
  if (!event) return

  if (updates.data) event.data = { ...event.data, ...updates.data }
  if (updates.preview !== undefined) event.preview = updates.preview
  if (updates.duration !== undefined) event.duration = updates.duration
  if (updates.image !== undefined) event.image = updates.image

  for (const listener of listeners) {
    listener(event)
  }
}

export function emitTelemetry(
  type: TelemetryEventType,
  data?: Record<string, unknown>,
  extra?: { duration?: number; preview?: string; image?: string }
): TelemetryEvent {
  const event: TelemetryEvent = {
    id: `tel-${++eventCounter}`,
    type,
    timestamp: Date.now(),
    duration: extra?.duration,
    data,
    preview: extra?.preview,
    image: extra?.image,
  }

  history.push(event)
  if (history.length > MAX_HISTORY) history.shift()

  for (const listener of listeners) {
    listener(event)
  }

  // Also log to console for debugging
  const icon = type.startsWith('agent') ? '🤖'
    : type.startsWith('api') ? '🌐'
    : type.startsWith('visual') ? '👁'
    : type.startsWith('runtime') ? '⚙️'
    : type.startsWith('feedback') ? '💬'
    : 'ℹ️'

  console.log(
    `%c${icon} [${type}]%c ${extra?.preview ?? ''}`,
    'color: #3b82f6; font-weight: bold',
    'color: inherit',
    extra?.duration ? `(${extra.duration}ms)` : '',
  )

  return event
}

export function onTelemetry(listener: TelemetryListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTelemetryHistory(): TelemetryEvent[] {
  return [...history]
}

export function clearTelemetry() {
  history.length = 0
}
