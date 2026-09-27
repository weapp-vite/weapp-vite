import type { Browser, Page } from 'playwright'
import type { Feature1087Record } from '../../e2e-apps/github-issues/src/shared/feature1087'
import { ok as assert } from 'node:assert'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from '../utils/dev-process'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { createWebDevServerEnv, resolveWebDevServerUrl } from '../utils/webDevServer'

const ROOT = path.resolve(import.meta.dirname, '../..')
const LIST = '/pages/feature-1087/index'
const DOCUMENT = '/pages/feature-1087/page/index'
const NATIVE = '/pages/feature-1087/native/index'
const TAB = '/pages/feature-1087/tab/index'
const TAB_PEER = '/pages/feature-1087/tab-peer/index'
const ACTIVE = '[data-weapp-page-active="true"]'

interface Snapshot {
  automatic: boolean
  records: Feature1087Record[]
  errors: string[]
  instance?: number
  ready?: boolean
  contentReady?: boolean
  marker?: string
  observed?: { primaryTop: number, secondaryTop: number }
}

interface FixtureActions {
  _reset: () => void
  _setPosition: (top: number, left?: number, secondaryTop?: number) => Promise<void>
  _loadContent: () => Promise<void>
  _restore: () => Promise<boolean | boolean[]>
}

interface RouteResult { errMsg: string }
interface RouteOptions {
  url: string
  success?: (result: RouteResult) => void
  complete?: (result: RouteResult) => void
}
type Navigation = 'reLaunch' | 'redirectTo' | 'navigateTo' | 'switchTab'
// 这些全局对象由本 suite 启动的 Web fixture 安装，仅补充浏览器执行上下文的类型。
interface WebFixtureHost {
  getCurrentPages: () => Array<Partial<FixtureActions> & {
    route: string
    options: Record<string, string>
    webviewId: number
    _snapshot: () => Snapshot
  }>
  wx: Record<Navigation, (options: RouteOptions) => Promise<RouteResult>>
}

