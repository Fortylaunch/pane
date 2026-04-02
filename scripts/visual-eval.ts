/**
 * Visual Eval — captures screenshots, runs 6D evals, multi-viewport, and a11y checks.
 *
 * Run: npx tsx scripts/visual-eval.ts
 * Flags:
 *   --a11y    Enable axe-core accessibility checks (requires @axe-core/playwright)
 *
 * Requires: Vite dev server running on port 3000 with ?agent=starter
 */

import { chromium, type Page } from 'playwright'
import { mkdirSync } from 'fs'
import { runEval, formatEvalResult, type EvalContext, type EvalResult, type PaneSession } from '@pane/core'

const BASE = 'http://localhost:3000?agent=starter'
const SCREENSHOT_DIR = 'tests/screenshots/eval'
const ENABLE_A11Y = process.argv.includes('--a11y')

interface ViewportConfig {
  name: string
  width: number
  height: number
}

const VIEWPORTS: ViewportConfig[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'narrow',  width: 400,  height: 800 },
]

interface VisualEvalResult {
  view: string
  viewport: string
  screenshot: string
  errors: string[]
  warnings: string[]
  panelCount: number
  hasContent: boolean
  hasInput: boolean
  loadTimeMs: number
  evalResult?: EvalResult
  a11yViolations?: number
}

const views = [
  { name: 'empty-state',    input: null,                      expect: 'Pane' },
  { name: 'first-response', input: 'hello',                   expect: 'Welcome to Pane' },
  { name: 'dashboard',      input: 'show me a dashboard',     expect: 'Revenue' },
  { name: 'editor',         input: 'let me write something',  expect: 'Compose' },
  { name: 'capabilities',   input: 'show me what you can do', expect: '12 Atoms' },
  { name: 'action-demo',    input: 'trigger an action',       expect: 'action' },
]

async function sendMessage(page: Page, text: string, expectText: string): Promise<boolean> {
  const input = page.locator('input[type="text"]').last()
  await input.fill(text)
  await input.press('Enter')
  try {
    await page.locator(`text=${expectText}`).first().waitFor({ timeout: 8000 })
    return true
  } catch {
    return false
  }
}

/**
 * Extract session from browser and run full 6D eval in Node.
 */
async function extractAndEval(page: Page): Promise<EvalResult | null> {
  try {
    // Serialize session out of the browser
    const session: PaneSession | null = await page.evaluate(() => {
      const runtime = (window as any).__paneRuntime
      if (!runtime || typeof runtime.getSession !== 'function') return null
      // getSession() returns a plain object — safe to serialize
      return JSON.parse(JSON.stringify(runtime.getSession()))
    })

    if (!session || !session.contexts || session.contexts.length === 0) return null

    // Run the full 6D eval in Node
    const ctx: EvalContext = { session }
    return runEval(ctx)
  } catch {
    return null
  }
}

async function runA11yCheck(page: Page): Promise<number> {
  if (!ENABLE_A11Y) return 0
  try {
    const AxeBuilder = (await import('@axe-core/playwright')).default
    const results = await new AxeBuilder({ page }).analyze()
    return results.violations.length
  } catch {
    console.warn('  a11y check skipped (install @axe-core/playwright to enable)')
    return 0
  }
}

