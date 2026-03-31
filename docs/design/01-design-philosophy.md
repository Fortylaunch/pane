# The Pane Design Intelligence

## A Composite Design Philosophy for Agent-Composed Interfaces

---

## Identity

This document defines the design intelligence that governs how Pane's surface is composed. It is not a style guide. It is not a component library. It is a set of convictions about what makes an interface legible, useful, and worthy of a person's attention — applied to a system where interfaces are generated, not hand-crafted.

The intelligence draws from six minds:

**Edward Tufte** — the conviction that every pixel of ink must earn its place. Information density is not clutter; decoration is. The surface should maximize the data-ink ratio: show the data, remove everything else. Small multiples over dashboards. Micro/macro readings that reward both the glance and the study. Respect the viewer's intelligence.

**Alan Cooper** — the discipline of designing for goals, not features. Every view Pane composes exists because a human has an intent. The surface must serve that intent with the minimum viable interaction. No interface for the sake of interface. Goal-directed design means asking "what is this person trying to accomplish right now?" before placing a single atom on the surface.

**Jony Ive** — the pursuit of inevitability. The best interface feels like it could not have been any other way. Restraint is not minimalism for its own sake — it is the refusal to add anything that doesn't make the thing fundamentally better. Material honesty: the atoms should feel like what they are. A box is a box. An input is an input. No skeuomorphism, no false affordances, no theatrics.

**Don Norman** — the insistence that usability is not negotiable. Every element must have a clear affordance. Every action must produce visible feedback. Every state must be discoverable. The conceptual model the user builds in their head must match what the system actually does. When the surface shifts modalities, the user must never feel lost. Signifiers over mysteries.

**Jon Yablonski** — the application of psychological law to interface decisions. Hick's Law governs how many choices we present. Fitts's Law governs where we place targets. Miller's Law governs how we chunk information. Jakob's Law reminds us that people spend most of their time in other interfaces and bring those expectations here. The aesthetic-usability effect means that visual harmony isn't cosmetic — it directly affects perceived usability.

**Jeremy Van Cleef** — the strategic eye that connects design to real-world performance. Every view must work in context, not just in a screenshot. The surface exists inside a workflow, inside a day, inside a job. Product experience means the whole arc — from the moment intent forms to the moment the task is done. Elevate the experience, don't just render the data. Think about what the person walks away with.

---

## Core Convictions

### 1. The Surface Serves Intent, Not Structure

There are no pages. There are no predetermined layouts. The surface exists to serve whatever the human needs right now. When an agent composes a view, it is answering one question: "What does this person need to see and do in this moment?"

This means every composition starts from intent, not from a template. A metrics view is not a "dashboard" — it is the answer to "how are we doing?" A form is not a "page" — it is the answer to "I need to provide this information." The shape of the view follows the shape of the need.

### 2. Information Density Is a Virtue; Clutter Is a Sin

Tufte's most important insight: the enemy is not complexity, it is noise. A dense, well-organized view that shows everything relevant at a glance is superior to a sparse view that forces the user to click, scroll, or navigate to find what they need.

Every atom placed on the surface must carry information or enable action. Decorative elements are permitted only when they improve legibility (whitespace as structure, dividers as grouping, color as encoding). If an element's removal would not reduce the user's understanding or capability, it should not exist.

### 3. Clarity Before Aesthetics, But Aesthetics Serve Clarity

A beautiful interface that confuses is a failure. An ugly interface that works is also a failure — because perceived usability degrades with poor aesthetics (Yablonski's aesthetic-usability effect). The goal is the intersection: views that are visually harmonious because their visual choices encode meaning.

Color is not decoration — it is data encoding and state signaling. Typography is not styling — it is hierarchy and scanability. Spacing is not cosmetic — it is grouping and separation (Gestalt proximity). Every visual choice must be defensible in functional terms.

### 4. The User's Mental Model Is Sacred

When the surface shifts between modalities — from conversational to informational to transactional — the user must never lose their sense of where they are, what they were doing, or what just happened. Transitions must preserve context. Norman's gulf of evaluation (can I tell what happened?) and gulf of execution (can I tell what to do?) must remain bridged at all times.

This means: persistent orientation cues. Clear state indication. Visible history. Reversible actions where possible. The system should feel like a workspace that rearranges itself, not a series of disconnected screens that replace each other.

### 5. Every Interaction Has a Cost — Minimize It

Cooper's principle: the best interface is no interface. Every click, every decision point, every moment of confusion is a cost to the user. Pane's advantage is that agents can absorb complexity — they can compose, filter, prioritize, and pre-select. The surface should present the result of intelligent work, not dump raw possibilities on the human and ask them to sort it out.

Hick's Law in practice: fewer choices, better defaults, progressive disclosure only when needed. Fitts's Law in practice: primary actions are large and close; destructive actions are small and distant. Miller's Law in practice: no more than 5-7 items in a group before chunking or progressive disclosure is needed, and within those groups, sub-clusters of 2-4 related items.

### 6. Traceability Is Not Optional

Every element the user sees should be traceable — which agent produced it, when, from what data, with what confidence. This is not just an engineering concern; it is a design concern. Trust requires transparency. The user must be able to interrogate any piece of the surface and understand its provenance.

This does not mean drowning the user in metadata. It means: traceability is available on demand, one gesture away, never hidden, never requiring special mode.

### 7. The System Must Feel Alive Without Feeling Anxious

Animation and motion serve exactly two purposes: conveying state change and maintaining spatial continuity. A panel that slides in tells the user "this is new and it came from over there." A number that counts up tells the user "this is changing." An element that fades out tells the user "this is going away."

Motion that serves no informational purpose — loading spinners that entertain, hover effects that dazzle, transitions that show off — violates the principle that every pixel earns its place. The surface should feel responsive and fluid without feeling performative.

### 8. Design for the Whole Arc, Not the Single Frame

Van Cleef's strategic lens: a view is not a static composition. It exists in time. The user arrived here from somewhere, will do something here, and will leave for somewhere else. The view must support that arc — providing context about what preceded it, clarity about what to do now, and orientation toward what comes next.

This means: agent-composed views should be aware of session history, current task state, and likely next actions. A transactional view that appears mid-composition should acknowledge the composition it interrupted. A metrics view that follows a deployment should emphasize the metrics most relevant to that deployment.

---

## The Six-Voice Test

When evaluating any composed view, ask:

**Tufte would ask:** Is every mark on this surface carrying data? Could I remove anything without losing information? Is the data-ink ratio as high as it can be?

**Cooper would ask:** Does this view serve the user's goal? Is there unnecessary interaction standing between the person and their objective? Could the agent have resolved more of this before showing it to the human?

**Ive would ask:** Does this feel inevitable? Is there anything here that exists because it was easy to add rather than necessary to include? Does the composition have the quiet confidence of something that couldn't be simpler?

**Norman would ask:** Can the user tell what to do? Can they tell what happened? Are the affordances clear? Are the signifiers visible? Will the conceptual model in their head match what the system does?

**Yablonski would ask:** Are we respecting cognitive load? Are choices grouped and limited appropriately? Are targets sized and placed for the motor reality of human hands and eyes? Does the visual quality support perceived usability?

**Van Cleef would ask:** Does this work in context — not just as a screenshot but as a moment in someone's workflow? Does the person walk away from this interaction better off? Does the experience perform in the real world?

A view that satisfies all six passes is a view worth rendering.
