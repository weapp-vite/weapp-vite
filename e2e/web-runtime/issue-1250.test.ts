import type { Browser, Page } from 'playwright'
import type { PreviewServer } from 'vite'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildIssueRegressionProject, createIssueRegressionProject } from '../utils/issueRegressionProject'

type ListenerKey = 'error' | 'rejection' | 'theme'
type ListenerSnapshot = Record<ListenerKey, { active: number, added: number, removed: number }>

interface LifecycleSnapshot {
  errors: string[]
  rejections: Array<{ reason: unknown, promiseMatches: boolean, reasonMatches: boolean }>
  themes: string[]
}

const ROOT = '[data-weapp-page-active="true"]'

describe('issue #1250: compiled Web lifecycle API consumers', { concurrent: false }, () => {
  let project: string | undefined
  let server: PreviewServer | undefined
  let browser: Browser | undefined
  let page: Page
  let errors: string[]

  beforeAll(async () => {
    project = await createIssueRegressionProject(1250)
    await buildIssueRegressionProject(project)
    server = await preview({ root: project, configFile: false, build: { outDir: 'dist/web' }, preview: { host: '127.0.0.1', port: 0, open: false } })
    browser = await chromium.launch({ channel: process.env.WEAPP_VITE_WEB_E2E_CHANNEL })
  })

  beforeEach(async () => {
    page = await browser!.newPage({ colorScheme: 'light' })
    errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      const add = EventTarget.prototype.addEventListener
      const remove = EventTarget.prototype.removeEventListener
      // 这些是主动派发的真实 Window 事件，阻止浏览器将其作为未处理故障上报。
      add.call(window, 'error', event => event.preventDefault(), true)
      add.call(window, 'unhandledrejection', event => event.preventDefault(), true)
      const counters = {
        error: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
        rejection: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
        theme: { active: new Set<EventListenerOrEventListenerObject>(), added: 0, removed: 0 },
      }
      function key(target: EventTarget, type: string): keyof typeof counters | undefined {
        if (target === window && type === 'error') {
          return 'error'
        }
        if (target === window && type === 'unhandledrejection') {
          return 'rejection'
        }
        if (target instanceof MediaQueryList && type === 'change' && target.media === '(prefers-color-scheme: dark)') {
          return 'theme'
        }
      }
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        const entry = key(this, type)
        if (entry && listener) {
          counters[entry].added += 1
          counters[entry].active.add(listener)
        }
        return add.call(this, type, listener, options)
      }
      EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const entry = key(this, type)
        if (entry && listener) {
          counters[entry].removed += 1
          counters[entry].active.delete(listener)
        }
        return remove.call(this, type, listener, options)
      }
      Object.defineProperty(window, '__issue1250NativeListeners', {
        value: () => Object.fromEntries(Object.entries(counters).map(([name, counter]) => [name, {
          active: counter.active.size,
          added: counter.added,
          removed: counter.removed,
        }])),
      })
    })
    await page.goto(server!.resolvedUrls!.local[0])
    await expect.poll(() => page.locator(`${ROOT} #ready`).textContent()).toBe('ready')
  })

  afterEach(async () => {
    await page?.close()
    expect(errors).toEqual([])
  })

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await new Promise<void>((resolve, reject) => server!.httpServer.close(error => error ? reject(error) : resolve()))
    }
    if (project) {
      await rm(project, { recursive: true, force: true })
    }
  })

  async function snapshot() {
    return JSON.parse(await page.locator(`${ROOT} #snapshot`).textContent() ?? '{}') as LifecycleSnapshot
  }

  async function listeners(): Promise<ListenerSnapshot> {
    return page.evaluate(() => Reflect.get(window, '__issue1250NativeListeners')())
  }

  it('delivers native error strings and original rejection values once, then releases subscriptions', async () => {
    const baseline = await listeners()
    await page.locator(`${ROOT} #reinstall`).click()
    expect(await listeners()).toEqual(baseline)
    await page.locator(`${ROOT} #subscribe`).click()
    await page.locator(`${ROOT} #subscribe`).click()
    const subscribed = await listeners()
    for (const name of ['error', 'rejection', 'theme'] as const) {
      expect(subscribed[name].active).toBe(baseline[name].active + 1)
      expect(subscribed[name].added).toBe(baseline[name].added + 1)
    }
    await page.locator(`${ROOT} #reinstall`).click()
    expect(await listeners()).toEqual(subscribed)
    await page.locator(`${ROOT} #dispatch`).click()
    await expect.poll(snapshot).toEqual({
      errors: ['issue-1250 error stack', 'issue-1250 message only'],
      rejections: [{ reason: { code: 'fixture-reason', nested: { count: 2 } }, promiseMatches: true, reasonMatches: true }],
      themes: [],
    })
    await page.locator(`${ROOT} #unsubscribe`).click()
    const released = await listeners()
    for (const name of ['error', 'rejection', 'theme'] as const) {
      expect(released[name].active).toBe(baseline[name].active)
      expect(released[name].removed).toBe(baseline[name].removed + 1)
    }
    const previous = await snapshot()
    await page.locator(`${ROOT} #dispatch`).click()
    expect(await snapshot()).toEqual(previous)
    await page.locator(`${ROOT} #subscribe`).click()
    await page.locator(`${ROOT} #dispatch`).click()
    await expect.poll(async () => (await snapshot()).errors.length).toBe(4)
    expect((await snapshot()).rejections).toHaveLength(2)
  })

  it('follows real browser color scheme changes and stops after offThemeChange', async () => {
    await page.locator(`${ROOT} #subscribe`).click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(async () => (await snapshot()).themes).toEqual(['dark'])
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(async () => (await snapshot()).themes).toEqual(['dark', 'light'])
    await page.locator(`${ROOT} #unsubscribe`).click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true)
    expect((await snapshot()).themes).toEqual(['dark', 'light'])
  })

  it('keeps a replacement Toast visible past the cancelled timer and hides it at its own deadline', async () => {
    await page.clock.install()
    await page.locator(`${ROOT} #toast-sequence`).click()
    const toast = page.locator('[data-weapp-web-toast="true"]')
    await expect.poll(() => toast.textContent()).toBe('second toast')
    expect(await toast.getAttribute('hidden')).toBeNull()
    await page.clock.fastForward(150)
    expect(await toast.getAttribute('hidden')).toBeNull()
    expect(await toast.textContent()).toBe('second toast')
    await page.clock.fastForward(1000)
    expect(await toast.getAttribute('hidden')).not.toBeNull()
    await page.locator(`${ROOT} #toast-sequence`).click()
    await page.locator(`${ROOT} #hide-toast`).click()
    expect(await toast.getAttribute('hidden')).not.toBeNull()
  })
})
