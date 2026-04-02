import type { CSSProperties, ReactNode } from 'react'
import type { LayoutConfig } from '@pane/core'
import { LAYOUT_FILL_DEFAULTS } from '@pane/core'

interface LayoutProps {
  config: LayoutConfig
  children: ReactNode
}

export function Layout({ config, children }: LayoutProps) {
  const style = getLayoutStyle(config)
  return <div style={style}>{children}</div>
}

function getLayoutStyle(config: LayoutConfig): CSSProperties {
  const gap = config.gap ?? 'var(--pane-space-sm)'
  const defaults = LAYOUT_FILL_DEFAULTS[config.pattern] ?? LAYOUT_FILL_DEFAULTS.stack
  const fill = config.fill ?? defaults.fill
  const isStretch = fill === 'stretch'

  // Base styles shared by all patterns
  const base: CSSProperties = {
    width: '100%',
    gap,
    // Fill contract: stretch layouts expand to fill parent and constrain children
    ...(isStretch ? {
      flex: 1,
      minHeight: 0,
    } : {}),
  }

  switch (config.pattern) {
    case 'stack':
      return {
        ...base,
        display: 'flex',
        flexDirection: 'column',
      }

    case 'split': {
      const [left, right] = (config.ratio ?? '1:1').split(':').map(Number)
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `${left}fr ${right}fr`,
        // Fill contract: stretch means children fill their column
        alignItems: isStretch ? 'stretch' : 'start',
      }
    }

    case 'grid':
      if (config.autoFill && config.minWidth) {
        return {
          ...base,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${config.minWidth}, 1fr))`,
          alignItems: isStretch ? 'stretch' : 'start',
          alignContent: 'start',
        }
      }
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `repeat(${config.columns ?? 2}, 1fr)`,
        alignItems: isStretch ? 'stretch' : 'start',
        alignContent: 'start',
      }

    case 'tabs':
      return {
        ...base,
        display: 'flex',
        flexDirection: 'column',
      }

    case 'overlay':
      return {
        ...base,
        position: 'relative',
      }

    case 'flow':
      return {
        ...base,
        display: 'flex',
        flexDirection: 'row',
        overflowX: 'auto',
        alignItems: isStretch ? 'stretch' : 'start',
      }

    case 'sidebar': {
      const sw = config.sidebarWidth ?? '240px'
      const pos = config.sidebarPosition ?? 'left'
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: pos === 'left' ? `${sw} 1fr` : `1fr ${sw}`,
        alignItems: 'stretch',
      }
    }

    case 'dashboard':
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto 1fr auto',
      }

    default:
      return {
        ...base,
        display: 'flex',
        flexDirection: 'column',
      }
  }
}
