# Pane

A dynamic workspace layer for human-agent collaboration.

Pane is the surface between humans and agents. It's not a dashboard. It's not a chat interface. It's a workspace that shapeshifts to match what you're doing, as you're doing it. Agents compose the interface from atomic primitives in real time. The surface adapts, the user steers.

## What Pane Does

- **8 atomic primitives** (box, text, image, input, shape, frame, icon, spacer) compose into any interface on the fly
- **6 workspace modalities** (conversational, informational, compositional, transactional, collaborative, environmental) — the surface shifts between them fluidly
- **Agent-driven** — any agent that returns a JSON spec can drive the surface. Claude, custom agents, REST APIs, WebSockets
- **Design intelligence** — the system prompt carries six design traditions (Tufte, Cooper, Ive, Norman, Yablonski, Van Cleef) so agent-composed views are intentional, not random
- **Full observability** — telemetry drawer shows every agent request, API call, design reasoning, visual capture, and correction in real time
- **Visual self-correction** — after rendering, Pane captures a screenshot and sends it back to the agent for evaluation. If the render is broken, the agent corrects it
- **Streaming** — Claude's response streams in real time. The telemetry drawer shows the agent's thinking as it generates
- **Feedback loop** — users rate panels (helpful / not useful). Feedback flows back to agents so the system improves
- **Recipes** — pre-composed patterns (metric cards, data tables, editors, forms, timelines) that agents can use as shorthand or compose from raw atoms
- **Evals** — 6-dimension evaluation framework (spec quality, modality fit, visual outcome, interaction quality, traceability, design quality) with machine-readable scoring

## Quick Start

### Option 1: Create a new app

```bash
npx create-pane my-app
cd my-app
npm install
npm run dev
```

With Claude:

```bash
npx create-pane my-app --claude
cd my-app
cp .env.example .env  # add your Anthropic API key
node server.js         # terminal 1: start the proxy
npm run dev            # terminal 2: start the app
```

### Option 2: Add to an existing project

```bash
npm install @pane/core @pane/renderer @pane/theme
```

```tsx
import { createPane, functionAgent } from '@pane/core'
import { PaneProvider, PaneRenderer } from '@pane/renderer'
import { defaultTheme } from '@pane/theme'

const agent = functionAgent(async (input, session) => ({
  contexts: [{
    id: 'main',
    operation: session.contexts.length === 0 ? 'create' : 'update',
    label: 'Home',
    modality: 'conversational',
    view: {
      layout: { pattern: 'stack' },
      panels: [{
        id: 'response',
        atom: 'text',
        props: { content: `You said: ${input.content}`, level: 'body' },
        source: 'my-agent',
      }],
    },
  }],
}))

const pane = createPane({ agent })

function App() {
  return (
    <PaneProvider runtime={pane} theme={defaultTheme}>
      <PaneRenderer />
    </PaneProvider>
  )
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│              @pane/renderer             │  React: 8 atoms, recipes, layout,
│              (the surface)              │  animations, telemetry drawer
├─────────────────────────────────────────┤
│               @pane/core                │  Types, runtime, agent interface,
│              (the brain)                │  connectors, actions, evals, telemetry
├─────────────────────────────────────────┤
│               @pane/theme               │  Tokens, rules, enforcement
└─────────────────────────────────────────┘
```

**Three packages.** `@pane/core` is the brain — types, runtime, agent interface, connectors (HTTP, WebSocket, Claude API), action tracking, feedback, telemetry, evals. `@pane/renderer` is the surface — atom components, recipe expansion, layout engine, animation stack, observability layer, telemetry drawer. `@pane/theme` is the skin — tokens, rules, silent enforcement.

## Connecting Agents

Pane works with any agent backend. Swap one line:

```typescript
// Local function
import { functionAgent, createPane } from '@pane/core'
const pane = createPane({ agent: functionAgent(myFn) })

// REST endpoint
import { httpAgent, createPane } from '@pane/core'
const pane = createPane({ agent: httpAgent({ url: 'https://my-api.com/pane' }) })

// WebSocket (streaming, real-time)
import { wsAgent, createPane } from '@pane/core'
const pane = createPane({ agent: wsAgent({ url: 'wss://my-api.com/pane' }) })

// Claude API
import { claudeAgent, createPane } from '@pane/core'
const pane = createPane({ agent: claudeAgent({ proxyUrl: 'http://localhost:3001/api/claude' }) })
```

Any system that returns a `PaneSessionUpdate` can drive the surface.

## The 8 Atoms

Everything is composed from these primitives:

