import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture, createNavigationFixture } from './helpers'

function writeFixtureFile(target: string, content: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

describe('HeadlessSession', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('bootstraps a built app and reLaunches a page', () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const app = session.bootstrap()
    expect(app).toBeTruthy()

    const page = session.reLaunch('/pages/index/index')
    expect(page.route).toBe('pages/index/index')
    expect(page.data.__e2eResult).toEqual({
      status: 'ready',
      detail: 'rendered',
    })
    expect(page.options).toEqual({})
    expect(page.__route__).toBe('pages/index/index')
    expect(session.getCurrentPages()).toHaveLength(1)
  })

  it('binds page methods to the page instance and applies setData', () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/index/index')
    expect(page.data.__e2eResult.status).toBe('ready')

    page.onTap()

    expect(page.data.__e2eResult).toEqual({
      status: 'tapped',
      detail: 'tap handled',
    })
  })

  it('runs unload and recreates the page on reLaunch', () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const firstPage = session.reLaunch('/pages/index/index')
    firstPage.setData({
      'transient.value': 1,
    })

    const secondPage = session.reLaunch('/pages/index/index')
    expect(secondPage).not.toBe(firstPage)
    expect(secondPage.data.transient).toBeUndefined()
    expect(session.getCurrentPages()).toHaveLength(1)
  })

  it('drives navigateTo and navigateBack with devtools-like lifecycle order', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index?entry=direct')
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{"entry":"direct"}',
      'home:onShow',
      'home:onReady',
    ])
    expect(homePage.options).toEqual({ entry: 'direct' })
    expect(homePage.__route__).toBe('pages/home/index')

    homePage.goDetail()

    const detailPage = session.getCurrentPages().at(-1)
    expect(detailPage?.route).toBe('pages/detail/index')
    expect(detailPage?.data.logs).toEqual([
      'home:onLoad:{"entry":"direct"}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
    ])

    detailPage?.backHome()

    expect(session.getCurrentPages()).toHaveLength(1)
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{"entry":"direct"}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onUnload',
      'home:onShow',
    ])
  })

  it('runs navigation success/fail/complete callbacks through wx api calls', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index')

    homePage.goDetailWithCallbacks()
    const detailPage = session.getCurrentPages().at(-1)
    expect(detailPage?.options).toEqual({ from: 'home-callback' })
    expect(detailPage?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home-callback"}',
      'detail:onShow',
      'detail:onReady',
    ])
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home-callback"}',
      'detail:onShow',
      'detail:onReady',
      'home:navigateTo:success',
      'home:navigateTo:complete',
    ])

    session.navigateBack()
    homePage.goMissingWithCallbacks()

    expect(session.getCurrentPages()).toHaveLength(1)
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home-callback"}',
      'detail:onShow',
      'detail:onReady',
      'home:navigateTo:success',
      'home:navigateTo:complete',
      'detail:onUnload',
      'home:onShow',
      'home:navigateTo:fail:Unknown route for headless runtime navigation: ../missing/index',
      'home:navigateTo:complete',
    ])
  })

  it('normalizes navigateBack delta and unloads intermediate pages from top to bottom', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index')
    homePage.goDetail()
    const detailPage = session.getCurrentPages().at(-1)
    detailPage?.goSettings()

    const settingsPage = session.getCurrentPages().at(-1)
    expect(settingsPage?.options).toEqual({ from: 'detail-stack' })
    expect(session.getCurrentPages().map(page => page.route)).toEqual([
      'pages/home/index',
      'pages/detail/index',
      'pages/settings/index',
    ])

    settingsPage?.back(0)

    expect(session.getCurrentPages().map(page => page.route)).toEqual([
      'pages/home/index',
      'pages/detail/index',
    ])
    expect(detailPage?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onHide',
      'settings:onLoad:{"from":"detail-stack"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onUnload',
      'detail:onShow',
    ])

    detailPage?.goSettings()
    const secondSettingsPage = session.getCurrentPages().at(-1)
    secondSettingsPage?.back(-2)

    expect(session.getCurrentPages().map(page => page.route)).toEqual([
      'pages/home/index',
      'pages/detail/index',
    ])

    detailPage?.goSettings()
    const thirdSettingsPage = session.getCurrentPages().at(-1)
    thirdSettingsPage?.back(99)

    expect(session.getCurrentPages().map(page => page.route)).toEqual([
      'pages/home/index',
    ])
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onHide',
      'settings:onLoad:{"from":"detail-stack"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onUnload',
      'detail:onShow',
      'detail:onHide',
      'settings:onLoad:{"from":"detail-stack"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onUnload',
      'detail:onShow',
      'detail:onHide',
      'settings:onLoad:{"from":"detail-stack"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onUnload',
      'detail:onUnload',
      'home:onShow',
    ])
  })

  it('supports redirectTo, switchTab and reLaunch stack transitions', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index')
    homePage.goDetail()

    const detailPage = session.getCurrentPages().at(-1)
    detailPage?.replaceProfile()

    const settingsPage = session.getCurrentPages().at(-1)
    expect(session.getCurrentPages()).toHaveLength(2)
    expect(settingsPage?.route).toBe('pages/settings/index')
    expect(settingsPage?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onUnload',
      'settings:onLoad:{"from":"detail"}',
      'settings:onShow',
      'settings:onReady',
    ])

    session.switchTab('/pages/home/index')

    expect(session.getCurrentPages()).toHaveLength(1)
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onUnload',
      'settings:onLoad:{"from":"detail"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onHide',
      'settings:onUnload',
      'home:onShow',
      'home:onTabItemTap:{"index":0,"pagePath":"pages/home/index","text":"Home"}',
    ])

    session.reLaunch('/pages/profile/index?mode=relaunch')

    expect(session.getCurrentPages()).toHaveLength(1)
    const relaunchedProfile = session.getCurrentPages()[0]
    expect(relaunchedProfile?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'detail:onLoad:{"from":"home"}',
      'detail:onShow',
      'detail:onReady',
      'detail:onUnload',
      'settings:onLoad:{"from":"detail"}',
      'settings:onShow',
      'settings:onReady',
      'settings:onHide',
      'settings:onUnload',
      'home:onShow',
      'home:onTabItemTap:{"index":0,"pagePath":"pages/home/index","text":"Home"}',
      'home:onUnload',
      'profile:onLoad:{"mode":"relaunch"}',
      'profile:onShow',
      'profile:onReady',
    ])
  })

  it('fires onTabItemTap when switching or retapping a tab page', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index')
    session.switchTab('/pages/profile/index')

    const profilePage = session.getCurrentPages()[0]
    expect(profilePage?.route).toBe('pages/profile/index')
    expect(profilePage?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'profile:onLoad:{}',
      'profile:onShow',
      'profile:onReady',
      'profile:onTabItemTap:{"index":1,"pagePath":"pages/profile/index","text":"Profile"}',
    ])

    session.switchTab('/pages/profile/index')

    expect(profilePage?.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:onHide',
      'profile:onLoad:{}',
      'profile:onShow',
      'profile:onReady',
      'profile:onTabItemTap:{"index":1,"pagePath":"pages/profile/index","text":"Profile"}',
      'profile:onTabItemTap:{"index":1,"pagePath":"pages/profile/index","text":"Profile"}',
    ])
    expect(homePage.options).toEqual({})
    expect(profilePage?.options).toEqual({})
  })

  it('rejects switchTab urls that contain query parameters', () => {
    const projectPath = createNavigationFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const homePage = session.reLaunch('/pages/home/index')
    homePage.goProfileWithQueryCallbacks()

    expect(session.getCurrentPages().map(page => page.route)).toEqual([
      'pages/home/index',
    ])
    expect(homePage.data.logs).toEqual([
      'home:onLoad:{}',
      'home:onShow',
      'home:onReady',
      'home:switchTab:fail:wx.switchTab() url cannot contain query in headless runtime: /pages/profile/index?from=home',
      'home:switchTab:complete',
    ])
  })

  it('tracks request mocks, storage sync and toast snapshots through wx api state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-api-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index'],
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    asyncClearSummary: '',
    asyncGetSummary: '',
    asyncInfoSummary: '',
    asyncRemoveSummary: '',
    asyncSetSummary: '',
    hideLoadingSummary: '',
    loadingSummary: '',
    requestSummary: '',
    storageInfoSummary: '',
    storageSummary: '',
    toastSummary: ''
  },
  runWxApis() {
    wx.request({
      url: 'https://mock.mpcore.dev/api/queue-health',
      success: (result) => {
        this.setData({
          requestSummary: JSON.stringify(result.data)
        })
      }
    })
    wx.setStorageSync('lab', {
      count: 3,
      status: 'stable'
    })
    this.setData({
      storageInfoSummary: JSON.stringify(wx.getStorageInfoSync()),
      storageSummary: JSON.stringify(wx.getStorageSync('lab'))
    })
    wx.setStorage({
      key: 'async-lab',
      data: {
        count: 5,
        status: 'queued'
      },
      success: (result) => {
        this.setData({
          asyncSetSummary: result.errMsg
        })
      }
    })
    wx.getStorage({
      key: 'async-lab',
      success: (result) => {
        this.setData({
          asyncGetSummary: JSON.stringify(result.data)
        })
      }
    })
    wx.getStorageInfo({
      success: (result) => {
        this.setData({
          asyncInfoSummary: JSON.stringify(result)
        })
      }
    })
    wx.removeStorage({
      key: 'async-lab',
      success: (result) => {
        this.setData({
          asyncRemoveSummary: result.errMsg
        })
      }
    })
    wx.clearStorage({
      success: (result) => {
        this.setData({
          asyncClearSummary: result.errMsg
        })
      }
    })
    wx.setStorageSync('lab', {
      count: 3,
      status: 'stable'
    })
    wx.showLoading({
      title: 'syncing',
      mask: true,
      success: (result) => {
        this.setData({
          loadingSummary: result.errMsg
        })
      }
    })
    wx.showToast({
      title: 'queued',
      success: (result) => {
        this.setData({
          toastSummary: result.errMsg
        })
      }
    })
  },
  hideLoadingLab() {
    wx.hideLoading({
      success: (result) => {
        this.setData({
          hideLoadingSummary: result.errMsg
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>lab</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockRequest({
      method: 'GET',
      response: {
        count: 7,
        queue: 'alpha',
      },
      url: 'https://mock.mpcore.dev/api/queue-health',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runWxApis()

    expect(page.data.requestSummary).toContain('"queue":"alpha"')
    expect(page.data.storageSummary).toContain('"count":3')
    expect(page.data.storageInfoSummary).toContain('"keys":["lab"]')
    expect(page.data.asyncSetSummary).toBe('setStorage:ok')
    expect(page.data.asyncGetSummary).toContain('"count":5')
    expect(page.data.asyncInfoSummary).toContain('"keys":["async-lab","lab"]')
    expect(page.data.asyncRemoveSummary).toBe('removeStorage:ok')
    expect(page.data.asyncClearSummary).toBe('clearStorage:ok')
    expect(page.data.loadingSummary).toBe('showLoading:ok')
    expect(page.data.toastSummary).toBe('showToast:ok')
    expect(session.getLoading()).toEqual({
      mask: true,
      title: 'syncing',
    })
    expect(session.getStorageSnapshot()).toEqual({
      lab: {
        count: 3,
        status: 'stable',
      },
    })
    expect(session.getStorageInfo()).toEqual({
      currentSize: 1,
      errMsg: 'getStorageInfo:ok',
      keys: ['lab'],
      limitSize: 10240,
    })
    expect(session.getToast()).toEqual({
      duration: 1500,
      icon: 'success',
      mask: false,
      title: 'queued',
    })
    expect(session.getRequestLogs()).toHaveLength(1)
    expect(session.getRequestLogs()[0]).toMatchObject({
      matched: true,
      method: 'GET',
      url: 'https://mock.mpcore.dev/api/queue-health',
    })

    page.hideLoadingLab()
    expect(page.data.hideLoadingSummary).toBe('hideLoading:ok')
    expect(session.getLoading()).toBeNull()
  })

  it('supports delayed request mocks and request task abort', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-request-abort-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index'],
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  startRequestAndAbort() {
    const task = wx.request({
      url: 'https://mock.mpcore.dev/api/slow',
      success: () => {
        this.push('success')
      },
      fail: (error) => {
        this.push('fail:' + error.message)
      },
      complete: () => {
        this.push('complete')
      }
    })
    task.abort()
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>lab</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockRequest({
      delay: 50,
      method: 'GET',
      response: {
        ok: true,
      },
      url: 'https://mock.mpcore.dev/api/slow',
    })

    const page = session.reLaunch('/pages/index/index')
    page.startRequestAndAbort()
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(page.data.logs).toEqual([
      'fail:request:fail abort',
      'complete',
    ])
    expect(session.getRequestLogs()).toEqual([])
  })

  it('supports showModal defaults and queued modal mocks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-show-modal-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index'],
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    defaultSummary: '',
    cancelSummary: '',
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  openDefaultModal() {
    wx.showModal({
      title: 'Warmup',
      content: 'Confirm flow',
      success: (result) => {
        this.setData({
          defaultSummary: JSON.stringify(result)
        })
        this.push('default:success')
      },
      complete: (result) => {
        this.push('default:complete:' + (result?.errMsg ?? 'none'))
      }
    })
  },
  openCancelModal() {
    wx.showModal({
      title: 'Blocker',
      content: 'Cancel flow',
      cancelText: '返回',
      confirmText: '继续',
      success: (result) => {
        this.setData({
          cancelSummary: JSON.stringify(result)
        })
        this.push('cancel:success')
      },
      complete: (result) => {
        this.push('cancel:complete:' + (result?.errMsg ?? 'none'))
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>modal</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')

    page.openDefaultModal()
    session.mockModal({ confirm: false })
    page.openCancelModal()

    expect(page.data.defaultSummary).toContain('"confirm":true')
    expect(page.data.defaultSummary).toContain('"cancel":false')
    expect(page.data.cancelSummary).toContain('"confirm":false')
    expect(page.data.cancelSummary).toContain('"cancel":true')
    expect(page.data.logs).toEqual([
      'default:success',
      'default:complete:showModal:ok',
      'cancel:success',
      'cancel:complete:showModal:ok',
    ])
    expect(session.getModalLogs()).toEqual([
      {
        cancelColor: '#000000',
        cancelText: '取消',
        confirmColor: '#576B95',
        confirmText: '确定',
        content: 'Confirm flow',
        result: {
          cancel: false,
          confirm: true,
          errMsg: 'showModal:ok',
        },
        showCancel: true,
        title: 'Warmup',
      },
      {
        cancelColor: '#000000',
        cancelText: '返回',
        confirmColor: '#576B95',
        confirmText: '继续',
        content: 'Cancel flow',
        result: {
          cancel: true,
          confirm: false,
          errMsg: 'showModal:ok',
        },
        showCancel: true,
        title: 'Blocker',
      },
    ])
  })
})
