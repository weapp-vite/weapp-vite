import type { HeadlessWx } from '../src/host'
import fs from 'node:fs'
import path from 'node:path'
import { WEVU_ROUTE_EVENT_CONTRACT_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { querySelectorAll } from '../src/view/selectors'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { routeEventFiles } from './helpers/routeEvents'

interface RouteRecord {
  stage: string
  path: string
  routeEventId: string
  webviewId: number
  openType: string
  ready: boolean
}

const tempDirs: string[] = []
const sessions: Array<{ close: () => void | Promise<void> }> = []

function createProject() {
  const projectPath = createBaseFixture()
  tempDirs.push(projectPath)
  for (const [file, source] of routeEventFiles) {
    const output = path.join(projectPath, 'dist', file)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, source)
  }
  return projectPath
}

afterEach(async () => {
  for (const session of sessions.splice(0)) {
    await session.close()
  }
  cleanupTempDirs(tempDirs)
})

describe.each(['node', 'browser'] as const)('%s native route listener contract', (provider) => {
  function createSession() {
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath: createProject() })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(routeEventFiles) })
    sessions.push(session)
    return session
  }

  it('captures a destroyed page before its teardown and completes only after target readiness', async () => {
    const session = createSession()
    const home = session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const wx = app.getWx() as HeadlessWx
    const events = app.globalData.events as RouteRecord[]
    await vi.waitFor(() => expect(events.at(-1)?.stage).toBe('done'))
    expect(events[0]).toMatchObject({ stage: 'before', openType: 'appLaunch', path: home.route })
    expect(wx[WEVU_ROUTE_EVENT_CONTRACT_KEY]).toBe(1)
    expect(wx.getAppBaseInfo()?.SDKVersion).toBe('0.0.0')
    app.globalData.order.length = 0
    events.length = 0

    wx.redirectTo({ url: '/pages/detail/index?id=42' })
    expect(events.map(event => event.stage)).toEqual(['before', 'unload', 'route'])
    expect(events[0]).toMatchObject({ path: 'pages/detail/index', query: { id: '42' }, stack: [home.route], renderer: 'webview' })
    expect(events[1]).toMatchObject({ path: home.route, pageInStack: true, unloaded: false })
    expect(app.globalData.unloadedPages[0]).toBe(home)
    expect(app.globalData.order).toEqual([
      'before:pages/detail/index',
      'unload:pages/home/index',
      'destroy:pages/home/index',
      'detached:pages/home/index',
      'load:pages/detail/index',
      'show:pages/detail/index',
      'route:pages/detail/index',
    ])
    expect(events[2]).toMatchObject({ ready: false, stack: ['pages/detail/index'] })
    await vi.waitFor(() => expect(events.at(-1)?.stage).toBe('done'))
    expect(events[3]).toMatchObject({ path: 'pages/detail/index', ready: true, query: { id: '42' } })
    expect(events.map(event => event.routeEventId)).toEqual(Array.from({ length: 4 }).fill(events[0]!.routeEventId))
    expect(events[3]!.webviewId).toBe(events[0]!.webviewId)
    expect(events[1]!.webviewId).not.toBe(events[0]!.webviewId)
  })

  it('preserves retained page identity across back and tabs without reporting a no-op as a new route', async () => {
    const session = createSession()
    const home = session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const events = app.globalData.events as RouteRecord[]
    await vi.waitFor(() => expect(events.at(-1)?.stage).toBe('done'))
    const homeId = events.at(-1)!.webviewId
    session.navigateTo('/pages/detail/index')
    session.navigateBack()
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', openType: 'navigateBack', webviewId: homeId }))
    expect(session.getCurrentPages()).toEqual([home])
    expect(home.data.unloaded).toBe(false)

    const tabA = session.switchTab('/pages/tab-a/index')!
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', path: tabA.route }))
    const tabAId = events.at(-1)!.webviewId
    session.switchTab('/pages/tab-b/index')
    session.switchTab('/pages/tab-a/index')
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', path: tabA.route, webviewId: tabAId }))
    expect(session.getCurrentPages()[0]).toBe(tabA)
    expect(tabA.data.unloaded).toBe(false)
    const beforeNoop = events.slice()
    session.switchTab('/pages/tab-a/index')
    session.navigateBack()
    expect(events).toEqual(beforeNoop)
    const ids = events.filter(event => event.stage === 'before').map(event => event.routeEventId)
    expect(new Set(ids).size).toBe(ids.length)

    session.reLaunch('/pages/home/index')
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', openType: 'reLaunch' }))
    expect(app.globalData.unloadedPages.filter((page: unknown) => page === tabA)).toEqual([tabA])
    expect(events.at(-1)!.webviewId).not.toBe(homeId)
  })

  it('keeps delayed done events associated with the active accepted operation', async () => {
    const session = createSession()
    session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const events = app.globalData.events as RouteRecord[]
    session.navigateTo('/pages/detail/index')
    session.redirectTo('/pages/other/index')
    const accepted = events.filter(event => event.stage === 'route').at(-1)!
    await vi.waitFor(() => expect(events.filter(event => event.stage === 'done')).toEqual([
      expect.objectContaining({ path: 'pages/other/index', routeEventId: accepted.routeEventId, webviewId: accepted.webviewId, ready: true }),
    ]))
    expect(app.globalData.order).not.toContain('ready:pages/detail/index')
  })

  it.each(['load', 'ready'])('does not complete a page superseded in its %s lifecycle', async (hook) => {
    const session = createSession()
    session.reLaunch(`/pages/home/index?mode=redirect-${hook}`)
    const events = session.getApp()!.globalData.events as RouteRecord[]
    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ stage: 'done', path: 'pages/other/index' }))
    expect(events.filter(event => event.stage === 'done').map(event => event.path)).toEqual(['pages/other/index'])
  })

  it('does not emit accepted stages for invalid routes or failed page initialization', async () => {
    const session = createSession()
    session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const events = app.globalData.events as RouteRecord[]
    const wx = app.getWx() as HeadlessWx
    await vi.waitFor(() => expect(events.at(-1)?.stage).toBe('done'))
    events.length = 0
    const fail = vi.fn()
    wx.navigateTo({ url: '/pages/missing/index', fail })
    wx.navigateTo({ url: '/pages/tab-a/index', fail })
    wx.switchTab({ url: '/pages/detail/index', fail })
    expect(fail).toHaveBeenCalledTimes(3)
    expect(events).toEqual([])
    wx.navigateTo({ url: '/pages/detail/index?mode=throw', fail })
    expect(fail).toHaveBeenCalledTimes(4)
    await Promise.resolve()
    expect(events.map(event => event.stage)).toEqual(['before'])
  })

  it('removes individual and all listeners for every route phase', async () => {
    const session = createSession()
    session.reLaunch('/pages/home/index')
    const app = session.getApp()!
    const wx = app.getWx() as HeadlessWx
    await vi.waitFor(() => expect(app.globalData.events.at(-1)?.stage).toBe('done'))
    const removed = vi.fn()
    const remaining = vi.fn()
    for (const name of ['BeforeAppRoute', 'BeforePageUnload', 'AppRoute', 'AppRouteDone'] as const) {
      wx[`on${name}`](removed)
      wx[`on${name}`](remaining)
      wx[`off${name}`](removed)
    }
    session.redirectTo('/pages/detail/index')
    await vi.waitFor(() => expect(remaining).toHaveBeenCalledTimes(4))
    expect(removed).not.toHaveBeenCalled()
    for (const name of ['BeforeAppRoute', 'BeforePageUnload', 'AppRoute', 'AppRouteDone'] as const) {
      wx[`off${name}`]()
    }
    session.redirectTo('/pages/other/index')
    await vi.waitFor(() => expect(session.getCurrentPages().at(-1)?.data.ready).toBe(true))
    expect(remaining).toHaveBeenCalledTimes(4)
  })

  it('captures the current scroll position before hide changes the outgoing page', async () => {
    const session = createSession()
    const page = session.reLaunch('/pages/home/index')
    const wx = session.getApp()!.getWx() as HeadlessWx
    const captured: number[] = []
    wx.pageScrollTo({ scrollTop: 320, duration: 0 })
    page.onHide = () => wx.pageScrollTo({ scrollTop: 0, duration: 0 })
    wx.onBeforeAppRoute(() => {
      wx.createSelectorQuery().selectViewport().scrollOffset((result) => {
        if (result && !Array.isArray(result)) {
          captured.push(result.scrollTop)
        }
      }).exec()
    })
    session.navigateTo('/pages/detail/index')
    expect(captured).toEqual([320])
    expect(page.__scrollTop__).toBe(0)
  })

  it('observes independent native scroll coordinates and does not reset user scrolling on unchanged bindings', async () => {
    const session = createSession()
    const page = session.reLaunch('/pages/home/index')
    page.setData({ top: 240, left: 65, secondTop: 90 })
    await vi.waitFor(() => expect(page.data.scroll).toEqual({ scrollTop: 240, scrollLeft: 65 }))
    expect(page.data.secondScroll).toEqual({ scrollTop: 90, scrollLeft: 0 })
    expect(page.measure('#primary')).toEqual({ scrollTop: 240, scrollLeft: 65 })
    expect(page.measure('#secondary')).toEqual({ scrollTop: 90, scrollLeft: 0 })

    const node = querySelectorAll(session.renderCurrentPage().root, '#primary')[0]!
    session.dispatchNativeNodeEvent(node, 'scroll', { detail: { scrollTop: 380, scrollLeft: 110 } })
    page.setData({ unrelated: true })
    await Promise.resolve()
    expect(page.measure('#primary')).toEqual({ scrollTop: 380, scrollLeft: 110 })
    page.setData({ top: 0, left: 0 })
    await vi.waitFor(() => expect(page.data.scroll).toEqual({ scrollTop: 0, scrollLeft: 0 }))
    page.setData({ top: 240, left: 65 })
    await vi.waitFor(() => expect(page.data.scroll).toEqual({ scrollTop: 240, scrollLeft: 65 }))
    expect(page.measure('#primary')).toEqual({ scrollTop: 240, scrollLeft: 65 })
  })
})

it('routes navigator descendant taps, native back and tabs through the public testing bridge', async () => {
  const miniProgram = await launch({ projectPath: createProject() })
  sessions.push(miniProgram)
  const home = await miniProgram.reLaunch('/pages/home/index')
  await (await home.$('#primary'))!.trigger('scroll', { detail: { scrollTop: 330, scrollLeft: 45 } })
  expect(await home.data('scroll')).toEqual({ scrollTop: 330, scrollLeft: 45 })
  expect(await home.callMethod('measure', '#primary')).toEqual({ scrollTop: 330, scrollLeft: 45 })
  await (await home.$('#forward-label'))!.tap()
  const detail = await miniProgram.currentPage()
  expect(detail?.path).toBe('pages/detail/index')
  expect(detail?.query).toEqual({ from: 'navigator' })
  await (await detail!.$('#back'))!.tap()
  expect((await miniProgram.currentPage())?.pageId).toBe(home.pageId)
  await (await home.$('#tab'))!.tap()
  expect((await miniProgram.currentPage())?.path).toBe('pages/tab-a/index')
})