async function evalViewport(viewport: ViewportConfig, results: VisualEvalResult[]) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', err => pageErrors.push(err.message))

  await page.goto(BASE)

  for (const view of views) {
    const startTime = Date.now()
    const viewErrors: string[] = []

    if (view.input) {
      const found = await sendMessage(page, view.input, view.expect)
      if (!found) viewErrors.push(`Expected text "${view.expect}" not found after 8s`)
    }

    const loadTime = Date.now() - startTime

    // Screenshot
    const screenshotPath = `${SCREENSHOT_DIR}/${view.name}-${viewport.name}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })

    // Panel count
    const panelCount = await page.locator('[data-pane-panel]').count().catch(() => 0)

    // Content checks
    const bodyText = await page.locator('body').innerText()
    const hasContent = bodyText.length > 50
    const hasInput = (await page.locator('input[type="text"]').count()) > 0

    // Console errors
    const newErrors = pageErrors.splice(0)
    viewErrors.push(...newErrors)

    // Heuristic warnings
    const warnings: string[] = []
    const contentHeight = await page.evaluate(() => document.body.scrollHeight)

    if (contentHeight < 200 && view.input) {
      warnings.push('Very little content rendered — page looks empty')
    }

    const textElements = await page.locator('p, h2, h3, span').count()
    if (textElements === 0 && view.input) {
      warnings.push('No text elements found after input — rendering may be broken')
    }

    // Viewport-specific: excessive scroll on narrow
    if (viewport.name === 'narrow' && contentHeight > viewport.height * 3 && view.input) {
      warnings.push(`Excessive scroll on narrow viewport (${contentHeight}px content in ${viewport.height}px viewport)`)
    }

    // 6D eval — run on desktop viewport only (avoids redundant eval runs)
    let evalResult: EvalResult | undefined
    if (viewport.name === 'desktop') {
      const result = await extractAndEval(page)
      if (result) {
        evalResult = result
        // Surface eval failures/warnings as visual-eval warnings
        for (const finding of result.findings) {
          if (finding.grade === 'fail') {
            viewErrors.push(`[${finding.dimension}] ${finding.message}`)
          } else if (finding.grade === 'warn') {
            warnings.push(`[${finding.dimension}] ${finding.message}`)
          }
        }
      }
    }

    // Accessibility
    const a11yViolations = await runA11yCheck(page)
    if (a11yViolations > 0) {
      warnings.push(`${a11yViolations} accessibility violation(s) found`)
    }

    results.push({
      view: view.name,
      viewport: viewport.name,
      screenshot: screenshotPath,
      errors: viewErrors,
      warnings,
      panelCount,
      hasContent,
      hasInput,
      loadTimeMs: loadTime,
      evalResult,
      a11yViolations: ENABLE_A11Y ? a11yViolations : undefined,
    })
  }

  await browser.close()
}

async function run() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const results: VisualEvalResult[] = []

  // Run all viewports
  for (const viewport of VIEWPORTS) {
    await evalViewport(viewport, results)
  }

  // ── Report ──

  console.log('\n═══════════════════════════════════════')
  console.log(' PANE VISUAL EVAL')
  console.log('═══════════════════════════════════════\n')

  let totalErrors = 0
  let totalWarnings = 0

  // Group by viewport
  for (const viewport of VIEWPORTS) {
    const vpResults = results.filter(r => r.viewport === viewport.name)
    console.log(`  ── ${viewport.name} (${viewport.width}×${viewport.height}) ──\n`)

    for (const result of vpResults) {
      const grade = result.errors.length > 0 ? 'FAIL' : result.warnings.length > 0 ? 'WARN' : 'PASS'
      const icon = grade === 'PASS' ? '✓' : grade === 'WARN' ? '!' : '✗'

      console.log(`  ${icon} ${result.view}`)
      console.log(`    Screenshot: ${result.screenshot}`)
      console.log(`    Load: ${result.loadTimeMs}ms | Content: ${result.hasContent} | Input: ${result.hasInput}`)

      // 6D eval summary
      if (result.evalResult) {
        const er = result.evalResult
        console.log(`    6D Eval: ${er.overallGrade.toUpperCase()} (${er.duration}ms)`)
        for (const [dim, score] of Object.entries(er.dimensions)) {
          const di = score.grade === 'pass' ? '✓' : score.grade === 'warn' ? '!' : '✗'
          console.log(`      ${di} ${dim}: ${score.score} [${score.findingCount.pass}p ${score.findingCount.warn}w ${score.findingCount.fail}f]`)
        }
      }

      if (result.a11yViolations !== undefined) {
        console.log(`    A11y: ${result.a11yViolations === 0 ? '✓ no violations' : `${result.a11yViolations} violation(s)`}`)
      }

      for (const err of result.errors) {
        console.log(`    ✗ ERROR: ${err}`)
        totalErrors++
      }
      for (const warn of result.warnings) {
        console.log(`    ! WARN: ${warn}`)
        totalWarnings++
      }
      console.log()
    }
  }

  console.log('───────────────────────────────────────')
  console.log(`  ${VIEWPORTS.length} viewports | ${views.length} views | ${results.length} total checks`)
  console.log(`  ${totalErrors} errors | ${totalWarnings} warnings`)
  console.log(`  Screenshots saved to ${SCREENSHOT_DIR}/`)
  console.log('═══════════════════════════════════════\n')

  process.exit(totalErrors > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Visual eval failed:', err)
  process.exit(1)
})
