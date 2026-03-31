import type { CSSProperties } from 'react'
import { motion } from 'motion/react'

type TextLevel = 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'code'

interface TextProps {
  content: string
  level?: TextLevel
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const LEVEL_STYLES: Record<TextLevel, CSSProperties> = {
  heading: {
    fontSize: 'var(--pane-text-xl-size)',
    lineHeight: 'var(--pane-text-xl-line)',
    fontWeight: 600,
    color: 'var(--pane-color-text)',
    letterSpacing: '-0.02em',
  },
  subheading: {
    fontSize: 'var(--pane-text-lg-size)',
    lineHeight: 'var(--pane-text-lg-line)',
    fontWeight: 500,
    color: 'var(--pane-color-text)',
    letterSpacing: '-0.01em',
  },
  body: {
    fontSize: 'var(--pane-text-md-size)',
    lineHeight: '1.65',
    fontWeight: 400,
    color: 'var(--pane-color-text)',
  },
  label: {
    fontSize: 'var(--pane-text-xs-size)',
    lineHeight: 'var(--pane-text-xs-line)',
    fontWeight: 600,
    color: 'var(--pane-color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  caption: {
    fontSize: 'var(--pane-text-xs-size)',
    lineHeight: 'var(--pane-text-xs-line)',
    fontWeight: 400,
    color: 'var(--pane-color-text-muted)',
  },
  code: {
    fontSize: 'var(--pane-text-sm-size)',
    lineHeight: 'var(--pane-text-sm-line)',
    fontWeight: 400,
    fontFamily: 'var(--pane-font-mono)',
    color: 'var(--pane-color-accent)',
    background: 'rgba(59, 130, 246, 0.08)',
    padding: '2px 6px',
    borderRadius: 'var(--pane-radius-sm)',
    display: 'inline',
  },
}

export function Text({ content, level = 'body', style, className }: TextProps) {
  const Tag = level === 'heading' ? 'h2' : level === 'subheading' ? 'h3' : 'p'

  // Support newlines in content
  const parts = content.split('\n')

  return (
    <motion.div layout>
      <Tag style={{ margin: 0, whiteSpace: 'pre-wrap', ...LEVEL_STYLES[level], ...style }} className={className}>
        {parts.map((line, i) => (
          <span key={i}>
            {line}
            {i < parts.length - 1 && <br />}
          </span>
        ))}
      </Tag>
    </motion.div>
  )
}
