# Pane

A dynamic workspace layer for human-agent collaboration.

Pane is the surface between humans and agents. It's not a dashboard. It's not a chat interface. It's a workspace that shapeshifts to match what you're doing, as you're doing it. Agents compose the interface from atomic primitives in real time. The surface adapts, the user steers.

## What Pane Does

- **16 atomic primitives** — box, text, image, input, shape, frame, icon, spacer, badge, divider, progress, list, chart, skeleton, pill, map
- **18 recipes** — pre-composed patterns (metric, data-table, alert, stat-grid, map-panel, dashboard, toolbar, filter-bar, and more)
- **8 layout patterns** — stack, split, grid, tabs, overlay, flow, sidebar, dashboard — with systematic fill contracts
- **6 workspace modalities** — conversational, informational, compositional, transactional, collaborative, environmental
- **Agent-driven** — any agent that returns a JSON spec can drive the surface. Claude, custom agents, REST APIs, WebSockets
- **Design intelligence** — six design traditions (Tufte, Cooper, Ive, Norman, Yablonski, Van Cleef) embedded in the system prompt and eval framework
- **Design Council** — sidebar chat where you can consult six design personas about the current UI in real time
- **Design audit** — screenshot comparison tool that analyzes a reference UI against Pane's output and produces actionable token/atom patches
- **6D eval system** — spec quality, modality fit, visual outcome, interaction quality, traceability, design quality — toggleable via UI
- **Visual self-correction** — after rendering, Pane captures a screenshot and sends it to Claude for evaluation. If the render is broken, the agent corrects it
- **Layout fill contracts** — stretch layouts (split, sidebar, dashboard) fill the viewport and manage internal scroll. Start layouts (stack, grid) flow naturally. Enforced at the type system level.
- **Full observability** — telemetry drawer shows every agent request, API call, design reasoning, and eval finding
- **Feedback loop** — eval findings feed back to Claude as context on the next call, so the agent self-corrects

## Quick Start

### Development

```bash
pnpm install
pnpm dev                                # Dev server → http://localhost:5173
npx tsx examples/dev/server.ts          # Claude API proxy → http://localhost:3001
```

Visit `http://localhost:5173` for the Claude agent (needs proxy), or `http://localhost:5173/?agent=starter` for the local starter agent.

### Create a new app

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

