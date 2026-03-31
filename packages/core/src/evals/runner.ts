// ────────────────────────────────────────────
// Eval Runner
//
// Runs all 5 dimensions against an EvalContext
// and produces a scored result.
// ────────────────────────────────────────────

import type { EvalContext, EvalResult, EvalFinding, EvalDimension, DimensionScore, EvalGrade } from './types.js'
import { evalSpecQuality } from './spec-quality.js'
import { evalModalityFit } from './modality-fit.js'
import { evalVisualOutcome } from './visual-outcome.js'
import { evalInteractionQuality } from './interaction-quality.js'
import { evalTraceability } from './traceability.js'
import { evalDesignQuality } from './design-quality.js'

const ALL_DIMENSIONS: EvalDimension[] = [
  'spec-quality',
  'modality-fit',
  'visual-outcome',
  'interaction-quality',
  'traceability',
  'design-quality',
]

export function runEval(ctx: EvalContext): EvalResult {
  const start = performance.now()

  const findings: EvalFinding[] = [
    ...evalSpecQuality(ctx),
    ...evalModalityFit(ctx),
    ...evalVisualOutcome(ctx),
    ...evalInteractionQuality(ctx),
    ...evalTraceability(ctx),
    ...evalDesignQuality(ctx),
  ]

  const dimensions = {} as Record<EvalDimension, DimensionScore>
  for (const dim of ALL_DIMENSIONS) {
    dimensions[dim] = scoreDimension(dim, findings)
  }

  const overallGrade = computeOverallGrade(dimensions)

  return {
    timestamp: Date.now(),
    duration: Math.round(performance.now() - start),
    dimensions,
    findings,
    overallGrade,
  }
}

function scoreDimension(dimension: EvalDimension, findings: EvalFinding[]): DimensionScore {
  const dimFindings = findings.filter(f => f.dimension === dimension)
  const counts = { pass: 0, warn: 0, fail: 0 }

  for (const f of dimFindings) {
    counts[f.grade]++
  }

  const total = counts.pass + counts.warn + counts.fail
  if (total === 0) {
    return { grade: 'pass', score: 1, findingCount: counts }
  }

  // Score: pass=1, warn=0.5, fail=0
  const score = (counts.pass * 1 + counts.warn * 0.5) / total
  const grade: EvalGrade = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass'

  return { grade, score: Math.round(score * 100) / 100, findingCount: counts }
}

function computeOverallGrade(dimensions: Record<EvalDimension, DimensionScore>): EvalGrade {
  const scores = Object.values(dimensions)
  if (scores.some(s => s.grade === 'fail')) return 'fail'
  if (scores.some(s => s.grade === 'warn')) return 'warn'
  return 'pass'
}

// ── Formatting ──

export function formatEvalResult(result: EvalResult): string {
  const lines: string[] = []

  lines.push(`\n── Pane Eval ── ${result.overallGrade.toUpperCase()} ── ${result.duration}ms ──\n`)

  for (const dim of ALL_DIMENSIONS) {
    const score = result.dimensions[dim]
    const icon = score.grade === 'pass' ? 'PASS' : score.grade === 'warn' ? 'WARN' : 'FAIL'
    lines.push(`  ${icon}  ${dim} (${score.score})  [${score.findingCount.pass}p ${score.findingCount.warn}w ${score.findingCount.fail}f]`)
  }

  lines.push('')

  const issues = result.findings.filter(f => f.grade !== 'pass')
  if (issues.length > 0) {
    lines.push('  Issues:')
    for (const f of issues) {
      const icon = f.grade === 'warn' ? '  !' : '  X'
      lines.push(`${icon} [${f.dimension}] ${f.message}`)
      if (f.suggestion) {
        lines.push(`      -> ${f.suggestion}`)
      }
    }
  } else {
    lines.push('  No issues found.')
  }

  lines.push('')
  return lines.join('\n')
}
