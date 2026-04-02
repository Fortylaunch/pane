import type { CSSProperties, ReactNode } from 'react'
import type { LayoutConfig } from '@pane/core'

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

  const base: CSSProperties = {
    width: '100%',
    minHeight: 0,
    gap,
  }

  switch (config.pattern) {
    case 'stack':
      return { ...base, display: 'flex', flexDirection: 'column' }

    case 'split': {
      const [left, right] = (config.ratio ?? '1:1').split(':').map(Number)
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `${left}fr ${right}fr`,
        alignItems: 'start',
      }
    }

    case 'grid':
      if (config.autoFill && config.minWidth) {
        return {
          ...base,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${config.minWidth}, 1fr))`,
          alignItems: 'start',
        }
      }
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `repeat(${config.columns ?? 2}, 1fr)`,
        alignItems: 'start',
      }

    case 'tabs':
      return { ...base, display: 'flex', flexDirection: 'column' }

    case 'overlay':
      return { ...base, position: 'relative', flex: 1 }

    case 'flow':
      return { ...base, display: 'flex', flexDirection: 'row', overflowX: 'auto', alignItems: 'start' }

    case 'sidebar': {
      const sw = config.sidebarWidth ?? '240px'
      const pos = config.sidebarPosition ?? 'left'
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: pos === 'left' ? `${sw} 1fr` : `1fr ${sw}`,
        flex: 1,
        minHeight: 0,
        alignItems: 'stretch',
      }
    }

    case 'dashboard':
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto 1fr auto',
        flex: 1,
        minHeight: 0,
      }

    default:
      return { ...base, display: 'flex', flexDirection: 'column' }
  }
}
