import type { Browser, Page } from 'playwright'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ACTIVE = '[data-weapp-page-active="true"]'

describe('compiled scroll-view capabilities in Chromium', { concurrent: false }, () => {
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
    }, { timeout: 90_000 }), 'scroll capabilities Web server starts')
    baseUrl = resolveWebDevServerUrl(server.getOutput())!
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    errors = []
    page = await browser!.newPage({ viewport: { width: 400, height: 800 } })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL('pages/scroll-capabilities/index', baseUrl).href)
    await expect.poll(() => page.locator(`${ACTIVE} #start-count`).textContent()).toBe('0')
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

  const control = (id: string) => page.locator(`${ACTIVE} #${id}`)
  function geometry(target = 'position-target') {
    return control('position-feed').evaluate((element, target) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = element.querySelector(`[id="${target}"]`)!.getBoundingClientRect()
      return {
        top: viewport.scrollTop,
        relativeTop: targetRect.top - viewportRect.top - viewport.clientTop,
        relativeBottom: targetRect.bottom - viewportRect.top - viewport.clientTop,
        height: viewport.clientHeight,
        targetHeight: targetRect.height,
      }
    }, target)
  }

  it('uses start, center, end, nearest and offset through compiled WXML attributes', async () => {
    await control('align-start').click()
    await expect.poll(async () => (await geometry()).relativeTop).toBeCloseTo(0, 0)
    await control('align-center').click()
    await expect.poll(async () => {
      const value = await geometry()
      return value.relativeTop - (value.height - value.targetHeight) / 2
    }).toBeCloseTo(0, 0)
    await control('align-end').click()
    await expect.poll(async () => {
      const value = await geometry()
      return value.relativeBottom - value.height
    }).toBeCloseTo(0, 0)
    const visibleTop = (await geometry()).top
    await control('align-nearest').click()
    await expect.poll(() => control('position-feed').getAttribute('scroll-into-view-alignment')).toBe('nearest')
    await expect.poll(async () => (await geometry()).top).toBe(visibleTop)
    await control('apply-offset').click()
    await expect.poll(async () => (await geometry()).relativeTop).toBeCloseTo(20, 0)
  })

  it('resolves a target inserted after selection and keeps later user scrolling', async () => {
    await control('choose-late').click()
    expect((await geometry()).top).toBe(0)
    await control('insert-late').click()
    await expect.poll(async () => (await geometry('late-target')).relativeTop).toBeCloseTo(0, 0)
    await control('position-feed').evaluate((element) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      viewport.scrollTop = 50
    })
    await expect.poll(() => control('scroll-position').textContent()).toBe('50')
    await control('position-feed').evaluate(async (element) => {
      element.append(document.createElement('div'))
      await new Promise(requestAnimationFrame)
    })
    await expect.poll(async () => (await geometry()).top).toBe(50)
  })

  it('lays out slotted children with the host flex direction and gap', async () => {
    const boxes = () => control('flex-feed').evaluate((element) => {
      const first = element.querySelector('#flex-first')!.getBoundingClientRect()
      const second = element.querySelector('#flex-second')!.getBoundingClientRect()
      return { x: second.left - first.left, y: second.top - first.top }
    })
    await expect.poll(async () => (await boxes()).y).toBe(40)
    await control('toggle-flex').click()
    await expect.poll(boxes).toEqual({ x: 92, y: 0 })
    await control('toggle-flex').click()
    await expect.poll(async () => (await boxes()).y).toBe(40)
  })

  it('keeps default scrollbars and requires enhanced for an explicit hide override', async () => {
    const hidden = () => control('position-feed').evaluate(element => element.shadowRoot!.querySelector('.viewport')!.classList.contains('no-scrollbar'))
    expect(await hidden()).toBe(false)
    await control('hide-scrollbar').click()
    await expect.poll(hidden).toBe(true)
    expect(await control('flex-feed').evaluate(element => element.shadowRoot!.querySelector('.viewport')!.classList.contains('no-scrollbar'))).toBe(false)
    await control('restore-scrollbar').click()
    await expect.poll(hidden).toBe(false)
  })

  it('delivers one start and end per real browser scroll session through WXML handlers', async () => {
    const scroll = (top: number) => control('position-feed').evaluate((element, top) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      // 不派发合成 scroll，断言来自浏览器滚动及编译后的 WXML 事件绑定。
      viewport.scrollTop = top
    }, top)
    await scroll(100)
    await expect.poll(() => control('start-count').textContent()).toBe('1')
    await expect.poll(() => control('end-count').textContent()).toBe('1')
    expect(await control('end-position').textContent()).toBe('100')
    await scroll(250)
    await expect.poll(() => control('start-count').textContent()).toBe('2')
    await expect.poll(() => control('end-count').textContent()).toBe('2')
    expect(await control('end-position').textContent()).toBe('250')
    expect(Number(await control('scroll-count').textContent())).toBeGreaterThanOrEqual(2)
  })

  it('starts a fresh session when a scrollstart listener disconnects and reconnects the same host', async () => {
    await control('position-feed').evaluate((element) => {
      element.addEventListener('scrollstart', () => {
        const parent = element.parentElement!
        element.remove()
        parent.append(element)
      }, { once: true })
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      viewport.scrollTop = 100
    })
    await expect.poll(() => control('start-count').textContent()).toBe('1')
    expect(await control('scroll-count').textContent()).toBe('0')
    await control('position-feed').evaluate((element) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      viewport.scrollTop = 250
    })
    await expect.poll(() => control('start-count').textContent()).toBe('2')
    await expect.poll(() => control('end-count').textContent()).toBe('1')
    expect(await control('scroll-count').textContent()).toBe('1')
    expect(await control('end-position').textContent()).toBe('250')
  })
})
