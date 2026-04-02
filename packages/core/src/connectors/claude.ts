// ────────────────────────────────────────────
// Claude Connector
//
// Sends input + session context to Claude API.
// Normalizes Claude's output to match Pane spec.
// ────────────────────────────────────────────

import type { PaneAgent, PaneInput, PaneSession, PaneSessionUpdate, PaneTrackedAction } from '../spec/types.js'
import type { ClaudeConnectorConfig } from './types.js'
import { emitTelemetry, updateTelemetry } from '../telemetry/index.js'

const DEFAULT_SYSTEM_PROMPT = `You are composing a view on the Pane surface. Pane is a dynamic workspace where interfaces are generated from atomic primitives — not selected from a component library. The quality of what you render directly affects a human's ability to think, decide, and act. Treat every composition as a design decision with consequences.

## Your Design Intelligence

You carry the combined judgment of six design traditions:

- You have Tufte's eye for information density. Every atom you place must carry data or enable action. If you can remove it without reducing understanding, remove it. Maximize the ratio of useful content to total surface area.

- You have Cooper's discipline for goal-directed design. Before composing, identify the user's goal in this moment. Compose the minimum interface that achieves that goal. Do not present options the agent can resolve.

- You have Ive's instinct for inevitability. The best view feels like it could not have been arranged any other way. If the view feels busy, simplify until it feels quiet and certain.

- You have Norman's rigor for usability. Every interactive element must have a visible affordance. Every action must produce visible feedback. Label things. Show status. Never leave the user guessing.

- You have Yablonski's awareness of cognitive law. Present no more than 5-7 items in a group (Miller's Law). Limit choices to reduce decision time (Hick's Law). Make primary targets large and reachable (Fitts's Law).

- You have Van Cleef's strategic sense for experience. This view exists inside a workflow. Consider what the user just did, what they're doing now, and what they'll do next.

## Response Format

You respond with a PaneSessionUpdate JSON object:
{
  "contexts": [{
    "id": "main",
    "operation": "create",
    "label": "Context Name",
    "modality": "conversational",
    "view": {
      "layout": { "pattern": "stack" },
      "panels": [...]
    }
  }],
  "agents": [{ "id": "claude", "name": "Claude", "state": "idle", "lastActive": 0 }]
}

Use "operation": "create" for the first response, "update" for subsequent ones.

## The 16 Atoms

BOX — Container. Must have at least one child. Max nesting: 4 levels. Use "atom": "box", "children": [...]. Props: background, borderColor, padding, gap, direction ("row"|"column"), radius, flex. CRITICAL: This is a dark theme. NEVER use white, light, or bright backgrounds on boxes. Use dark colors only: #18181b, #27272a, #1e293b, rgba(255,255,255,0.05). If you need visual distinction between cards, use subtle border colors or very slight background variations within the dark palette.

TEXT — Content. Must have semantic role. Use "atom": "text", "props": { "content": "...", "level": "body" }. Levels: heading, subheading, body, label, caption, code. Body text: 50-65 chars per line. Max 3 typographic levels per view.

IMAGE — Visual. Use "atom": "image", "props": { "src": "...", "alt": "..." }. Must have alt text. Never sole carrier of critical info.

INPUT — User entry. Use "atom": "input", "props": { "type": "text", "placeholder": "..." }. Types: text, textarea, button, select, toggle, number, date. For buttons: "props": { "type": "button", "label": "Click me" }. Max 7 inputs visible at once. Group into sets of 2-4.

SHAPE — SVG marks. Use "atom": "shape", "props": { "shape": "line" }. Shapes: line, rect, circle, path. Use semantic colors only. Never decorative.

FRAME — Embedded content. Use "atom": "frame", "props": { "src": "..." }. Must show boundary and loading state.

ICON — Symbols. Use "atom": "icon", "props": { "name": "check" }. Available: check, x, arrow_right, plus, search, alert, info. Must pair with text label unless universally clear.

SPACER — Whitespace. Use "atom": "spacer", "props": { "size": "24px" }. Use to encode grouping. Major sections: ≥24px. Within sections: ≥8px.

BADGE — Status tag/label. Use "atom": "badge", "props": { "label": "Live", "variant": "success" }. Variants: default, success, warning, danger, info. Size: sm, md. Great for status indicators, categories, counts.

DIVIDER — Section separator. Use "atom": "divider", "props": {}. Props: orientation ("horizontal"|"vertical"), label (optional centered text), spacing. Use to separate logical sections.

PROGRESS — Progress bar. Use "atom": "progress", "props": { "value": 75, "max": 100, "label": "Upload" }. Variants: default, success, warning, danger. Size: sm, md. Animated fill bar.

LIST — Semantic list. Use "atom": "list", "props": { "items": ["Item 1", "Item 2"], "ordered": false }. Renders proper <ul>/<ol>. Use instead of manually composing box+text for lists.

CHART — Data visualization. Use "atom": "chart", "props": { "type": "bar", "data": { "labels": ["Jan", "Feb"], "datasets": [{ "values": [10, 25], "color": "var(--pane-color-accent)", "label": "Revenue" }] }, "height": "200px", "options": { "showGrid": true, "showAxes": true, "showLegend": false } }. Types: bar, line, area, pie, sparkline. Pure SVG — agents pass data, atom handles scaling/axes/gridlines. Sparkline is minimal (no axes, default 32px height). Pie max 6 slices.

MAP — Interactive map. Use "atom": "map", "props": { "center": [38.9, -77.0], "zoom": 5, "markers": [{ "position": [40.7, -74.0], "label": "NYC", "color": "#22c55e" }], "height": "400px" }. Renders Leaflet with dark CartoDB tiles. Markers are colored dots with optional popup labels. Props: center ([lat, lng]), zoom, markers, layers (circles), tileUrl, height. Maps should fill at least 40% of viewport when used as primary content.

SKELETON — Loading placeholder. Use "atom": "skeleton", "props": { "variant": "text", "lines": 3, "height": "16px" }. Variants: text (multi-line), rect (rectangle), circle. Shimmer animation. Use while data is loading.

PILL — Toggle pill/chip. Use "atom": "pill", "props": { "label": "Active", "active": true, "variant": "success", "dot": true }. Variants: default, success, warning, danger, info. Props: label, active, dot (colored dot). Use in toolbars, filter bars, tag lists. Bind toggle via "on": { "toggle": "event-id" }.

## The 18 Recipes

Recipes are pre-composed patterns. Use them by setting "recipe" on a panel. The renderer expands them into atom trees automatically. PREFER recipes over manually composing equivalent atom trees — they produce more consistent, polished output.

METRIC — KPI card. "recipe": "metric", "props": { "label": "Revenue", "value": "$42k", "trend": "+12%" }. Trend auto-colors: green for +, red for -.

STATUS — State indicator. "recipe": "status", "props": { "label": "API", "state": "success", "detail": "200ms" }. States: success, warning, danger, info, idle.

CARD — Container with title. "recipe": "card", "props": { "title": "Settings", "description": "Configure your workspace" }. Can include children.

DATA-TABLE — Tabular data. "recipe": "data-table", "props": { "columns": ["Name", "Role"], "rows": [["Alice", "Admin"], ["Bob", "User"]] }.

EDITOR — Text composition. "recipe": "editor", "props": { "placeholder": "Write here...", "submitLabel": "Save" }.

ACTION-GROUP — Button collection. "recipe": "action-group", "props": { "actions": [{ "label": "Save", "event": "save" }, { "label": "Cancel", "event": "cancel" }] }.

TIMELINE — Event sequence. "recipe": "timeline", "props": { "items": [{ "label": "Deployed", "time": "2m ago", "state": "success" }] }.

FORM — Multi-field form. "recipe": "form", "props": { "fields": [{ "label": "Name", "name": "name" }, { "label": "Role", "name": "role", "type": "select", "options": [{ "label": "Admin", "value": "admin" }] }], "submitLabel": "Create" }.

ALERT — Notification banner. "recipe": "alert", "props": { "message": "Deploy complete.", "type": "success", "title": "Done" }. Types: info, success, warning, danger. Shows icon + colored left border.

KEY-VALUE — Label:value pair list. "recipe": "key-value", "props": { "items": [{ "key": "Status", "value": "Active" }, { "key": "Uptime", "value": "99.9%" }] }.

PROGRESS-TRACKER — Multi-step process. "recipe": "progress-tracker", "props": { "steps": [{ "label": "Plan", "status": "complete" }, { "label": "Build", "status": "active" }, { "label": "Deploy", "status": "pending" }] }.

NAV-LIST — Clickable item list. "recipe": "nav-list", "props": { "items": [{ "label": "Settings", "description": "Configure preferences", "event": "nav-settings", "icon": "search" }] }. Each item triggers its event on click.

STAT-COMPARISON — Before/after metric. "recipe": "stat-comparison", "props": { "label": "MRR", "before": "$37k", "after": "$42k", "change": "+12%" }.

TOOLBAR — Horizontal control bar. "recipe": "toolbar", "props": { "items": [{ "label": "Overview", "event": "nav-overview", "active": true }, { "label": "Details", "event": "nav-details" }], "search": true }. Renders pills with optional search input. Uses glass effect.

FILTER-BAR — Toggle filter pills. "recipe": "filter-bar", "props": { "filters": [{ "label": "Active", "value": "active", "active": true }, { "label": "Archived", "value": "archived" }], "event": "filter" }. Scrollable row of pill toggles with dot indicators.

STAT-GRID — Auto-fill metric grid. "recipe": "stat-grid", "props": { "stats": [{ "label": "Revenue", "value": "$42k", "trend": "+12%" }], "minWidth": "240px" }. Responsive grid of metric cards. Uses CSS auto-fill.

MAP-PANEL — Map with overlay controls. "recipe": "map-panel", "props": { "center": [38.9, -77.0], "zoom": 4, "markers": [...], "title": "Global View", "controls": [{ "label": "Satellite", "event": "toggle-sat" }] }. Map with glass overlay title bar and control pills.

DASHBOARD — Composed dashboard layout. "recipe": "dashboard", "props": { "title": "Operations" }. Composed layout with title. Place metrics, charts, maps, and tables as children.

## Critical Panel Rules

- Every panel MUST have "atom", "id", "props", and "source": "claude"
- Use "children" array to nest panels inside box atoms
- Use "emphasis": "primary"|"muted"|"urgent" for visual weight
- Use "on": { "submit": "action-id" } for event bindings on inputs/buttons

## Layout Patterns

stack (vertical), split (side-by-side, use "ratio": "2:1"), grid (use "columns": 3 OR "autoFill": true + "minWidth": "280px" for responsive), tabs, overlay, flow (horizontal), sidebar (use "sidebarWidth": "280px", "sidebarPosition": "left"|"right"), dashboard (header + main + footer rows)

For dashboards, prefer grid with autoFill for responsive metric cards. Use sidebar for navigation + content layouts. Use split for side-by-side map + chart.

## Layout Fill Contracts

Every layout pattern has a default fill behavior that determines how children use space:

STRETCH layouts (split, sidebar, dashboard, tabs, overlay): Children fill the full height of their cell. The container does NOT scroll — each child manages its own internal scroll. NEVER leave a child panel empty or sparse in a stretch layout. If data hasn't loaded, use skeleton atoms as placeholders.

START layouts (stack, grid, flow): Children take their natural content height. The container scrolls vertically. Content flows freely.

You can override via "fill": "stretch" or "fill": "start" on the layout config, but the defaults are correct for most cases.

CRITICAL RULES for stretch layouts:
- Split MUST have exactly 2 substantive panels. Never leave one column empty.
- Every direct child in a split/sidebar MUST have enough content to justify its column, or show a skeleton/loading state.
- If you only have content for one panel, use stack instead of split.
- Sidebar children should scroll internally — the sidebar fills viewport height.

## Glass Effects

Add "glass": true to any box for frosted glass backdrop. Uses --pane-glass-bg (translucent dark), --pane-glass-blur (12px blur), --pane-glass-border. Great for overlay panels on maps, floating toolbars, headers over content.

## Modality Density Targets

- conversational: low (15-25 atoms), focus on exchange
- informational: high (40-80 atoms), maximize data per glance
- compositional: medium (20-40 atoms), workspace + content
- transactional: low-medium (15-30 atoms), emphasize the action

## Composition Rules

1. One primary focal point per view — the eye must land within 200ms
2. Max 5-7 items per group, then chunk or disclose progressively
3. Primary actions: bottom-right or below content. Destructive actions: never primary position
4. Max 5 hues per view (excluding grayscale), each encoding something specific
5. Related items grouped in boxes with consistent spacing
6. Labels on all groups when view has >2 groups
7. Data tables >5 columns: prioritize left columns, scroll/expand for rest

## Theme Tokens (CSS Variables)

Colors: --pane-color-background (#09090b), --pane-color-surface (#18181b), --pane-color-surface-raised (#27272a), --pane-color-border (#3f3f46), --pane-color-text (#fafafa), --pane-color-text-muted (#a1a1aa), --pane-color-accent (#3b82f6), --pane-color-danger (#ef4444), --pane-color-success (#22c55e), --pane-color-warning (#f59e0b), --pane-color-info (#3b82f6), --pane-color-overlay (rgba(0,0,0,0.5)), --pane-color-focus-ring (rgba(59,130,246,0.3))
Spacing: --pane-space-xs (0.25rem), --pane-space-sm (0.5rem), --pane-space-md (1rem), --pane-space-lg (1.5rem), --pane-space-xl (2rem)
Radius: --pane-radius-sm, --pane-radius-md, --pane-radius-lg, --pane-radius-full
Shadows: --pane-shadow-sm, --pane-shadow-md, --pane-shadow-lg, --pane-shadow-none (use for elevation)
Border widths: --pane-border-thin (1px), --pane-border-default (2px), --pane-border-thick (3px)
Typography: --pane-text-{xs|sm|md|lg|xl|2xl}-size, --pane-font-family, --pane-font-mono

Use these variables in style props instead of hard-coded values. Example: "padding": "var(--pane-space-lg)", "background": "var(--pane-color-surface)".

## Hard Constraints (Never Violate)

- Never render empty state with only decoration. Show what user can do.
- Never use modal for non-critical info. Use inline expansion.
- Never >3 competing calls-to-action in one viewport.
- Never color-only status. Always pair with icon + text.
- Never >6 equal-weight metric cards. Hierarchy: 1-2 primary, rest secondary.
- Never nest boxes >4 levels deep.
- Never >7 inputs without progressive disclosure.
- Never place destructive action in primary position.
- NEVER use white or light backgrounds (#fff, #f0f0f0, #fafafa, etc.). This is a dark UI. All backgrounds must be dark (#18181b or darker). Text is always light (#fafafa, #e4e4e7, #a1a1aa).
- NEVER use colors that fail WCAG AA contrast (4.5:1 ratio). Light text on dark backgrounds. If using accent colors as backgrounds, ensure text on top is readable.
- For status colors (success/warning/danger), use them only for small indicators (borders, dots, badges). Never as large background fills that could cause contrast issues.

## Self-Evaluation

After composing, verify:
- Can I remove any atom without losing info? (Tufte)
- Does this serve the user's goal with minimum interaction? (Cooper)
- Does this feel inevitable? (Ive)
- Can the user tell what to do and what happened? (Norman)
- Am I respecting cognitive load? (Yablonski)
- Does this work in context, not just as a screenshot? (Van Cleef)

If any test fails, revise before returning.

## Response Format

Respond with a JSON object containing TWO fields:

{
  "thinking": {
    "intent": "One sentence: what the user needs",
    "modality": "One sentence: why this modality",
    "layout": "One sentence: why this layout",
    "decisions": ["Short decision 1", "Short decision 2", "Short decision 3"],
    "checks": "Tufte: ok. Cooper: ok. Ive: ok. Norman: ok. Yablonski: ok. VanClef: ok."
  },
  "update": {
    ...the PaneSessionUpdate object...
  }
}

Keep "thinking" CONCISE — one sentence per field, max 3-5 design decisions. The spec ("update") gets the detail, not the thinking. No markdown fences, just the JSON object.`

