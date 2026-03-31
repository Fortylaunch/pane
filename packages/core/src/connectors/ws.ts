// ────────────────────────────────────────────
// WebSocket Connector
//
// Bidirectional, streaming, tick-capable.
// Real-time agent communication.
// ────────────────────────────────────────────

import type { PaneAgent, PaneInput, PaneSession, PaneSessionUpdate, PaneTrackedAction } from '../spec/types.js'
import type { WsConnectorConfig, PaneRequest, PaneStreamChunk } from './types.js'

export function wsAgent(config: WsConnectorConfig): PaneAgent {
  const { url, protocols, reconnect = true, tickInterval } = config

  let ws: WebSocket | null = null
  let requestId = 0
  const pending = new Map<number, {
    resolve: (update: PaneSessionUpdate) => void
    reject: (err: Error) => void
    accumulated: PaneSessionUpdate
  }>()

  function connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN) {
        resolve(ws)
        return
      }

      ws = new WebSocket(url, protocols)

      ws.onopen = () => resolve(ws!)

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Streaming chunk
          if (data.requestId !== undefined && data.partial) {
            const chunk = data as PaneStreamChunk & { requestId: number }
            const entry = pending.get(chunk.requestId)
            if (entry) {
              entry.accumulated = mergeUpdates(entry.accumulated, chunk.partial)
              if (chunk.done) {
                entry.resolve(entry.accumulated)
                pending.delete(chunk.requestId)
              }
            }
            return
          }

          // Full response
          if (data.requestId !== undefined && data.update) {
            const entry = pending.get(data.requestId)
            if (entry) {
              entry.resolve(data.update)
              pending.delete(data.requestId)
            }
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onerror = () => reject(new Error('WebSocket connection failed'))

      ws.onclose = () => {
        if (reconnect) {
          setTimeout(() => connect().catch(() => {}), 3000)
        }
      }
    })
  }

  async function send(type: PaneRequest['type'], session: PaneSession, input?: PaneInput): Promise<PaneSessionUpdate> {
    const socket = await connect()
    const id = ++requestId

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, accumulated: {} })

      const request = {
        requestId: id,
        type,
        input,
        session,
        timestamp: Date.now(),
      }

      socket.send(JSON.stringify(request))

      // Timeout
      setTimeout(() => {
        if (pending.has(id)) {
          const entry = pending.get(id)!
          pending.delete(id)
          // If we accumulated partial updates, return those
          if (Object.keys(entry.accumulated).length > 0) {
            entry.resolve(entry.accumulated)
          } else {
            entry.reject(new Error('WebSocket request timed out'))
          }
        }
      }, 30000)
    })
  }

  const emptySession: PaneSession = {
    id: '', version: 0, activeContext: '',
    contexts: [], conversation: [], actions: [],
    agents: [], artifacts: [], feedback: [],
  }

  const agent: PaneAgent = {
    async init(input: PaneInput) {
      return send('init', emptySession, input)
    },
    async onInput(input: PaneInput, session: PaneSession) {
      return send('input', session, input)
    },
    async onActionResult(action: PaneTrackedAction, session: PaneSession) {
      return send('action-result', session)
    },
    async teardown() {
      ws?.close()
      ws = null
    },
  }

  // Add tick if configured
  if (tickInterval) {
    agent.tick = async (session: PaneSession) => {
      return send('tick', session)
    }
  }

  return agent
}

// Merge partial updates into accumulated
function mergeUpdates(a: PaneSessionUpdate, b: PaneSessionUpdate): PaneSessionUpdate {
  return {
    contexts: [...(a.contexts ?? []), ...(b.contexts ?? [])],
    actions: [...(a.actions ?? []), ...(b.actions ?? [])],
    agents: [...(a.agents ?? []), ...(b.agents ?? [])],
    artifacts: [...(a.artifacts ?? []), ...(b.artifacts ?? [])],
    feedback: [...(a.feedback ?? []), ...(b.feedback ?? [])],
  }
}
