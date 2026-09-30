import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'playwright/test'

const port = Number(process.env.WEBSITE_TEST_PORT || 4173)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  outputDir: fileURLToPath(new URL('../.playwright-cli/website-tests/', import.meta.url)),
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/vitepress/bin/vitepress.js preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
