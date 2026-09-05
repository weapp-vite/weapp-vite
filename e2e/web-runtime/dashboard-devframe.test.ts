import type { Browser, BrowserContext, Page } from 'playwright'
import type { AnalyzeSubpackagesResult } from '../../packages/weapp-vite/src/analyze/subpackages'
import type { AnalyzeDashboardHandle } from '../../packages/weapp-vite/src/cli/analyze/dashboard'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startAnalyzeDashboard } from '../../packages/weapp-vite/src/cli/analyze/dashboard'

const ROOT = path.resolve(import.meta.dirname, '../..')

interface DashboardWindow extends Window {
  __dashboardSockets: WebSocket[]
}

function createAnalyzeResult(size: number): AnalyzeSubpackagesResult {
  return {
    metadata: {
      projectName: 'dashboard-devframe-browser',
      generatedAt: new Date(size).toISOString(),
      budgets: {
        totalBytes: 20 * 1024 * 1024,
        mainBytes: 2 * 1024 * 1024,
        subPackageBytes: 2 * 1024 * 1024,
        independentBytes: 2 * 1024 * 1024,
        warningRatio: 0.85,
        source: 'default',
      },
      history: {
        enabled: false,
        dir: '.weapp-vite/analyze-history',
        limit: 20,
      },
    },
    packages: [{
      id: '__main__',
      label: '主包',
      type: 'main',
      files: [{
        file: 'app.js',
        type: 'chunk',
        from: 'main',
        size,
        gzipSize: Math.round(size / 2),
        brotliSize: Math.round(size / 3),
        isEntry: true,
        modules: [{
          id: 'app.ts',
          source: 'app.ts',
          sourceType: 'src',
          bytes: size,
          originalBytes: size,
        }],
        source: 'app.ts',
      }],
    }],
    modules: [{
      id: 'app.ts',
      source: 'app.ts',
      sourceType: 'src',
      packages: [{ packageId: '__main__', files: ['app.js'] }],
    }],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
}

async function installWebSocketTracking(page: Page) {
  await page.addInitScript(() => {
    const dashboardWindow = window as DashboardWindow
    const NativeWebSocket = window.WebSocket
    dashboardWindow.__dashboardSockets = []
    class TrackedWebSocket extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        dashboardWindow.__dashboardSockets.push(this)
      }
    }
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: TrackedWebSocket,
      writable: true,
    })
  })
}

async function launchDashboardBrowser() {
  try {
    return await chromium.launch({ headless: true })
  }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes('Executable doesn\'t exist')) {
      throw error
    }
    return await chromium.launch({ channel: 'chrome', headless: true })
  }
}

