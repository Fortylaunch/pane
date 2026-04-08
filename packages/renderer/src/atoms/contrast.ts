/**
 * Shared contrast enforcement utility.
 * Detects if a CSS color string is "light" (would need dark text for contrast).
 */

import type { CSSProperties } from 'react'

const LIGHT_NAMED_COLORS = new Set([
  'white', 'snow', 'ivory', 'beige', 'linen', 'oldlace', 'lightyellow',
  'lightcyan', 'azure', 'mintcream', 'honeydew', 'ghostwhite', 'aliceblue',
  'lavenderblush', 'seashell', 'floralwhite', 'whitesmoke', 'lavender',
  'lightgoldenrodyellow', 'cornsilk', 'lemonchiffon', 'lightgray', 'lightgrey',
  'gainsboro', 'mistyrose', 'antiquewhite', 'papayawhip', 'blanchedalmond',
  'bisque', 'peachpuff', 'navajowhite', 'moccasin', 'wheat', 'pink',
  'lightpink', 'lightsalmon', 'lightyellow',
])

export function isLightColor(color: string): boolean {
  if (!color) return false
  // Skip CSS variables — they're from our dark theme
  if (color.startsWith('var(')) return false
  if (color === 'transparent' || color === 'inherit') return false

  // Skip translucent rgba backgrounds (glass effects, overlays)
  const alphaMatch = color.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/)
  if (alphaMatch && parseFloat(alphaMatch[1]) <= 0.5) return false

  // Parse hex
  let hex = color
  if (hex.startsWith('#')) {
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Parse rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Named colors that are light
  return LIGHT_NAMED_COLORS.has(color.toLowerCase())
}

/** Dark text color used when enforcing contrast against light backgrounds */
export const DARK_TEXT = '#18181b'

/**
 * Given a style object, detect if background/backgroundColor is light
 * and return an overridden color if needed. Returns undefined if no override needed.
 */
export function getContrastTextColor(
  style?: CSSProperties
): string | undefined {
  if (!style) return undefined
  const bg = style.background as string | undefined ?? style.backgroundColor as string | undefined
  if (bg && isLightColor(bg)) return DARK_TEXT
  return undefined
}
