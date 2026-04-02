import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000?agent=starter'

// Helper: send a message, wait for response, then wait for animations
async function sendMessage(page: any, text: string, expectText: string) {
  const input = page.locator('input[type="text"]')
  await input.fill(text)
  await input.press('Enter')
  await expect(page.locator(`text=${expectText}`).first()).toBeVisible({ timeout: 8000 })
  // Wait for animations to settle
  await page.waitForTimeout(500)
}

test.describe('Pane Visual Rendering', () => {

  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('empty state renders correctly', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    await expect(page.locator('text=Pane').first()).toBeVisible()
    const input = page.locator('input[type="text"]')
    await expect(input).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/01-empty-state.png', fullPage: true })
  })

  test('first message renders welcome', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")

    await page.screenshot({ path: 'tests/screenshots/02-welcome.png', fullPage: true })
  })

  test('dashboard view renders with metrics', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")
    await sendMessage(page, 'show me a dashboard', 'Dashboard')

    await expect(page.locator('text=Revenue').first()).toBeVisible()
    await expect(page.locator('text=Active Users').first()).toBeVisible()
    await expect(page.locator('text=$42,000').first()).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/03-dashboard.png', fullPage: true })
  })

  test('editor view renders with textarea', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")
    await sendMessage(page, 'let me write something', 'Compose')

    await expect(page.locator('textarea')).toBeVisible()
    await expect(page.locator('text=Save Draft').first()).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/04-editor.png', fullPage: true })
  })

  test('capabilities grid renders all cards', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")
    await sendMessage(page, 'show me what you can do', '16 Atoms')

    await expect(page.locator('text=6 Modalities').first()).toBeVisible()
    await expect(page.locator('text=Action Layer').first()).toBeVisible()
    await expect(page.locator('text=Feedback Loop').first()).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/05-capabilities.png', fullPage: true })
  })

  test('no console errors through all views', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")
    await sendMessage(page, 'show me a dashboard', 'Dashboard')
    await sendMessage(page, 'let me write something', 'Compose')
    await sendMessage(page, 'show me what you can do', '16 Atoms')

    expect(errors).toEqual([])

    await page.screenshot({ path: 'tests/screenshots/06-all-views.png', fullPage: true })
  })

  test('modality shifts update indicator and input', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    await sendMessage(page, 'hello', "I'm Pane")

    // Conversational: input should say "Type a message..."
    await expect(page.locator('input[placeholder="Type a message..."]')).toBeVisible()

    await sendMessage(page, 'show me a dashboard', 'Dashboard')

    // Informational: input should say "Ask about this data..."
    await expect(page.locator('input[placeholder="Ask about this data..."]')).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/07-modality-shift.png', fullPage: true })
  })
})
