import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { cleanupTempDirs, createAppLifecycleFixture } from './helpers'

describe('app lifecycle alignment', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('passes launch/show options into App hooks on bootstrap', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const app = session.bootstrap()

    expect(app.globalData.ready).toBe(true)
    expect(app.globalData.logs).toEqual([
      'onLaunch:{"path":"","query":{},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onShow:{"path":"","query":{},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
    ])
    expect(session.getWx().canIUse('onAppShow')).toBe(true)
    expect(session.getWx().canIUse('onAppHide')).toBe(true)
    expect(app.globalData.lifecycle.showFirst).toHaveLength(1)
    expect(app.globalData.lifecycle.showRemoved).toHaveLength(1)
    expect(app.globalData.lifecycle.showLate).toEqual([])
    expect(app.globalData.lifecycle.launchShows).toHaveLength(1)
  })

  it('uses the first entered page as launch/show path when bootstrapped by navigation', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    session.reLaunch('/pages/home/index?from=entry')

    const app = session.getApp()
    expect(app?.globalData.logs).toEqual([
      'onLaunch:{"path":"pages/home/index","query":{"from":"entry"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onShow:{"path":"pages/home/index","query":{"from":"entry"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
    ])
    const timeline = app?.globalData.lifecycle.timeline as string[]
    const pageLoadIndex = timeline.indexOf('page:home:onLoad')
    expect(pageLoadIndex).toBeGreaterThan(-1)
    expect(timeline.findIndex(entry => entry.startsWith('app:onLaunch:'))).toBeLessThan(pageLoadIndex)
    expect(timeline.findIndex(entry => entry.startsWith('app:onShow:'))).toBeLessThan(pageLoadIndex)
    expect(timeline.findIndex(entry => entry.startsWith('wx:onAppShow:'))).toBeLessThan(pageLoadIndex)
  })

  it('exposes launch and enter options through sync wx apis after bootstrap', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    session.reLaunch('/pages/home/index?from=entry')
    const app = session.getApp()

    app?.captureLaunchOptions()
    app?.captureEnterOptions()

    expect(app?.globalData.launchOptions).toEqual({
      path: 'pages/home/index',
      query: { from: 'entry' },
      referrerInfo: {
        appId: '',
        extraData: {},
      },
      scene: 1001,
    })
    expect(app?.globalData.enterOptions).toEqual({
      path: 'pages/home/index',
      query: { from: 'entry' },
      referrerInfo: {
        appId: '',
        extraData: {},
      },
      scene: 1001,
    })
    expect(session.getLaunchOptions()).toEqual(app?.globalData.launchOptions)
    expect(session.getEnterOptions()).toEqual(app?.globalData.enterOptions)
  })

  it('calls onPageNotFound with normalized route info before throwing', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    session.bootstrap()

    expect(() => session.reLaunch('/pages/missing/index?from=test')).toThrowError(
      'Unknown route for headless runtime navigation: /pages/missing/index?from=test',
    )

    const app = session.getApp()
    expect(app?.globalData.logs).toEqual([
      'onLaunch:{"path":"","query":{},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onShow:{"path":"","query":{},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onPageNotFound:{"path":"pages/missing/index","query":{"from":"test"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
    ])
  })

  it('bootstraps with missing target info before calling onPageNotFound', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    expect(() => session.reLaunch('/pages/missing/index?from=entry')).toThrowError(
      'Unknown route for headless runtime navigation: /pages/missing/index?from=entry',
    )

    const app = session.getApp()
    expect(app?.globalData.logs).toEqual([
      'onLaunch:{"path":"pages/missing/index","query":{"from":"entry"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onShow:{"path":"pages/missing/index","query":{"from":"entry"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
      'onPageNotFound:{"path":"pages/missing/index","query":{"from":"entry"},"referrerInfo":{"appId":"","extraData":{}},"scene":1001}',
    ])
  })

  it('uses the first explicit app show as a single cold-start transition', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    const showOptions = {
      path: 'pages/home/index',
      query: { from: 'cold-show' },
      referrerInfo: {
        appId: 'wx-cold-start',
        extraData: {},
      },
      scene: 1037,
    }

    session.triggerAppShow(showOptions)

    const app = session.getApp()!
    expect(app.globalData.logs).toEqual([
      `onLaunch:${JSON.stringify(showOptions)}`,
      `onShow:${JSON.stringify(showOptions)}`,
    ])
    expect(app.globalData.lifecycle.appShows).toEqual([showOptions])
    expect(app.globalData.lifecycle.showFirst).toEqual([showOptions])
    expect(app.globalData.lifecycle.launchShows).toEqual([showOptions])
    expect(session.getLaunchOptions()).toEqual(showOptions)
    expect(session.getEnterOptions()).toEqual(showOptions)
  })

  it('drives session-owned app transitions without changing launch options during navigation', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    session.reLaunch('/pages/home/index?from=entry')
    const app = session.getApp()!
    const lifecycle = app.globalData.lifecycle
    const launchOptions = session.getLaunchOptions()
    const hideOptions = { reason: 2 as const }
    const showOptions = {
      path: 'pages/detail/index',
      query: { from: 'resume' },
      referrerInfo: {
        appId: 'wx-resumer',
        extraData: {},
      },
      scene: 1037,
    }

    session.triggerAppHide(hideOptions)
    session.triggerAppShow(showOptions)

    expect(lifecycle.appHides).toEqual([hideOptions])
    expect(lifecycle.hideFirst).toEqual([hideOptions])
    expect(lifecycle.hideRemoved).toEqual([hideOptions])
    expect(lifecycle.hideLate).toEqual([])
    expect(lifecycle.appShows.at(-1)).toBe(showOptions)
    expect(lifecycle.showFirst.at(-1)).toBe(showOptions)
    expect(lifecycle.showRemoved).toHaveLength(1)
    expect(lifecycle.showLate).toEqual([showOptions])
    expect(lifecycle.launchShows.at(-1)).toBe(showOptions)
    expect(session.getLaunchOptions()).toEqual(launchOptions)
    expect(session.getEnterOptions()).toEqual(showOptions)

    showOptions.query.from = 'mutated outside the session'
    showOptions.referrerInfo.appId = 'mutated-app'
    session.navigateTo('/pages/detail/index?from=navigation')

    expect(lifecycle.appShows).toHaveLength(2)
    expect(lifecycle.showFirst).toHaveLength(2)
    expect(session.getLaunchOptions()).toEqual(launchOptions)
    expect(session.getEnterOptions()).toEqual({
      path: 'pages/detail/index',
      query: { from: 'resume' },
      referrerInfo: {
        appId: 'wx-resumer',
        extraData: {},
      },
      scene: 1037,
    })

    app.removeFirstShowListener()
    session.triggerAppShow()
    expect(lifecycle.showFirst).toHaveLength(2)
    expect(lifecycle.showLate).toHaveLength(2)
    expect(lifecycle.launchShows).toHaveLength(3)

    app.clearShowListeners()
    session.triggerAppShow()
    expect(lifecycle.appShows).toHaveLength(4)
    expect(lifecycle.showLate).toHaveLength(2)
    expect(lifecycle.launchShows).toHaveLength(3)

    const secondHideOptions = { reason: 1 as const }
    session.triggerAppHide(secondHideOptions)
    expect(lifecycle.hideFirst).toEqual([hideOptions, secondHideOptions])
    expect(lifecycle.hideRemoved).toEqual([hideOptions])
    expect(lifecycle.hideLate).toEqual([secondHideOptions])

    app.removeFirstHideListener()
    const thirdHideOptions = { reason: 0 as const }
    session.triggerAppHide(thirdHideOptions)
    expect(lifecycle.hideFirst).toHaveLength(2)
    expect(lifecycle.hideLate).toEqual([secondHideOptions, thirdHideOptions])

    app.clearHideListeners()
    session.triggerAppHide({ reason: 3 })
    expect(lifecycle.appHides).toHaveLength(4)
    expect(lifecycle.hideLate).toHaveLength(2)
  })

  it('forwards app controls through the testing session handle', async () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })
    const showOptions = {
      path: 'pages/detail/index',
      query: { from: 'testing-handle' },
      referrerInfo: {
        appId: '',
        extraData: {},
      },
      scene: 1001,
    }

    await miniProgram.triggerAppHide({ reason: 3 })
    await miniProgram.triggerAppShow(showOptions)

    const lifecycle = await miniProgram.evaluate<{
      appHides: Array<{ reason: number }>
      appShows: Array<{ path: string }>
      hideFirst: Array<{ reason: number }>
      showFirst: Array<{ path: string }>
    }>('() => getApp().globalData.lifecycle')
    expect(lifecycle.appHides.at(-1)).toEqual({ reason: 3 })
    expect(lifecycle.hideFirst.at(-1)).toEqual({ reason: 3 })
    expect(lifecycle.appShows.at(-1)).toEqual(showOptions)
    expect(lifecycle.showFirst.at(-1)).toEqual(showOptions)

    await miniProgram.close()
  })

  it('clears app subscriptions on close without synthesizing an app hide', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    session.reLaunch('/pages/home/index')
    const lifecycle = session.getApp()!.globalData.lifecycle

    session.close()

    expect(lifecycle.appHides).toEqual([])
    expect(lifecycle.hideFirst).toEqual([])
    expect(() => session.triggerAppHide({ reason: 0 })).toThrowError()
    expect(() => session.triggerAppShow()).toThrowError()
    expect(lifecycle.appHides).toEqual([])
    expect(lifecycle.showFirst).toHaveLength(1)
  })
})
