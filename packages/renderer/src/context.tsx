import { createContext, useContext, useSyncExternalStore, useCallback, type ReactNode } from 'react'
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

export function usePaneSession(): PaneSession {
  const runtime = usePaneRuntime()

  const subscribe = useCallback(
    (callback: () => void) => runtime.subscribe(callback),
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
