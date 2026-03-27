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

  it('supports getNetworkType and network status change listeners', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-network-type-'))
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
    currentType: '',
    initialType: '',
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  inspectNetwork() {
    wx.getNetworkType({
      success: (result) => {
        this.setData({
          initialType: result.networkType
        })
        this.push('get:' + result.networkType)
      }
    })
  },
  startWatchingNetwork() {
    this.networkHandler = (result) => {
      this.setData({
        currentType: result.networkType
      })
      this.push('change:' + result.networkType + ':' + result.isConnected)
    }
    wx.onNetworkStatusChange(this.networkHandler)
  },
  stopWatchingNetwork() {
    wx.offNetworkStatusChange(this.networkHandler)
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>network</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')

    page.startWatchingNetwork()
    page.inspectNetwork()
    session.setNetworkType('none')
    session.setNetworkType('4g')
    page.stopWatchingNetwork()
    session.setNetworkType('5g')

    expect(page.data.initialType).toBe('wifi')
    expect(page.data.currentType).toBe('4g')
    expect(page.data.logs).toEqual([
      'get:wifi',
      'change:none:false',
      'change:4g:true',
    ])
    expect(session.getNetworkType()).toEqual({
      errMsg: 'getNetworkType:ok',
      networkType: '5g',
    })
  })

  it('supports navigation bar title, color and loading state defaults', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-navigation-bar-title-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index', 'pages/detail/index'],
      window: {
        navigationBarBackgroundColor: '#112233',
        navigationBarTitleText: 'App Shell',
        navigationBarTextStyle: 'white',
      },
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/index/index.json'), JSON.stringify({
      navigationBarBackgroundColor: '#abc123',
      navigationBarTitleText: 'Index Title',
      navigationBarTextStyle: 'black',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/pages/index/index.js'), `
Page({
  data: {
    logs: []
  },
  updateTitle() {
    wx.setNavigationBarTitle({
      title: 'Updated Title',
      success: () => {
        this.setData({
          logs: [...this.data.logs, 'success']
        })
      },
      complete: (result) => {
        this.setData({
          logs: [...this.data.logs, 'complete:' + (result?.errMsg ?? 'none')]
        })
      }
    })
  },
  updateColor() {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: '#135790',
      animation: {
        duration: 240,
        timingFunction: 'easeIn'
      },
      success: () => {
        this.setData({
          logs: [...this.data.logs, 'color:success']
        })
      },
      complete: (result) => {
        this.setData({
          logs: [...this.data.logs, 'color:complete:' + (result?.errMsg ?? 'none')]
        })
      }
    })
  },
  showNavLoading() {
    wx.showNavigationBarLoading({
      success: () => {
        this.setData({
          logs: [...this.data.logs, 'show-loading:success']
        })
      }
    })
  },
  hideNavLoading() {
    wx.hideNavigationBarLoading({
      complete: (result) => {
        this.setData({
          logs: [...this.data.logs, 'hide-loading:complete:' + (result?.errMsg ?? 'none')]
        })
      }
    })
  },
  goDetail() {
    wx.navigateTo({
      url: '/pages/detail/index'
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>index</view>')
    writeFixtureFile(path.join(root, 'dist/pages/detail/index.js'), 'Page({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/detail/index.wxml'), '<view>detail</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')

    expect(session.getCurrentPageNavigationBarTitle()).toBe('Index Title')
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: null,
      backgroundColor: '#abc123',
      frontColor: '#000000',
      loading: false,
      title: 'Index Title',
    })

    page.updateTitle()
    expect(session.getCurrentPageNavigationBarTitle()).toBe('Updated Title')
    expect(session.getCurrentPageNavigationBar()?.title).toBe('Updated Title')

    page.updateColor()
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: {
        duration: 240,
        timingFunction: 'easeIn',
      },
      backgroundColor: '#135790',
      frontColor: '#ffffff',
      loading: false,
      title: 'Updated Title',
    })

    page.showNavLoading()
    expect(session.getCurrentPageNavigationBar()?.loading).toBe(true)

    page.hideNavLoading()
    expect(session.getCurrentPageNavigationBar()?.loading).toBe(false)
    expect(page.data.logs).toEqual([
      'success',
      'complete:setNavigationBarTitle:ok',
      'color:success',
      'color:complete:setNavigationBarColor:ok',
      'show-loading:success',
      'hide-loading:complete:hideNavigationBarLoading:ok',
    ])

    page.goDetail()
    expect(session.getCurrentPageNavigationBarTitle()).toBe('App Shell')
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: null,
      backgroundColor: '#112233',
      frontColor: '#ffffff',
      loading: false,
      title: 'App Shell',
    })
  })

  it('supports showActionSheet defaults and cancel path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-action-sheet-'))
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
    cancelSummary: '',
    defaultSummary: '',
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  openDefaultActionSheet() {
    wx.showActionSheet({
      itemList: ['copy', 'open'],
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
  openCancelledActionSheet() {
    wx.showActionSheet({
      itemList: ['copy', 'open'],
      fail: (error) => {
        this.setData({
          cancelSummary: error.message
        })
        this.push('cancel:fail')
      },
      complete: (result) => {
        this.push('cancel:complete:' + (result?.errMsg ?? 'none'))
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>actions</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')

    page.openDefaultActionSheet()
    session.mockActionSheet({ cancel: true })
    page.openCancelledActionSheet()

    expect(page.data.defaultSummary).toContain('"tapIndex":0')
    expect(page.data.cancelSummary).toBe('showActionSheet:fail cancel')
    expect(page.data.logs).toEqual([
      'default:success',
      'default:complete:showActionSheet:ok',
      'cancel:fail',
      'cancel:complete:none',
    ])
    expect(session.getActionSheetLogs()).toEqual([
      {
        itemList: ['copy', 'open'],
        result: {
          errMsg: 'showActionSheet:ok',
          tapIndex: 0,
        },
      },
      {
        itemList: ['copy', 'open'],
      },
    ])
  })

  it('supports showTabBar and hideTabBar state transitions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-tab-bar-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/home/index', 'pages/profile/index'],
      tabBar: {
        list: [
          { pagePath: 'pages/home/index', text: 'Home' },
          { pagePath: 'pages/profile/index', text: 'Profile' },
        ],
      },
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/home/index.js'), `
Page({
  data: {
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  hideTabBarLab() {
    wx.hideTabBar({
      success: () => this.push('hide:success'),
      complete: (result) => this.push('hide:complete:' + (result?.errMsg ?? 'none'))
    })
  },
  showTabBarLab() {
    wx.showTabBar({
      success: () => this.push('show:success'),
      complete: (result) => this.push('show:complete:' + (result?.errMsg ?? 'none'))
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/home/index.wxml'), '<view>home</view>')
    writeFixtureFile(path.join(root, 'dist/pages/profile/index.js'), 'Page({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/profile/index.wxml'), '<view>profile</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/home/index')

    expect(session.getTabBar()).toEqual({
      visible: true,
    })

    page.hideTabBarLab()
    expect(session.getTabBar()).toEqual({
      visible: false,
    })

    page.showTabBarLab()
    expect(session.getTabBar()).toEqual({
      visible: true,
    })

    expect(page.data.logs).toEqual([
      'hide:success',
      'hide:complete:hideTabBar:ok',
      'show:success',
      'show:complete:showTabBar:ok',
    ])
  })

  it('supports share menu state transitions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-share-menu-'))
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
  showShareMenuLab() {
    wx.showShareMenu({
      withShareTicket: true,
      success: () => {
        this.push('show:success')
      }
    })
  },
  updateShareMenuLab() {
    wx.updateShareMenu({
      isUpdatableMessage: true,
      menus: ['shareAppMessage', 'shareTimeline'],
      complete: (result) => {
        this.push('update:complete:' + (result?.errMsg ?? 'none'))
      }
    })
  },
  hideShareMenuLab() {
    wx.hideShareMenu({
      complete: (result) => {
        this.push('hide:complete:' + (result?.errMsg ?? 'none'))
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>share</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')

    expect(session.getShareMenu()).toEqual({
      isUpdatableMessage: false,
      menus: [],
      visible: false,
      withShareTicket: false,
    })

    page.showShareMenuLab()
    expect(session.getShareMenu()).toEqual({
      isUpdatableMessage: false,
      menus: [],
      visible: true,
      withShareTicket: true,
    })

    page.updateShareMenuLab()
    expect(session.getShareMenu()).toEqual({
      isUpdatableMessage: true,
      menus: ['shareAppMessage', 'shareTimeline'],
      visible: true,
      withShareTicket: true,
    })

    page.hideShareMenuLab()
    expect(session.getShareMenu()).toEqual({
      isUpdatableMessage: true,
      menus: ['shareAppMessage', 'shareTimeline'],
      visible: false,
      withShareTicket: true,
    })
    expect(page.data.logs).toEqual([
      'show:success',
      'update:complete:updateShareMenu:ok',
      'hide:complete:hideShareMenu:ok',
    ])
  })
})
