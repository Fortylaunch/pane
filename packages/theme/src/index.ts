// ────────────────────────────────────────────
// @pane/theme
// Tokens + enforced rules.
// ────────────────────────────────────────────

export interface PaneColorTokens {
  background: string
  surface: string
  surfaceRaised: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentText: string
  danger: string
  success: string
  warning: string
  info: string
  overlay: string
  focusRing: string
}

export interface PaneShadowTokens {
  sm: string
  md: string
  lg: string
  none: string
}

export interface PaneBorderTokens {
  thin: string
  default: string
  thick: string
}

export interface PaneTypographyScale {
  size: string
  lineHeight: string
  weight: number
}

export interface PaneTypographyTokens {
  fontFamily: string
  fontMono: string
  scale: {
    xs: PaneTypographyScale
    sm: PaneTypographyScale
    md: PaneTypographyScale
    lg: PaneTypographyScale
    xl: PaneTypographyScale
    '2xl': PaneTypographyScale
  }
}

export interface PaneSpacingTokens {
  unit: string
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
}

export interface PaneRadiusTokens {
  sm: string
  md: string
  lg: string
  full: string
}

export interface PaneThemeRules {
  maxDensity: 'compact' | 'default' | 'spacious'
  minContrast: number
  maxActionsPerGroup: number
  maxNestingDepth: number
  requireLabels: boolean
}

export interface PaneTheme {
  name: string
  tokens: {
    color: PaneColorTokens
    typography: PaneTypographyTokens
    spacing: PaneSpacingTokens
    radius: PaneRadiusTokens
    shadow: PaneShadowTokens
    border: PaneBorderTokens
  }
  rules: PaneThemeRules
}

// ── Default Theme ──

export const defaultTheme: PaneTheme = {
  name: 'Pane Default',
  tokens: {
    color: {
      background: '#09090b',
      surface: '#18181b',
      surfaceRaised: '#27272a',
      border: '#3f3f46',
      text: '#fafafa',
      textMuted: '#a1a1aa',
      accent: '#3b82f6',
      accentText: '#ffffff',
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
      info: '#3b82f6',
      overlay: 'rgba(0, 0, 0, 0.5)',
      focusRing: 'rgba(59, 130, 246, 0.3)',
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontMono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
      scale: {
        xs:   { size: '0.75rem',  lineHeight: '1rem',    weight: 400 },
        sm:   { size: '0.875rem', lineHeight: '1.25rem', weight: 400 },
        md:   { size: '1rem',     lineHeight: '1.5rem',  weight: 400 },
        lg:   { size: '1.25rem',  lineHeight: '1.75rem', weight: 500 },
        xl:   { size: '1.5rem',   lineHeight: '2rem',    weight: 600 },
        '2xl': { size: '2rem',    lineHeight: '2.5rem',  weight: 700 },
      },
    },
    spacing: {
      unit: '0.25rem',
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    radius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem',
      full: '9999px',
    },
    shadow: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
      md: '0 2px 8px rgba(0, 0, 0, 0.15)',
      lg: '0 8px 24px rgba(0, 0, 0, 0.2)',
      none: 'none',
    },
    border: {
      thin: '1px',
      default: '2px',
      thick: '3px',
    },
  },
  rules: {
    maxDensity: 'default',
    minContrast: 4.5,
    maxActionsPerGroup: 5,
    maxNestingDepth: 6,
    requireLabels: true,
  },
}

// ── Theme Factory ──

export function createTheme(overrides: DeepPartial<PaneTheme>): PaneTheme {
  return deepMerge(defaultTheme, overrides) as PaneTheme
}

// ── CSS Custom Properties ──

export function themeToCssVars(theme: PaneTheme): Record<string, string> {
  const vars: Record<string, string> = {}

  // Colors
  for (const [key, value] of Object.entries(theme.tokens.color)) {
    vars[`--pane-color-${kebab(key)}`] = value
  }

  // Typography
  vars['--pane-font-family'] = theme.tokens.typography.fontFamily
  vars['--pane-font-mono'] = theme.tokens.typography.fontMono
  for (const [key, scale] of Object.entries(theme.tokens.typography.scale)) {
    vars[`--pane-text-${key}-size`] = scale.size
    vars[`--pane-text-${key}-line`] = scale.lineHeight
    vars[`--pane-text-${key}-weight`] = String(scale.weight)
  }

  // Spacing
  for (const [key, value] of Object.entries(theme.tokens.spacing)) {
    vars[`--pane-space-${key}`] = value
  }

  // Radius
  for (const [key, value] of Object.entries(theme.tokens.radius)) {
    vars[`--pane-radius-${key}`] = value
  }

  // Shadows
  for (const [key, value] of Object.entries(theme.tokens.shadow)) {
    vars[`--pane-shadow-${key}`] = value
  }

  // Border widths
  for (const [key, value] of Object.entries(theme.tokens.border)) {
    vars[`--pane-border-${key}`] = value
  }

  return vars
}

export function themeToStyleString(theme: PaneTheme): string {
  const vars = themeToCssVars(theme)
  return Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n')
}

// ── Enforcement ──

export { enforceTheme } from './enforce.js'

// ── Helpers ──

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] }

function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] ?? {}, source[key])
    } else if (source[key] !== undefined) {
      result[key] = source[key]
    }
  }
  return result
}

function kebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