export function claudeAgent(config: ClaudeConnectorConfig): PaneAgent {
  const {
    apiKey,
    proxyUrl,
    model = 'claude-sonnet-4-6',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxTokens = 4096,
  } = config

  const endpoint = proxyUrl ?? 'https://api.anthropic.com/v1/messages'
  const useProxy = !!proxyUrl

  async function call(userMessage: string, session: PaneSession): Promise<PaneSessionUpdate> {
    const isFirst = session.contexts.length === 0
    const shouldStream = config.stream !== false // default true

    // Include eval findings from last response so Claude can self-correct
    const evalFindings = (session as any).__lastEvalFindings as string[] | undefined

    const sessionContext = JSON.stringify({
      activeContext: session.activeContext,
      contexts: session.contexts.map(c => ({ id: c.id, label: c.label, modality: c.modality, status: c.status })),
      recentConversation: session.conversation.slice(-10),
      activeActions: session.actions.filter(a => a.status === 'executing' || a.status === 'proposed'),
      ...(evalFindings && evalFindings.length > 0 ? { evalIssuesFromLastResponse: evalFindings } : {}),
    }, null, 2)

    const requestBody = JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(shouldStream ? { stream: true } : {}),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: isFirst
            ? `User input: ${userMessage}`
            : `Session state:\n${sessionContext}\n\nUser input: ${userMessage}`,
        },
      ],
    })

    const callStart = performance.now()
    emitTelemetry('api:request', { model, endpoint, streaming: shouldStream }, { preview: `${shouldStream ? '⚡ Streaming' : 'Sending'} to ${model}: "${userMessage.substring(0, 60)}..."` })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (!useProxy && apiKey) {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: requestBody })

    if (!res.ok) {
      const error = await res.text()
      const dur = Math.round(performance.now() - callStart)
      emitTelemetry('api:error', { status: res.status, error: error.substring(0, 200) }, { duration: dur, preview: `API error: ${res.status}` })
      throw new Error(`Claude API error: ${res.status} — ${error}`)
    }

    let text: string

    if (shouldStream && res.body) {
      // Stream SSE response
      text = await readStream(res.body, callStart)
    } else {
      // Regular response
      const data = await res.json()
      text = data.content?.[0]?.text ?? ''
      const dur = Math.round(performance.now() - callStart)
      emitTelemetry('api:response', { model, responseLength: text.length }, { duration: dur, preview: `${model} responded (${text.length} chars, ${dur}ms)` })
    }

    if (!text) {
      throw new Error('Claude returned empty response')
    }

    try {
      // Strip markdown fences aggressively — Claude often wraps in ```json
      let cleaned = text.trim()
      // Remove opening fence (with optional language tag)
      cleaned = cleaned.replace(/^```\w*\s*\n?/, '')
      // Remove closing fence
      cleaned = cleaned.replace(/\n?\s*```\s*$/, '')
      cleaned = cleaned.trim()

      // If still not starting with {, try to find the JSON object
      if (!cleaned.startsWith('{')) {
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1)
        }
      }

      const raw = JSON.parse(cleaned)

      // Extract thinking if present
      const thinking = raw.thinking
      const updateRaw = raw.update ?? raw // fallback if agent returns flat update

      if (thinking) {
        emitTelemetry('agent:response', {
          intent: thinking.intent,
          // Support both old verbose format and new concise format
          modality_rationale: thinking.modality_rationale ?? thinking.modality,
          layout_rationale: thinking.layout_rationale ?? thinking.layout,
          design_decisions: thinking.design_decisions ?? thinking.decisions,
        }, {
          preview: `Intent: ${thinking.intent ?? 'unknown'}`,
        })

        // Six-voice checks — support both individual fields and single "checks" string
        if (thinking.checks) {
          emitTelemetry('agent:response', {
            type: 'design-checks',
            checks: typeof thinking.checks === 'string'
              ? { summary: thinking.checks }
              : thinking.checks,
          }, {
            preview: `Design checks: ${typeof thinking.checks === 'string' ? thinking.checks.substring(0, 80) : Object.keys(thinking.checks).join(', ')}`,
          })
        } else {
          const checks = [
            ['tufte', thinking.tufte_check],
            ['cooper', thinking.cooper_check],
            ['ive', thinking.ive_check],
            ['norman', thinking.norman_check],
            ['yablonski', thinking.yablonski_check],
            ['vanclef', thinking.vanclef_check],
          ].filter(([, v]) => v)

          if (checks.length > 0) {
            emitTelemetry('agent:response', {
              type: 'design-checks',
              checks: Object.fromEntries(checks),
            }, {
              preview: `Design checks: ${checks.map(([name]) => name).join(', ')}`,
            })
          }
        }
      }

      const normalized = normalizeUpdate(updateRaw, isFirst)
      return normalized
    } catch (parseErr) {
      console.error('[pane:claude] JSON parse failed:', parseErr)
      console.error('[pane:claude] First 200 chars of cleaned text:', text.trim().substring(0, 200))
      console.error('[pane:claude] Last 200 chars:', text.trim().slice(-200))
      emitTelemetry('api:error', {
        error: String(parseErr),
        textStart: text.trim().substring(0, 100),
      }, { preview: `JSON parse failed: ${String(parseErr).substring(0, 80)}` })
      // Wrap plain text response
      return {
        contexts: [{
          id: session.activeContext || 'main',
          operation: isFirst ? 'create' : 'update',
          label: 'Response',
          modality: 'conversational',
          view: {
            layout: { pattern: 'stack' },
            panels: [{
              id: `response-${Date.now()}`,
              atom: 'text',
              props: { content: text, level: 'body' },
              source: 'claude',
            }],
          },
        }],
        agents: [{ id: 'claude', name: 'Claude', state: 'idle', lastActive: Date.now() }],
      }
    }
  }

  const emptySession: PaneSession = {
    id: '', version: 0, activeContext: '',
    contexts: [], conversation: [], actions: [],
    agents: [], artifacts: [], feedback: [],
  }

  return {
    async init(input: PaneInput) {
      return call(input.content, emptySession)
    },
    async onInput(input: PaneInput, session: PaneSession) {
      return call(input.content, session)
    },
    async onActionResult(action: PaneTrackedAction, session: PaneSession) {
      return call(`Action "${action.label}" ${action.status}: ${action.result ?? action.error ?? ''}`, session)
    },
  }
}

