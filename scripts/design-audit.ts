/**
 * Design Audit Agent
 *
 * Compares a Pane screenshot against a reference design screenshot
 * using Claude Vision, then outputs concrete token/atom/recipe patches.
 *
 * Usage:
 *   npx tsx scripts/design-audit.ts --reference <path> [--pane <path>] [--capture]
 *
 * Flags:
 *   --reference <path>   Reference design screenshot (required)
 *   --pane <path>        Pane screenshot to compare (or use --capture)
 *   --capture            Auto-capture Pane dashboard from localhost:3000
 *   --apply              Write recommended changes to a patch file
 *   --proxy <url>        Claude API proxy (default: http://localhost:3001/api/claude)
 *
 * Requires: ANTHROPIC_API_KEY in examples/dev/.env or environment
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

// ── Load env ──
try {
  const envPath = resolve(SCRIPT_DIR, '../examples/dev/.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key?.trim() && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch {}

const API_KEY = process.env.ANTHROPIC_API_KEY
const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
}
const hasFlag = (name: string) => args.includes(`--${name}`)

const referencePath = getArg('reference')
const panePath = getArg('pane')
const shouldCapture = hasFlag('capture')
const shouldApply = hasFlag('apply')
const proxyUrl = getArg('proxy') ?? 'http://localhost:3001/api/claude'

if (!referencePath) {
  console.error('Usage: npx tsx scripts/design-audit.ts --reference <screenshot.png> [--pane <screenshot.png>] [--capture]')
  process.exit(1)
}

// ── Read current theme for context ──
const themeSource = readFileSync(resolve(SCRIPT_DIR, '../packages/theme/src/index.ts'), 'utf-8')
const boxSource = readFileSync(resolve(SCRIPT_DIR, '../packages/renderer/src/atoms/Box.tsx'), 'utf-8')
const textSource = readFileSync(resolve(SCRIPT_DIR, '../packages/renderer/src/atoms/Text.tsx'), 'utf-8')
const inputSource = readFileSync(resolve(SCRIPT_DIR, '../packages/renderer/src/atoms/Input.tsx'), 'utf-8')

// ── Capture Pane screenshot if needed ──
async function capturePaneScreenshot(): Promise<string> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  await page.goto('http://localhost:3000?agent=starter')
  await page.waitForLoadState('networkidle')

  // Send message to trigger dashboard
  const input = page.locator('input[type="text"]')
  await input.fill('show me a dashboard')
  await input.press('Enter')

  try {
    await page.locator('text=Revenue').first().waitFor({ timeout: 8000 })
  } catch {}
  await page.waitForTimeout(2000) // Let map tiles load

  mkdirSync('tests/screenshots/audit', { recursive: true })
  const path = 'tests/screenshots/audit/pane-current.png'
  await page.screenshot({ path, fullPage: true })
  await browser.close()
  return path
}

function imageToBase64(path: string): { data: string; mediaType: string } {
  const buf = readFileSync(path)
  const ext = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  return { data: buf.toString('base64'), mediaType: ext }
}

// ── System prompt for the design audit agent ──
const AUDIT_PROMPT = `You are a product design auditor for Pane, a declarative UI system that renders agent-composed interfaces. Your job is to compare a reference design screenshot against Pane's current rendered output and produce SPECIFIC, ACTIONABLE design patches.

You are given:
1. A REFERENCE screenshot — this is the target quality level
2. A PANE screenshot — this is what Pane currently produces
3. Pane's current theme tokens and atom source code

## Your analysis approach

Examine the reference design with pixel-level precision across these dimensions:

**SPACING**: Measure padding, gaps, margins. Compare to Pane's current spacing tokens. Be specific: "reference cards use ~8px padding, Pane uses 12px (--pane-space-md)."

**TYPOGRAPHY**: Font families (monospace vs sans-serif for data), font sizes, weights, letter-spacing, text transforms, line heights. Note where reference uses monospace for data display vs Pane using sans-serif.

**COLOR**: Background tones, border colors, text colors, accent usage, contrast levels. Note if reference uses darker/lighter backgrounds, more/less saturated accents.

**BORDERS & RADIUS**: Border widths, styles, colors. Corner radius on cards, buttons, pills. Note if reference is sharper (2px radius) vs Pane's rounder corners.

**DENSITY**: Information per viewport area. Count how many data points are visible. Note whitespace usage — is reference tighter or more generous?

**VISUAL WEIGHT**: Shadows, hover effects, elevation. Note if reference is flatter or uses more depth. Check if reference uses box-shadows at all.

**COMPONENT PATTERNS**: How does reference handle: status indicators, pills/tabs, data labels, cards, legends, headers, toolbars, lists with checkboxes, grid layouts?

## Output format

Respond with a JSON object:

{
  "analysis": {
    "spacing": "...",
    "typography": "...",
    "color": "...",
    "borders": "...",
    "density": "...",
    "weight": "...",
    "patterns": "..."
  },
  "tokenPatches": {
    "spacing": { "xs": "...", "sm": "...", ... },
    "typography": { ... },
    "radius": { ... },
    "shadow": { ... },
    "color": { ... }
  },
  "atomPatches": [
    {
      "atom": "Box",
      "file": "Box.tsx",
      "changes": [
        { "description": "...", "current": "...", "recommended": "..." }
      ]
    }
  ],
  "newRules": [
    "Rule 1: ...",
    "Rule 2: ..."
  ],
  "systemPromptAdditions": [
    "When composing dashboards, ...",
    "..."
  ],
  "priority": [
    { "change": "...", "impact": "high|medium|low", "reason": "..." }
  ]
}

Be EXTREMELY specific. Don't say "reduce padding" — say "reduce --pane-space-md from 0.75rem to 0.5rem". Don't say "use monospace" — say "Text atom label level should use fontFamily: var(--pane-font-mono)". Reference exact CSS properties, exact pixel values, exact token names.

Current Pane theme tokens and atom code are provided below for reference.`

async function runAudit() {
  console.log('\n══════════════════════════════════════')
  console.log(' PANE DESIGN AUDIT')
  console.log('══════════════════════════════════════\n')

  // Get Pane screenshot
  let paneScreenshotPath: string
  if (panePath) {
    paneScreenshotPath = panePath
    console.log(`  Reference: ${referencePath}`)
    console.log(`  Pane:      ${paneScreenshotPath}`)
  } else if (shouldCapture) {
    console.log('  Capturing Pane dashboard screenshot...')
    paneScreenshotPath = await capturePaneScreenshot()
    console.log(`  Reference: ${referencePath}`)
    console.log(`  Pane:      ${paneScreenshotPath}`)
  } else {
    console.error('  Provide --pane <path> or --capture to auto-capture')
    process.exit(1)
  }

  const ref = imageToBase64(referencePath)
  const pane = imageToBase64(paneScreenshotPath)

  console.log('\n  Sending to Claude Vision for analysis...\n')

  const useProxy = proxyUrl.includes('localhost')
  const endpoint = useProxy ? proxyUrl : 'https://api.anthropic.com/v1/messages'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!useProxy && API_KEY) {
    headers['x-api-key'] = API_KEY
    headers['anthropic-version'] = '2023-06-01'
  }

  const start = performance.now()

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: AUDIT_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'REFERENCE DESIGN (target quality):' },
          { type: 'image', source: { type: 'base64', media_type: ref.mediaType, data: ref.data } },
          { type: 'text', text: 'PANE CURRENT OUTPUT:' },
          { type: 'image', source: { type: 'base64', media_type: pane.mediaType, data: pane.data } },
          { type: 'text', text: `CURRENT PANE THEME TOKENS:\n\`\`\`typescript\n${themeSource}\n\`\`\`\n\nCURRENT BOX ATOM:\n\`\`\`typescript\n${boxSource.substring(0, 1500)}\n\`\`\`\n\nCURRENT TEXT ATOM:\n\`\`\`typescript\n${textSource.substring(0, 800)}\n\`\`\`\n\nCURRENT INPUT ATOM (first 500 chars):\n\`\`\`typescript\n${inputSource.substring(0, 500)}\n\`\`\`\n\nAnalyze both screenshots and produce the design audit with specific, actionable patches.` },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`  API error: ${res.status} — ${err.substring(0, 200)}`)
    process.exit(1)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const dur = Math.round(performance.now() - start)

  console.log(`  Analysis complete (${dur}ms)\n`)

  // Parse the JSON response
  let audit: any
  try {
    let cleaned = text.trim()
    cleaned = cleaned.replace(/^```json?\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
    if (!cleaned.startsWith('{')) {
      const first = cleaned.indexOf('{')
      const last = cleaned.lastIndexOf('}')
      if (first !== -1 && last > first) cleaned = cleaned.substring(first, last + 1)
    }
    audit = JSON.parse(cleaned)
  } catch (e) {
    console.log('  Raw response (could not parse as JSON):\n')
    console.log(text)
    mkdirSync('tests/screenshots/audit', { recursive: true })
    writeFileSync('tests/screenshots/audit/raw-response.txt', text)
    process.exit(1)
  }

  // ── Print Report ──

  console.log('──────────────────────────────────────')
  console.log(' ANALYSIS')
  console.log('──────────────────────────────────────\n')

  if (audit.analysis) {
    for (const [dim, desc] of Object.entries(audit.analysis)) {
      console.log(`  ${dim.toUpperCase()}:`)
      console.log(`    ${String(desc).split('\n').join('\n    ')}\n`)
    }
  }

  console.log('──────────────────────────────────────')
  console.log(' TOKEN PATCHES')
  console.log('──────────────────────────────────────\n')

  if (audit.tokenPatches) {
    for (const [category, patches] of Object.entries(audit.tokenPatches)) {
      if (patches && typeof patches === 'object' && Object.keys(patches).length > 0) {
        console.log(`  ${category}:`)
        for (const [key, value] of Object.entries(patches as Record<string, string>)) {
          console.log(`    --pane-${category === 'color' ? 'color-' : category === 'spacing' ? 'space-' : category === 'radius' ? 'radius-' : ''}${key}: ${value}`)
        }
        console.log()
      }
    }
  }

  console.log('──────────────────────────────────────')
  console.log(' ATOM PATCHES')
  console.log('──────────────────────────────────────\n')

  if (audit.atomPatches) {
    for (const patch of audit.atomPatches) {
      console.log(`  ${patch.atom} (${patch.file}):`)
      for (const change of patch.changes ?? []) {
        console.log(`    • ${change.description}`)
        if (change.current) console.log(`      current:     ${change.current}`)
        if (change.recommended) console.log(`      recommended: ${change.recommended}`)
      }
      console.log()
    }
  }

  console.log('──────────────────────────────────────')
  console.log(' NEW DESIGN RULES')
  console.log('──────────────────────────────────────\n')

  if (audit.newRules) {
    for (const rule of audit.newRules) {
      console.log(`  • ${rule}`)
    }
    console.log()
  }

  console.log('──────────────────────────────────────')
  console.log(' PRIORITY')
  console.log('──────────────────────────────────────\n')

  if (audit.priority) {
    for (const p of audit.priority) {
      const icon = p.impact === 'high' ? '!!!' : p.impact === 'medium' ? ' !!' : '  !'
      console.log(`  ${icon} [${p.impact}] ${p.change}`)
      if (p.reason) console.log(`       ${p.reason}`)
    }
    console.log()
  }

  // Save full audit
  mkdirSync('tests/screenshots/audit', { recursive: true })
  const auditPath = 'tests/screenshots/audit/audit-result.json'
  writeFileSync(auditPath, JSON.stringify(audit, null, 2))
  console.log(`  Full audit saved to ${auditPath}`)

  if (shouldApply) {
    const patchPath = 'tests/screenshots/audit/design-patches.json'
    writeFileSync(patchPath, JSON.stringify({
      tokenPatches: audit.tokenPatches,
      atomPatches: audit.atomPatches,
      newRules: audit.newRules,
      systemPromptAdditions: audit.systemPromptAdditions,
    }, null, 2))
    console.log(`  Patches saved to ${patchPath}`)
  }

  console.log('\n══════════════════════════════════════\n')
}

runAudit().catch(err => {
  console.error('Design audit failed:', err)
  process.exit(1)
})
