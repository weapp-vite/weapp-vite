import type { Browser, Page } from 'playwright'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = '/pages/viewport-units/index'

interface ViewportPage {
  route: string
  setViewport: (mode: 'mini-program' | 'responsive', maxWidth?: number) => Promise<void>
}

interface FixtureHost {
  getCurrentPages: () => ViewportPage[]
  wx: { reLaunch: (options: { url: string }) => Promise<unknown> }
}

describe('WXSS viewport units in Chromium', { concurrent: false }, () => {
  let dev: ReturnType<typeof startDevProcess> | undefined
  let browser: Browser | undefined
  let page: Page | undefined
  let baseUrl: string
  let pageErrors: string[]

  beforeAll(async () => {
    dev = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      path.join(ROOT, 'apps/weapp-vite-web-demo'),
      '--platform',
      'web',
      '--host',
      '127.0.0.1',
    ], {
      cwd: ROOT,
      env: { ...createWebDevServerEnv(createDevProcessEnv()), WEAPP_WEB_PORT: '0' },
      all: true,
    })
    await dev.waitFor(vi.waitFor(() => {
      expect(resolveWebDevServerUrl(dev!.getOutput())).toBeTypeOf('string')
    }, { timeout: 90_000 }), 'viewport fixture Web server starts')
    baseUrl = resolveWebDevServerUrl(dev.getOutput())!
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  afterEach(async () => {
    try {
      expect(pageErrors).toEqual([])
    }
    finally {
      await page?.close()
    }
  })

  afterAll(async () => {
    try {
      await browser?.close()
    }
    finally {
      await dev?.stop(5_000)
    }
  })

  async function openFixture(width: number, height: number) {
    pageErrors = []
    page = await browser!.newPage({ viewport: { width, height } })
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page!.evaluate(() => {
      const host = globalThis as unknown as FixtureHost
      return typeof host.wx?.reLaunch
    })).toBe('function')
    await page.evaluate(async (url) => {
      const host = globalThis as unknown as FixtureHost
      await host.wx.reLaunch({ url })
    }, ROUTE)
    await expect.poll(() => page!.evaluate(() => {
      const host = globalThis as unknown as FixtureHost
      return host.getCurrentPages().at(-1)?.route
    })).toBe(ROUTE.slice(1))
    await page.locator('#viewport-width').waitFor({ state: 'visible' })
  }

  async function assertGeometry(width: number, height: number, browserWidth: number) {
    await expect.poll(() => page!.locator('#viewport-width').evaluate(element => element.getBoundingClientRect().width))
      .toBe(width)
    const geometry = await page!.locator('[data-weapp-page-active="true"]').evaluate((element) => {
      const root = element.shadowRoot!
      const rect = (id: string) => {
        const { left, right, width, height } = root.querySelector(id)!.getBoundingClientRect()
        return { left, right, width, height }
      }
      const app = document.querySelector('#app')!.getBoundingClientRect()
      return {
        app: { left: app.left, right: app.right, width: app.width, height: app.height },
        halfHeight: rect('#viewport-height').height,
        minimum: rect('#viewport-min').width,
        maximum: rect('#viewport-max').width,
        calculated: rect('#viewport-calc').width,
        fallback: rect('#viewport-fallback').width,
        variable: rect('#viewport-variable').width,
        exponent: rect('#viewport-exponent').width,
        fixed: rect('#viewport-fixed'),
        content: getComputedStyle(root.querySelector('#viewport-string')!, '::before').content,
        image: getComputedStyle(root.querySelector('#viewport-image')!).backgroundImage,
      }
    })
    expect(geometry.app).toEqual({ left: (browserWidth - width) / 2, right: (browserWidth + width) / 2, width, height })
    expect(geometry.halfHeight).toBeCloseTo(height / 2, 1)
    expect(geometry.minimum).toBeCloseTo(Math.min(width, height) / 10, 1)
    expect(geometry.maximum).toBeCloseTo(Math.max(width, height) / 10, 1)
    expect(geometry.calculated).toBeCloseTo(width - 20, 1)
    expect(geometry.fallback).toBeCloseTo(width / 4, 1)
    expect(geometry.variable).toBe(23)
    expect(geometry.exponent).toBe(width)
    expect(geometry.fixed.width).toBe(width)
    expect(geometry.fixed.left).toBe(geometry.app.left)
    expect(geometry.fixed.right).toBe(geometry.app.right)
    expect(geometry.content).toBe('"100vw"')
    expect(geometry.image).toContain('/viewport-100vw.svg')
    const imageWidth = await page!.evaluate(async () => {
      const image = new Image()
      image.src = '/viewport-100vw.svg'
      await image.decode()
      return image.naturalWidth
    })
    expect(imageWidth).toBe(16)
  }

  it('uses the mobile viewport without changing strings, URLs or custom property references', async () => {
    await openFixture(375, 812)
    await assertGeometry(375, 812, 375)
  })

  it('updates dimensions for desktop device widths and responsive mode', async () => {
    await openFixture(1200, 900)
    await assertGeometry(375, 900, 1200)
    await page!.evaluate(async () => {
      const host = globalThis as unknown as FixtureHost
      await host.getCurrentPages().at(-1)!.setViewport('mini-program', 414)
    })
    await assertGeometry(414, 900, 1200)
    await page!.evaluate(async () => {
      const host = globalThis as unknown as FixtureHost
      await host.getCurrentPages().at(-1)!.setViewport('responsive')
    })
    await assertGeometry(1200, 900, 1200)
  })
})
