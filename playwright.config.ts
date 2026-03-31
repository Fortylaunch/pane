import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './tests/screenshots',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'cd examples/dev && npx vite --port 3000',
    port: 3000,
    reuseExistingServer: true,
    timeout: 10000,
  },
})
