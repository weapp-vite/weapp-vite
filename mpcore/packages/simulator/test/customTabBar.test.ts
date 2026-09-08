import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'

function createCustomTabBarFixtureEntries(): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({
      pages: ['pages/home/index', 'pages/profile/index', 'pages/detail/index'],
      tabBar: {
        custom: true,
        list: [
          { pagePath: 'pages/home/index', text: 'Home' },
          { pagePath: 'pages/profile/index', text: 'Profile' },
        ],
      },
    })],
    ['app.js', 'App({ globalData: { attached: [], customPageLifetimes: [], detached: [], lifecycleLog: [], nextTabId: 0, normalPageLifetimes: [] } })'],
    ['pages/home/index.js', `
Page({
  onShow() {
    this.getTabBar().setData({ owner: 'home' })
  },
  openDetail() {
    wx.navigateTo({ url: '/pages/detail/index' })
  },
})
`],
    ['pages/home/index.json', JSON.stringify({
      usingComponents: {
        'status-card': '../../components/status-card/index',
      },
    })],
    ['pages/home/index.wxml', '<status-card /><view>home-page</view>'],
    ['pages/profile/index.js', `
Page({
  onShow() {
    this.getTabBar().setData({ owner: 'profile' })
  },
})
`],
    ['pages/profile/index.json', JSON.stringify({ usingComponents: {} })],
    ['pages/profile/index.wxml', '<view>profile-page</view>'],
    ['pages/detail/index.js', 'Page({})'],
    ['pages/detail/index.json', '{}'],
    ['pages/detail/index.wxml', '<view>detail-page</view>'],
    ['custom-tab-bar/index.js', `
Component({
  data: {
    instanceId: 0,
    owner: '',
    taps: 0,
  },
  lifetimes: {
    attached() {
      const app = getApp()
      const instanceId = ++app.globalData.nextTabId
      app.globalData.attached.push(instanceId)
      app.globalData.lifecycleLog.push(instanceId + ':attached')
      this.setData({ instanceId })
    },
    ready() {
      getApp().globalData.lifecycleLog.push(this.data.instanceId + ':ready')
    },
    detached() {
      const app = getApp()
      app.globalData.detached.push(this.data.instanceId)
      app.globalData.lifecycleLog.push(this.data.instanceId + ':detached')
    },
  },
  methods: {
    handleTap() {
      this.setData({ taps: this.data.taps + 1 })
    },
  },
  pageLifetimes: {
    show() {
      getApp().globalData.customPageLifetimes.push(this.data.instanceId + ':show')
    },
    hide() {
      getApp().globalData.customPageLifetimes.push(this.data.instanceId + ':hide')
    },
    resize() {
      getApp().globalData.customPageLifetimes.push(this.data.instanceId + ':resize')
    },
  },
})
`],
    ['components/status-card/index.js', `
Component({
  pageLifetimes: {
    show() {
      getApp().globalData.normalPageLifetimes.push('show')
    },
    hide() {
      getApp().globalData.normalPageLifetimes.push('hide')
    },
    resize() {
      getApp().globalData.normalPageLifetimes.push('resize')
    },
  },
})
`],
    ['components/status-card/index.json', JSON.stringify({ component: true })],
    ['components/status-card/index.wxml', '<view>normal-component</view>'],
    ['custom-tab-bar/index.json', JSON.stringify({ component: true })],
    ['custom-tab-bar/index.wxss', ''],
    ['custom-tab-bar/index.wxml', '<view id="custom-tab-marker" bindtap="handleTap">custom-tab-marker:{{owner}}:{{instanceId}}:{{taps}}</view>'],
  ]
}

