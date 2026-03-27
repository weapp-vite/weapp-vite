import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture, createComponentFixture, createComponentLifecycleFixture, createNavigationFixture, createSelectorQueryFixture } from './helpers'

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

  it('supports downloadFile, saveFile and uploadFile through wx api state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-file-transfer-'))
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
    downloadSummary: '',
    savedInfoSummary: '',
    saveSummary: '',
    uploadSummary: '',
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  runFileTransferLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/report.txt',
      success: (downloadResult) => {
        this.setData({
          downloadSummary: JSON.stringify(downloadResult)
        })
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/report.txt',
          success: (saveResult) => {
            this.setData({
              saveSummary: JSON.stringify(saveResult)
            })
            wx.getSavedFileInfo({
              filePath: saveResult.savedFilePath,
              success: (savedFileInfo) => {
                this.setData({
                  savedInfoSummary: JSON.stringify(savedFileInfo)
                })
              }
            })
            wx.uploadFile({
              url: 'https://mock.mpcore.dev/upload/report',
              filePath: saveResult.savedFilePath,
              name: 'file',
              formData: {
                ticket: 'alpha'
              },
              success: (uploadResult) => {
                this.setData({
                  uploadSummary: uploadResult.data
                })
              }
            })
          }
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>file-transfer</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockDownloadFile({
      fileContent: 'downloaded report body',
      url: 'https://mock.mpcore.dev/files/report.txt',
    })
    session.mockUploadFile({
      response: ({ fileContent, formData }) => JSON.stringify({
        accepted: true,
        fileContent,
        ticket: formData?.ticket ?? null,
      }),
      url: 'https://mock.mpcore.dev/upload/report',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runFileTransferLab()

    expect(page.data.downloadSummary).toContain('"errMsg":"downloadFile:ok"')
    expect(page.data.savedInfoSummary).toContain('"errMsg":"getSavedFileInfo:ok"')
    expect(page.data.savedInfoSummary).toContain('"size":22')
    expect(page.data.saveSummary).toContain('"savedFilePath":"headless://saved/report.txt"')
    expect(page.data.uploadSummary).toContain('"accepted":true')
    expect(page.data.uploadSummary).toContain('"ticket":"alpha"')
    expect(session.getFileText('headless://saved/report.txt')).toBe('downloaded report body')
    expect(session.getDownloadFileLogs()).toEqual([
      {
        header: {},
        matched: true,
        response: {
          errMsg: 'downloadFile:ok',
          statusCode: 200,
          tempFilePath: expect.any(String),
        },
        tempFilePath: expect.any(String),
        url: 'https://mock.mpcore.dev/files/report.txt',
      },
    ])
    expect(session.getUploadFileLogs()).toEqual([
      {
        fileContent: 'downloaded report body',
        fileName: undefined,
        filePath: 'headless://saved/report.txt',
        formData: {
          ticket: 'alpha',
        },
        header: {},
        matched: true,
        name: 'file',
        response: {
          data: page.data.uploadSummary,
          errMsg: 'uploadFile:ok',
          statusCode: 200,
        },
        url: 'https://mock.mpcore.dev/upload/report',
      },
    ])
    expect(session.getSavedFileListSnapshot()).toEqual([
      {
        createTime: expect.any(Number),
        filePath: 'headless://saved/report.txt',
        size: 'downloaded report body'.length,
      },
    ])
  })

  it('supports getFileSystemManager with read/write/access/unlink operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-manager-'))
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
    accessSummary: '',
    readSummary: '',
    unlinkSummary: '',
    writeSummary: ''
  },
  runFsManagerLab() {
    const fsManager = wx.getFileSystemManager()
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/fs-manager.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/fs-lab.txt',
          success: (saveResult) => {
            this.setData({
              accessSummary: 'begin'
            })
            fsManager.access({
              path: saveResult.savedFilePath,
              success: (result) => {
                this.setData({
                  accessSummary: result.errMsg
                })
              }
            })
            this.setData({
              readSummary: fsManager.readFileSync(saveResult.savedFilePath, 'utf8')
            })
            fsManager.writeFile({
              filePath: saveResult.savedFilePath,
              data: 'rewritten payload',
              success: (result) => {
                this.setData({
                  writeSummary: result.errMsg
                })
              }
            })
            this.setData({
              readSummary: fsManager.readFileSync(saveResult.savedFilePath)
            })
            fsManager.unlink({
              filePath: saveResult.savedFilePath,
              success: (result) => {
                this.setData({
                  unlinkSummary: result.errMsg
                })
              }
            })
          }
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-manager</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockDownloadFile({
      fileContent: 'initial payload',
      url: 'https://mock.mpcore.dev/files/fs-manager.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runFsManagerLab()

    expect(page.data.accessSummary).toBe('access:ok')
    expect(page.data.readSummary).toBe('rewritten payload')
    expect(page.data.writeSummary).toBe('writeFile:ok')
    expect(page.data.unlinkSummary).toBe('unlink:ok')
    expect(session.getFileText('headless://saved/fs-lab.txt')).toBeNull()
  })

  it('supports getFileSystemManager copyFile and rename operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-copy-rename-'))
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
    copiedSummary: '',
    originalSummary: '',
    renamedSummary: ''
  },
  runFsCopyRenameLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://saved/source.txt', 'source payload')
    fsManager.copyFile({
      srcPath: 'headless://saved/source.txt',
      destPath: 'headless://saved/copied.txt',
      success: (result) => {
        this.setData({
          copiedSummary: result.errMsg
        })
      }
    })
    this.setData({
      originalSummary: fsManager.readFileSync('headless://saved/source.txt')
    })
    fsManager.renameSync('headless://saved/copied.txt', 'headless://saved/renamed.txt')
    this.setData({
      renamedSummary: fsManager.readFileSync('headless://saved/renamed.txt')
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-copy-rename</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runFsCopyRenameLab()

    expect(page.data.copiedSummary).toBe('copyFile:ok')
    expect(page.data.originalSummary).toBe('source payload')
    expect(page.data.renamedSummary).toBe('source payload')
    expect(session.getFileText('headless://saved/source.txt')).toBe('source payload')
    expect(session.getFileText('headless://saved/copied.txt')).toBeNull()
    expect(session.getFileText('headless://saved/renamed.txt')).toBe('source payload')
  })

  it('does not create new saved file metadata across copyFile operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-copy-'))
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
    listSummary: ''
  },
  runSavedFileCopyLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/source.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/source.txt',
      filePath: 'headless://saved/source.txt',
      success: () => {
        fsManager.copyFileSync('headless://saved/source.txt', 'headless://saved/copied.txt')
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-copy</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileCopyLab()

    expect(page.data.listSummary).toContain('"filePath":"headless://saved/source.txt"')
    expect(page.data.listSummary).toContain('"size":5')
    expect(page.data.listSummary).not.toContain('headless://saved/copied.txt')
  })

  it('supports getFileSystemManager mkdir readdir and stat operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-dir-ops-'))
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
    dirSummary: '',
    dirTypeSummary: '',
    fileTypeSummary: ''
  },
  runFsDirectoryLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdirSync('headless://saved/reports/daily', true)
    fsManager.writeFileSync('headless://saved/reports/daily/summary.txt', 'daily payload')
    this.setData({
      dirSummary: JSON.stringify(fsManager.readdirSync('headless://saved/reports')),
      dirTypeSummary: String(fsManager.statSync('headless://saved/reports/daily').isDirectory()),
      fileTypeSummary: String(fsManager.statSync('headless://saved/reports/daily/summary.txt').isFile())
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-dir-ops</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runFsDirectoryLab()

    expect(page.data.dirSummary).toBe('["daily"]')
    expect(page.data.dirTypeSummary).toBe('true')
    expect(page.data.fileTypeSummary).toBe('true')
    expect(session.getFileText('headless://saved/reports/daily/summary.txt')).toBe('daily payload')
  })

  it('supports getFileSystemManager rmdir operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-rmdir-'))
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
    missingDirSummary: '',
    nonEmptyDirSummary: '',
    removeSummary: '',
    removedDirSummary: ''
  },
  runFsRemoveDirectoryLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdirSync('headless://saved/archive/daily', true)
    fsManager.writeFileSync('headless://saved/archive/daily/report.txt', 'daily payload')
    fsManager.rmdir({
      dirPath: 'headless://saved/missing-archive',
      fail: (error) => {
        this.setData({
          missingDirSummary: error.message
        })
      }
    })
    fsManager.rmdir({
      dirPath: 'headless://saved/archive',
      fail: (error) => {
        this.setData({
          nonEmptyDirSummary: error.message
        })
      }
    })
    fsManager.rmdirSync('headless://saved/archive', true)
    try {
      fsManager.statSync('headless://saved/archive')
    }
    catch (error) {
      this.setData({
        removedDirSummary: error.message
      })
    }
    this.setData({
      removeSummary: JSON.stringify(fsManager.readdirSync('headless://saved'))
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-rmdir</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runFsRemoveDirectoryLab()

    expect(page.data.missingDirSummary).toContain('rmdir:fail no such file or directory')
    expect(page.data.nonEmptyDirSummary).toContain('rmdir:fail directory not empty')
    expect(page.data.removedDirSummary).toContain('stat:fail no such file or directory')
    expect(page.data.removeSummary).toBe('[]')
    expect(session.getDirectorySnapshot()).not.toContain('headless://saved/archive')
    expect(session.getFileText('headless://saved/archive/daily/report.txt')).toBeNull()
  })

  it('removes saved file registrations when rmdir deletes saved files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-rmdir-saved-files-'))
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
    listSummary: ''
  },
  runRmdirSavedFilesLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/report.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/report.txt',
      filePath: 'headless://saved/archive/report.txt',
      success: () => {
        fsManager.rmdirSync('headless://saved/archive', true)
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>rmdir-saved-files</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runRmdirSavedFilesLab()

    expect(page.data.listSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
    expect(session.getFileText('headless://saved/archive/report.txt')).toBeNull()
  })

  it('supports getFileSystemManager appendFile operations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-append-'))
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
    appendSummary: '',
    fileSummary: ''
  },
  runFsAppendLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://saved/log.txt', 'alpha')
    fsManager.appendFile({
      filePath: 'headless://saved/log.txt',
      data: '-beta',
      success: (result) => {
        this.setData({
          appendSummary: result.errMsg
        })
      }
    })
    fsManager.appendFileSync('headless://saved/log.txt', '-gamma')
    this.setData({
      fileSummary: fsManager.readFileSync('headless://saved/log.txt')
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-append</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runFsAppendLab()

    expect(page.data.appendSummary).toBe('appendFile:ok')
    expect(page.data.fileSummary).toBe('alpha-beta-gamma')
    expect(session.getFileText('headless://saved/log.txt')).toBe('alpha-beta-gamma')
  })

  it('keeps saved file metadata in sync with fs mutations', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-file-fs-sync-'))
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
    afterAppendSummary: '',
    afterRenameSummary: '',
    afterUnlinkSummary: '',
    afterWriteSummary: ''
  },
  runSavedFileFsSyncLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/report.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/report.txt',
      filePath: 'headless://saved/report.txt',
      success: (saveResult) => {
        fsManager.writeFileSync(saveResult.savedFilePath, 'beta')
        this.setData({
          afterWriteSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.appendFileSync(saveResult.savedFilePath, '-gamma')
        this.setData({
          afterAppendSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.renameSync(saveResult.savedFilePath, 'headless://saved/report-renamed.txt')
        this.setData({
          afterRenameSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.unlinkSync('headless://saved/report-renamed.txt')
        this.setData({
          afterUnlinkSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-file-fs-sync</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileFsSyncLab()

    expect(page.data.afterWriteSummary).toContain('"filePath":"headless://saved/report.txt"')
    expect(page.data.afterWriteSummary).toContain('"size":4')
    expect(page.data.afterAppendSummary).toContain('"size":10')
    expect(page.data.afterRenameSummary).toContain('"filePath":"headless://saved/report-renamed.txt"')
    expect(page.data.afterRenameSummary).not.toContain('headless://saved/report.txt')
    expect(page.data.afterUnlinkSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
  })

  it('removes saved file registrations when renaming to non-saved paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-file-rename-out-'))
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
    listSummary: ''
  },
  runSavedRenameOutLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/source.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/source.txt',
      filePath: 'headless://saved/source.txt',
      success: (saveResult) => {
        fsManager.renameSync(saveResult.savedFilePath, 'headless://temp/moved.txt')
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-rename-out</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameOutLab()

    expect(page.data.listSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
    expect(session.getFileText('headless://temp/moved.txt')).toBe('alpha')
  })

  it('updates saved metadata when renaming a non-saved file onto a saved path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-file-rename-into-'))
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
    infoSummary: '',
    listSummary: ''
  },
  runSavedRenameIntoLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/original.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/original.txt',
      filePath: 'headless://saved/target.txt',
      success: () => {
        fsManager.renameSync('headless://temp/source.txt', 'headless://saved/target.txt')
        this.setData({
          infoSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: 'headless://saved/target.txt' })),
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-rename-into</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameIntoLab()

    expect(page.data.infoSummary).toContain('"size":10')
    expect(page.data.listSummary).toContain('"filePath":"headless://saved/target.txt"')
    expect(page.data.listSummary).toContain('"size":10')
    expect(session.getFileText('headless://saved/target.txt')).toBe('alpha-beta')
  })

  it('reports stat sizes and fs manager failures through callbacks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-fs-errors-'))
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
    dirSizeSummary: '',
    fileSizeSummary: '',
    missingAccessSummary: '',
    missingReadSummary: '',
    missingReadDirSummary: ''
  },
  runFsErrorLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdirSync('headless://saved/errors', true)
    fsManager.writeFileSync('headless://saved/errors/report.txt', 'error-lab')
    this.setData({
      dirSizeSummary: String(fsManager.statSync('headless://saved/errors').size),
      fileSizeSummary: String(fsManager.statSync('headless://saved/errors/report.txt').size)
    })
    fsManager.access({
      path: 'headless://saved/errors/missing.txt',
      fail: (error) => {
        this.setData({
          missingAccessSummary: error.message
        })
      }
    })
    fsManager.readFile({
      filePath: 'headless://saved/errors/missing.txt',
      fail: (error) => {
        this.setData({
          missingReadSummary: error.message
        })
      }
    })
    fsManager.readdir({
      dirPath: 'headless://saved/errors/missing-dir',
      fail: (error) => {
        this.setData({
          missingReadDirSummary: error.message
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>fs-error-lab</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runFsErrorLab()

    expect(page.data.dirSizeSummary).toBe('0')
    expect(page.data.fileSizeSummary).toBe(String('error-lab'.length))
    expect(page.data.missingAccessSummary).toContain('access:fail no such file or directory')
    expect(page.data.missingReadSummary).toContain('readFile:fail no such file or directory')
    expect(page.data.missingReadDirSummary).toContain('readdir:fail no such file or directory')
  })

  it('supports getSavedFileList and removeSavedFile through wx api state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-files-'))
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
    listSummary: '',
    removeSummary: ''
  },
  runSavedFileLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/saved-file.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/saved-file.txt',
          success: (saveResult) => {
            wx.getSavedFileList({
              success: (result) => {
                this.setData({
                  listSummary: JSON.stringify(result.fileList)
                })
              }
            })
            wx.removeSavedFile({
              filePath: saveResult.savedFilePath,
              success: (result) => {
                this.setData({
                  removeSummary: result.errMsg
                })
              }
            })
          }
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-files</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockDownloadFile({
      fileContent: 'saved payload',
      url: 'https://mock.mpcore.dev/files/saved-file.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileLab()

    expect(page.data.listSummary).toContain('"filePath":"headless://saved/saved-file.txt"')
    expect(page.data.listSummary).toContain('"size":13')
    expect(page.data.removeSummary).toBe('removeSavedFile:ok')
    expect(session.getFileText('headless://saved/saved-file.txt')).toBeNull()
  })

  it('reports removeSavedFile and getSavedFileInfo failures after removal', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-files-errors-'))
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
    missingRemoveSummary: '',
    postRemoveInfoSummary: '',
    postRemoveReadSummary: '',
    secondRemoveSummary: ''
  },
  runSavedFileErrorLab() {
    const fsManager = wx.getFileSystemManager()
    wx.removeSavedFile({
      filePath: 'headless://saved/missing-file.txt',
      fail: (error) => {
        this.setData({
          missingRemoveSummary: error.message
        })
      }
    })
    fsManager.writeFileSync('headless://saved/removable.txt', 'removable')
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/removable.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/removable.txt',
          success: (saveResult) => {
            wx.removeSavedFile({
              filePath: saveResult.savedFilePath,
              success: () => {
                try {
                  fsManager.readFileSync(saveResult.savedFilePath)
                }
                catch (error) {
                  this.setData({
                    postRemoveReadSummary: error.message
                  })
                }
                wx.getSavedFileInfo({
                  filePath: saveResult.savedFilePath,
                  fail: (infoError) => {
                    this.setData({
                      postRemoveInfoSummary: infoError.message
                    })
                  }
                })
                wx.removeSavedFile({
                  filePath: saveResult.savedFilePath,
                  fail: (secondError) => {
                    this.setData({
                      secondRemoveSummary: secondError.message
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-file-errors</view>')

    const session = createHeadlessSession({ projectPath: root })
    session.mockDownloadFile({
      fileContent: 'removable',
      url: 'https://mock.mpcore.dev/files/removable.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileErrorLab()

    expect(page.data.missingRemoveSummary).toContain('removeSavedFile:fail no such file or directory')
    expect(page.data.postRemoveInfoSummary).toContain('getSavedFileInfo:fail no such file or directory')
    expect(page.data.postRemoveReadSummary).toContain('readFile:fail no such file or directory')
    expect(page.data.secondRemoveSummary).toContain('removeSavedFile:fail no such file or directory')
  })

  it('returns stable saved file metadata ordering', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-saved-files-ordering-'))
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
    listSummary: ''
  },
  runSavedFileOrderingLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/zeta.txt', 'zeta')
    fsManager.writeFileSync('headless://temp/alpha.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/zeta.txt',
      filePath: 'headless://saved/zeta.txt',
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/alpha.txt',
          filePath: 'headless://saved/alpha.txt',
          success: () => {
            wx.getSavedFileList({
              success: (result) => {
                this.setData({
                  listSummary: JSON.stringify(result.fileList)
                })
              }
            })
          }
        })
      }
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/index/index.wxml'), '<view>saved-file-ordering</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileOrderingLab()

    const fileList = JSON.parse(page.data.listSummary) as Array<{ createTime: number, filePath: string, size: number }>
    expect(fileList.map(item => item.filePath)).toEqual([
      'headless://saved/alpha.txt',
      'headless://saved/zeta.txt',
    ])
    expect(fileList.every(item => typeof item.createTime === 'number' && item.createTime > 0)).toBe(true)
    expect(fileList.map(item => item.size)).toEqual([5, 4])
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

  it('supports tabBar badge and red dot state transitions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-tab-bar-badge-'))
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
  showDot() {
    wx.showTabBarRedDot({
      index: 1,
      success: () => this.push('dot:success')
    })
  },
  hideDot() {
    wx.hideTabBarRedDot({
      index: 1,
      complete: (result) => this.push('hide-dot:complete:' + (result?.errMsg ?? 'none'))
    })
  },
  setBadge() {
    wx.setTabBarBadge({
      index: 1,
      text: '9+',
      success: () => this.push('badge:success')
    })
  },
  removeBadge() {
    wx.removeTabBarBadge({
      index: 1,
      complete: (result) => this.push('remove-badge:complete:' + (result?.errMsg ?? 'none'))
    })
  }
})
`)
    writeFixtureFile(path.join(root, 'dist/pages/home/index.wxml'), '<view>home</view>')
    writeFixtureFile(path.join(root, 'dist/pages/profile/index.js'), 'Page({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/profile/index.wxml'), '<view>profile</view>')

    const session = createHeadlessSession({ projectPath: root })
    const page = session.reLaunch('/pages/home/index')

    expect(session.getTabBarSnapshot()).toEqual({
      items: [
        { badge: null, index: 0, pagePath: 'pages/home/index', redDot: false, text: 'Home' },
        { badge: null, index: 1, pagePath: 'pages/profile/index', redDot: false, text: 'Profile' },
      ],
      visible: true,
    })

    page.showDot()
    expect(session.getTabBarSnapshot().items[1]).toEqual({
      badge: null,
      index: 1,
      pagePath: 'pages/profile/index',
      redDot: true,
      text: 'Profile',
    })

    page.setBadge()
    expect(session.getTabBarSnapshot().items[1]).toEqual({
      badge: '9+',
      index: 1,
      pagePath: 'pages/profile/index',
      redDot: false,
      text: 'Profile',
    })

    page.removeBadge()
    page.showDot()
    page.hideDot()
    expect(session.getTabBarSnapshot().items[1]).toEqual({
      badge: null,
      index: 1,
      pagePath: 'pages/profile/index',
      redDot: false,
      text: 'Profile',
    })
    expect(page.data.logs).toEqual([
      'dot:success',
      'badge:success',
      'remove-badge:complete:removeTabBarBadge:ok',
      'dot:success',
      'hide-dot:complete:hideTabBarRedDot:ok',
    ])
  })

  it('supports background text style and color defaults and updates', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-runtime-wx-background-text-style-'))
    tempDirs.push(root)

    writeFixtureFile(path.join(root, 'project.config.json'), JSON.stringify({
      appid: 'wx123',
      miniprogramRoot: 'dist',
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.json'), JSON.stringify({
      pages: ['pages/index/index', 'pages/detail/index'],
      window: {
        backgroundColor: '#fefefe',
        backgroundColorBottom: '#eeeeee',
        backgroundColorTop: '#ffffff',
        backgroundTextStyle: 'light',
      },
    }, null, 2))
    writeFixtureFile(path.join(root, 'dist/app.js'), 'App({})\n')
    writeFixtureFile(path.join(root, 'dist/pages/index/index.json'), JSON.stringify({
      backgroundColor: '#101010',
      backgroundColorBottom: '#202020',
      backgroundColorTop: '#303030',
      backgroundTextStyle: 'dark',
    }, null, 2))
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
  setLight() {
    wx.setBackgroundTextStyle({
      textStyle: 'light',
      success: () => this.push('light:success'),
      complete: (result) => this.push('light:complete:' + (result?.errMsg ?? 'none'))
    })
  },
  setBackgroundColorLab() {
    wx.setBackgroundColor({
      backgroundColor: '#444444',
      backgroundColorTop: '#555555',
      backgroundColorBottom: '#666666',
      success: () => this.push('color:success'),
      complete: (result) => this.push('color:complete:' + (result?.errMsg ?? 'none'))
    })
  },
  setInvalid() {
    wx.setBackgroundTextStyle({
      textStyle: 'weird',
      fail: (error) => this.push('invalid:fail:' + error.message),
      complete: (result) => this.push('invalid:complete:' + (result?.errMsg ?? 'none'))
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

    expect(session.getCurrentPageBackground()).toEqual({
      backgroundColor: '#101010',
      backgroundColorBottom: '#202020',
      backgroundColorTop: '#303030',
      textStyle: 'dark',
    })

    page.setLight()
    page.setBackgroundColorLab()
    expect(session.getCurrentPageBackground()).toEqual({
      backgroundColor: '#444444',
      backgroundColorBottom: '#666666',
      backgroundColorTop: '#555555',
      textStyle: 'light',
    })

    page.setInvalid()
    expect(session.getCurrentPageBackground()).toEqual({
      backgroundColor: '#444444',
      backgroundColorBottom: '#666666',
      backgroundColorTop: '#555555',
      textStyle: 'light',
    })
    expect(page.data.logs).toEqual([
      'light:success',
      'light:complete:setBackgroundTextStyle:ok',
      'color:success',
      'color:complete:setBackgroundColor:ok',
      'invalid:fail:setBackgroundTextStyle:fail invalid textStyle',
      'invalid:complete:none',
    ])

    page.goDetail()
    expect(session.getCurrentPageBackground()).toEqual({
      backgroundColor: '#fefefe',
      backgroundColorBottom: '#eeeeee',
      backgroundColorTop: '#ffffff',
      textStyle: 'light',
    })
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

  it('supports createSelectorQuery for node fields and viewport scroll offset', () => {
    const projectPath = createSelectorQueryFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/index/index')
    page.runSelectorQuery()

    expect(page.data.selectorQueryResult).toEqual({
      class: 'panel primary',
      dataset: {
        phase: 'ready',
        role: 'hero',
      },
      height: 48,
      id: 'card',
      left: 12,
      right: 132,
      top: 24,
      bottom: 72,
      width: 120,
    })

    page.runViewportQuery()

    expect(page.data.viewportResult).toEqual({
      scrollLeft: 0,
      scrollTop: 64,
    })
  })

  it('renders custom components and exposes selectComponent APIs in headless runtime', () => {
    const projectPath = createComponentFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const page = session.reLaunch('/pages/lab/index')
    expect(session.renderCurrentPage().wxml).toContain('count: 2')

    page.inspect()

    expect(page.data.snapshot).toContain('"count":2')
    expect(page.data.snapshot).toContain('"hasPulse":true')
    expect(page.data.snapshot).toContain('"size":1')

    const card = page.selectComponent?.('#status-card')
    card?.pulse()

    expect(page.data.log).toEqual(['status-card'])

    page.inspectScopedQuery()
    expect(page.data.scopedRect).toEqual({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
    })

    page.inspectScopedSelectAll()
    expect(page.data.multiRectSummary).toContain('"id":"multi-a"')
    expect(page.data.multiRectSummary).toContain('"kind":"alpha"')
    expect(page.data.multiRectSummary).toContain('"id":"multi-b"')
    expect(page.data.multiRectSummary).toContain('"kind":"beta"')

    page.inspectMetaQuery()
    expect(page.data.metaSummary).toContain('"source":"component-card"')
    expect(page.data.metaSummary).toContain('"type":"unsupported-context"')
    expect(page.data.metaSummary).toContain('"type":"view"')
  })

  it('runs component lifetimes and pageLifetimes in headless runtime', () => {
    const projectPath = createComponentLifecycleFixture()
    tempDirs.push(projectPath)
    const session = createHeadlessSession({ projectPath })

    const pageA = session.reLaunch('/pages/a/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('created')
    expect(rendered.wxml).toContain('attached')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('ready')
    expect(rendered.wxml).toContain('show')

    session.triggerResize({
      size: {
        windowWidth: 375,
      },
    })
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('resize:375')
    const scopes = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()
    expect(session.getScopeSnapshot(componentScopeId!)).toMatchObject({
      data: {
        lifecycleLog: ['created', 'attached', 'ready', 'show', 'resize:375'],
      },
      properties: {
        mode: 'alpha',
      },
      type: 'component',
    })

    pageA.openB()
    expect(rendered.wxml).toContain('resize:375')
  })
})
