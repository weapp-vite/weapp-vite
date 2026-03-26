import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
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
})
