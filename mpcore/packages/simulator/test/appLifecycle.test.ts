import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { cleanupTempDirs, createAppLifecycleFixture } from './helpers'

describe('app lifecycle alignment', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('passes launch/show options into App hooks and wx listeners on bootstrap', () => {
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
    const launchOptions = session.getLaunchOptions()
    expect(app.globalData.lifecycle.showFirst).toEqual([launchOptions, launchOptions])
    expect(app.globalData.lifecycle.showLate).toEqual([])
    expect(app.globalData.lifecycle.launchShows).toEqual([launchOptions])
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

  it('keeps the first explicit show in cold App-before-wx order', () => {
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
    const serializedOptions = JSON.stringify(showOptions)
    expect(app.globalData.logs).toEqual([
      `onLaunch:${serializedOptions}`,
      `onShow:${serializedOptions}`,
    ])
    expect(app.globalData.lifecycle.timeline).toEqual([
      `app:onLaunch:${serializedOptions}`,
      `app:onShow:${serializedOptions}`,
      `wx:onAppShow:mutate:${serializedOptions}`,
      `wx:onAppShow:first:${serializedOptions}`,
      `wx:onAppShow:first:${serializedOptions}`,
      `wx:onAppShow:launch:${serializedOptions}`,
    ])
    expect(app.globalData.lifecycle.appShows).toEqual([showOptions])
    expect(app.globalData.lifecycle.showFirst).toEqual([showOptions, showOptions])
    expect(app.globalData.lifecycle.showLate).toEqual([])
    expect(app.globalData.lifecycle.launchShows).toEqual([showOptions])
    expect(session.getLaunchOptions()).toEqual(showOptions)
    expect(session.getEnterOptions()).toEqual(showOptions)
  })

  it('preserves duplicate callback snapshots and native warm transition order', () => {
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

    lifecycle.timeline.length = 0
    session.triggerAppHide(hideOptions)
    session.triggerAppShow(showOptions)

    const serializedHideOptions = JSON.stringify(hideOptions)
    const serializedShowOptions = JSON.stringify(showOptions)
    expect(lifecycle.timeline).toEqual([
      `wx:onAppHide:mutate:${serializedHideOptions}`,
      `wx:onAppHide:first:${serializedHideOptions}`,
      `wx:onAppHide:first:${serializedHideOptions}`,
      `app:onHide:${serializedHideOptions}`,
      `wx:onAppShow:launch:${serializedShowOptions}`,
      `wx:onAppShow:late:${serializedShowOptions}`,
      `app:onShow:${serializedShowOptions}`,
    ])
    expect(lifecycle.appHides).toEqual([hideOptions])
    expect(lifecycle.hideFirst).toEqual([hideOptions, hideOptions])
    expect(lifecycle.hideLate).toEqual([])
    expect(lifecycle.appShows).toEqual([launchOptions, showOptions])
    expect(lifecycle.showFirst).toEqual([launchOptions, launchOptions])
    expect(lifecycle.showLate).toEqual([showOptions])
    expect(lifecycle.launchShows).toEqual([launchOptions, showOptions])
    expect(session.getLaunchOptions()).toEqual(launchOptions)
    expect(session.getEnterOptions()).toEqual(showOptions)

    showOptions.query.from = 'mutated outside the session'
    showOptions.referrerInfo.appId = 'mutated-app'
    session.navigateTo('/pages/detail/index?from=navigation')

    expect(lifecycle.appShows).toEqual([launchOptions, showOptions])
    expect(lifecycle.showFirst).toEqual([launchOptions, launchOptions])
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

    const secondHideOptions = { reason: 1 as const }
    lifecycle.timeline.length = 0
    session.triggerAppHide(secondHideOptions)
    const serializedSecondHideOptions = JSON.stringify(secondHideOptions)
    expect(lifecycle.timeline).toEqual([
      `wx:onAppHide:late:${serializedSecondHideOptions}`,
      `app:onHide:${serializedSecondHideOptions}`,
    ])
    expect(lifecycle.appHides).toEqual([hideOptions, secondHideOptions])
    expect(lifecycle.hideFirst).toEqual([hideOptions, hideOptions])
    expect(lifecycle.hideLate).toEqual([secondHideOptions])

    const clearedShowOptions = session.getEnterOptions()
    lifecycle.timeline.length = 0
    app.clearShowListeners()
    session.triggerAppShow()
    expect(lifecycle.timeline).toEqual([
      `app:onShow:${JSON.stringify(clearedShowOptions)}`,
    ])
    expect(lifecycle.appShows).toEqual([launchOptions, showOptions, clearedShowOptions])
    expect(lifecycle.showLate).toEqual([showOptions])
    expect(lifecycle.launchShows).toEqual([launchOptions, showOptions])

    const clearedHideOptions = { reason: 3 as const }
    lifecycle.timeline.length = 0
    app.clearHideListeners()
    session.triggerAppHide(clearedHideOptions)
    expect(lifecycle.timeline).toEqual([
      `app:onHide:${JSON.stringify(clearedHideOptions)}`,
    ])
    expect(lifecycle.appHides).toEqual([hideOptions, secondHideOptions, clearedHideOptions])
    expect(lifecycle.hideLate).toEqual([secondHideOptions])
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
      showLate: Array<{ path: string }>
    }>('() => getApp().globalData.lifecycle')
    expect(lifecycle.appHides.at(-1)).toEqual({ reason: 3 })
    expect(lifecycle.hideFirst).toEqual([{ reason: 3 }, { reason: 3 }])
    expect(lifecycle.appShows.at(-1)).toEqual(showOptions)
    expect(lifecycle.showLate).toEqual([showOptions])

    await miniProgram.close()
  })

  it('clears app subscriptions on close without synthesizing an app hide', () => {
    const projectPath = createAppLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    session.reLaunch('/pages/home/index')
    const lifecycle = session.getApp()!.globalData.lifecycle
    const launchOptions = session.getLaunchOptions()

    session.close()

    expect(lifecycle.appHides).toEqual([])
    expect(lifecycle.hideFirst).toEqual([])
    expect(() => session.triggerAppHide({ reason: 0 })).toThrowError()
    expect(() => session.triggerAppShow()).toThrowError()
    expect(lifecycle.appHides).toEqual([])
    expect(lifecycle.showFirst).toEqual([launchOptions, launchOptions])
  })
})
