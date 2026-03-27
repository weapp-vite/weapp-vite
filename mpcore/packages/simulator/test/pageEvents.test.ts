import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { launch } from '../src/testing'
import { cleanupTempDirs, createPageEventsFixture } from './helpers'

describe('page event alignment', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('drives onPageScroll through wx.pageScrollTo and keeps success callbacks', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.runScroll(120)

    expect(page.data.scrollTop).toBe(120)
    expect(page.data.logs).toEqual([
      'onPageScroll:{"scrollTop":120}',
    ])
    expect(page.data.callbacks).toEqual(['success', 'complete'])
  })

  it('can trigger pull-down, reach-bottom, resize and route-done hooks from the testing bridge', async () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })

    const page = await miniProgram.reLaunch('/pages/events/index')
    await miniProgram.triggerPullDownRefresh()
    await miniProgram.triggerReachBottom()
    await miniProgram.triggerResize({
      size: {
        windowWidth: 375,
        windowHeight: 667,
      },
    })
    await miniProgram.triggerRouteDone({
      from: 'test',
    })
    await miniProgram.pageScrollTo(64)

    expect(await page.data('logs')).toEqual([
      'onPullDownRefresh',
      'onReachBottom',
      'onResize:{"size":{"windowWidth":375,"windowHeight":667}}',
      'onRouteDone:{"from":"test"}',
      'onPageScroll:{"scrollTop":64}',
    ])
    expect(await page.data('scrollTop')).toBe(64)
  })

  it('updates getSystemInfo results after resize events', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.readSystemInfo()

    expect(page.data.systemInfoSync).toContain('"windowWidth":375')
    expect(page.data.systemInfoAsync).toContain('"windowHeight":667')

    session.triggerResize({
      size: {
        windowWidth: 412,
        windowHeight: 915,
      },
    })
    page.readSystemInfo()

    expect(page.data.systemInfoSync).toContain('"windowWidth":412')
    expect(page.data.systemInfoSync).toContain('"windowHeight":915')
    expect(session.getSystemInfo()).toMatchObject({
      screenHeight: 915,
      screenWidth: 412,
      windowHeight: 915,
      windowWidth: 412,
    })
  })

  it('tracks pull-down refresh state and stop calls in headless runtime', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    session.reLaunch('/pages/events/index')
    expect(session.getPullDownRefreshState()).toEqual({
      active: false,
      stopCalls: 0,
    })

    session.triggerPullDownRefresh()

    expect(session.getPullDownRefreshState()).toEqual({
      active: false,
      stopCalls: 1,
    })
  })

  it('exposes compatibility info through getWindowInfo, getAppBaseInfo and canIUse', () => {
    const projectPath = createPageEventsFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/events/index')
    page.readCompatibilityInfo()

    expect(page.data.windowInfoSync).toContain('"windowWidth":375')
    expect(page.data.windowInfoAsync).toContain('"statusBarHeight":20')
    expect(page.data.appBaseInfoSync).toContain('"platform":"devtools"')
    expect(page.data.canIUseSummary).toContain('"getWindowInfo":true')
    expect(page.data.canIUseSummary).toContain('"getWindowInfoReturn":true')
    expect(page.data.canIUseSummary).toContain('"menuButtonRect":true')
    expect(page.data.canIUseSummary).toContain('"nextTick":true')
    expect(page.data.canIUseSummary).toContain('"missing":false')
    expect(page.data.menuButtonRect).toContain('"width":87')

    session.triggerResize({
      size: {
        windowWidth: 390,
        windowHeight: 844,
      },
    })
    page.readCompatibilityInfo()

    expect(page.data.windowInfoSync).toContain('"windowWidth":390')
    expect(page.data.menuButtonRect).toContain('"right":378')
    expect(session.getWindowInfo()).toMatchObject({
      screenHeight: 844,
      screenWidth: 390,
      windowHeight: 844,
      windowWidth: 390,
    })
    expect(session.getMenuButtonBoundingClientRect()).toMatchObject({
      right: 378,
      width: 87,
    })
    expect(session.getAppBaseInfo()).toMatchObject({
      host: {
        env: 'devtools',
      },
      platform: 'devtools',
    })
  })
})
