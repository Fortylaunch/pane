# Contributing to Pane

Pane is a dynamic workspace layer for human-agent collaboration. Contributions are welcome.

## Setup

```bash
git clone <repo-url>
cd pane
pnpm install
pnpm build
pnpm test
```

## Structure

```
packages/core       — Types, runtime, agents, connectors, evals, telemetry
packages/renderer   — React atoms, recipes, layout, animations, telemetry drawer
packages/theme      — Tokens, rules, enforcement
packages/create-pane — CLI scaffold
```

## Development

```bash
# Build all packages
pnpm build

# Run unit tests (21 tests)
pnpm test

# Run visual tests (Playwright, 7 tests)
pnpm run test:visual

# Run eval demo
npx tsx scripts/eval-demo.ts

# Start dev app
cd examples/dev && npx vite --port 3000
```

## How to Extend

### Add an Atom

Atoms live in `packages/renderer/src/atoms/`. Each atom is a single React component. To add one:

1. Create `packages/renderer/src/atoms/MyAtom.tsx`
2. Export it from `packages/renderer/src/atoms/index.ts`
3. Add rendering in `packages/renderer/src/PanelRenderer.tsx` (the switch statement)
4. Add the atom type to `AtomType` in `packages/core/src/spec/types.ts`

### Add a Recipe

Recipes live in `packages/renderer/src/recipes/builtins.ts`. Each recipe is a function that takes a `PanePanel` and returns an expanded atom tree.

```typescript
registerRecipe('my-recipe', (panel) => ({
  ...panel,
  atom: 'box',
  recipe: undefined,
  props: { ... },
  children: [ ... ],
}))
```

### Add a Connector

Connectors live in `packages/core/src/connectors/`. Each connector implements the `PaneAgent` interface:

```typescript
interface PaneAgent {
  init(input: PaneInput): Promise<PaneSessionUpdate>
  onInput(input: PaneInput, session: PaneSession): Promise<PaneSessionUpdate>
  onActionResult?(action: PaneTrackedAction, session: PaneSession): Promise<PaneSessionUpdate>
  tick?(session: PaneSession): Promise<PaneSessionUpdate | null>
  teardown?(session: PaneSession): Promise<void>
}
```

### Add an Eval Dimension

Evals live in `packages/core/src/evals/`. Each dimension is a function that takes an `EvalContext` and returns `EvalFinding[]`.

1. Create `packages/core/src/evals/my-dimension.ts`
2. Add the dimension to `EvalDimension` type in `packages/core/src/evals/types.ts`
3. Wire it into the runner in `packages/core/src/evals/runner.ts`
4. Export from `packages/core/src/evals/index.ts`

## Design Philosophy

Read `docs/design/01-design-philosophy.md` before contributing visual changes. Every composition decision should pass the six-voice test (Tufte, Cooper, Ive, Norman, Yablonski, Van Cleef).

## License

MIT