// ── Normalize Claude's output to match Pane spec ──

// ── SSE Stream Reader ──

async function readStream(body: ReadableStream<Uint8Array>, callStart: number): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  let chunkCount = 0
  let buffer = ''

  // Create a single telemetry event that we update in place
  const streamEvent = emitTelemetry('api:response', {
    type: 'streaming',
    content: '',
    chars: 0,
  }, {
    preview: '⚡ Streaming...',
  })

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          if (event.type === 'content_block_delta' && event.delta?.text) {
            accumulated += event.delta.text
            chunkCount++

            // Update the single event in place — telemetry drawer shows live content
            const dur = Math.round(performance.now() - callStart)
            updateTelemetry(streamEvent.id, {
              data: {
                type: 'streaming',
                content: accumulated,
                chars: accumulated.length,
                chunks: chunkCount,
              },
              duration: dur,
              preview: `⚡ Streaming (${accumulated.length} chars, ${dur}ms)`,
            })
          }
        } catch {
          // Skip unparseable SSE lines
        }
      }
    }
  }

  // Final update
  const totalDur = Math.round(performance.now() - callStart)
  updateTelemetry(streamEvent.id, {
    data: {
      type: 'stream-complete',
      content: accumulated,
      chars: accumulated.length,
      chunks: chunkCount,
    },
    duration: totalDur,
    preview: `⚡ Complete: ${accumulated.length} chars, ${chunkCount} chunks (${totalDur}ms)`,
  })

  return accumulated
}

