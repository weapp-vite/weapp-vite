import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function writeJson(target: string, value: Record<string, any>) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(value, null, 2))
}

function writeScript(target: string, source: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

function writeText(target: string, source: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, source)
}

export function cleanupTempDirs(tempDirs: string[]) {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

export function createBaseFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-base-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/index/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    __e2eData: {
      greeting: 'Hello',
      target: 'index snapshot',
    },
    __e2eBlur: null,
    __e2eChange: null,
    __e2eInput: null,
    __e2eResult: {
      status: 'ready',
      detail: 'rendered',
    },
    __e2eTap: null,
  },
  onTap(event) {
    this.setData({
      '__e2eResult.status': 'tapped',
      '__e2eResult.detail': 'tap handled',
      __e2eTap: {
        currentTarget: event?.currentTarget ?? null,
        target: event?.target ?? null,
      },
    })
  },
  onInput(event) {
    this.setData({
      __e2eInput: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
  onChange(event) {
    this.setData({
      __e2eChange: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
  onBlur(event) {
    this.setData({
      __e2eBlur: {
        detail: event?.detail ?? null,
        type: event?.type ?? '',
      },
    })
  },
})
`)
  writeText(path.join(root, 'dist/pages/index/index.wxml'), `
<view id="greeting-button" data-phase="initial" data-card-type="primary" bind:tap="onTap">{{__e2eData.greeting}}</view>
<input id="greeting-input" data-field="greeting" bindinput="onInput" bindchange="onChange" bindblur="onBlur" value="{{__e2eData.greeting}}" />
<view class="panel-row">Status: {{__e2eResult.status}}</view>
<view class="panel-row">Detail: {{__e2eResult.detail}}</view>
<view class="panel-row">Greeting: {{__e2eData.greeting}}</view>
<view class="panel-row">Target: {{__e2eData.target}}</view>
`)

  return root
}

export function createNavigationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-session-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })

  writeJson(path.join(root, 'dist/app.json'), {
    pages: [
      'pages/home/index',
      'pages/detail/index',
      'pages/settings/index',
      'pages/profile/index',
    ],
    tabBar: {
      list: [
        { pagePath: 'pages/home/index', text: 'Home' },
        { pagePath: 'pages/profile/index', text: 'Profile' },
      ],
    },
  })

  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')

  writeScript(path.join(root, 'dist/pages/home/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('home:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('home:onShow')
  },
  onReady() {
    this.push('home:onReady')
  },
  onHide() {
    this.push('home:onHide')
  },
  onUnload() {
    this.push('home:onUnload')
  },
  onTabItemTap(options) {
    this.push('home:onTabItemTap:' + JSON.stringify(options))
  },
  goDetail() {
    wx.navigateTo({
      url: '../detail/index?from=home',
    })
  },
  goDetailWithCallbacks() {
    wx.navigateTo({
      url: '../detail/index?from=home-callback',
      success: () => this.push('home:navigateTo:success'),
      complete: () => this.push('home:navigateTo:complete'),
    })
  },
  goMissingWithCallbacks() {
    wx.navigateTo({
      url: '../missing/index',
      fail: (error) => this.push('home:navigateTo:fail:' + error.message),
      complete: () => this.push('home:navigateTo:complete'),
    })
  },
  goProfile() {
    wx.switchTab({
      url: '/pages/profile/index',
    })
  },
  goProfileWithQueryCallbacks() {
    wx.switchTab({
      url: '/pages/profile/index?from=home',
      fail: (error) => this.push('home:switchTab:fail:' + error.message),
      complete: () => this.push('home:switchTab:complete'),
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/detail/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('detail:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('detail:onShow')
  },
  onReady() {
    this.push('detail:onReady')
  },
  onHide() {
    this.push('detail:onHide')
  },
  onUnload() {
    this.push('detail:onUnload')
  },
  replaceProfile() {
    wx.redirectTo({
      url: '/pages/settings/index?from=detail',
    })
  },
  goSettings() {
    wx.navigateTo({
      url: '/pages/settings/index?from=detail-stack',
    })
  },
  backHome(delta) {
    wx.navigateBack({
      delta,
    })
  },
  relaunchProfile() {
    wx.reLaunch({
      url: '/pages/profile/index?mode=relaunch',
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/settings/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('settings:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('settings:onShow')
  },
  onReady() {
    this.push('settings:onReady')
  },
  onHide() {
    this.push('settings:onHide')
  },
  onUnload() {
    this.push('settings:onUnload')
  },
  back(delta) {
    wx.navigateBack({
      delta,
    })
  },
})
`)

  writeScript(path.join(root, 'dist/pages/profile/index.js'), `
const pushes = globalThis.__testLogPushes ||= []

Page({
  data: {
    logs: [],
  },
  push(message) {
    pushes.push(message)
    this.setData({
      logs: pushes.slice(),
    })
  },
  onLoad(query) {
    this.push('profile:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('profile:onShow')
  },
  onReady() {
    this.push('profile:onReady')
  },
  onHide() {
    this.push('profile:onHide')
  },
  onUnload() {
    this.push('profile:onUnload')
  },
  onTabItemTap(options) {
    this.push('profile:onTabItemTap:' + JSON.stringify(options))
  },
})
`)

  return root
}

export function createPageEventsFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-page-events-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/events/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), 'App({})\n')
  writeScript(path.join(root, 'dist/pages/events/index.js'), `
Page({
  data: {
    logs: [],
    callbacks: [],
    scrollTop: 0,
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  runScroll(top) {
    wx.pageScrollTo({
      scrollTop: top,
      success: () => {
        this.setData({
          callbacks: [...this.data.callbacks, 'success'],
        })
      },
      complete: () => {
        this.setData({
          callbacks: [...this.data.callbacks, 'complete'],
        })
      },
    })
  },
  onPageScroll(options) {
    this.push('onPageScroll:' + JSON.stringify(options))
    this.setData({
      scrollTop: options?.scrollTop ?? 0,
    })
  },
  onPullDownRefresh() {
    this.push('onPullDownRefresh')
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    this.push('onReachBottom')
  },
  onResize(options) {
    this.push('onResize:' + JSON.stringify(options))
  },
  onRouteDone(options) {
    this.push('onRouteDone:' + JSON.stringify(options))
  },
})
`)

  return root
}

export function createAppLifecycleFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-app-lifecycle-'))

  writeJson(path.join(root, 'project.config.json'), {
    appid: 'wx123',
    miniprogramRoot: 'dist',
  })
  writeJson(path.join(root, 'dist/app.json'), {
    pages: ['pages/home/index'],
  })
  writeScript(path.join(root, 'dist/app.js'), `
App({
  globalData: {
    logs: [],
    ready: true,
  },
  push(message) {
    this.globalData.logs.push(message)
  },
  onLaunch(options) {
    this.push('onLaunch:' + JSON.stringify(options))
  },
  onShow(options) {
    this.push('onShow:' + JSON.stringify(options))
  },
  onPageNotFound(options) {
    this.push('onPageNotFound:' + JSON.stringify(options))
  },
})
`)
  writeScript(path.join(root, 'dist/pages/home/index.js'), `
Page({
  data: {
    ok: true,
  },
})
`)

  return root
}
