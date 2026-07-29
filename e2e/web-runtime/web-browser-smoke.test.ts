/* eslint-disable e18e/ban-dependencies -- Web browser smoke needs a dedicated dev server and browser process. */
import type { Subprocess } from 'execa'
import type { Browser, BrowserType, Page } from 'playwright'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import { firefox, webkit } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.resolve(ROOT, 'apps/weapp-vite-web-demo')
const CLI_PATH = path.resolve(ROOT, 'packages/weapp-vite/dist/cli.mjs')
const HOST = '127.0.0.1'
const PORT = Number(process.env.WEAPP_VITE_WEB_BROWSER_SMOKE_PORT ?? 5190)
const URL = `http://${HOST}:${PORT}`
const STARTUP_TIMEOUT = 60_000

const browserTypes: Array<[string, BrowserType]> = [
  ['firefox', firefox],
  ['webkit', webkit],
]
const requestedBrowser = process.env.WEAPP_VITE_WEB_BROWSER
const selectedBrowserTypes = browserTypes.filter(([name]) => {
  if (requestedBrowser && requestedBrowser !== 'all' && requestedBrowser !== name) {
    return false
  }
  return true
})

if (selectedBrowserTypes.length === 0) {
  throw new Error(`Unknown Web smoke browser: ${requestedBrowser}`)
}

async function waitForServer(server: Subprocess) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < STARTUP_TIMEOUT) {
    if (server.nodeChildProcess.exitCode !== null) {
      throw new Error(`Web browser smoke server exited with ${server.nodeChildProcess.exitCode}`)
    }
    try {
      if ((await fetch(URL)).ok) {
        return
      }
    }
    catch {
    }
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${URL}`)
}

async function expectRuntime(page: Page, route: string) {
  await expect.poll(async () => page.evaluate(() => {
    const pages = typeof (window as any).getCurrentPages === 'function'
      ? (window as any).getCurrentPages()
      : []
    return {
      hasWx: typeof (window as any).wx === 'object',
      route: pages[pages.length - 1]?.route ?? null,
    }
  }), { timeout: 45_000 }).toEqual({ hasWx: true, route })
}

describe.sequential('web runtime compatibility browser smoke', () => {
  let server: Subprocess | undefined
  const browsers: Browser[] = []

  beforeAll(async () => {
    server = execa(process.execPath, [CLI_PATH, APP_ROOT, '--platform', 'web', '--host', HOST], {
      cwd: ROOT,
      env: {
        ...process.env,
        WEAPP_WEB_HOST: HOST,
        WEAPP_WEB_PORT: String(PORT),
        WEAPP_WEB_OPEN: 'false',
        BROWSER: 'none',
      },
    })
    await waitForServer(server)
    for (const [, browserType] of selectedBrowserTypes) {
      browsers.push(await browserType.launch({ headless: true }))
    }
  })

  afterAll(async () => {
    await Promise.all(browsers.map(browser => browser.close()))
    if (server && server.nodeChildProcess.exitCode === null) {
      server.kill('SIGTERM')
      await server.catch(() => undefined)
    }
  })

  it.each(selectedBrowserTypes.map(([name]) => name))('%s starts the runtime and navigates', async (name) => {
    const index = selectedBrowserTypes.findIndex(([browserName]) => browserName === name)
    const page = await browsers[index]!.newPage()
    try {
      await page.goto(`${URL}/pages/index/index`, { waitUntil: 'domcontentloaded' })
      await expectRuntime(page, 'pages/index/index')
      await page.evaluate(() => (window as any).wx.navigateTo({ url: 'pages/form-parity/index' }))
      await expectRuntime(page, 'pages/form-parity/index')
      await page.locator('weapp-input#profile-name input').fill('Grace')
      await page.getByRole('button', { name: '提交资料' }).click()
      await expect.poll(() => page.locator('[data-form-result="submitted"]').isVisible()).toBe(true)
      await expect.poll(() => page.locator('.form-result__value').textContent()).toContain('Grace')

      await page.route('**/api/web-browser-smoke', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ browser: name, ok: true }),
      }))
      const requestResult = await page.evaluate(() => new Promise((resolve) => {
        ;(window as any).wx.request({
          url: '/api/web-browser-smoke',
          success: resolve,
          fail: resolve,
        })
      }))
      expect(requestResult).toMatchObject({
        data: { browser: name, ok: true },
        statusCode: 200,
      })

      const navigationError = await page.evaluate(() => new Promise((resolve) => {
        ;(window as any).wx.navigateTo({
          url: 'pages/missing/index',
          success: resolve,
          fail: resolve,
        })
      }))
      expect(navigationError).toEqual({ errMsg: 'navigateTo:fail page not found' })
      await expectRuntime(page, 'pages/form-parity/index')
    }
    finally {
      await page.close()
    }
  })
})
