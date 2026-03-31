# Pane Composition Ruleset

## Machine-Readable Design Heuristics for Agent-Composed Views

---

This ruleset translates the Pane Design Philosophy into actionable constraints that agents apply when composing views from the 8 atomic primitives. Rules are organized by concern and tagged with their source influence.

---

## 1. Atom Usage Rules

### BOX
- A box must contain at least one child atom. Empty boxes are prohibited. [Tufte: no empty ink]
- Nesting depth must not exceed 4 levels. If composition requires deeper nesting, restructure into sibling boxes. [Norman: conceptual model clarity]
- A box used purely for spacing must be replaced with a `spacer` atom. Boxes are containers, not whitespace. [Ive: material honesty]
- A box with a single child and no styling properties should be eliminated. Unnecessary wrappers degrade legibility of the view tree. [Tufte: data-ink ratio]

### TEXT
- Every text atom must have an explicit semantic role: `title`, `heading`, `subheading`, `body`, `caption`, `label`, `code`, `emphasis`. No unsemantic text. [Norman: signifiers]
- Body text must not exceed 75 characters per line. Optimal range: 50-65 characters. [Tufte: typographic legibility]
- Do not use more than 3 levels of typographic hierarchy in a single view. Title + body + caption is sufficient for most compositions. A fourth level (subheading) is permitted only when the view contains distinct sections. [Yablonski: Miller's Law]
- All-caps text is permitted only for labels and short status indicators (≤3 words). Never for body text or headings. [Norman: readability]

### IMAGE
- Every image must have an `alt` description and a functional purpose: `data-visualization`, `contextual`, `identity`, `decorative`. [Norman: affordances]
- Images with purpose `decorative` are prohibited unless they occupy ≤5% of the view's total area. [Tufte: data-ink ratio]
- Images must never be the sole carrier of critical information. Pair with text atoms for accessibility and legibility. [Norman: redundant encoding]

### INPUT
- Every input must have a visible label (text atom with role `label`). Placeholder text is supplementary, never primary. [Norman: signifiers]
- A single view must not present more than 7 input fields simultaneously. Beyond 7, use progressive disclosure or multi-step sequencing. [Yablonski: Miller's Law]
- Input groups must be chunked into logical sets of 2-4 fields, separated by spacers or labeled sections. [Yablonski: Miller's Law + Gestalt proximity]
- Default values should be provided wherever a reasonable default exists. Never present a blank field when the agent has enough context to pre-fill. [Cooper: minimize interaction cost]

### SHAPE
- Shapes used as dividers must carry semantic meaning (separating distinct information groups). Decorative shapes are prohibited. [Tufte: no chartjunk]
- Color-filled shapes used for status or encoding must use the theme's semantic palette (success, warning, error, info, neutral). No arbitrary colors. [Norman: consistent mapping]
- Shapes must not be used where a box with a border would suffice. Prefer structural atoms over drawn decoration. [Ive: material honesty]

### FRAME
- Frames (embedded content) must always display a visible boundary and a source indicator. The user must know framed content comes from elsewhere. [Conviction: traceability]
- Frame content must not autoplay media or initiate interaction without user action. [Norman: user control]
- Loading states within frames must be visible. A blank frame is never acceptable. [Norman: visibility of system status]

### ICON
- Icons must always be paired with a text label unless the icon is universally unambiguous (close/X, search/magnifier, back/arrow). Maximum of 5 unlabeled icons per view. [Norman: signifiers; Yablonski: Jakob's Law]
- Icons used for actions must have a minimum tap target of 44x44 logical pixels. [Yablonski: Fitts's Law]
- Icon density must not exceed one icon per 48px of horizontal space. Crowded icon rows degrade scanability. [Tufte: avoid label clutter]

### SPACER
- Spacers encode visual grouping. Adjacent items with smaller spacers are perceived as related; larger spacers create separation. Use deliberately. [Gestalt proximity]
- The spacing scale must be consistent within a view: use the theme's spacing tokens (4, 8, 12, 16, 24, 32, 48). No arbitrary pixel values. [Ive: systematic precision]
- Vertical spacers between major sections should be ≥24px. Within sections, ≥8px. Between related items within a group, ≥4px. [Tufte: layering and separation]

---

## 2. Composition Rules

### Layout Density

| Modality | Target density | Max atoms per viewport | Rationale |
|---|---|---|---|
| Conversational | Low | 15-25 | Focus on the exchange; reduce visual competition [Cooper] |
| Informational | High | 40-80 | Maximize data per glance; reward study [Tufte] |
| Compositional | Medium | 20-40 | Balance workspace tools with content area [Ive] |
| Transactional | Low-Medium | 15-30 | Reduce choices; emphasize the action [Cooper, Yablonski] |
| Collaborative | Medium | 25-50 | Support multiple participants' context [Van Cleef] |
| Environmental | Variable | Adaptive | Match the environment's natural density [Van Cleef] |

### Hierarchy and Scanning

- Every view must have exactly one primary focal point. The eye must land somewhere definite within 200ms of the view appearing. [Tufte: entry point]
- Visual hierarchy must follow a Z-pattern (left-to-right, top-to-bottom) or F-pattern (for text-heavy informational views). Do not fight the natural scanning direction. [Yablonski: Jakob's Law]
- Primary actions must be placed in the bottom-right quadrant (confirmation zone) or directly below the content they act on. Destructive actions must never occupy the primary position. [Yablonski: Fitts's Law; Cooper: safe interaction]
- Secondary information (metadata, timestamps, agent attribution) belongs in the periphery — top-right corner, bottom edge, or collapsible footer. Present but not competing. [Tufte: micro/macro reading]

### Grouping and Chunking

- Related atoms must be grouped into box containers with consistent internal spacing. [Gestalt proximity]
- A group must contain no more than 5-7 items. Lists exceeding 7 items must use progressive disclosure, pagination, or hierarchical nesting. [Yablonski: Miller's Law]
- Groups must be labeled when the view contains more than 2 groups. The label is a text atom with role `heading` or `subheading`. [Norman: signifiers]
- Data tables with more than 5 columns must use horizontal priority: the most important columns are leftmost and always visible; less critical columns may be accessible via scroll or expansion. [Tufte: small multiples principle adapted to tables]

### Color Rules

- Maximum 5 distinct hues per view (excluding grayscale). Each hue must encode something specific: category, status, emphasis, interaction state, or data series. [Tufte: color as data encoding]
- Background colors must maintain WCAG AA contrast ratio (4.5:1) with foreground text at all sizes. AAA (7:1) preferred for body text. [Norman: legibility]
- Do not use color as the sole differentiator for any critical information. Pair with shape, position, or text. [Norman: redundant encoding]
- Semantic colors are fixed: success (green), warning (amber), error (red), info (blue), neutral (gray). Do not repurpose these. [Norman: consistent mapping]

### Motion Rules

- Atoms entering the viewport: fade-in (150-250ms) or slide-in from the direction of their source (200-350ms). No bouncing, no overshoot. [Conviction: alive without anxious]
- Atoms exiting the viewport: fade-out (100-200ms). Shorter than entrance to maintain forward momentum. [Ive: restraint]
- State changes (value updates, status transitions): crossfade (150ms) for text, color transition (200ms) for status indicators. [Norman: visibility of system status]
- Page-level modality transitions: coordinated motion where departing elements exit before arriving elements enter. Total transition time must not exceed 400ms. [Norman: spatial continuity]
- No motion purely for decoration. If removing the animation would not reduce the user's understanding of what changed, remove the animation. [Tufte: no chartjunk; Ive: inevitability]

---

## 3. Interaction Rules

### Choice Architecture

- When presenting choices, the recommended or most common option must be visually distinguished (primary styling) and positioned first. [Yablonski: default effect; Cooper: goal-directed]
- Binary choices (confirm/cancel, yes/no) must always place the affirmative action on the right and the dismissive action on the left. [Yablonski: Jakob's Law — platform convention]
- Choice sets exceeding 5 options must use a searchable or filterable input rather than a flat list of buttons. [Yablonski: Hick's Law]
- Destructive actions require a confirmation step. The confirmation must restate what will happen in plain language, not just "Are you sure?" [Norman: error prevention; Cooper: goal clarity]

### Feedback Loops

- Every user action must produce visible feedback within 100ms. Tap, click, or submit must produce an immediate visual response (highlight, depress, spinner). [Norman: visibility of system status]
- If an agent operation will take >1 second, show a progress indicator with estimated time or indeterminate animation. If >5 seconds, show a status message describing what's happening. If >15 seconds, provide the option to continue working on something else. [Cooper: respect the user's time]
- Success and error states must be visually distinct and persistent until acknowledged or until the next action replaces them. Toasts that auto-dismiss critical information are prohibited. [Norman: visibility of system status]

### Agent Attribution

- Every view must include an attribution indicator identifying the agent that composed it. This may be a subtle label, icon, or footer — but it must be present. [Conviction: traceability]
- When multiple agents contribute to a single view, each section must be independently attributable. [Conviction: traceability]
- Attribution must link to the telemetry detail for that composition — timing, data sources, confidence level. One gesture from attribution to detail. [Conviction: total visibility]

---

## 4. Modality-Specific Rules

### Conversational
- Message bubbles must alternate alignment or color to distinguish human from agent. [Norman: mapping]
- The input area must always be visible and anchored to the bottom. [Cooper: persistent availability of the primary action]
- Historical messages must be scrollable but the current exchange must be visible without scrolling. [Van Cleef: arc awareness]

### Informational
- Prioritize data density. Use small multiples for comparison. Use sparklines for inline trends. [Tufte]
- Every data point must be queryable — tap or hover to see the underlying value, source, and timestamp. [Conviction: traceability]
- Avoid chart types that obscure data: no pie charts for >4 segments, no 3D charts ever, no dual-axis charts unless explicitly requested. [Tufte: chartjunk avoidance]

### Compositional
- The primary content area must occupy ≥60% of the viewport. Tools and palettes are secondary. [Ive: the content is the interface]
- Auto-save must be indicated visually. The user must never wonder if their work is persisted. [Norman: visibility of system status]
- Undo must be available and visible. [Norman: error recovery]

### Transactional
- The action required must be stated in plain language at the top of the view. "Approve this purchase order for $4,200" not "Transaction pending." [Cooper: goal clarity; Van Cleef: real-world performance]
- Show only the information necessary to make the decision. Supplementary detail is available on expansion, not by default. [Cooper: minimum viable interaction; Tufte: data-ink ratio]
- The primary action button must be the largest interactive element in the view. [Yablonski: Fitts's Law]

### Collaborative
- Every participant's cursor, selection, or focus area must be visible and color-coded. [Norman: visibility of system status]
- Edits must be attributed in real time. [Conviction: traceability]
- Conflict resolution must be surfaced immediately, not deferred. [Norman: error prevention]

### Environmental
- The view must adapt to the physical context: screen size, ambient light (if available), input modality (touch vs. pointer vs. voice). [Van Cleef: context-aware experience]
- Information density must scale with screen real estate. Do not simply shrink a desktop view onto a small screen — recompose it. [Cooper: goal-directed adaptation]
- Voice-initiated surfaces must prioritize readability at distance and reduce reliance on fine motor interaction. [Yablonski: Fitts's Law adapted to environmental context]

---

## 5. Anti-Patterns (Never Do This)

| Anti-pattern | Violation | Correction |
|---|---|---|
| Empty state with only an illustration and "Nothing here yet" | Tufte: wasted ink; Cooper: unhelpful | Show what the user can do next, or explain why it's empty and what would populate it |
| Modal dialog for non-critical information | Cooper: unnecessary interaction cost | Use inline expansion or a non-blocking panel |
| More than 3 competing calls-to-action in a single viewport | Yablonski: Hick's Law | Establish hierarchy — one primary, one secondary, rest tertiary or hidden |
| Color-only status indicators | Norman: single-channel encoding | Add icon + text label to every status color |
| Auto-playing animation loops | Tufte: chartjunk; Conviction: alive not anxious | Animate once on entry, then hold still |
| Unlabeled icon-only toolbar | Norman: signifiers | Add text labels or tooltips at minimum |
| Infinite scroll with no position indicator | Norman: visibility of system status | Show scroll position, total count, or pagination |
| Generic error messages ("Something went wrong") | Cooper: goal clarity; Norman: error recovery | State what failed, why, and what the user can do about it |
| Loading skeleton that doesn't match the final layout | Norman: conceptual model | Skeletons must structurally preview the actual content layout |
| Dashboard with >6 metric cards of equal visual weight | Tufte: entry point; Yablonski: Hick's Law | Establish hierarchy — feature 1-2 primary metrics, rest secondary |
