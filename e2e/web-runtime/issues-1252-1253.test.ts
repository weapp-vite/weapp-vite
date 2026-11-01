import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { rm } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

const ACTIVE = '[data-weapp-page-active="true"]'

describe('issues #1252–#1253: compiled touch and refresher consumers', { concurrent: false }, () => {
  let project: string
  let server: PreviewServer
  let browser: Browser
  let page: Page
  let errors: string[]

  function control(id: string) {
    return page.locator(`${ACTIVE} #${id}`)
  }

  beforeAll(async () => {
    project = await createIssueRegressionProject(1252)
    await buildIssueRegressionProject(project)
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 600, height: 900 } })
    page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
  })

  beforeEach(async () => {
    errors = []
    await page.goto(server.resolvedUrls!.local[0])
    await expect.poll(() => control('ready').textContent()).toBe('ready')
  })

  afterAll(async () => {
    try {
      await browser?.close()
    }
    finally {
      try {
        if (server) {
          await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
        }
      }
      finally {
        if (project) {
          await rm(project, { recursive: true, force: true })
        }
      }
    }
  })

  const read = async (id: string) => JSON.parse(await control(id).textContent() ?? '[]')
  const types = async () => (await read('trace')).map((event: { type: string }) => event.type)
  const top = () => control('feed').evaluate(element => element.scrollTop)

  async function drag(distance: number, outside = false) {
    await control('feed').scrollIntoViewIfNeeded()
    const box = await control('feed').boundingBox()
    expect(box).toBeTruthy()
    const x = box!.x + 100
    const y = box!.y + 40
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, outside ? box!.y + box!.height + 80 : y + distance, { steps: 6 })
    await page.mouse.up()
  }

  it('adapts the mouse on a hybrid device, refreshes outside the source and restores on an unchanged false commit', async () => {
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)
    await drag(130, true)
    await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh'])
    const touches = await read('touches')
    expect(touches[0].type).toBe('touchstart')
    expect(touches.at(-1).type).toBe('touchend')
    expect(touches.at(-1).touches).toEqual([])
    expect(touches[0].touches).toHaveLength(1)
    expect(touches[0].touches[0]).toMatchObject({ identifier: expect.any(Number), clientX: expect.any(Number), pageY: expect.any(Number) })
    expect(await top()).toBe(0)
    // pulling/touch handlers update other data; these commits must leave refresh active.
    await control('reset').click()
    expect(await types()).toEqual([])
    await control('restore').click()
    await expect.poll(types).toEqual(['refresherrestore'])
    expect(errors).toEqual([])
  })

  it('aborts below the threshold and keeps ordinary scrolling available away from the top', async () => {
    await drag(24)
    await expect.poll(types).toEqual(['refresherpulling', 'refresherabort'])
    await control('feed').evaluate(element => element.scrollTop = 160)
    await expect.poll(top).toBe(160)
    await control('reset').click()
    await drag(100)
    expect(await types()).toEqual([])
    const box = await control('feed').boundingBox()
    await page.mouse.move(box!.x + 100, box!.y + 100)
    await page.mouse.wheel(0, 120)
    await expect.poll(top).toBeGreaterThan(160)
    expect(errors).toEqual([])
  })

  it('does not synthesize duplicate events for native touch input', async () => {
    await control('feed').scrollIntoViewIfNeeded()
    const box = await control('feed').boundingBox()
    const cdp = await page.context().newCDPSession(page)
    try {
      const point = { x: box!.x + 80, y: box!.y + 50 }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 2 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 8 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 130 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh'])
      const touches = await read('touches')
      expect(touches.filter((event: { type: string }) => event.type === 'touchstart')).toHaveLength(1)
      expect(touches.filter((event: { type: string }) => event.type === 'touchend')).toHaveLength(1)
    }
    finally {
      await cdp.detach()
    }
    expect(errors).toEqual([])
  })

  it('programmatic refresh restores before a later explicit reentry', async () => {
    await control('trigger').click()
    await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh'])
    await control('reenter').click()
    await control('restore').click()
    await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore'])
    await expect.poll(() => control('feed').evaluate(element => element.shadowRoot!.querySelector<HTMLElement>('.refresher')!.dataset.state)).toBe('idle')
    await control('trigger').click()
    await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh', 'refresherrestore', 'refresherpulling', 'refresherrefresh'])
    expect(errors).toEqual([])
  })

  it('keeps source mouse events available through catch and cancels a blurred mouse session', async () => {
    await control('caught-source').scrollIntoViewIfNeeded()
    const box = await control('caught-source').boundingBox()
    const point = { x: box!.x + 80, y: box!.y + 20 }
    await control('caught-source').evaluate((element) => {
      element.addEventListener('pointerdown', () => element.setAttribute('data-pointer-observed', 'true'), { once: true })
    })
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    expect(await control('caught-source').getAttribute('data-pointer-observed')).toBe('true')
    expect(await control('canvas-parents').textContent()).toBe('0')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.move(point.x + 30, point.y + 10)
    await page.mouse.up()
    const events = await read('touches')
    expect(events.map((event: { type: string }) => event.type)).toEqual(['touchstart', 'touchcancel'])
    await control('reset').click()
    await expect.poll(() => read('touches')).toEqual([])
    await control('caught-source').scrollIntoViewIfNeeded()
    const nextBox = await control('caught-source').boundingBox()
    await page.mouse.move(nextBox!.x + 80, nextBox!.y + 20)
    await page.mouse.down()
    try {
      await expect.poll(async () => (await read('touches')).map((event: { type: string }) => event.type)).toEqual(['touchstart'])
    }
    finally {
      await page.mouse.up()
    }
    await expect.poll(async () => (await read('touches')).map((event: { type: string }) => event.type)).toEqual(['touchstart', 'touchend'])
    expect(errors).toEqual([])
  })

  it('uses relative CSS canvas coordinates alongside modern event bubbling and real drawing', async () => {
    await control('signature').scrollIntoViewIfNeeded()
    const box = await control('signature').boundingBox()
    await page.mouse.move(box!.x + 70, box!.y + 40)
    await page.mouse.down()
    await page.mouse.move(box!.x + 90, box!.y + 55)
    await page.mouse.up()
    await expect.poll(() => read('canvas-end')).toMatchObject({
      type: 'touchend',
      currentTarget: { id: 'signature' },
      touches: [],
      changedTouches: [{ identifier: expect.any(Number), x: 90, y: 55, clientX: expect.any(Number) }],
    })
    expect(await control('canvas-parents').textContent()).toBe('1')
    const pixel = await control('signature').evaluate(element => Array.from(element.shadowRoot!.querySelector('canvas')!.getContext('2d')!.getImageData(20, 20, 1, 1).data))
    expect(pixel).toEqual([182, 132, 61, 255])
    const stroke = await control('signature').evaluate(element => Array.from(element.shadowRoot!.querySelector('canvas')!.getContext('2d')!.getImageData(80, 47, 1, 1).data))
    expect(stroke).toEqual([24, 58, 102, 255])
    expect(errors).toEqual([])
  })

  it('animates programmatic positioning and presents a named custom refresher', async () => {
    await control('scroll-down').click()
    await expect.poll(top).toBeGreaterThan(0)
    await expect.poll(top).toBe(300)
    await control('scroll-up').click()
    await expect.poll(top).toBe(0)
    await control('custom-appearance').click()
    await control('trigger').click()
    await expect.poll(types).toEqual(['refresherpulling', 'refresherrefresh'])
    expect(await control('custom-refresher').isVisible()).toBe(true)
    expect(await control('feed').evaluate((element) => {
      const root = element.shadowRoot!
      const slot = root.querySelector<HTMLSlotElement>('slot[name="refresher"]')!
      return { assigned: slot.assignedElements().map(node => node.id), background: getComputedStyle(root.querySelector('.refresher')!).backgroundColor }
    })).toEqual({ assigned: ['custom-refresher'], background: 'rgb(226, 243, 255)' })
    expect(errors).toEqual([])
  })
})