| Atom | Purpose |
|---|---|
| `box` | Container. Holds children. Flexbox layout. |
| `text` | Content with semantic level (heading, body, label, caption, code). |
| `image` | Visual media with alt text. |
| `input` | User entry — text, textarea, button, select, toggle, number, date. |
| `shape` | SVG elements — line, rect, circle, path. For data visualization. |
| `frame` | Embedded interactive content. Sandboxed. |
| `icon` | Semantic icon reference. |
| `spacer` | Explicit spacing / divider. |

Agents compose atoms by nesting. A chart is `box > shapes + text`. A table is `box(grid) > boxes > text`. An editor is `box > input(textarea) + buttons`. There's no component library — the interface is generated.

## Recipes

Pre-composed patterns agents can reference as shorthand:

| Recipe | What it expands to |
|---|---|
| `metric` | Label + value + trend indicator |
| `card` | Title + description + actions |
| `data-table` | Header row + data rows |
| `editor` | Textarea + action buttons |
| `form` | Labeled fields + submit |
| `action-group` | Set of buttons with hierarchy |
| `timeline` | Ordered events with timestamps |
| `status` | Dot + label + optional detail |

Agents can also register new recipes at runtime.

## Evals

6-dimension evaluation framework that scores every agent response:

| Dimension | What it checks |
|---|---|
| Spec Quality | Valid structure, unique IDs, reasonable nesting depth |
| Modality Fit | Content matches declared modality, density targets |
| Visual Outcome | Panel count, atom variety, emphasis balance, action hierarchy |
| Interaction Quality | Response time, interjection handling, context preservation |
| Traceability | Every panel sourced, actions timed, artifacts located |
| Design Quality | Tufte (data-ink), Cooper (goal-directed), Ive (inevitability), Norman (usability), Yablonski (cognitive load), Van Cleef (context) |

```bash
# Run evals
npx tsx scripts/eval-demo.ts

# Run visual tests (Playwright)
pnpm run test:visual
```

## Foundational Principles

1. **Total visibility** — what's happening, how long it takes, where work is, where things are stored, how long they persist. Always visible.
2. **Traceability** — every panel, action, and artifact traces to its source agent. One gesture from content to provenance.
3. **No hidden state** — if an agent is working, the surface shows it. If data is stale, the surface says so.
4. **User sovereignty** — the user can always interrupt, redirect, cancel, or override. Agents work for the user.
5. **Feedback is first-class** — the system gets better the more you use it. Feedback is captured, transparent, and retractable.

## Roadmap

Pane is functional today — agents compose views, the surface renders with animations, telemetry streams, evals score. Here's what's coming:

### Next Up

- [ ] **Progressive rendering** — show panels as they stream instead of waiting for full JSON. The surface builds itself in real time.
- [ ] **Action confirmation UI** — confirm/cancel prompts in the renderer for proposed actions.
- [ ] **AutoAnimate on containers** — children animate automatically on add/remove/reorder.
- [ ] **View Transitions API** — browser-native GPU-accelerated view swaps as the base animation layer.
- [ ] **Contrast enforcement on all atoms** — currently only Box detects light backgrounds. Extend to Text, Input, etc.
- [ ] **JSON truncation recovery** — graceful handling when Claude's response is cut off mid-spec.

### Planned

- [ ] **Playground** — live spec editor + renderer + diagnostics. Compose atoms and recipes interactively.
- [ ] **Example suite** — static, recipes, conversational, modality-shift, full demo.
- [ ] **Multi-agent composition** — multiple agents contributing panels to the same view.
- [ ] **Session persistence** — resume where you left off across sessions.
- [ ] **Persistent artifacts** — save/retrieve system for things the surface produces.
- [ ] **Mobile/responsive** — recompose views for smaller screens, not just shrink.
- [ ] **Voice input** — the interaction types support it, implementation pending.
- [ ] **CI pipeline** — GitHub Actions for build, test, visual tests, and evals on every PR.

## Tech Stack

- React 19, TypeScript (strict), CSS custom properties
- Motion (Framer Motion) for layout animations and springs
- html2canvas for visual self-correction screenshots
- Playwright for visual testing
- Vite for dev/build, Vitest for unit tests
- pnpm workspaces + Turborepo

## Project Structure

```
pane/
├── packages/
│   ├── core/            # Types, runtime, agents, connectors, actions, evals, telemetry
│   ├── renderer/        # React atoms, recipes, layout, animations, telemetry drawer
│   ├── theme/           # Tokens, rules, enforcement
│   └── create-pane/     # npx create-pane scaffold CLI
├── examples/
│   └── dev/             # Dev app with Claude connected
├── tests/
│   └── visual/          # Playwright visual tests
├── scripts/             # Demo and eval scripts
└── docs/
    └── design/          # Design philosophy and composition ruleset
```

## License

MIT
