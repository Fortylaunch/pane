// ────────────────────────────────────────────
// HTTP Connector
//
// POST input → get PaneSessionUpdate back.
// Works with any REST endpoint.
// ────────────────────────────────────────────

import type { PaneAgent, PaneInput, PaneSession, PaneSessionUpdate, PaneTrackedAction } from '../spec/types.js'
import type { HttpConnectorConfig, PaneRequest, PaneResponse } from './types.js'

export function httpAgent(config: HttpConnectorConfig): PaneAgent {
  const { url, headers = {}, timeout = 30000 } = config

  async function send(type: PaneRequest['type'], session: PaneSession, input?: PaneInput): Promise<PaneSessionUpdate> {
    const request: PaneRequest = {
      type,
      input,
      session,
      timestamp: Date.now(),
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Pane HTTP connector: ${res.status} ${res.statusText}`)
      }

      const response: PaneResponse = await res.json()
      return response.update
    } finally {
      clearTimeout(timer)
    }
  }

  const emptySession: PaneSession = {
    id: '', version: 0, activeContext: '',
    contexts: [], conversation: [], actions: [],
    agents: [], artifacts: [], feedback: [],
  }

  return {
    async init(input: PaneInput) {
      return send('init', emptySession, input)
    },
    async onInput(input: PaneInput, session: PaneSession) {
      return send('input', session, input)
    },
    async onActionResult(action: PaneTrackedAction, session: PaneSession) {
      return send('action-result', session)
    },
  }
}
