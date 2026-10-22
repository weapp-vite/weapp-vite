import type { Browser, Page } from 'playwright'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ROUTE = 'pages/scroll-boundary/index'
const ACTIVE = '[data-weapp-page-active="true"]'

describe('scroll-view boundary pagination in Chromium', { concurrent: false }, () => {
  let dev: ReturnType<typeof startDevProcess> | undefined
  let browser: Browser | undefined
  let page: Page
  let baseUrl: string
  let errors: string[]

  beforeAll(async () => {
    const server = startDevProcess(process.execPath, [
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
    dev = server
    await server.waitFor(vi.waitFor(() => {
      expect(resolveWebDevServerUrl(server.getOutput())).toBeTypeOf('string')
    }, { timeout: 90_000 }), 'scroll boundary Web server starts')
    baseUrl = resolveWebDevServerUrl(server.getOutput())!
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    errors = []
    page = await browser!.newPage({ viewport: { width: 400, height: 800 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL(ROUTE, baseUrl).href)
    await expect.poll(() => page.locator(`${ACTIVE} #lower-count`).textContent()).toBe('0')
  })

  afterEach(async () => {
    try {
      expect(errors).toEqual([])
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

  function geometry(id: string) {
    return page.locator(`${ACTIVE} #${id}`).evaluate((element) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      return {
        top: viewport.scrollTop,
        left: viewport.scrollLeft,
        height: viewport.scrollHeight,
        width: viewport.scrollWidth,
      }
    })
  }

  async function scroll(id: string, axis: 'x' | 'y', edge: 'lower' | 'upper', distance = 0) {
    await page.locator(`${ACTIVE} #${id}`).evaluate((element, { axis, edge, distance }) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      // 只操作真实滚动位置；边界事件必须由浏览器 scroll 和编译后的 WXML 绑定产生。
      if (axis === 'y') {
        viewport.scrollTop = edge === 'lower' ? viewport.scrollHeight - viewport.clientHeight - distance : 0
      }
      else {
        viewport.scrollLeft = edge === 'lower' ? viewport.scrollWidth - viewport.clientWidth - distance : 0
      }
    }, { axis, edge, distance })
  }

  it.each([
    { axis: 'y', id: 'vertical-feed', lower: 'lower', upper: 'upper', direction: 'bottom', start: 'top', size: 'height' },
    { axis: 'x', id: 'horizontal-feed', lower: 'right', upper: 'left', direction: 'right', start: 'left', size: 'width' },
  ] as const)('continues $axis pagination after content grows and delivers WXML boundary handlers once', async (scenario) => {
    const initial = await geometry(scenario.id)
    expect(initial[scenario.size]).toBe(1000)
    for (let count = 1; count <= 3; count++) {
      await scroll(scenario.id, scenario.axis, 'lower')
      await expect.poll(() => page.locator(`${ACTIVE} #${scenario.lower}-count`).textContent()).toBe(String(count))
      await expect.poll(async () => (await geometry(scenario.id))[scenario.size]).toBe(1000 + Math.min(count, 2) * 100)
    }
    expect(await page.locator(`${ACTIVE} #${scenario.lower}-direction`).textContent()).toBe(scenario.direction)

    await scroll(scenario.id, scenario.axis, 'lower', 20)
    const positionId = scenario.axis === 'y' ? 'vertical-position' : 'horizontal-position'
    const expectedPosition = (await geometry(scenario.id))[scenario.axis === 'y' ? 'top' : 'left']
    await expect.poll(() => page.locator(`${ACTIVE} #${positionId}`).textContent()).toBe(String(expectedPosition))
    await scroll(scenario.id, scenario.axis, 'upper')
    await expect.poll(() => page.locator(`${ACTIVE} #${scenario.upper}-count`).textContent()).toBe('1')
    expect(await page.locator(`${ACTIVE} #${scenario.lower}-count`).textContent()).toBe('3')
    expect(await page.locator(`${ACTIVE} #${scenario.upper}-direction`).textContent()).toBe(scenario.start)
    expect(await page.locator(`${ACTIVE} #outer-count`).textContent()).toBe('0')
  })
})