### Add to an existing project

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
      <PaneRenderer proxyUrl="http://localhost:3001/api/claude" />
    </PaneProvider>
  )
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│              @pane/renderer             │  React: 16 atoms, 18 recipes, layout,
│              (the surface)              │  animations, design council, telemetry
├─────────────────────────────────────────┤
│               @pane/core                │  Types, runtime, agent interface,
│              (the brain)                │  connectors, actions, 6D evals, telemetry
├─────────────────────────────────────────┤
│               @pane/theme               │  Tokens, rules, fill contracts, enforcement
└─────────────────────────────────────────┘
```

## The 16 Atoms

| Atom | Purpose |
|---|---|
| `box` | Container with flexbox layout, glass effect support, fill protocol |
| `text` | Content with semantic level (heading, body, label, caption, code) — mono uppercase for labels |
| `image` | Visual media with alt text |
| `input` | User entry — text, textarea, button, select, toggle, number, date |
| `shape` | SVG elements — line, rect, circle, path |
| `frame` | Embedded interactive content, sandboxed |
| `icon` | Semantic icon reference |
| `spacer` | Explicit spacing / divider |
| `badge` | Status tag/label with color variants |
| `divider` | Section separator with optional label |
| `progress` | Animated progress bar with variants |
| `list` | Semantic ordered/unordered list |
| `chart` | SVG data visualization — bar, line, area, pie, sparkline |
| `skeleton` | Shimmer loading placeholder |
| `pill` | Toggle pill/chip for filter bars and toolbars |
| `map` | Interactive Leaflet map with dark tiles, markers, and layers |

## The 18 Recipes

| Recipe | What it composes |
|---|---|
| `metric` | Label + value + trend indicator |
| `status` | Dot + label + optional detail |
| `card` | Title + description + actions |
| `data-table` | Header row + data rows |
| `editor` | Textarea + action buttons |
| `form` | Labeled fields + submit |
| `action-group` | Set of buttons with hierarchy |
| `timeline` | Ordered events with timestamps |
| `alert` | Notification banner with icon + colored border |
| `key-value` | Label:value pair list |
| `progress-tracker` | Multi-step process with badge indicators |
| `nav-list` | Clickable item list with icons and arrows |
| `stat-comparison` | Before/after metric with change indicator |
| `toolbar` | Horizontal pill bar with optional search |
| `filter-bar` | Scrollable toggle pills with dot indicators |
| `stat-grid` | Auto-fill responsive grid of metric cards |
| `map-panel` | Map with glass overlay title and control pills |
| `dashboard` | Composed layout with title and children regions |

## Layout Fill Contracts

Every layout pattern declares its fill behavior as part of the type system:

| Pattern | Fill | Overflow | Behavior |
|---|---|---|---|
| `stack` | start | visible | Children take natural height, container scrolls |
| `split` | stretch | scroll | Children fill columns, manage own scroll |
| `grid` | start | visible | Content flows in grid, container scrolls |
| `sidebar` | stretch | scroll | Both panes fill viewport height |
| `dashboard` | stretch | scroll | Header/main/footer fill viewport |
| `tabs` | stretch | scroll | Active tab fills available space |
| `overlay` | stretch | clip | Positioned content fills container |
| `flow` | start | visible | Horizontal flow with overflow scroll |

Agents can override via `fill` and `overflow` fields on `LayoutConfig`.

## Design Tools

### Design Audit

Compare a reference UI screenshot against Pane's output:

```bash
npx tsx scripts/design-audit.ts --reference <screenshot.png> --capture --apply
```

Outputs specific token patches, atom changes, and design rules based on pixel-level analysis.

### Design Council

Sidebar chat (DESIGN tab in the telemetry panel) where you consult six design personas about the current UI. They analyze through Tufte, Cooper, Ive, Norman, Yablonski, and Van Cleef lenses and suggest concrete improvements.

### Visual Eval

Multi-viewport screenshot evaluation with 6D scoring:

```bash
npx tsx scripts/visual-eval.ts [--a11y]
```

## Evals

6-dimension evaluation framework that scores every agent response (toggleable via UI, default off):

| Dimension | What it checks |
|---|---|
| Spec Quality | Valid structure, unique IDs, reasonable nesting |
| Modality Fit | Content matches declared modality |
| Visual Outcome | Density, atom variety, emphasis balance, space utilization |
| Interaction Quality | Response time, context preservation |
| Traceability | Every panel sourced, actions timed |
| Design Quality | Six design tradition checks |

Eval findings feed back to Claude as context on the next call, creating a self-correction loop.

## Theme

Intelligence dashboard aesthetic calibrated against World Monitor:

- Neon green accent (`#00e676`), near-black backgrounds (`#0b0b0e`)
- Sharp corners (0-2px radius), no shadows, completely flat
- Monospace uppercase labels with letter-spacing
- Compact spacing (md: 0.5rem, lg: 0.75rem)
- Glass effects via `--pane-glass-*` tokens (backdrop-filter blur)
- Density multipliers (compact 0.625x, spacious 1.5x)

## Connecting Agents

```typescript
// Local function
const pane = createPane({ agent: functionAgent(myFn) })

// REST endpoint
const pane = createPane({ agent: httpAgent({ url: 'https://my-api.com/pane' }) })

// WebSocket
const pane = createPane({ agent: wsAgent({ url: 'wss://my-api.com/pane' }) })

// Claude API
const pane = createPane({ agent: claudeAgent({ proxyUrl: 'http://localhost:3001/api/claude' }) })
```

## Testing

```bash
pnpm test           # Unit tests (vitest)
pnpm test:visual    # Playwright visual tests
```

## Tech Stack

- React 19, TypeScript (strict), CSS custom properties
- Motion (Framer Motion) for layout animations and springs
- Leaflet for interactive maps (CDN, no API key)
- html2canvas for visual self-correction screenshots
- Playwright for visual testing
- Vite for dev/build, Vitest for unit tests
- pnpm workspaces + Turborepo

## Project Structure

```
pane/
├── packages/
│   ├── core/            # Types, runtime, agents, connectors, actions, evals, telemetry
│   ├── renderer/        # React atoms, recipes, layout, design council, telemetry drawer
│   ├── theme/           # Tokens, fill contracts, rules, enforcement
│   └── create-pane/     # npx create-pane scaffold CLI
├── examples/
│   └── dev/             # Dev app with starter + Claude agents
├── scripts/
│   ├── design-audit.ts  # Reference screenshot comparison tool
│   └── visual-eval.ts   # Multi-viewport eval with 6D scoring
├── tests/
│   └── visual/          # Playwright visual tests
└── docs/
    └── design/          # Design philosophy and composition ruleset
```

## License

MIT
