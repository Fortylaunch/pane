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
  const base: CSSProperties = {
    width: '100%',
    gap: config.gap ?? 'var(--pane-space-sm)',
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
      }
    }

    case 'grid':
      if (config.autoFill && config.minWidth) {
        return {
          ...base,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${config.minWidth}, 1fr))`,
        }
      }
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: `repeat(${config.columns ?? 2}, 1fr)`,
      }

    case 'tabs':
      // Tabs render only the active tab — handled by TabLayout
      return { ...base, display: 'flex', flexDirection: 'column' }

    case 'overlay':
      return { ...base, position: 'relative' }

    case 'flow':
      return { ...base, display: 'flex', flexDirection: 'row', overflowX: 'auto' }

    case 'sidebar': {
      const sw = config.sidebarWidth ?? '280px'
      const pos = config.sidebarPosition ?? 'left'
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: pos === 'left' ? `${sw} 1fr` : `1fr ${sw}`,
        height: '100%',
      }
    }

    case 'dashboard':
      return {
        ...base,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto 1fr auto',
        height: '100%',
      }

    default:
      return { ...base, display: 'flex', flexDirection: 'column' }
  }
}