// 一个真实 CLI server 和 Chromium 进程覆盖整个 suite；每例使用独立浏览器上下文。
describe('feature #1087: scroll restoration in Chromium', { concurrent: false }, () => {
  let dev: { stop: (forceKillDelayMs?: number) => Promise<void> } | undefined
  let browser: Browser | undefined
  let page: Page
  let baseUrl: string
  let pageErrors: string[]

  beforeAll(async () => {
    const server = startDevProcess(process.execPath, [
      path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js'),
      'dev',
      path.join(ROOT, 'e2e-apps/github-issues'),
      '--platform',
      'web',
      '--host',
      '127.0.0.1',
    ], {
      cwd: ROOT,
      env: {
        ...createWebDevServerEnv(createDevProcessEnv()),
        WEAPP_WEB_PORT: '0',
        WEAPP_VITE_E2E_TARGET_FILE: 'github-issues.runtime.feature1087.test.ts',
      },
      all: true,
    })
    dev = server
    await server.waitFor(vi.waitFor(() => {
      expect(resolveWebDevServerUrl(server.getOutput())).toBeTypeOf('string')
    }, { timeout: 90_000 }), 'feature #1087 Web server starts')
    baseUrl = resolveWebDevServerUrl(server.getOutput())!
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

  function snapshot() {
    return page.evaluate(() => {
      const host = globalThis as unknown as WebFixtureHost
      return host.getCurrentPages().at(-1)!._snapshot()
    })
  }

  function invoke(method: keyof FixtureActions, ...args: number[]) {
    return page.evaluate(async ({ method, args }) => {
      const host = globalThis as unknown as WebFixtureHost
      const current = host.getCurrentPages().at(-1)
      const action = current?.[method]
      if (typeof action !== 'function') {
        throw new TypeError(`Missing fixture action ${method} on ${current?.route}`)
      }
      return await Reflect.apply(action, current, args) as unknown
    }, { method, args })
  }

  async function waitForRoute(url: string) {
    const route = url.split('?')[0]!.slice(1)
    await expect.poll(() => page.evaluate((route) => {
      const host = globalThis as unknown as WebFixtureHost
      const current = host.getCurrentPages?.().at(-1)
      const state = current?._snapshot?.()
      // 冷启动的 BeforeAppRoute 早于 App setup 订阅；用已接受的逻辑路由关联实际提交。
      const accepted = state?.records.findLast(record => record.phase === 'AppRoute')
      return {
        route: current?.route,
        ready: state?.ready === true || (state !== undefined && (route.endsWith('/native/index') || route.endsWith('/tab-peer/index'))),
        done: typeof accepted?.routeEventId === 'string' && accepted.path === route
          && state?.records.some(record => record.phase === 'AppRouteDone' && record.routeEventId === accepted.routeEventId),
      }
    }, route), { timeout: 15_000 }).toEqual({ route, ready: true, done: true })
    expect(await page.locator(ACTIVE).getAttribute('data-weapp-page')).toBe(route)
  }

  async function navigate(action: Navigation, url: string) {
    const result = await page.evaluate(({ action, url }) => {
      const host = globalThis as unknown as WebFixtureHost
      return host.wx[action]({ url })
    }, { action, url })
    expect(result).toMatchObject({ errMsg: `${action}:ok` })
    await waitForRoute(url)
  }

  function listGeometry() {
    return page.locator(ACTIVE).locator('#feature1087-primary, #feature1087-secondary').evaluateAll(elements => elements.map((element) => {
      // 读取 scroll-view shadow DOM 内真正发生滚动的 div，不读取绑定 ref 或宿主属性代理。
      const viewport = element.shadowRoot?.querySelector('.viewport')
      if (!(viewport instanceof HTMLDivElement)) {
        throw new TypeError(`Missing native scroll viewport for ${element.id}`)
      }
      return {
        top: viewport.scrollTop,
        left: viewport.scrollLeft,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        scrollWidth: viewport.scrollWidth,
        scrollHeight: viewport.scrollHeight,
      }
    }))
  }

  async function expectListPosition(top: number, left: number, secondaryTop: number) {
    await expect.poll(async () => (await listGeometry()).map(({ top, left }) => ({ top, left })), { timeout: 10_000 })
      .toEqual([{ top, left }, { top: secondaryTop, left: 0 }])
    const geometry = await listGeometry()
    for (const viewport of geometry) {
      expect(viewport.width).toBeGreaterThan(0)
      expect(viewport.height).toBeGreaterThan(0)
      expect(viewport.scrollHeight - viewport.height).toBeGreaterThanOrEqual(1500)
    }
    expect(geometry[0]!.scrollWidth - geometry[0]!.width).toBeGreaterThanOrEqual(700)
  }

  async function setListPosition(top: number, left: number, secondaryTop: number) {
    await invoke('_setPosition', top, left, secondaryTop)
    await expectListPosition(top, left, secondaryTop)
    // 等待真实 scroll 事件到达业务 hook 后才允许离页采集。
    await expect.poll(async () => (await snapshot()).observed).toEqual({ primaryTop: top, secondaryTop })
  }

  function historySnapshot() {
    return page.evaluate(() => {
      const host = globalThis as unknown as WebFixtureHost
      return {
        length: history.length,
        state: history.state as unknown,
        url: location.href,
        pages: host.getCurrentPages().map(({ route, options, webviewId }) => ({ route, options, webviewId })),
      }
    })
  }

  beforeEach(async () => {
    pageErrors = []
    page = await browser!.newPage({ viewport: { width: 400, height: 800 } })
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(new URL(NATIVE, baseUrl).href)
    await waitForRoute(NATIVE)
    await invoke('_reset')
    expect((await snapshot()).automatic).toBe(true)
  })

  it('restores both axes and independent containers after recreation without mixing query keys', async () => {
    const feedA = `${LIST}?feed=a`
    const feedB = `${LIST}?feed=b`
    await navigate('reLaunch', feedA)
    const first = await snapshot()
    assert(first.instance !== undefined)
    await setListPosition(420, 80, 610)
    await navigate('reLaunch', feedB)
    await expectListPosition(0, 0, 0)
    await setListPosition(180, 35, 250)
    await navigate('reLaunch', feedA)
    await expectListPosition(420, 80, 610)
    const restored = await snapshot()
    expect(restored.instance).not.toBe(first.instance)
    const capture = restored.records.findIndex(record => record.instance === first.instance && record.phase === 'capture')
    const unload = restored.records.findIndex(record => record.instance === first.instance && record.phase === 'unload')
    expect(capture).toBeGreaterThanOrEqual(0)
    expect(unload).toBeGreaterThan(capture)
    expect(restored.records[capture]).toMatchObject({ primaryTop: 420, secondaryTop: 610 })
    expect(restored.records).toContainEqual(expect.objectContaining({ instance: restored.instance, phase: 'restore:applied', ready: true, contentReady: true }))
    expect(await page.locator(ACTIVE).locator('#feature1087-marker').textContent()).toBe('saved:420:80:610')
    await navigate('reLaunch', feedB)
    await expectListPosition(180, 35, 250)
    expect((await snapshot()).errors).toEqual([])
  })

  it('waits for business content readiness and repeatedly restores actual rendered lists', async () => {
    const route = `${LIST}?manual=1`
    await navigate('reLaunch', route)
    await invoke('_loadContent')
    await setListPosition(480, 90, 660)
    await navigate('reLaunch', NATIVE)
    await navigate('reLaunch', route)
    const initial = await snapshot()
    expect(initial.contentReady).toBe(false)
    expect(initial.records.some(record => record.instance === initial.instance && record.phase === 'restore:applied')).toBe(false)
    expect(await page.locator(ACTIVE).locator('#feature1087-content').count()).toBe(0)
    expect((await listGeometry()).map(({ top, left }) => ({ top, left }))).toEqual([{ top: 0, left: 0 }, { top: 0, left: 0 }])
    await invoke('_loadContent')
    await expect.poll(() => page.locator(ACTIVE).locator('#feature1087-content').evaluate(element => element.getBoundingClientRect().height)).toBe(1800)
    await expectListPosition(0, 0, 0)
    expect((await snapshot()).records.some(record => record.instance === initial.instance && record.phase === 'restore:applied')).toBe(false)
    expect(await invoke('_restore')).toEqual([true, true, true])
    await expectListPosition(480, 90, 660)
    await setListPosition(110, 20, 130)
    expect(await invoke('_restore')).toEqual([true, true, true])
    await expectListPosition(480, 90, 660)
    expect(await page.locator(ACTIVE).locator('#feature1087-marker').textContent()).toBe('saved:480:90:660')
    expect((await snapshot()).errors).toEqual([])
  })

  it('keeps repeated active-tab switches inert through real Back/Forward and captures the latest retained position', async () => {
    const tabUrl = `${TAB}?entry=initial`
    await navigate('switchTab', tabUrl)
    await setListPosition(290, 45, 440)
    const original = await snapshot()
    assert(original.instance !== undefined)
    const restores = original.records.filter(record => record.instance === original.instance && record.phase === 'restore:applied')
    await navigate('switchTab', TAB_PEER)
    const previousHistory = await historySnapshot()
    await navigate('switchTab', tabUrl)
    await expectListPosition(290, 45, 440)
    await setListPosition(620, 75, 810)
    const beforeNoop = await snapshot()
    const tabHistory = await historySnapshot()
    expect(tabHistory.length).toBe(previousHistory.length + 1)
    expect(tabHistory.url).toBe(new URL(tabUrl, baseUrl).href)
    const noops = await page.evaluate(async (tabRoute) => {
      const host = globalThis as unknown as WebFixtureHost
      const current = host.getCurrentPages().at(-1)!
      const state = history.state as unknown
      const results = []
      const callbacks: string[] = []
      for (let repeat = 0; repeat < 3; repeat++) {
        const result = await host.wx.switchTab({
          url: `${tabRoute}?ignored=${repeat}`,
          success: value => callbacks.push(`success:${value.errMsg}`),
          complete: value => callbacks.push(`complete:${value.errMsg}`),
        })
        results.push({
          result,
          sameState: history.state === state,
          samePage: host.getCurrentPages().length === 1 && host.getCurrentPages()[0] === current,
          length: history.length,
          url: location.href,
          options: { ...current.options },
          records: current._snapshot().records,
        })
      }
      return { results, callbacks }
    }, TAB)
    expect(noops.callbacks).toEqual(Array.from({ length: 3 }, () => ['success:switchTab:ok', 'complete:switchTab:ok']).flat())
    for (const noop of noops.results) {
      expect(noop).toEqual({
        result: { errMsg: 'switchTab:ok' },
        sameState: true,
        samePage: true,
        length: tabHistory.length,
        url: tabHistory.url,
        options: { entry: 'initial' },
        records: beforeNoop.records,
      })
    }
    expect(await historySnapshot()).toEqual(tabHistory)
    await expectListPosition(620, 75, 810)

    // 不伪造 popstate/hashchange，也不 replaceState；Chromium 真实保留前进项。
    await page.evaluate(() => history.back())
    await waitForRoute(TAB_PEER)
    expect(await historySnapshot()).toEqual({ ...previousHistory, length: tabHistory.length })
    await page.evaluate(() => history.forward())
    await waitForRoute(tabUrl)
    expect(await historySnapshot()).toEqual(tabHistory)
    await expectListPosition(620, 75, 810)
    const retained = await snapshot()
    expect(retained.instance).toBe(original.instance)
    expect(retained.records.filter(record => record.instance === original.instance && record.phase === 'restore:applied')).toEqual(restores)
    expect(retained.records.some(record => record.instance === original.instance && record.phase === 'unload')).toBe(false)

    await setListPosition(830, 95, 1020)
    const captureCount = retained.records.filter(record => record.instance === original.instance && record.phase === 'capture').length
    await navigate('navigateTo', NATIVE)
    const captures = (await snapshot()).records.filter(record => record.instance === original.instance && record.phase === 'capture')
    expect(captures).toHaveLength(captureCount + 1)
    expect(captures.at(-1)).toMatchObject({ primaryTop: 830, secondaryTop: 1020 })
    await navigate('reLaunch', tabUrl)
    await expectListPosition(830, 95, 1020)
    expect((await snapshot()).instance).not.toBe(original.instance)
    expect(await page.locator(ACTIVE).locator('#feature1087-marker').textContent()).toBe('saved:830:95:1020')
    expect((await snapshot()).errors).toEqual([])
  })

  it('restores the real page scroll container after destruction and on an explicit repeat', async () => {
    const expectPagePosition = async (top: number) => {
      await expect.poll(() => page.locator('#app').evaluate(element => element.scrollTop), { timeout: 10_000 }).toBe(top)
      expect(await page.locator('#app').evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(720)
    }
    await navigate('reLaunch', DOCUMENT)
    const first = await snapshot()
    assert(first.instance !== undefined)
    await invoke('_setPosition', 720)
    await expectPagePosition(720)
    await navigate('redirectTo', NATIVE)
    const left = await snapshot()
    const capture = left.records.findIndex(record => record.instance === first.instance && record.phase === 'capture')
    expect(capture).toBeGreaterThanOrEqual(0)
    expect(left.records.findIndex(record => record.instance === first.instance && record.phase === 'unload')).toBeGreaterThan(capture)
    await navigate('reLaunch', DOCUMENT)
    await expectPagePosition(720)
    const restored = await snapshot()
    expect(restored.instance).not.toBe(first.instance)
    expect(restored.records).toContainEqual(expect.objectContaining({ instance: restored.instance, phase: 'restore:applied', ready: true }))
    await invoke('_setPosition', 120)
    await expectPagePosition(120)
    expect(await invoke('_restore')).toBe(true)
    await expectPagePosition(720)
    expect((await snapshot()).errors).toEqual([])
  })
})
