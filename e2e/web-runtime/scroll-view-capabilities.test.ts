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

  function bothAxesGeometry() {
    return control('both-axes-feed').evaluate((element) => {
      const viewport = element.shadowRoot!.querySelector('.viewport') as HTMLDivElement
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = element.querySelector('#both-axes-target')!.getBoundingClientRect()
      return {
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        relativeLeft: targetRect.left - viewportRect.left - viewport.clientLeft,
        relativeTop: targetRect.top - viewportRect.top - viewport.clientTop,
        relativeRight: targetRect.right - viewportRect.left - viewport.clientLeft,
        relativeBottom: targetRect.bottom - viewportRect.top - viewport.clientTop,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        targetWidth: targetRect.width,
        targetHeight: targetRect.height,
      }
    })
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

  it('aligns both axes in one viewport for start, center, end, nearest and offset', async () => {
    await control('align-start').click()
    await expect.poll(async () => {
      const value = await bothAxesGeometry()
      return Math.max(Math.abs(value.relativeLeft), Math.abs(value.relativeTop))
    }).toBeLessThan(0.5)
    const start = await bothAxesGeometry()
    expect(start.left).toBeGreaterThan(0)
    expect(start.top).toBeGreaterThan(0)

    await control('align-center').click()
    await expect.poll(async () => {
      const value = await bothAxesGeometry()
      return Math.max(
        Math.abs(value.relativeLeft - (value.width - value.targetWidth) / 2),
        Math.abs(value.relativeTop - (value.height - value.targetHeight) / 2),
      )
    }).toBeLessThan(0.5)

    await control('align-end').click()
    await expect.poll(async () => {
      const value = await bothAxesGeometry()
      return Math.max(Math.abs(value.relativeRight - value.width), Math.abs(value.relativeBottom - value.height))
    }).toBeLessThan(0.5)

    const visible = await bothAxesGeometry()
    await control('align-nearest').click()
    await expect.poll(() => control('both-axes-feed').getAttribute('scroll-into-view-alignment')).toBe('nearest')
    await expect.poll(async () => {
      const value = await bothAxesGeometry()
      return { left: value.left, top: value.top }
    }).toEqual({ left: visible.left, top: visible.top })

    await control('apply-offset').click()
    await expect.poll(async () => {
      const value = await bothAxesGeometry()
      return Math.max(Math.abs(value.relativeLeft - 20), Math.abs(value.relativeTop - 20))
    }).toBeLessThan(0.5)
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
    const scrollbar = (id: string) => control(id).evaluate((element) => {
      const viewport = element.shadowRoot!.querySelector('.viewport')!
      const style = getComputedStyle(viewport)
      return {
        hidden: viewport.classList.contains('no-scrollbar'),
        width: style.getPropertyValue('scrollbar-width'),
      }
    })
    // :vertical 方向伪类没有可靠的 getComputedStyle 查询入口；验证纵向单轴的标准计算值，避免依赖系统 overlay 滚动条尺寸。
    const visible = { hidden: false, width: 'auto' }
    expect(await scrollbar('position-feed')).toEqual(visible)
    expect(await scrollbar('flex-feed')).toEqual(visible)
    await control('hide-scrollbar').click()
    await expect.poll(() => scrollbar('position-feed')).toEqual({ hidden: true, width: 'none' })
    expect(await scrollbar('flex-feed')).toEqual(visible)
    await control('restore-scrollbar').click()
    await expect.poll(() => scrollbar('position-feed')).toEqual(visible)
    expect(await scrollbar('flex-feed')).toEqual(visible)
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
