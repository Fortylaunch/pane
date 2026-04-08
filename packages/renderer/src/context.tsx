import { createContext, useContext, useSyncExternalStore, useCallback, useRef, type ReactNode } from 'react'
import type { PaneSession, PaneInput } from '@pane/core'
import { PaneRuntime } from '@pane/core'
import type { PaneTheme } from '@pane/theme'

// ── Runtime Context ──

const RuntimeContext = createContext<PaneRuntime | null>(null)
const ThemeContext = createContext<PaneTheme | null>(null)

export function usePaneRuntime(): PaneRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('usePaneRuntime must be used within <PaneProvider>')
  return runtime
}

export function usePaneTheme(): PaneTheme {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('usePaneTheme must be used within <PaneProvider>')
  return theme
}

// View Transitions API support check
function canViewTransition(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as any).startViewTransition === 'function'
  )
}

export function usePaneSession(): PaneSession {
  const runtime = usePaneRuntime()
  const transitionActive = useRef(false)
  const prevViewKey = useRef<string | undefined>(undefined)

  const subscribe = useCallback(
    (callback: () => void) => {
      return runtime.subscribe(() => {
        const next = runtime.getSession()
        const isReplace = !next.lastMutation || next.lastMutation.type === 'REPLACE_VIEW'
        // Build the same key used by AnimatePresence in PaneRenderer
        const nextKey = next.activeContext
          ? `${next.activeContext}-${next.version}`
          : 'empty'
        const keyChanged = prevViewKey.current !== undefined && prevViewKey.current !== nextKey
        prevViewKey.current = nextKey

        // Wrap full view swaps (context switch or REPLACE_VIEW) in a
        // view transition when the API is available. The callback runs
        // synchronously, so React's re-render is captured by the
        // browser's transition snapshot.
        // Only attempt view transitions when:
        // 1. The view key actually changed (not a metadata-only update)
        // 2. It's a full REPLACE_VIEW (not a partial mutation)
        // 3. The browser supports the API
        // 4. No transition is already active
        // 5. The document is visible (transitions fail in hidden tabs)
        const docVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'
        if (keyChanged && isReplace && canViewTransition() && !transitionActive.current && docVisible) {
          transitionActive.current = true
          try {
            const transition = (document as any).startViewTransition(() => {
              callback()
            })
            const clear = () => { transitionActive.current = false }
            const swallow = (err: unknown) => {
              clear()
              const name = (err as any)?.name
              // Expected errors when transition is interrupted or browser refuses
              if (name !== 'AbortError' && name !== 'InvalidStateError') {
                console.warn('[pane] view transition error:', err)
              }
            }
            transition.finished?.then(clear, swallow)
            transition.ready?.catch(swallow)
            transition.updateCallbackDone?.catch(swallow)
          } catch (err) {
            // Synchronous failure (e.g. InvalidStateError) — fall back to direct callback
            transitionActive.current = false
            callback()
          }
          return
        }

        callback()
      })
    },
    [runtime]
  )

  const getSnapshot = useCallback(
    () => runtime.getSession(),
    [runtime]
  )

  return useSyncExternalStore(subscribe, getSnapshot)
}

// ── Provider ──

interface PaneProviderProps {
  runtime: PaneRuntime
  theme: PaneTheme
  children: ReactNode
}

export function PaneProvider({ runtime, theme, children }: PaneProviderProps) {
  return (
    <RuntimeContext.Provider value={runtime}>
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </RuntimeContext.Provider>
  )
}
