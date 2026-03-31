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
    gap: config.gap ?? 'var(--pane-space-md)',
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

    default:
      return { ...base, display: 'flex', flexDirection: 'column' }
  }
}