describe('Dashboard Devframe browser regression', () => {
  let browser: Browser | undefined
  let context: BrowserContext | undefined
  let page: Page | undefined
  let dashboard: AnalyzeDashboardHandle | undefined
  let dashboardUrl = ''
  let temporaryRoot: string | undefined

  beforeAll(async () => {
    await fs.mkdir(path.resolve(ROOT, '.tmp'), { recursive: true })
    temporaryRoot = await fs.mkdtemp(path.resolve(ROOT, '.tmp/dashboard-devframe-browser-'))
    const srcRoot = path.resolve(temporaryRoot, 'src')
    const artifactRoot = path.resolve(temporaryRoot, 'dist')
    await fs.mkdir(srcRoot, { recursive: true })
    await fs.mkdir(artifactRoot, { recursive: true })
    await fs.writeFile(path.resolve(srcRoot, 'app.ts'), 'export const source = true\n', 'utf8')
    await fs.writeFile(path.resolve(artifactRoot, 'app.js'), 'App({})\n', 'utf8')

    dashboard = await startAnalyzeDashboard(createAnalyzeResult(128), {
      artifactRoot,
      cwd: temporaryRoot,
      silentStartupLog: true,
      srcRoot,
      watch: true,
    }) || undefined
    if (!dashboard?.urls[0]) {
      throw new Error('Dashboard Vite server did not expose an authenticated URL')
    }
    dashboardUrl = dashboard.urls[0]
    browser = await launchDashboardBrowser()
    context = await browser.newContext()
    page = await context.newPage()
    await installWebSocketTracking(page)
  })

  afterAll(async () => {
    await context?.close()
    await browser?.close()
    await dashboard?.close()
    if (temporaryRoot) {
      await fs.rm(temporaryRoot, { force: true, recursive: true })
    }
  })

  it('authenticates, updates, reconnects and keeps deep-link RPC views working', async () => {
    if (!page || !dashboard) {
      throw new Error('Dashboard browser fixture was not initialized')
    }
    const activePage = page
    const activeDashboard = dashboard
    await activePage.goto(dashboardUrl, { waitUntil: 'domcontentloaded' })
    await expect.poll(
      () => activePage.getByText('weapp-vite DevTools connected').first().isVisible(),
      { timeout: 30_000 },
    ).toBe(true)
    await expect.poll(() => activePage.getByText('1 packages').first().isVisible()).toBe(true)
    expect(new URL(activePage.url()).hash).toBe('')

    await expect.poll(() => activePage.getByText('128 B').first().isVisible()).toBe(true)
    await activeDashboard.update(createAnalyzeResult(256), createAnalyzeResult(128))
    await expect.poll(
      () => activePage.getByText('256 B').first().isVisible(),
      { timeout: 30_000 },
    ).toBe(true)

    const initialSocketCount = await activePage.evaluate(() => (window as DashboardWindow).__dashboardSockets.length)
    await activePage.evaluate(() => {
      const sockets = (window as DashboardWindow).__dashboardSockets
      sockets[sockets.length - 1]?.close()
    })
    await expect.poll(
      () => activePage.evaluate(() => (window as DashboardWindow).__dashboardSockets.length),
      { timeout: 30_000 },
    ).toBeGreaterThan(initialSocketCount)
    await expect.poll(() => activePage.getByText('weapp-vite DevTools connected').first().isVisible()).toBe(true)

    const origin = new URL(dashboardUrl).origin
    await activePage.goto(`${origin}/analyze?tab=graph`, { waitUntil: 'domcontentloaded' })
    await expect.poll(
      () => activePage.getByText('weapp-vite DevTools connected').first().isVisible(),
      { timeout: 30_000 },
    ).toBe(true)
    await expect.poll(
      () => activePage.locator('svg circle').count(),
      { timeout: 30_000 },
    ).toBeGreaterThan(0)

    await activePage.goto(`${origin}/analyze?tab=source`, { waitUntil: 'domcontentloaded' })
    await expect.poll(
      () => activePage.getByRole('heading', { name: '源码对比' }).isVisible(),
      { timeout: 30_000 },
    ).toBe(true)
    await expect.poll(() => activePage.getByText('源码行数').isVisible()).toBe(true)
  })

  it('rejects an unauthenticated UI and a foreign WebSocket Origin', async () => {
    if (!browser) {
      throw new Error('Dashboard browser fixture was not initialized')
    }
    const origin = new URL(dashboardUrl).origin
    const unauthorizedContext = await browser.newContext()
    const unauthorizedPage = await unauthorizedContext.newPage()
    try {
      const dialogPromise = unauthorizedPage.waitForEvent('dialog')
      await unauthorizedPage.goto(origin, { waitUntil: 'domcontentloaded' })
      const dialog = await dialogPromise
      expect(dialog.message()).toContain('authentication code')
      await dialog.dismiss()
    }
    finally {
      await unauthorizedContext.close()
    }

    const foreignContext = await browser.newContext()
    const foreignPage = await foreignContext.newPage()
    try {
      await foreignPage.goto('data:text/html,<title>foreign-origin</title>')
      const websocketUrl = `${origin.replace(/^http/, 'ws')}/__weapp-vite/__ws`
      const outcome = await foreignPage.evaluate(async (url) => {
        return await new Promise<'closed' | 'opened' | 'timeout'>((resolve) => {
          const socket = new WebSocket(url)
          // 浏览器只通过 open/close 暴露握手结果，因此用短最终超时防止协议挂死。
          const timeout = window.setTimeout(resolve, 5_000, 'timeout')
          socket.addEventListener('open', () => {
            window.clearTimeout(timeout)
            socket.close()
            resolve('opened')
          })
          socket.addEventListener('close', () => {
            window.clearTimeout(timeout)
            resolve('closed')
          })
        })
      }, websocketUrl)
      expect(outcome).toBe('closed')
    }
    finally {
      await foreignContext.close()
    }
  })
})
