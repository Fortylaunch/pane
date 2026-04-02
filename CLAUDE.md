# Pane — Development Guide

## What is Pane
A dynamic workspace layer for human-agent collaboration. Agents compose UI declaratively via JSON specs (atoms + recipes + layouts), and the renderer draws them. Claude is the primary composing agent.

## Architecture
```
Agent (Claude/starter) → PaneSessionUpdate → PaneRuntime → React Renderer
                                                  ↓
                                            6D Eval (optional)
                                            Visual Eval (optional)
```

- **@pane/core** — spec types, runtime, eval system, Claude connector, telemetry
- **@pane/renderer** — React components (atoms, recipes, layout, PaneRenderer shell)
- **@pane/theme** — design tokens, CSS variable emission, enforcement rules
- **examples/dev** — dev app with starter agent + Claude agent + proxy server

## Running locally
```bash
pnpm dev                                    # Vite dev server on :5173
npx tsx examples/dev/server.ts              # Claude API proxy on :3001
# Visit http://localhost:5173               # Claude agent (needs proxy)
# Visit http://localhost:5173/?agent=starter # Local starter agent
```

## Testing
```bash
pnpm test           # Unit tests (vitest)
pnpm test:visual    # Playwright visual tests (starts Vite on :3000)
```

## Design tools
```bash
npx tsx scripts/design-audit.ts --reference <screenshot.png> --capture --apply
npx tsx scripts/visual-eval.ts              # Multi-viewport eval with 6D scoring
```

## System inventory

### 16 Atoms
box, text, image, input, shape, frame, icon, spacer, badge, divider, progress, list, chart, skeleton, pill, map

### 18 Recipes
metric, status, card, data-table, editor, action-group, timeline, form, alert, key-value, progress-tracker, nav-list, stat-comparison, toolbar, filter-bar, stat-grid, map-panel, dashboard

### 8 Layout patterns
stack, split, grid, tabs, overlay, flow, sidebar, dashboard

### Layout fill contracts
Each pattern has a default fill behavior in `LAYOUT_FILL_DEFAULTS`:
- **stretch** (split, sidebar, dashboard, tabs, overlay): children fill parent height, manage own scroll
- **start** (stack, grid, flow): children take natural height, container scrolls

### Theme aesthetic
Intelligence dashboard style (World Monitor reference):
- Neon green accent (#00e676), near-black backgrounds (#0b0b0e)
- Sharp corners (0-2px radius), no shadows, flat UI
- Monospace uppercase labels, compact spacing (md: 0.5rem)
- Glass effects via `--pane-glass-*` tokens

### Eval system (6 dimensions)
spec-quality, modality-fit, visual-outcome, interaction-quality, traceability, design-quality. Toggleable via UI (default: off). Results feed back to Claude as context on next call.

### Design Council
Sidebar chat (DESIGN tab in telemetry panel) with six personas: Tufte, Cooper, Ive, Norman, Yablonski, Van Cleef. Analyzes current UI through design lenses.

## Key patterns

### Adding an atom
1. Create TSX in `packages/renderer/src/atoms/`
2. Export from `atoms/index.ts`
3. Add to `AtomType` union in `packages/core/src/spec/types.ts`
4. Add to `VALID_ATOMS` in `packages/core/src/spec/validate.ts`
5. Add import + switch case in `packages/renderer/src/PanelRenderer.tsx`
6. Document in Claude system prompt (`packages/core/src/connectors/claude.ts`)

### Adding a recipe
1. `registerRecipe('name', expanderFn)` in `packages/renderer/src/recipes/builtins.ts`
2. Document in Claude system prompt

### Changing design tokens
1. Update `packages/theme/src/index.ts` (interfaces + defaults + CSS var emission)
2. Run design audit to validate: `npx tsx scripts/design-audit.ts --reference <ref> --capture`

## Design principles
- Fix issues at the system level (tokens, atoms, contracts), never as one-off patches
- Every design change should update: (1) the code, (2) the Claude system prompt, (3) eval rules
- Reference standard: World Monitor (worldmonitor.app) — tight, data-dense, intelligence dashboard
- The design audit agent (`scripts/design-audit.ts`) compares screenshots and outputs actionable patches
