import { useRef, useCallback } from 'react'

/**
 * Progressive enhancement hook for the View Transitions API.
 * Wraps a state-updating callback so that, when the API is available,
 * the DOM update happens inside `document.startViewTransition()`.
 * Falls back to a direct call when unsupported or when a transition
 * is already running.
 */

type ViewTransitionSupported = {
  startViewTransition: (cb: () => void) => { finished: Promise<void> }
}

function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as unknown as ViewTransitionSupported).startViewTransition === 'function'
  )
}

/**
 * Returns a function that wraps the provided callback in a view transition.
 *
 * Usage:
 * ```ts
 * const withTransition = useViewTransition()
 * // later, when you want a view-transition-wrapped update:
 * withTransition(() => setState(newValue))
 * ```
 */
export function useViewTransition() {
  const activeRef = useRef(false)

  const withTransition = useCallback((updateFn: () => void) => {
    // No API support or transition already running — just update directly
    if (!supportsViewTransitions() || activeRef.current) {
      updateFn()
      return
    }

    activeRef.current = true
    const doc = document as unknown as ViewTransitionSupported
    const transition = doc.startViewTransition(() => {
      updateFn()
    })
    transition.finished.then(
      () => { activeRef.current = false },
      () => { activeRef.current = false },
    )
  }, [])

  return withTransition
}

/**
 * Standalone check — useful for conditionally skipping Framer Motion
 * animations when a view transition is handling the crossfade.
 */
export function viewTransitionsSupported(): boolean {
  return supportsViewTransitions()
}
