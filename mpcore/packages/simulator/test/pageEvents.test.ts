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
})