function createStandardTabBarFixtureEntries(): Array<[string, string]> {
  return [
    ['project.config.json', JSON.stringify({ miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({
      pages: ['pages/home/index'],
      tabBar: {
        list: [{ pagePath: 'pages/home/index', text: 'Home' }],
      },
    })],
    ['app.js', 'App({})'],
    ['pages/home/index.js', 'Page({})'],
    ['pages/home/index.json', '{}'],
    ['pages/home/index.wxml', '<view>standard-tab-page</view>'],
  ]
}

function writeFixture(entries: Array<[string, string]>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-custom-tab-bar-'))
  for (const [filePath, source] of entries) {
    const target = path.join(root, filePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, source)
  }
  return root
}

describe('custom tabBar', () => {
  const tempDirs: string[] = []
  const sessions: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const session of sessions.splice(0)) {
      session.close()
    }
    for (const root of tempDirs.splice(0)) {
      fs.rmSync(root, { force: true, recursive: true })
    }
  })

  it('mounts one stable native component per tab page in the headless runtime', () => {
    const projectPath = writeFixture(createCustomTabBarFixtureEntries())
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })
    sessions.push(session)

    const home = session.reLaunch('/pages/home/index')
    const homeTabBar = home.getTabBar?.()
    expect(homeTabBar).toMatchObject({
      data: { instanceId: 1, owner: 'home', taps: 0 },
      is: 'custom-tab-bar/index',
    })
    expect(home.getTabBar?.()).toBe(homeTabBar)
    expect(session.getApp()?.globalData.attached).toEqual([1])
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:0')

    const homeTabBarScope = session.getScopeIdForComponent(homeTabBar)
    expect(homeTabBarScope).toBe('page:pages/home/index/custom-tab-bar')
    session.callScopeMethod(homeTabBarScope, 'handleTap', {
      currentTarget: { dataset: {}, id: 'custom-tab-marker' },
      target: { dataset: {}, id: 'custom-tab-marker' },
    })
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:1')

    const profile = session.switchTab('/pages/profile/index')
    const profileTabBar = profile?.getTabBar?.()
    expect(profileTabBar).not.toBe(homeTabBar)
    expect(profileTabBar?.data).toMatchObject({ instanceId: 2, owner: 'profile', taps: 0 })
    expect(session.getApp()?.globalData.attached).toEqual([1, 2])
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:profile:2:0')

    const revisitedHome = session.switchTab('/pages/home/index')
    expect(revisitedHome).toBe(home)
    expect(revisitedHome?.getTabBar?.()).toBe(homeTabBar)
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:1')

    const detail = session.navigateTo('/pages/detail/index')
    expect(detail.getTabBar).toBeUndefined()
    expect(session.renderCurrentPage().wxml).not.toContain('custom-tab-marker')
    expect(session.getApp()?.globalData.detached).toEqual([])

    expect(session.navigateBack()).toBe(home)
    expect(home.getTabBar?.()).toBe(homeTabBar)
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:1')

    const relaunchedProfile = session.reLaunch('/pages/profile/index')
    expect(relaunchedProfile.getTabBar?.()).not.toBe(profileTabBar)
    expect(relaunchedProfile.getTabBar?.()?.data).toMatchObject({ instanceId: 3, owner: 'profile' })
    expect(session.getApp()?.globalData.detached).toHaveLength(2)
    expect(session.getApp()?.globalData.detached).toEqual(expect.arrayContaining([1, 2]))
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:profile:3:0')

    const relaunchedDetail = session.reLaunch('/pages/detail/index')
    expect(relaunchedDetail.getTabBar).toBeUndefined()
    expect(session.getApp()?.globalData.detached).toHaveLength(3)
    expect(session.renderCurrentPage().wxml).not.toContain('custom-tab-marker')
  })

  it('keeps the same custom tabBar ownership contract in the browser runtime', () => {
    const files = createBrowserVirtualFiles(createCustomTabBarFixtureEntries())
    const session = createBrowserHeadlessSession({ files })
    sessions.push(session)

    const home = session.reLaunch('/pages/home/index')
    const homeTabBar = home.getTabBar?.()
    expect(homeTabBar?.data).toMatchObject({ instanceId: 1, owner: 'home', taps: 0 })
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:0')

    const homeTabBarScope = session.getScopeIdForComponent(homeTabBar)
    expect(homeTabBarScope).toBe('page:pages/home/index/custom-tab-bar')
    session.callTapBinding(homeTabBarScope!, 'handleTap')
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:1')

    const profile = session.switchTab('/pages/profile/index')
    const profileTabBar = profile?.getTabBar?.()
    expect(profileTabBar).not.toBe(homeTabBar)
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:profile:2:0')

    expect(session.switchTab('/pages/home/index')).toBe(home)
    expect(home.getTabBar?.()).toBe(homeTabBar)
    expect(session.renderCurrentPage().wxml).toContain('custom-tab-marker:home:1:1')

    const detail = session.navigateTo('/pages/detail/index')
    expect(detail.getTabBar).toBeUndefined()
    expect(session.renderCurrentPage().wxml).not.toContain('custom-tab-marker')
    expect(session.navigateBack()).toBe(home)
    expect(home.getTabBar?.()).toBe(homeTabBar)

    const relaunchedProfile = session.reLaunch('/pages/profile/index')
    expect(relaunchedProfile.getTabBar?.()).not.toBe(profileTabBar)
    expect(relaunchedProfile.getTabBar?.()?.data.instanceId).toBe(3)
    expect(session.getApp()?.globalData.detached).toHaveLength(2)

    const relaunchedDetail = session.reLaunch('/pages/detail/index')
    expect(relaunchedDetail.getTabBar).toBeUndefined()
    expect(session.getApp()?.globalData.detached).toHaveLength(3)
    expect(session.renderCurrentPage().wxml).not.toContain('custom-tab-marker')
  })

  it('suppresses custom tabBar page lifetimes across pre-render tab switches', () => {
    const entries = createCustomTabBarFixtureEntries()
    const projectPath = writeFixture(entries)
    tempDirs.push(projectPath)
    const headlessSession = createHeadlessSession({ projectPath })
    const browserSession = createBrowserHeadlessSession({
      files: createBrowserVirtualFiles(entries),
    })
    sessions.push(headlessSession, browserSession)

    headlessSession.reLaunch('/pages/home/index')
    headlessSession.switchTab('/pages/profile/index')
    headlessSession.switchTab('/pages/home/index')
    headlessSession.renderCurrentPage()

    browserSession.reLaunch('/pages/home/index')
    browserSession.switchTab('/pages/profile/index')
    browserSession.switchTab('/pages/home/index')
    browserSession.renderCurrentPage()

    const expectedLifecycle = [
      '1:attached',
      '2:attached',
      '1:ready',
    ]
    expect(headlessSession.getApp()?.globalData.lifecycleLog).toEqual(expectedLifecycle)
    expect(browserSession.getApp()?.globalData.lifecycleLog).toEqual(expectedLifecycle)
    expect(headlessSession.getApp()?.globalData.customPageLifetimes).toEqual([])
    expect(browserSession.getApp()?.globalData.customPageLifetimes).toEqual([])

    headlessSession.triggerResize({ size: { windowWidth: 375 } })
    headlessSession.switchTab('/pages/profile/index')
    headlessSession.switchTab('/pages/home/index')
    browserSession.triggerResize({ size: { windowWidth: 375 } })
    browserSession.switchTab('/pages/profile/index')
    browserSession.switchTab('/pages/home/index')

    const expectedNormalPageLifetimes = ['show', 'resize', 'hide', 'show']
    expect(headlessSession.getApp()?.globalData.customPageLifetimes).toEqual([])
    expect(browserSession.getApp()?.globalData.customPageLifetimes).toEqual([])
    expect(headlessSession.getApp()?.globalData.normalPageLifetimes).toEqual(expectedNormalPageLifetimes)
    expect(browserSession.getApp()?.globalData.normalPageLifetimes).toEqual(expectedNormalPageLifetimes)
  })

  it('does not add a page getTabBar component for a standard tabBar', () => {
    const entries = createStandardTabBarFixtureEntries()
    const projectPath = writeFixture(entries)
    tempDirs.push(projectPath)
    const headlessSession = createHeadlessSession({ projectPath })
    const browserSession = createBrowserHeadlessSession({
      files: createBrowserVirtualFiles(entries),
    })
    sessions.push(headlessSession, browserSession)

    const headlessPage = headlessSession.reLaunch('/pages/home/index')
    const browserPage = browserSession.reLaunch('/pages/home/index')

    expect(headlessPage.getTabBar).toBeUndefined()
    expect(browserPage.getTabBar).toBeUndefined()
    expect(headlessSession.renderCurrentPage().wxml).toContain('standard-tab-page')
    expect(browserSession.renderCurrentPage().wxml).toContain('standard-tab-page')
  })
})
