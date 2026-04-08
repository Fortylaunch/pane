import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { getContrastTextColor } from './contrast.js'

type TextLevel = 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'code'

interface TextProps {
  // unknown — Claude sometimes sends numbers, booleans, arrays, or objects.
  // Defensive coercion in the body normalizes to a string.
  content: unknown
  level?: TextLevel
  style?: CSSProperties
  className?: string
  [key: string]: unknown
}

const LEVEL_STYLES: Record<TextLevel, CSSProperties> = {
  heading: {
    fontSize: 'var(--pane-text-lg-size)',
    lineHeight: 'var(--pane-text-lg-line)',
    fontWeight: 600,
    color: 'var(--pane-color-text)',
    fontFamily: 'var(--pane-font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  subheading: {
    fontSize: 'var(--pane-text-md-size)',
    lineHeight: 'var(--pane-text-md-line)',
    fontWeight: 500,
    color: 'var(--pane-color-text)',
    fontFamily: 'var(--pane-font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  body: {
    fontSize: 'var(--pane-text-md-size)',
    lineHeight: '1.5',
    fontWeight: 400,
    color: 'var(--pane-color-text)',
  },
  label: {
    fontSize: 'var(--pane-text-xs-size)',
    lineHeight: 'var(--pane-text-xs-line)',
    fontWeight: 500,
    color: 'var(--pane-color-text)',
    fontFamily: 'var(--pane-font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  caption: {
    fontSize: 'var(--pane-text-xs-size)',
    lineHeight: 'var(--pane-text-xs-line)',
    fontWeight: 400,
    color: 'var(--pane-color-text-muted)',
    fontFamily: 'var(--pane-font-mono)',
    letterSpacing: '0.04em',
  },
  code: {
    fontSize: 'var(--pane-text-xs-size)',
    lineHeight: 'var(--pane-text-xs-line)',
    fontWeight: 500,
    fontFamily: 'var(--pane-font-mono)',
    color: 'var(--pane-color-text)',
    background: 'var(--pane-color-surface-raised)',
    padding: '1px 4px',
    borderRadius: '0px',
    display: 'inline',
  },
}

export function Text({ content, level = 'body', style, className }: TextProps) {
  const Tag = level === 'heading' ? 'h2' : level === 'subheading' ? 'h3' : 'p'

  // Contrast enforcement: if a light background is set on this Text, force dark text
  const contrastColor = getContrastTextColor(style)

  // Defensive coercion — Claude sometimes sends numbers, booleans, or arrays
  // as content. The atom should never crash on type mismatch.
  let safeContent: string
  if (content == null) {
    safeContent = ''
  } else if (typeof content === 'string') {
    safeContent = content
  } else if (Array.isArray(content)) {
    safeContent = content.map(c => String(c)).join('\n')
  } else if (typeof content === 'object') {
    safeContent = JSON.stringify(content)
  } else {
    safeContent = String(content)
  }

  // Support newlines in content
  const parts = safeContent.split('\n')

  return (
    <motion.div layout>
      <Tag style={{ margin: 0, whiteSpace: 'pre-wrap', ...LEVEL_STYLES[level], ...style, ...(contrastColor ? { color: contrastColor } : {}) }} className={className}>
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
