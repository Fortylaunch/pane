/**
 * Visual Eval — captures screenshots of each view and reports quality.
 *
 * Run: npx tsx scripts/visual-eval.ts
 *
 * Requires: Vite dev server running on port 3000 with ?agent=starter
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:3000?agent=starter'
const SCREENSHOT_DIR = 'tests/screenshots/eval'

interface VisualEvalResult {
  view: string
  screenshot: string
  errors: string[]
  warnings: string[]
  panelCount: number
  hasContent: boolean
  hasInput: boolean
  loadTimeMs: number
}

async function run() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })

  const results: VisualEvalResult[] = []

  // ── Test each view ──

  const views = [
    { name: 'empty-state', input: null, expect: 'Pane' },
    { name: 'first-response', input: 'hello', expect: 'Welcome to Pane' },
    { name: 'dashboard', input: 'show me a dashboard', expect: 'Revenue' },
    { name: 'editor', input: 'let me write something', expect: 'Compose' },
    { name: 'capabilities', input: 'show me what you can do', expect: '8 Atoms' },
    { name: 'action-demo', input: 'trigger an action', expect: 'action' },
  ]

  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', err => pageErrors.push(err.message))

  await page.goto(BASE)

  for (const view of views) {
    const startTime = Date.now()
    const viewErrors: string[] = []

    if (view.input) {
      // Find the input — placeholder changes after first message
      const input = page.locator('input[type="text"]').last()
      await input.fill(view.input)
      await input.press('Enter')

      try {
        await page.locator(`text=${view.expect}`).first().waitFor({ timeout: 8000 })
      } catch {
        viewErrors.push(`Expected text "${view.expect}" not found after 8s`)
      }
    }

    const loadTime = Date.now() - startTime

    // Capture screenshot
    const screenshotPath = `${SCREENSHOT_DIR}/${view.name}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })

    // Count rendered panels
    const panelCount = await page.locator('[data-pane-panel]').count().catch(() => 0)

    // Check for content
    const bodyText = await page.locator('body').innerText()
    const hasContent = bodyText.length > 50
    const hasInput = (await page.locator('input[type="text"]').count()) > 0

    // Check for React errors since last view
    const newErrors = pageErrors.splice(0)
    viewErrors.push(...newErrors)

    // Visual checks
    const warnings: string[] = []

    // Check if the page is mostly empty (no visible content)
    const viewportHeight = 800
    const contentHeight = await page.evaluate(() => document.body.scrollHeight)
    if (contentHeight < 200 && view.input) {
      warnings.push('Very little content rendered — page looks empty')
    }

    // Check for overlapping text (crude heuristic)
    const textElements = await page.locator('p, h2, h3, span').count()
    if (textElements === 0 && view.input) {
      warnings.push('No text elements found after input — rendering may be broken')
    }

    results.push({
      view: view.name,
      screenshot: screenshotPath,
      errors: viewErrors,
      warnings,
      panelCount,
      hasContent,
      hasInput,
      loadTimeMs: loadTime,
    })
  }

  await browser.close()

  // ── Report ──

  console.log('\n═══════════════════════════════════════')
  console.log(' PANE VISUAL EVAL')
  console.log('═══════════════════════════════════════\n')

  let totalErrors = 0
  let totalWarnings = 0

  for (const result of results) {
    const grade = result.errors.length > 0 ? 'FAIL' : result.warnings.length > 0 ? 'WARN' : 'PASS'
    const icon = grade === 'PASS' ? '✓' : grade === 'WARN' ? '!' : '✗'

    console.log(`  ${icon} ${result.view}`)
    console.log(`    Screenshot: ${result.screenshot}`)
    console.log(`    Load: ${result.loadTimeMs}ms | Content: ${result.hasContent} | Input: ${result.hasInput}`)

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

  console.log('───────────────────────────────────────')
  console.log(`  ${results.length} views | ${totalErrors} errors | ${totalWarnings} warnings`)
  console.log(`  Screenshots saved to ${SCREENSHOT_DIR}/`)
  console.log('═══════════════════════════════════════\n')

  process.exit(totalErrors > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Visual eval failed:', err)
  process.exit(1)
})