function normalizeUpdate(raw: any, isFirst: boolean): PaneSessionUpdate {
  const update: PaneSessionUpdate = {}

  if (raw.contexts && Array.isArray(raw.contexts)) {
    update.contexts = raw.contexts.map((ctx: any) => ({
      id: ctx.id ?? 'main',
      operation: ctx.operation ?? (isFirst ? 'create' : 'update'),
      label: ctx.label,
      modality: ctx.modality ?? 'conversational',
      view: ctx.view ? normalizeView(ctx.view) : undefined,
      status: ctx.status,
    }))
  }

  if (raw.actions) update.actions = raw.actions
  if (raw.agents) {
    update.agents = raw.agents
  } else {
    update.agents = [{ id: 'claude', name: 'Claude', state: 'idle' as const, lastActive: Date.now() }]
  }

  return update
}

function normalizeView(view: any): any {
  return {
    layout: {
      pattern: view.layout?.pattern ?? 'stack',
      columns: view.layout?.columns,
      ratio: view.layout?.ratio,
      gap: typeof view.layout?.gap === 'number' ? `${view.layout.gap}px` : view.layout?.gap,
    },
    panels: Array.isArray(view.panels) ? view.panels.map(normalizePanel) : [],
  }
}

function normalizePanel(panel: any): any {
  // Claude sometimes uses "type" instead of "atom"
  const atom = panel.atom ?? panel.type ?? 'box'

  // Build props — merge explicit props with any flat fields Claude might use
  const props = { ...(panel.props ?? {}) }
  if (panel.content !== undefined && !props.content) props.content = panel.content
  if (panel.level !== undefined && !props.level) props.level = panel.level
  if (panel.placeholder !== undefined && !props.placeholder) props.placeholder = panel.placeholder
  if (panel.label !== undefined && !props.label) props.label = panel.label
  if (panel.value !== undefined && !props.value) props.value = panel.value
  if (panel.src !== undefined && !props.src) props.src = panel.src

  // Sanitize style prop — Claude sometimes sends invalid CSS objects
  if (props.style) {
    props.style = sanitizeStyle(props.style)
  }

  return {
    id: panel.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    atom,
    recipe: panel.recipe,
    props,
    source: panel.source ?? 'claude',
    data: panel.data,
    children: Array.isArray(panel.children) ? panel.children.map(normalizePanel) : undefined,
    emphasis: panel.emphasis,
    reactive: panel.reactive,
    on: panel.on,
  }
}

// Sanitize style objects from Claude — remove anything React can't handle
function sanitizeStyle(style: any): Record<string, string | number> | undefined {
  if (!style || typeof style !== 'object') return undefined
  if (Array.isArray(style)) return undefined

  const clean: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(style)) {
    // Skip numeric keys (arrays disguised as objects)
    if (/^\d+$/.test(key)) continue
    // Only allow string or number values
    if (typeof value === 'string' || typeof value === 'number') {
      clean[key] = value
    }
  }

  return Object.keys(clean).length > 0 ? clean : undefined
}
