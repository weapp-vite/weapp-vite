import { describe, expect, it } from 'vitest'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFiles,
} from '../src/browser'

describe('BrowserHeadlessSession', () => {
  it('runs built output from virtual files and renders wxml in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/detail/index'] })],
      ['app.js', 'App({ globalData: { boot: true } })'],
      ['pages/index/index.js', `
Page({
  data: {
    title: 'Browser demo',
  },
  goDetail() {
    wx.navigateTo({
      url: '/pages/detail/index?from=index',
    })
  },
})
`],
      ['pages/index/index.wxml', '<view>{{title}}</view><view bindtap="goDetail">Go</view>'],
      ['pages/detail/index.js', `
Page({
  data: {
    title: 'Detail',
  },
  onLoad(query) {
    this.setData({
      from: query?.from ?? 'unknown',
    })
  },
})
`],
      ['pages/detail/index.wxml', '<view>{{title}}</view><view>{{from}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const indexPage = session.reLaunch('/pages/index/index')
    expect(indexPage.route).toBe('pages/index/index')
    expect(session.getApp()?.globalData.boot).toBe(true)

    indexPage.goDetail()

    expect(session.renderCurrentPage().wxml).toContain('Detail')
    expect(session.renderCurrentPage().wxml).toContain('index')
  })

  it('runs wx.nextTick callbacks after page setData in browser runtime', async () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    status: 'idle',
    detail: 'cold'
  },
  runNextTickUpdate() {
    this.setData({
      status: 'browser-next-tick',
      detail: 'pending'
    })
    wx.nextTick(() => {
      this.setData({
        detail: this.data.status
      })
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{status}}</view><view>{{detail}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    page.runNextTickUpdate()
    await Promise.resolve()

    expect(session.renderCurrentPage().wxml).toContain('browser-next-tick')
    expect(session.renderCurrentPage().wxml).toContain('browser-next-tick')
    expect(page.data).toEqual({
      status: 'browser-next-tick',
      detail: 'browser-next-tick',
    })
  })

  it('tracks delayed request mocks in browser runtime request state', async () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    logs: [],
    requestSummary: ''
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  startRequest() {
    wx.request({
      url: 'https://mock.mpcore.dev/api/browser-queue',
      success: (result) => {
        this.setData({
          requestSummary: JSON.stringify(result.data)
        })
        this.push('success')
      },
      complete: () => {
        this.push('complete')
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{requestSummary}}</view><view>{{logs.0}}</view><view>{{logs.1}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockRequest({
      delay: 30,
      method: 'GET',
      response: {
        queue: 'browser-alpha',
        stable: true,
      },
      url: 'https://mock.mpcore.dev/api/browser-queue',
    })

    const page = session.reLaunch('/pages/index/index')
    page.startRequest()

    expect(page.data.logs).toEqual([])

    await new Promise(resolve => setTimeout(resolve, 60))

    expect(page.data.logs).toEqual(['success', 'complete'])
    expect(page.data.requestSummary).toContain('"queue":"browser-alpha"')
    expect(session.renderCurrentPage().wxml).toContain('browser-alpha')
    expect(session.getRequestLogs()).toHaveLength(1)
    expect(session.getRequestLogs()[0]).toMatchObject({
      matched: true,
      method: 'GET',
      url: 'https://mock.mpcore.dev/api/browser-queue',
    })
  })

  it('supports request task abort in browser runtime', async () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
      url: 'https://mock.mpcore.dev/api/browser-slow',
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
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockRequest({
      delay: 50,
      method: 'GET',
      response: {
        ok: true,
      },
      url: 'https://mock.mpcore.dev/api/browser-slow',
    })

    const page = session.reLaunch('/pages/index/index')
    page.startRequestAndAbort()
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(page.data.logs).toEqual([
      'fail:request:fail abort',
      'complete',
    ])
    expect(session.renderCurrentPage().wxml).toContain('request:fail abort')
    expect(session.getRequestLogs()).toEqual([])
  })

  it('supports delayed downloadFile and uploadFile task abort in browser runtime', async () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  startFileTransferAbortLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-upload-abort.txt', 'browser-upload-abort')
    const downloadTask = wx.downloadFile({
      filePath: 'headless://temp/browser-download-abort.txt',
      url: 'https://mock.mpcore.dev/files/browser-slow-report.txt',
      success: () => {
        this.push('download:success')
      },
      fail: (error) => {
        this.push('download:fail:' + error.message)
      },
      complete: () => {
        this.push('download:complete')
      }
    })
    downloadTask.abort()
    const uploadTask = wx.uploadFile({
      url: 'https://mock.mpcore.dev/upload/browser-slow-report',
      filePath: 'headless://temp/browser-upload-abort.txt',
      name: 'artifact',
      success: () => {
        this.push('upload:success')
      },
      fail: (error) => {
        this.push('upload:fail:' + error.message)
      },
      complete: () => {
        this.push('upload:complete')
      }
    })
    uploadTask.abort()
  }
})
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view><view>{{logs.3}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockDownloadFile({
      delay: 50,
      fileContent: 'browser downloaded later',
      url: 'https://mock.mpcore.dev/files/browser-slow-report.txt',
    })
    session.mockUploadFile({
      delay: 50,
      response: JSON.stringify({
        browser: true,
      }),
      url: 'https://mock.mpcore.dev/upload/browser-slow-report',
    })

    const page = session.reLaunch('/pages/index/index')
    page.startFileTransferAbortLab()
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(page.data.logs).toEqual([
      'download:fail:downloadFile:fail abort',
      'download:complete',
      'upload:fail:uploadFile:fail abort',
      'upload:complete',
    ])
    expect(session.renderCurrentPage().wxml).toContain('download:fail:downloadFile:fail abort')
    expect(session.renderCurrentPage().wxml).toContain('upload:fail:uploadFile:fail abort')
    expect(session.getDownloadFileLogs()).toEqual([])
    expect(session.getUploadFileLogs()).toEqual([])
    expect(session.getFileText('headless://temp/browser-download-abort.txt')).toBeNull()
    expect(session.getFileText('headless://temp/browser-upload-abort.txt')).toBe('browser-upload-abort')
  })

  it('reports file transfer failures for missing mocks and missing upload source files in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    logs: []
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message]
    })
  },
  runFileTransferFailureLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-upload-no-mock.txt', 'browser-upload-no-mock')
    wx.downloadFile({
      filePath: 'headless://temp/browser-download-no-mock.txt',
      url: 'https://mock.mpcore.dev/files/browser-unmatched-report.txt',
      fail: (error) => {
        this.push('download:fail:' + error.message)
      },
      complete: () => {
        this.push('download:complete')
      }
    })
    wx.uploadFile({
      url: 'https://mock.mpcore.dev/upload/browser-missing-source',
      filePath: 'headless://temp/browser-missing-upload.txt',
      name: 'artifact',
      fail: (error) => {
        this.push('upload-missing-file:fail:' + error.message)
      },
      complete: () => {
        this.push('upload-missing-file:complete')
      }
    })
    wx.uploadFile({
      url: 'https://mock.mpcore.dev/upload/browser-unmatched-report',
      filePath: 'headless://temp/browser-upload-no-mock.txt',
      name: 'artifact',
      fail: (error) => {
        this.push('upload-no-mock:fail:' + error.message)
      },
      complete: () => {
        this.push('upload-no-mock:complete')
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view><view>{{logs.3}}</view><view>{{logs.4}}</view><view>{{logs.5}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFileTransferFailureLab()

    expect(page.data.logs).toEqual([
      'download:fail:No downloadFile mock matched in headless runtime: https://mock.mpcore.dev/files/browser-unmatched-report.txt',
      'download:complete',
      'upload-missing-file:fail:uploadFile:fail file not found: headless://temp/browser-missing-upload.txt',
      'upload-missing-file:complete',
      'upload-no-mock:fail:No uploadFile mock matched in headless runtime: https://mock.mpcore.dev/upload/browser-unmatched-report',
      'upload-no-mock:complete',
    ])
    expect(session.renderCurrentPage().wxml).toContain('download:fail:No downloadFile mock matched in headless runtime')
    expect(session.renderCurrentPage().wxml).toContain('uploadFile:fail file not found: headless://temp/browser-missing-upload.txt')
    expect(session.getDownloadFileLogs()).toEqual([
      {
        header: {},
        matched: false,
        url: 'https://mock.mpcore.dev/files/browser-unmatched-report.txt',
      },
    ])
    expect(session.getUploadFileLogs()).toEqual([
      {
        fileContent: 'browser-upload-no-mock',
        fileName: undefined,
        filePath: 'headless://temp/browser-upload-no-mock.txt',
        formData: {},
        header: {},
        matched: false,
        name: 'artifact',
        url: 'https://mock.mpcore.dev/upload/browser-unmatched-report',
      },
    ])
    expect(session.getFileText('headless://temp/browser-download-no-mock.txt')).toBeNull()
  })

  it('supports downloadFile, saveFile and uploadFile in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    downloadSummary: '',
    savedInfoSummary: '',
    saveSummary: '',
    uploadSummary: ''
  },
  runFileTransferLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/browser-report.txt',
      success: (downloadResult) => {
        this.setData({
          downloadSummary: JSON.stringify(downloadResult)
        })
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
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
              url: 'https://mock.mpcore.dev/upload/browser-report',
              filePath: saveResult.savedFilePath,
              name: 'artifact',
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
`],
      ['pages/index/index.wxml', '<view>{{downloadSummary}}</view><view>{{saveSummary}}</view><view>{{uploadSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockDownloadFile({
      fileContent: 'browser report body',
      url: 'https://mock.mpcore.dev/files/browser-report.txt',
    })
    session.mockUploadFile({
      response: ({ fileContent }) => JSON.stringify({
        browser: true,
        fileContent,
      }),
      url: 'https://mock.mpcore.dev/upload/browser-report',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runFileTransferLab()

    expect(page.data.downloadSummary).toContain('"errMsg":"downloadFile:ok"')
    expect(page.data.savedInfoSummary).toContain('"errMsg":"getSavedFileInfo:ok"')
    expect(page.data.savedInfoSummary).toContain('"size":19')
    expect(page.data.saveSummary).toContain('"savedFilePath":"headless://wxfile/saved/')
    expect(page.data.uploadSummary).toContain('"browser":true')
    expect(session.renderCurrentPage().wxml).toContain('browser report body')
    expect(session.getSavedFileListSnapshot()).toEqual([
      {
        createTime: expect.any(Number),
        filePath: expect.stringContaining('headless://wxfile/saved/'),
        size: 'browser report body'.length,
      },
    ])
    expect(session.getUploadFileLogs()[0]).toMatchObject({
      fileContent: 'browser report body',
      matched: true,
      name: 'artifact',
      url: 'https://mock.mpcore.dev/upload/browser-report',
    })
  })

  it('supports getFileSystemManager in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
      url: 'https://mock.mpcore.dev/files/browser-fs.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          success: (saveResult) => {
            fsManager.access({
              path: saveResult.savedFilePath,
              success: (result) => {
                this.setData({
                  accessSummary: result.errMsg
                })
              }
            })
            this.setData({
              readSummary: fsManager.readFileSync(saveResult.savedFilePath)
            })
            fsManager.writeFileSync(saveResult.savedFilePath, 'browser rewritten payload')
            this.setData({
              readSummary: fsManager.readFileSync(saveResult.savedFilePath, 'utf8'),
              writeSummary: 'writeFileSync:ok'
            })
            fsManager.unlinkSync(saveResult.savedFilePath)
            this.setData({
              unlinkSummary: 'unlinkSync:ok'
            })
          }
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{accessSummary}}</view><view>{{readSummary}}</view><view>{{writeSummary}}</view><view>{{unlinkSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockDownloadFile({
      fileContent: 'browser initial payload',
      url: 'https://mock.mpcore.dev/files/browser-fs.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runFsManagerLab()

    expect(page.data.accessSummary).toBe('access:ok')
    expect(page.data.readSummary).toBe('browser rewritten payload')
    expect(page.data.writeSummary).toBe('writeFileSync:ok')
    expect(page.data.unlinkSummary).toBe('unlinkSync:ok')
    expect(session.renderCurrentPage().wxml).toContain('browser rewritten payload')
  })

  it('supports getFileSystemManager copyFile and rename in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    copiedSummary: '',
    originalSummary: '',
    renamedSummary: ''
  },
  runFsCopyRenameLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://saved/browser-source.txt', 'browser source payload')
    fsManager.copyFileSync('headless://saved/browser-source.txt', 'headless://saved/browser-copy.txt')
    fsManager.rename({
      oldPath: 'headless://saved/browser-copy.txt',
      newPath: 'headless://saved/browser-renamed.txt',
      success: (result) => {
        this.setData({
          copiedSummary: 'copyFileSync:ok',
          originalSummary: fsManager.readFileSync('headless://saved/browser-source.txt'),
          renamedSummary: result.errMsg + ':' + fsManager.readFileSync('headless://saved/browser-renamed.txt')
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{copiedSummary}}</view><view>{{originalSummary}}</view><view>{{renamedSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFsCopyRenameLab()

    expect(page.data.copiedSummary).toBe('copyFileSync:ok')
    expect(page.data.originalSummary).toBe('browser source payload')
    expect(page.data.renamedSummary).toBe('rename:ok:browser source payload')
    expect(session.getFileText('headless://saved/browser-source.txt')).toBe('browser source payload')
    expect(session.getFileText('headless://saved/browser-copy.txt')).toBeNull()
    expect(session.getFileText('headless://saved/browser-renamed.txt')).toBe('browser source payload')
  })

  it('does not create new saved file metadata across copyFile operations in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: ''
  },
  runSavedFileCopyLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-source.txt',
      success: (saveResult) => {
        fsManager.copyFileSync(saveResult.savedFilePath, 'headless://wxfile/saved/browser-copied.txt')
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileCopyLab()

    expect(page.data.listSummary).toContain('"size":5')
    expect(page.data.listSummary).not.toContain('headless://wxfile/saved/browser-copied.txt')
  })

  it('updates existing saved metadata when copyFile overwrites a saved target in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    infoSummary: '',
    listSummary: ''
  },
  runSavedFileCopyOverwriteLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/browser-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-target.txt',
      success: (saveResult) => {
        fsManager.copyFileSync('headless://temp/browser-source.txt', saveResult.savedFilePath)
        this.setData({
          infoSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: saveResult.savedFilePath })),
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{infoSummary}}</view><view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileCopyOverwriteLab()

    expect(page.data.infoSummary).toContain('"size":10')
    expect(page.data.listSummary).toContain('"size":10')
    expect(session.getSavedFileListSnapshot()).toHaveLength(1)
  })

  it('preserves saved target createTime when copyFile overwrites it in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    afterSummary: '',
    beforeSummary: ''
  },
  runSavedFileCopyOverwriteCreateTimeLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/browser-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-target.txt',
      success: (saveResult) => {
        this.setData({
          beforeSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: saveResult.savedFilePath }))
        })
        fsManager.copyFileSync('headless://temp/browser-source.txt', saveResult.savedFilePath)
        this.setData({
          afterSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: saveResult.savedFilePath }))
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{beforeSummary}}</view><view>{{afterSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileCopyOverwriteCreateTimeLab()

    const beforeInfo = JSON.parse(page.data.beforeSummary) as { createTime: number, size: number }
    const afterInfo = JSON.parse(page.data.afterSummary) as { createTime: number, size: number }
    expect(afterInfo.createTime).toBe(beforeInfo.createTime)
    expect(afterInfo.size).toBe(10)
  })

  it('reports saveFile failures when tempFilePath is missing in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    completeCount: 0,
    failSummary: ''
  },
  runMissingTempSaveFileLab() {
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-missing-save-source.txt',
      fail: (error) => {
        this.setData({
          failSummary: error.message
        })
      },
      complete: () => {
        this.setData({
          completeCount: this.data.completeCount + 1
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{failSummary}}</view><view>{{completeCount}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runMissingTempSaveFileLab()

    expect(page.data.failSummary).toBe('saveFile:fail tempFilePath not found: headless://temp/browser-missing-save-source.txt')
    expect(page.data.completeCount).toBe(1)
    expect(session.getSavedFileListSnapshot()).toEqual([])
    expect(session.renderCurrentPage().wxml).toContain('saveFile:fail tempFilePath not found')
  })

  it('supports getFileSystemManager mkdir readdir and stat in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    dirSummary: '',
    dirTypeSummary: '',
    fileTypeSummary: ''
  },
  runFsDirectoryLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdir({
      dirPath: 'headless://saved/browser-reports/daily',
      recursive: true,
      success: () => {
        fsManager.writeFileSync('headless://saved/browser-reports/daily/summary.txt', 'browser daily payload')
        this.setData({
          dirSummary: JSON.stringify(fsManager.readdirSync('headless://saved/browser-reports')),
          dirTypeSummary: String(fsManager.statSync('headless://saved/browser-reports/daily').isDirectory()),
          fileTypeSummary: String(fsManager.statSync('headless://saved/browser-reports/daily/summary.txt').isFile())
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{dirSummary}}</view><view>{{dirTypeSummary}}</view><view>{{fileTypeSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFsDirectoryLab()

    expect(page.data.dirSummary).toBe('["daily"]')
    expect(page.data.dirTypeSummary).toBe('true')
    expect(page.data.fileTypeSummary).toBe('true')
    expect(session.renderCurrentPage().wxml).toContain('["daily"]')
  })

  it('supports getFileSystemManager rmdir in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    missingDirSummary: '',
    nonEmptyDirSummary: '',
    removeSummary: '',
    removedDirSummary: ''
  },
  runFsRemoveDirectoryLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.mkdirSync('headless://saved/browser-archive/daily', true)
    fsManager.writeFileSync('headless://saved/browser-archive/daily/report.txt', 'browser daily payload')
    fsManager.rmdir({
      dirPath: 'headless://saved/browser-missing-archive',
      fail: (error) => {
        this.setData({
          missingDirSummary: error.message
        })
      }
    })
    fsManager.rmdir({
      dirPath: 'headless://saved/browser-archive',
      fail: (error) => {
        this.setData({
          nonEmptyDirSummary: error.message
        })
      }
    })
    fsManager.rmdirSync('headless://saved/browser-archive', true)
    try {
      fsManager.statSync('headless://saved/browser-archive')
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
`],
      ['pages/index/index.wxml', '<view>{{missingDirSummary}}</view><view>{{nonEmptyDirSummary}}</view><view>{{removeSummary}}</view><view>{{removedDirSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFsRemoveDirectoryLab()

    expect(page.data.missingDirSummary).toContain('rmdir:fail no such file or directory')
    expect(page.data.nonEmptyDirSummary).toContain('rmdir:fail directory not empty')
    expect(page.data.removedDirSummary).toContain('stat:fail no such file or directory')
    expect(page.data.removeSummary).toBe('[]')
    expect(session.getDirectorySnapshot()).not.toContain('headless://saved/browser-archive')
    expect(session.getFileText('headless://saved/browser-archive/daily/report.txt')).toBeNull()
  })

  it('removes saved file registrations when rmdir deletes saved files in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: ''
  },
  runRmdirSavedFilesLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-report.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-report.txt',
      filePath: 'headless://wxfile/saved/archive/report.txt',
      success: () => {
        fsManager.rmdirSync('headless://wxfile/saved/archive', true)
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runRmdirSavedFilesLab()

    expect(page.data.listSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
    expect(session.getFileText('headless://wxfile/saved/archive/report.txt')).toBeNull()
  })

  it('supports getFileSystemManager appendFile in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    appendSummary: '',
    fileSummary: ''
  },
  runFsAppendLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://saved/browser-log.txt', 'browser-alpha')
    fsManager.appendFileSync('headless://saved/browser-log.txt', '-browser-beta')
    fsManager.appendFile({
      filePath: 'headless://saved/browser-log.txt',
      data: '-browser-gamma',
      success: (result) => {
        this.setData({
          appendSummary: result.errMsg,
          fileSummary: fsManager.readFileSync('headless://saved/browser-log.txt')
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{appendSummary}}</view><view>{{fileSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFsAppendLab()

    expect(page.data.appendSummary).toBe('appendFile:ok')
    expect(page.data.fileSummary).toBe('browser-alpha-browser-beta-browser-gamma')
    expect(session.renderCurrentPage().wxml).toContain('browser-alpha-browser-beta-browser-gamma')
  })

  it('keeps saved file metadata in sync with fs mutations in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    afterAppendSummary: '',
    afterRenameSummary: '',
    afterUnlinkSummary: '',
    afterWriteSummary: ''
  },
  runSavedFileFsSyncLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-report.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-report.txt',
      success: (saveResult) => {
        fsManager.writeFileSync(saveResult.savedFilePath, 'beta')
        this.setData({
          afterWriteSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.appendFileSync(saveResult.savedFilePath, '-gamma')
        this.setData({
          afterAppendSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.renameSync(saveResult.savedFilePath, 'headless://wxfile/saved/browser-report-renamed.txt')
        this.setData({
          afterRenameSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
        fsManager.unlinkSync('headless://wxfile/saved/browser-report-renamed.txt')
        this.setData({
          afterUnlinkSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{afterWriteSummary}}</view><view>{{afterAppendSummary}}</view><view>{{afterRenameSummary}}</view><view>{{afterUnlinkSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileFsSyncLab()

    expect(page.data.afterWriteSummary).toContain('"size":4')
    expect(page.data.afterAppendSummary).toContain('"size":10')
    expect(page.data.afterRenameSummary).toContain('"filePath":"headless://wxfile/saved/browser-report-renamed.txt"')
    expect(page.data.afterUnlinkSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
  })

  it('removes saved file registrations when renaming to non-saved paths in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: ''
  },
  runSavedRenameOutLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-source.txt',
      success: (saveResult) => {
        fsManager.renameSync(saveResult.savedFilePath, 'headless://temp/browser-moved.txt')
        this.setData({
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameOutLab()

    expect(page.data.listSummary).toBe('[]')
    expect(session.getSavedFileListSnapshot()).toEqual([])
    expect(session.getFileText('headless://temp/browser-moved.txt')).toBe('alpha')
  })

  it('updates saved metadata when renaming a non-saved file onto a saved path in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    infoSummary: '',
    listSummary: ''
  },
  runSavedRenameIntoLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/browser-original.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-original.txt',
      success: (saveResult) => {
        fsManager.renameSync('headless://temp/browser-source.txt', saveResult.savedFilePath)
        this.setData({
          infoSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: saveResult.savedFilePath })),
          listSummary: JSON.stringify(wx.getSavedFileList().fileList)
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{infoSummary}}</view><view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameIntoLab()

    expect(page.data.infoSummary).toContain('"size":10')
    expect(page.data.listSummary).toContain('"size":10')
    expect(session.getSavedFileListSnapshot()).toHaveLength(1)
  })

  it('keeps a single saved registration when renaming one saved file onto another in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: ''
  },
  runSavedRenameOverwriteLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/browser-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-source.txt',
      filePath: 'headless://wxfile/saved/browser-source.txt',
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/browser-target.txt',
          filePath: 'headless://wxfile/saved/browser-target.txt',
          success: () => {
            fsManager.renameSync('headless://wxfile/saved/browser-source.txt', 'headless://wxfile/saved/browser-target.txt')
            this.setData({
              listSummary: JSON.stringify(wx.getSavedFileList().fileList)
            })
          }
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameOverwriteLab()

    expect(page.data.listSummary).toContain('"filePath":"headless://wxfile/saved/browser-target.txt"')
    expect(page.data.listSummary).toContain('"size":10')
    expect(page.data.listSummary).not.toContain('headless://wxfile/saved/browser-source.txt')
    expect(session.getSavedFileListSnapshot()).toHaveLength(1)
  })

  it('preserves target createTime when renaming one saved file onto another in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    afterSummary: '',
    beforeSummary: ''
  },
  runSavedRenameOverwriteCreateTimeLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-source.txt', 'alpha-beta')
    fsManager.writeFileSync('headless://temp/browser-target.txt', 'x')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-source.txt',
      filePath: 'headless://wxfile/saved/browser-source.txt',
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/browser-target.txt',
          filePath: 'headless://wxfile/saved/browser-target.txt',
          success: () => {
            this.setData({
              beforeSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/browser-target.txt' }))
            })
            fsManager.renameSync('headless://wxfile/saved/browser-source.txt', 'headless://wxfile/saved/browser-target.txt')
            this.setData({
              afterSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/browser-target.txt' }))
            })
          }
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{beforeSummary}}</view><view>{{afterSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedRenameOverwriteCreateTimeLab()

    const beforeInfo = JSON.parse(page.data.beforeSummary) as { createTime: number, size: number }
    const afterInfo = JSON.parse(page.data.afterSummary) as { createTime: number, size: number }
    expect(afterInfo.createTime).toBe(beforeInfo.createTime)
    expect(afterInfo.size).toBe(10)
  })

  it('preserves target createTime when saveFile overwrites an existing saved path in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    afterSummary: '',
    beforeSummary: ''
  },
  runSavedSaveFileOverwriteCreateTimeLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-first.txt', 'x')
    fsManager.writeFileSync('headless://temp/browser-second.txt', 'alpha-beta')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-first.txt',
      filePath: 'headless://wxfile/saved/browser-target.txt',
      success: () => {
        this.setData({
          beforeSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/browser-target.txt' }))
        })
        wx.saveFile({
          tempFilePath: 'headless://temp/browser-second.txt',
          filePath: 'headless://wxfile/saved/browser-target.txt',
          success: () => {
            this.setData({
              afterSummary: JSON.stringify(wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/browser-target.txt' }))
            })
          }
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{beforeSummary}}</view><view>{{afterSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedSaveFileOverwriteCreateTimeLab()

    const beforeInfo = JSON.parse(page.data.beforeSummary) as { createTime: number, size: number }
    const afterInfo = JSON.parse(page.data.afterSummary) as { createTime: number, size: number }
    expect(afterInfo.createTime).toBe(beforeInfo.createTime)
    expect(afterInfo.size).toBe(10)
  })

  it('reports stat sizes and fs manager failures in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
    fsManager.mkdirSync('headless://saved/browser-errors', true)
    fsManager.writeFileSync('headless://saved/browser-errors/report.txt', 'browser-error-lab')
    this.setData({
      dirSizeSummary: String(fsManager.statSync('headless://saved/browser-errors').size),
      fileSizeSummary: String(fsManager.statSync('headless://saved/browser-errors/report.txt').size)
    })
    fsManager.access({
      path: 'headless://saved/browser-errors/missing.txt',
      fail: (error) => {
        this.setData({
          missingAccessSummary: error.message
        })
      }
    })
    fsManager.readFile({
      filePath: 'headless://saved/browser-errors/missing.txt',
      fail: (error) => {
        this.setData({
          missingReadSummary: error.message
        })
      }
    })
    fsManager.readdir({
      dirPath: 'headless://saved/browser-errors/missing-dir',
      fail: (error) => {
        this.setData({
          missingReadDirSummary: error.message
        })
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{dirSizeSummary}}</view><view>{{fileSizeSummary}}</view><view>{{missingAccessSummary}}</view><view>{{missingReadSummary}}</view><view>{{missingReadDirSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runFsErrorLab()

    expect(page.data.dirSizeSummary).toBe('0')
    expect(page.data.fileSizeSummary).toBe(String('browser-error-lab'.length))
    expect(page.data.missingAccessSummary).toContain('access:fail no such file or directory')
    expect(page.data.missingReadSummary).toContain('readFile:fail no such file or directory')
    expect(page.data.missingReadDirSummary).toContain('readdir:fail no such file or directory')
  })

  it('supports getSavedFileList and removeSavedFile in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: '',
    removeSummary: ''
  },
  runSavedFileLab() {
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/browser-saved-file.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/browser-saved-file.txt',
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
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view><view>{{removeSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockDownloadFile({
      fileContent: 'browser saved payload',
      url: 'https://mock.mpcore.dev/files/browser-saved-file.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileLab()

    expect(page.data.listSummary).toContain('"filePath":"headless://saved/browser-saved-file.txt"')
    expect(page.data.listSummary).toContain('"size":21')
    expect(page.data.removeSummary).toBe('removeSavedFile:ok')
    expect(session.getFileText('headless://saved/browser-saved-file.txt')).toBeNull()
  })

  it('reports removeSavedFile and getSavedFileInfo failures after removal in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
      filePath: 'headless://saved/browser-missing-file.txt',
      fail: (error) => {
        this.setData({
          missingRemoveSummary: error.message
        })
      }
    })
    wx.downloadFile({
      url: 'https://mock.mpcore.dev/files/browser-removable.txt',
      success: (downloadResult) => {
        wx.saveFile({
          tempFilePath: downloadResult.tempFilePath,
          filePath: 'headless://saved/browser-removable.txt',
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
`],
      ['pages/index/index.wxml', '<view>{{missingRemoveSummary}}</view><view>{{postRemoveReadSummary}}</view><view>{{secondRemoveSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.mockDownloadFile({
      fileContent: 'browser removable',
      url: 'https://mock.mpcore.dev/files/browser-removable.txt',
    })

    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileErrorLab()

    expect(page.data.missingRemoveSummary).toContain('removeSavedFile:fail no such file or directory')
    expect(page.data.postRemoveInfoSummary).toContain('getSavedFileInfo:fail no such file or directory')
    expect(page.data.postRemoveReadSummary).toContain('readFile:fail no such file or directory')
    expect(page.data.secondRemoveSummary).toContain('removeSavedFile:fail no such file or directory')
  })

  it('returns stable saved file metadata ordering in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    listSummary: ''
  },
  runSavedFileOrderingLab() {
    const fsManager = wx.getFileSystemManager()
    fsManager.writeFileSync('headless://temp/browser-zeta.txt', 'zeta')
    fsManager.writeFileSync('headless://temp/browser-alpha.txt', 'alpha')
    wx.saveFile({
      tempFilePath: 'headless://temp/browser-zeta.txt',
      filePath: 'headless://saved/browser-zeta.txt',
      success: () => {
        wx.saveFile({
          tempFilePath: 'headless://temp/browser-alpha.txt',
          filePath: 'headless://saved/browser-alpha.txt',
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
`],
      ['pages/index/index.wxml', '<view>{{listSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')
    page.runSavedFileOrderingLab()

    const fileList = JSON.parse(page.data.listSummary) as Array<{ createTime: number, filePath: string, size: number }>
    expect(fileList.map(item => item.filePath)).toEqual([
      'headless://saved/browser-alpha.txt',
      'headless://saved/browser-zeta.txt',
    ])
    expect(fileList.every(item => typeof item.createTime === 'number' && item.createTime > 0)).toBe(true)
    expect(fileList.map(item => item.size)).toEqual([5, 4])
  })

  it('supports showModal defaults and queued modal mocks in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
      title: 'Browser Warmup',
      content: 'Confirm flow',
      success: (result) => {
        this.setData({
          defaultSummary: JSON.stringify(result)
        })
        this.push('default:success')
      }
    })
  },
  openCancelModal() {
    wx.showModal({
      title: 'Browser Blocker',
      content: 'Cancel flow',
      cancelText: '返回',
      confirmText: '继续',
      success: (result) => {
        this.setData({
          cancelSummary: JSON.stringify(result)
        })
        this.push('cancel:success')
      }
    })
  }
})
`],
      ['pages/index/index.wxml', '<view>{{defaultSummary}}</view><view>{{cancelSummary}}</view><view>{{logs.0}}</view><view>{{logs.1}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    page.openDefaultModal()
    session.mockModal({ confirm: false })
    page.openCancelModal()

    expect(page.data.defaultSummary).toContain('"confirm":true')
    expect(page.data.cancelSummary).toContain('"cancel":true')
    expect(page.data.logs).toEqual([
      'default:success',
      'cancel:success',
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
        title: 'Browser Warmup',
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
        title: 'Browser Blocker',
      },
    ])
  })

  it('supports getNetworkType and network status change listeners in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
`],
      ['pages/index/index.wxml', '<view>{{initialType}}</view><view>{{currentType}}</view><view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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
    expect(session.renderCurrentPage().wxml).toContain('wifi')
    expect(session.renderCurrentPage().wxml).toContain('4g')
    expect(session.getNetworkType()).toEqual({
      errMsg: 'getNetworkType:ok',
      networkType: '5g',
    })
  })

  it('supports navigation bar title, color and loading state defaults in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({
        pages: ['pages/index/index', 'pages/detail/index'],
        window: {
          navigationBarBackgroundColor: '#112233',
          navigationBarTitleText: 'Browser Shell',
          navigationBarTextStyle: 'white',
        },
      })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', JSON.stringify({
        navigationBarBackgroundColor: '#abc123',
        navigationBarTitleText: 'Browser Index',
        navigationBarTextStyle: 'black',
      })],
      ['pages/index/index.js', `
Page({
  data: {
    logs: []
  },
  updateTitle() {
    wx.setNavigationBarTitle({
      title: 'Browser Updated',
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
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view>'],
      ['pages/detail/index.js', 'Page({})'],
      ['pages/detail/index.wxml', '<view>detail</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    expect(session.getCurrentPageNavigationBarTitle()).toBe('Browser Index')
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: null,
      backgroundColor: '#abc123',
      frontColor: '#000000',
      loading: false,
      title: 'Browser Index',
    })

    page.updateTitle()
    expect(session.getCurrentPageNavigationBarTitle()).toBe('Browser Updated')
    expect(session.getCurrentPageNavigationBar()?.title).toBe('Browser Updated')

    page.updateColor()
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: {
        duration: 240,
        timingFunction: 'easeIn',
      },
      backgroundColor: '#135790',
      frontColor: '#ffffff',
      loading: false,
      title: 'Browser Updated',
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
    expect(session.getCurrentPageNavigationBarTitle()).toBe('Browser Shell')
    expect(session.getCurrentPageNavigationBar()).toEqual({
      animation: null,
      backgroundColor: '#112233',
      frontColor: '#ffffff',
      loading: false,
      title: 'Browser Shell',
    })
  })

  it('supports showActionSheet defaults and cancel path in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
`],
      ['pages/index/index.wxml', '<view>{{defaultSummary}}</view><view>{{cancelSummary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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

  it('supports share menu state transitions in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
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
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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

  it('supports showTabBar and hideTabBar state transitions in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({
        pages: ['pages/home/index', 'pages/profile/index'],
        tabBar: {
          list: [
            { pagePath: 'pages/home/index', text: 'Home' },
            { pagePath: 'pages/profile/index', text: 'Profile' },
          ],
        },
      })],
      ['app.js', 'App({})'],
      ['pages/home/index.js', `
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
`],
      ['pages/home/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view><view>{{logs.3}}</view>'],
      ['pages/profile/index.js', 'Page({})'],
      ['pages/profile/index.wxml', '<view>profile</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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

  it('supports tabBar badge and red dot state transitions in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({
        pages: ['pages/home/index', 'pages/profile/index'],
        tabBar: {
          list: [
            { pagePath: 'pages/home/index', text: 'Home' },
            { pagePath: 'pages/profile/index', text: 'Profile' },
          ],
        },
      })],
      ['app.js', 'App({})'],
      ['pages/home/index.js', `
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
`],
      ['pages/home/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view><view>{{logs.3}}</view><view>{{logs.4}}</view>'],
      ['pages/profile/index.js', 'Page({})'],
      ['pages/profile/index.wxml', '<view>profile</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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

  it('supports background text style and color defaults and updates in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({
        pages: ['pages/index/index', 'pages/detail/index'],
        window: {
          backgroundColor: '#fefefe',
          backgroundColorBottom: '#eeeeee',
          backgroundColorTop: '#ffffff',
          backgroundTextStyle: 'light',
        },
      })],
      ['app.js', 'App({})'],
      ['pages/index/index.json', JSON.stringify({
        backgroundColor: '#101010',
        backgroundColorBottom: '#202020',
        backgroundColorTop: '#303030',
        backgroundTextStyle: 'dark',
      })],
      ['pages/index/index.js', `
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
`],
      ['pages/index/index.wxml', '<view>{{logs.0}}</view><view>{{logs.1}}</view><view>{{logs.2}}</view><view>{{logs.3}}</view>'],
      ['pages/detail/index.js', 'Page({})'],
      ['pages/detail/index.wxml', '<view>detail</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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

  it('renders custom components and routes triggerEvent back to the page', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 2,
    events: [],
  },
  handlePulse(event) {
    this.setData({
      events: [...this.data.events, event?.detail?.phase ?? 'none'],
      count: this.data.count + 1,
    })
  },
})
`],
      ['pages/lab/index.wxml', `
<view>Lab</view>
<status-card count="{{count}}" bind:pulse="handlePulse" />
<view>{{events.0}}</view>
`],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    }
  },
  data: {
    observerLog: 'cold'
  },
  observers: {
    count() {
      this.setData({
        observerLog: 'count:' + this.properties.count
      })
    }
  },
  methods: {
    pulse() {
      this.triggerEvent('pulse', {
        phase: 'component-click'
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', `
<view>Count: {{count}}</view>
<view>{{observerLog}}</view>
<view bindtap="pulse">trigger</view>
`],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')

    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('Count: 2')
    expect(rendered.wxml).toContain('count:2')

    const scopes = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    session.callTapBinding(componentScopeId!, 'pulse')

    const rerendered = session.renderCurrentPage()
    expect(rerendered.wxml).toContain('component-click')
    expect(rerendered.wxml).toContain('Count: 3')
    expect(rerendered.wxml).toContain('count:3')
  })

  it('passes current values into component observer arguments', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 2,
    status: 'stable'
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    observerArgs: ''
  },
  observers: {
    'count, status'(count, status) {
      this.setData({
        observerArgs: JSON.stringify({ count, status })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{observerArgs}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"count":2')
    expect(rendered.wxml).toContain('"status":"stable"')
  })

  it('runs property-level observers with the current property value', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    status: 'stable'
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: '',
      observer(value) {
        this.setData({
          propertyObserverLog: 'status:' + value
        })
      }
    }
  },
  data: {
    propertyObserverLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propertyObserverLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('status:stable')
  })

  it('passes previous values into property-level observers', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    status: 'stable'
  },
  flip() {
    this.setData({
      status: 'boosted'
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" /><view bindtap="flip">flip</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: '',
      observer(value, oldValue) {
        this.setData({
          propertyObserverLog: JSON.stringify({ value, oldValue })
        })
      }
    }
  },
  data: {
    propertyObserverLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propertyObserverLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"value":"stable"')
    expect(rendered.wxml).not.toContain('"oldValue"')

    page.flip()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"value":"boosted"')
    expect(rendered.wxml).toContain('"oldValue":"stable"')
  })

  it('coerces basic property types for component props', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 2,
    enabled: '',
    status: 42
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" enabled="{{enabled}}" status="{{status}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    },
    enabled: {
      type: Boolean,
      value: false
    },
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    propTypes: ''
  },
  observers: {
    'count, enabled, status'(count, enabled, status) {
      this.setData({
        propTypes: JSON.stringify({
          countType: typeof count,
          enabledType: typeof enabled,
          enabledValue: enabled,
          statusType: typeof status,
          statusValue: status
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propTypes}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"countType":"number"')
    expect(rendered.wxml).toContain('"enabledType":"boolean"')
    expect(rendered.wxml).toContain('"enabledValue":true')
    expect(rendered.wxml).toContain('"statusType":"string"')
    expect(rendered.wxml).toContain('"statusValue":"42"')
  })

  it('supports shorthand property declarations for basic types', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 7,
    enabled: '',
    title: 1234
  }
})
`],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" enabled="{{enabled}}" title="{{title}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: Number,
    enabled: Boolean,
    title: String
  },
  data: {
    propTypes: ''
  },
  observers: {
    'count, enabled, title'(count, enabled, title) {
      this.setData({
        propTypes: JSON.stringify({
          count,
          countType: typeof count,
          enabled,
          enabledType: typeof enabled,
          title,
          titleType: typeof title
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{propTypes}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"count":7')
    expect(rendered.wxml).toContain('"countType":"number"')
    expect(rendered.wxml).toContain('"enabled":true')
    expect(rendered.wxml).toContain('"enabledType":"boolean"')
    expect(rendered.wxml).toContain('"title":"1234"')
    expect(rendered.wxml).toContain('"titleType":"string"')
  })

  it('initializes shorthand property declarations with stable default values when omitted', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('status-card')
    this.setData({
      summary: JSON.stringify({
        count: card?.properties?.count,
        enabled: card?.properties?.enabled,
        title: card?.properties?.title,
        tagsLength: card?.properties?.tags?.length ?? -1,
        metaKeys: Object.keys(card?.properties?.meta ?? {}).length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: Number,
    enabled: Boolean,
    title: String,
    tags: Array,
    meta: Object
  },
  data: {
    summary: ''
  },
  observers: {
    'count, enabled, title, tags, meta'(count, enabled, title, tags, meta) {
      this.setData({
        summary: JSON.stringify({
          count,
          enabled,
          title,
          tagsLength: tags.length,
          metaKeys: Object.keys(meta).length
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"count":0')
    expect(page.data.summary).toContain('"enabled":false')
    expect(page.data.summary).toContain('"title":""')
    expect(page.data.summary).toContain('"tagsLength":0')
    expect(page.data.summary).toContain('"metaKeys":0')
  })

  it('supports optionalTypes for component properties', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 7
  }
})
`],
      ['pages/lab/index.wxml', '<status-card mixed="{{count}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mixed: {
      type: String,
      optionalTypes: [Number],
      value: ''
    }
  },
  data: {
    summary: ''
  },
  observers: {
    mixed(value) {
      this.setData({
        summary: JSON.stringify({
          type: typeof value,
          value
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"type":"number"')
    expect(rendered.wxml).toContain('"value":7')
  })

  it('allows passthrough component properties when type is null', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    payload: {
      level: 3
    }
  }
})
`],
      ['pages/lab/index.wxml', '<status-card mixed="{{payload}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mixed: {
      type: null,
      value: null
    }
  },
  data: {
    summary: ''
  },
  observers: {
    mixed(value) {
      this.setData({
        summary: JSON.stringify({
          isObject: !!value && typeof value === 'object' && !Array.isArray(value),
          level: value?.level ?? 0
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"isObject":true')
    expect(rendered.wxml).toContain('"level":3')
  })

  it('falls back to property default values when page props become nullish', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    status: 'stable'
  },
  clearStatus() {
    this.setData({
      status: undefined
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card status="{{status}}" /><view bindtap="clearStatus">clear</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: 'idle'
    }
  },
  data: {
    summary: ''
  },
  observers: {
    status(value) {
      this.setData({
        summary: String(value)
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('stable')

    page.clearStatus()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('idle')
  })

  it('supports function-based property default values', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('status-card')
    this.setData({
      summary: JSON.stringify(card?.properties?.meta ?? {})
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    meta: {
      type: Object,
      value() {
        return {
          owner: 'factory'
        }
      }
    }
  },
  data: {
    summary: ''
  },
  observers: {
    meta(value) {
      this.setData({
        summary: JSON.stringify(value)
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"owner":"factory"')
  })

  it('supports primitive values returned from property default factories', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('status-card')
    this.setData({
      summary: JSON.stringify({
        flag: card?.properties?.flag,
        label: card?.properties?.label
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    flag: {
      type: Boolean,
      value() {
        return true
      }
    },
    label: {
      type: String,
      value() {
        return 'factory'
      }
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{label}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"flag":true')
    expect(page.data.summary).toContain('"label":"factory"')
  })

  it('prefers methods over top-level component method definitions with the same name', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    result: ''
  },
  capture(event) {
    this.setData({
      result: event?.detail?.source ?? ''
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card bind:pulse="capture" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  pulse() {
    this.triggerEvent('pulse', {
      source: 'top-level'
    })
  },
  methods: {
    pulse() {
      this.triggerEvent('pulse', {
        source: 'methods'
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view bindtap="pulse">pulse</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const cardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))
    expect(cardScopeId).toBeTruthy()

    session.callTapBinding(cardScopeId!, 'pulse')
    const page = session.getCurrentPages()[0]
    expect(page?.data.result).toBe('methods')
  })

  it('supports top-level component lifecycle hooks without lifetimes wrapper', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/a/index', 'pages/b/index'] })],
      ['app.js', 'App({})'],
      ['pages/a/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/a/index.js', 'Page({ openB() { wx.reLaunch({ url: "/pages/b/index" }) } })'],
      ['pages/a/index.wxml', '<status-card /><view bindtap="openB">next</view>'],
      ['pages/b/index.js', 'Page({})'],
      ['pages/b/index.wxml', '<view>B</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  data: {
    lifecycleLog: []
  },
  created() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'created']
    })
  },
  attached() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'attached']
    })
  },
  ready() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'ready']
    })
  },
  detached() {
    this.setData({
      lifecycleLog: [...this.data.lifecycleLog, 'detached']
    })
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{lifecycleLog.0}}</view><view>{{lifecycleLog.1}}</view><view>{{lifecycleLog.2}}</view><view>{{lifecycleLog.3}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const pageA = session.reLaunch('/pages/a/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('created')
    expect(rendered.wxml).toContain('attached')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('ready')

    const scopes = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    pageA.openB()
    const componentScope = session.getScopeSnapshot(componentScopeId!)
    expect(componentScope).toBeNull()
  })

  it('merges basic Behavior fields into component instances', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { count: 2 } })'],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
const shared = Behavior({
  properties: {
    count: Number
  },
  data: {
    fromBehavior: 'yes'
  },
  methods: {
    ping() {
      return 'pong'
    }
  },
  observers: {
    count(count) {
      this.setData({
        observerLog: 'count:' + count
      })
    }
  }
})

Component({
  behaviors: [shared],
  data: {
    observerLog: ''
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{fromBehavior}}</view><view>{{observerLog}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('yes')
    expect(rendered.wxml).toContain('count:2')

    const card = session.selectComponent('status-card')
    expect(card?.ping?.()).toBe('pong')
  })

  it('supports nested behaviors and preserves merge order', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { count: 2 } })'],
      ['pages/lab/index.wxml', '<status-card count="{{count}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
const base = Behavior({
  data: {
    level: 'base'
  },
  methods: {
    fromBase() {
      return 'base'
    }
  }
})

const nested = Behavior({
  behaviors: [base],
  data: {
    level: 'nested'
  },
  methods: {
    fromNested() {
      return 'nested'
    }
  }
})

Component({
  behaviors: [nested],
  data: {
    level: 'component',
    summary: ''
  },
  observers: {
    count(count) {
      this.setData({
        summary: JSON.stringify({
          count,
          level: this.data.level
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"count":2')
    expect(rendered.wxml).toContain('"level":"component"')

    const card = session.selectComponent('status-card')
    expect(card?.fromBase?.()).toBe('base')
    expect(card?.fromNested?.()).toBe('nested')
  })

  it('preserves array and object property structures from page data', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    filters: ['hot', 'new'],
    meta: {
      owner: 'ops'
    }
  }
})
`],
      ['pages/lab/index.wxml', '<status-card filters="{{filters}}" meta="{{meta}}" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    filters: Array,
    meta: Object
  },
  data: {
    payload: ''
  },
  observers: {
    'filters, meta'(filters, meta) {
      this.setData({
        payload: JSON.stringify({
          filterSize: filters?.length ?? 0,
          first: filters?.[0] ?? '',
          owner: meta?.owner ?? ''
        })
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{payload}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"filterSize":2')
    expect(rendered.wxml).toContain('"first":"hot"')
    expect(rendered.wxml).toContain('"owner":"ops"')
  })

  it('clones array and object default property values per component instance', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    title: 'main',
    summary: ''
  },
  inspect() {
    const cards = this.selectAllComponents('status-card')
    cards[0]?.properties?.filters?.push('first')
    cards[0]?.properties?.meta && (cards[0].properties.meta.owner = 'mutated')
    this.setData({
      summary: JSON.stringify({
        firstFilters: cards[0]?.properties?.filters ?? [],
        secondFilters: cards[1]?.properties?.filters ?? [],
        firstOwner: cards[0]?.properties?.meta?.owner ?? '',
        secondOwner: cards[1]?.properties?.meta?.owner ?? ''
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card /><status-card /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    filters: {
      type: Array,
      value: []
    },
    meta: {
      type: Object,
      value: {
        owner: 'default'
      }
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{filters.length}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"firstFilters":["first"]')
    expect(page.data.summary).toContain('"secondFilters":[]')
    expect(page.data.summary).toContain('"firstOwner":"mutated"')
    expect(page.data.summary).toContain('"secondOwner":"default"')
  })

  it('runs component pageLifetimes on page show hide and resize', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/a/index', 'pages/b/index'] })],
      ['app.js', 'App({})'],
      ['pages/a/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/a/index.js', 'Page({ openB() { wx.navigateTo({ url: "/pages/b/index" }) } })'],
      ['pages/a/index.wxml', '<status-card mode="{{\'A\'}}" /><view bindtap="openB">next</view>'],
      ['pages/b/index.js', 'Page({})'],
      ['pages/b/index.wxml', '<view>B</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    mode: {
      type: String,
      value: ''
    }
  },
  data: {
    lifecycleLog: []
  },
  pageLifetimes: {
    show() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'show']
      })
    },
    hide() {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'hide']
      })
    },
    resize(options) {
      this.setData({
        lifecycleLog: [...this.data.lifecycleLog, 'resize:' + options?.size?.windowWidth]
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{mode}}</view><view>{{lifecycleLog.0}}</view><view>{{lifecycleLog.1}}</view><view>{{lifecycleLog.2}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const pageA = session.reLaunch('/pages/a/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('show')
    const scopes = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const componentScopeId = scopes.find(scopeId => scopeId.includes('status-card'))
    expect(componentScopeId).toBeTruthy()

    session.triggerResize({
      size: {
        windowWidth: 375,
      },
    })
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('resize:375')

    pageA.openB()
    const componentScope = session.getScopeSnapshot(componentScopeId!)
    expect(componentScope?.data.lifecycleLog).toEqual(['show', 'resize:375', 'hide'])
  })

  it('supports selectComponent and selectAllComponents from the page instance', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    count: 2,
    snapshot: ''
  },
  inspect() {
    const card = this.selectComponent('#status-card')
    const cards = this.selectAllComponents('status-card')
    this.setData({
      snapshot: JSON.stringify({
        count: card?.properties?.count,
        hasPulse: typeof card?.pulse === 'function',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card id="status-card" count="{{count}}" /><view bindtap="inspect">inspect</view><view>{{snapshot}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    count: {
      type: Number,
      value: 0
    }
  },
  methods: {
    pulse() {}
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{count}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()

    expect(page.data.snapshot).toContain('"count":2')
    expect(page.data.snapshot).toContain('"hasPulse":true')
    expect(page.data.snapshot).toContain('"size":1')
  })

  it('supports selecting component instances by class selector', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    title: 'main',
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('.primary-card')
    const cards = this.selectAllComponents('.primary-card')
    this.setData({
      summary: JSON.stringify({
        title: card?.properties?.title ?? '',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card class="primary-card" title="{{title}}" /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    title: String
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{title}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"title":"main"')
    expect(page.data.summary).toContain('"size":1')
  })

  it('supports selecting component instances by data attribute selector', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    title: 'main',
    summary: ''
  },
  inspect() {
    const card = this.selectComponent('[data-role="primary"]')
    const cards = this.selectAllComponents('[data-role="primary"]')
    this.setData({
      summary: JSON.stringify({
        title: card?.properties?.title ?? '',
        size: cards.length
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card data-role="primary" title="{{title}}" /><view bindtap="inspect">inspect</view><view>{{summary}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  properties: {
    title: String
  }
})
`],
      ['components/status-card/index.wxml', '<view>{{title}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()
    page.inspect()
    expect(page.data.summary).toContain('"title":"main"')
    expect(page.data.summary).toContain('"size":1')
  })

  it('supports nested component selection and component created ready lifetimes', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { result: "", status: "stable" }, handlePulse(event) { this.setData({ result: event?.detail?.phase ?? "" }) } })'],
      ['pages/lab/index.wxml', '<status-card id="status-card" status="{{status}}" bind:pulse="handlePulse" /><view>{{result}}</view>'],
      ['components/status-card/index.json', JSON.stringify({
        usingComponents: {
          'mini-badge': '../mini-badge/index',
        },
      })],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: ''
    }
  },
  data: {
    nested: ''
  },
  methods: {
    inspectNested() {
      const badge = this.selectComponent('#mini-badge')
      const badges = this.selectAllComponents('mini-badge')
      this.setData({
        nested: JSON.stringify({
          label: badge?.properties?.label ?? '',
          size: badges.length
        })
      })
      this.triggerEvent('pulse', {
        phase: this.data.nested
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<mini-badge id="mini-badge" label="{{status}}" /><view bindtap="inspectNested">inspect nested</view><view>{{nested}}</view>'],
      ['components/mini-badge/index.json', '{}'],
      ['components/mini-badge/index.js', `
Component({
  properties: {
    label: {
      type: String,
      value: ''
    }
  },
  data: {
    readyState: 'cold'
  },
  lifetimes: {
    created() {
      this.setData({ readyState: 'created' })
    },
    ready() {
      this.setData({ readyState: 'ready' })
    }
  }
})
`],
      ['components/mini-badge/index.wxml', '<view>{{label}}</view><view>{{readyState}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('created')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('ready')

    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card') && !scopeId.includes('mini-badge'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBinding(statusCardScopeId!, 'inspectNested')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"label":"stable"')
    expect(rendered.wxml).toContain('"size":1')
  })

  it('passes triggerEvent options and event target shape back to the page', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    snapshot: ''
  },
  handlePulse(event) {
    this.setData({
      snapshot: JSON.stringify({
        bubbles: event?.bubbles ?? false,
        composed: event?.composed ?? false,
        id: event?.target?.id ?? ''
      })
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card id="status-card" bind:pulse="handlePulse" /><view>{{snapshot}}</view>'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  methods: {
    pulse() {
      this.triggerEvent('pulse', {
        phase: 'shape'
      }, {
        bubbles: true,
        composed: true
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view bindtap="pulse">pulse</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBindingWithEvent(statusCardScopeId!, 'pulse', {
      dataset: {
        cardType: 'primary',
        phase: 'pulse',
      },
      id: 'pulse-node',
    })
    const page = session.getCurrentPages()[0]
    expect(page?.data.snapshot).toContain('"bubbles":true')
    expect(page?.data.snapshot).toContain('"composed":true')
    expect(page?.data.snapshot).toContain('"id":"pulse-node"')
  })

  it('supports selectOwnerComponent from nested component instances', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', 'Page({ data: { status: "stable" } })'],
      ['pages/lab/index.wxml', '<status-card id="status-card" status="{{status}}" />'],
      ['components/status-card/index.json', JSON.stringify({
        usingComponents: {
          'mini-badge': '../mini-badge/index',
        },
      })],
      ['components/status-card/index.js', `
Component({
  properties: {
    status: {
      type: String,
      value: ''
    }
  }
})
`],
      ['components/status-card/index.wxml', '<mini-badge id="mini-badge" label="{{status}}" />'],
      ['components/mini-badge/index.json', '{}'],
      ['components/mini-badge/index.js', `
Component({
  properties: {
    label: {
      type: String,
      value: ''
    }
  },
  data: {
    ownerSnapshot: ''
  },
  methods: {
    inspectOwner() {
      const owner = this.selectOwnerComponent?.()
      this.setData({
        ownerSnapshot: JSON.stringify({
          hasOwner: !!owner,
          status: owner?.properties?.status ?? ''
        })
      })
    }
  }
})
`],
      ['components/mini-badge/index.wxml', '<view bindtap="inspectOwner">inspect owner</view><view>{{ownerSnapshot}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const badgeScopeId = scopeIds.find(scopeId => scopeId.includes('mini-badge'))
    expect(badgeScopeId).toBeTruthy()

    session.callTapBinding(badgeScopeId!, 'inspectOwner')
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('"hasOwner":true')
    expect(rendered.wxml).toContain('"status":"stable"')
  })

  it('maps data attributes into event target dataset', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    snapshot: ''
  },
  handlePulse(event) {
    this.setData({
      snapshot: JSON.stringify(event?.target?.dataset ?? {})
    })
  }
})
`],
      ['pages/lab/index.wxml', '<status-card bind:pulse="handlePulse" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', `
Component({
  methods: {
    pulse() {
      this.triggerEvent('pulse', {}, {
        bubbles: true
      })
    }
  }
})
`],
      ['components/status-card/index.wxml', '<view id="pulse-node" data-phase="pulse" data-card-type="primary" bindtap="pulse">pulse</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const statusCardScopeId = scopeIds.find(scopeId => scopeId.includes('status-card'))
    expect(statusCardScopeId).toBeTruthy()

    session.callTapBindingWithEvent(statusCardScopeId!, 'pulse', {
      dataset: {
        cardType: 'primary',
        phase: 'pulse',
      },
      id: 'pulse-node',
    })
    const page = session.getCurrentPages()[0]
    expect(page?.data.snapshot).toContain('"phase":"pulse"')
    expect(page?.data.snapshot).toContain('"cardType":"primary"')
  })

  it('renders wx:if / wx:elif / wx:else branches and wx:for lists', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.js', `
Page({
  data: {
    visible: true,
    status: '',
    actions: [
      { label: 'Alpha', value: 'alpha' },
      { label: 'Beta', value: 'beta' }
    ]
  },
  flip() {
    this.setData({
      visible: false,
      status: 'ready'
    })
  }
})
`],
      ['pages/lab/index.wxml', `
<view wx:if="{{visible}}">visible</view>
<view wx:elif="{{status}}">status:{{status}}</view>
<view wx:else>empty</view>
<view
  wx:for="{{actions}}"
  wx:key="value"
  wx:for-item="action"
  wx:for-index="actionIndex"
>
  {{actionIndex}}-{{action.label}}-{{action.value}}
</view>
`],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('visible')
    expect(rendered.wxml).not.toContain('status:ready')
    expect(rendered.wxml).toContain('0-Alpha-alpha')
    expect(rendered.wxml).toContain('1-Beta-beta')

    page.flip()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).not.toContain('>visible<')
    expect(rendered.wxml).toContain('status:ready')
    expect(rendered.wxml).not.toContain('>empty<')
  })

  it('updates loop-driven component properties after page setData patches', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          pill: '../../components/pill/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    actions: [
      { label: 'Alpha' },
      { label: 'Beta' }
    ]
  },
  rename() {
    this.setData({
      'actions[1].label': 'Gamma'
    })
  }
})
`],
      ['pages/lab/index.wxml', `
<pill
  wx:for="{{actions}}"
  wx:key="label"
  wx:for-item="action"
  label="{{action.label}}"
/>
`],
      ['components/pill/index.json', '{}'],
      ['components/pill/index.js', `
Component({
  properties: {
    label: String
  },
  data: {
    summary: ''
  },
  observers: {
    label(value) {
      this.setData({
        summary: String(value)
      })
    }
  }
})
`],
      ['components/pill/index.wxml', '<view>{{summary}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    let rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('Alpha')
    expect(rendered.wxml).toContain('Beta')

    page.rename()
    rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('Gamma')
    expect(rendered.wxml).not.toContain('>Beta<')
  })

  it('bubbles triggerEvent through component hosts when bubbles and composed are enabled', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          shell: '../../components/shell/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    log: []
  },
  onPagePulse(event) {
    this.setData({
      log: [...this.data.log, 'page:' + (event?.detail?.phase ?? 'none')]
    })
  }
})
`],
      ['pages/lab/index.wxml', '<shell bind:pulse="onPagePulse" /><view>{{log.0}}|{{log.1}}</view>'],
      ['components/shell/index.json', JSON.stringify({
        usingComponents: {
          leaf: '../leaf/index',
        },
      })],
      ['components/shell/index.js', `
Component({
  data: {
    log: []
  },
  methods: {
    onShellPulse(event) {
      this.setData({
        log: [...this.data.log, 'shell:' + (event?.detail?.phase ?? 'none')]
      })
    }
  }
})
`],
      ['components/shell/index.wxml', '<leaf bind:pulse="onShellPulse" /><view>{{log.0}}</view>'],
      ['components/leaf/index.json', '{}'],
      ['components/leaf/index.js', `
Component({
  methods: {
    fire() {
      this.triggerEvent('pulse', {
        phase: 'leaf'
      }, {
        bubbles: true,
        composed: true
      })
    }
  }
})
`],
      ['components/leaf/index.wxml', '<view bindtap="fire">fire</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const leafScopeId = scopeIds.find(scopeId => scopeId.includes('leaf'))
    expect(leafScopeId).toBeTruthy()

    session.callTapBindingWithEvent(leafScopeId!, 'fire', {
      id: 'leaf-node',
    })

    const page = session.getCurrentPages()[0]
    expect(page?.data.log).toEqual(['page:leaf'])
    const rerendered = session.renderCurrentPage()
    expect(rerendered.wxml).toContain('shell:leaf')
  })

  it('stops triggerEvent bubbling at catch bindings on component hosts', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          shell: '../../components/shell/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    log: []
  },
  onPagePulse(event) {
    this.setData({
      log: [...this.data.log, 'page:' + (event?.detail?.phase ?? 'none')]
    })
  }
})
`],
      ['pages/lab/index.wxml', '<shell bind:pulse="onPagePulse" /><view>{{log.0}}</view>'],
      ['components/shell/index.json', JSON.stringify({
        usingComponents: {
          leaf: '../leaf/index',
        },
      })],
      ['components/shell/index.js', `
Component({
  data: {
    log: []
  },
  methods: {
    onShellPulse(event) {
      this.setData({
        log: [...this.data.log, 'shell:' + (event?.detail?.phase ?? 'none')]
      })
    }
  }
})
`],
      ['components/shell/index.wxml', '<leaf catch:pulse="onShellPulse" /><view>{{log.0}}</view>'],
      ['components/leaf/index.json', '{}'],
      ['components/leaf/index.js', `
Component({
  methods: {
    fire() {
      this.triggerEvent('pulse', {
        phase: 'leaf'
      }, {
        bubbles: true,
        composed: true
      })
    }
  }
})
`],
      ['components/leaf/index.wxml', '<view bindtap="fire">fire</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    session.reLaunch('/pages/lab/index')
    const rendered = session.renderCurrentPage()
    const scopeIds = Array.from(rendered.wxml.matchAll(/data-sim-scope="([^"]+)"/g), match => match[1]!)
    const leafScopeId = scopeIds.find(scopeId => scopeId.includes('leaf'))
    expect(leafScopeId).toBeTruthy()

    session.callTapBinding(leafScopeId!, 'fire')

    const page = session.getCurrentPages()[0]
    expect(page?.data.log).toEqual([])
    const rerendered = session.renderCurrentPage()
    expect(rerendered.wxml).toContain('shell:leaf')
  })

  it('supports createSelectorQuery in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    selectorQueryResult: null,
    viewportResult: null
  },
  runSelectorQuery() {
    wx.createSelectorQuery()
      .select('#card')
      .fields({
        id: true,
        dataset: true,
        rect: true,
        size: true
      }, (result) => {
        this.setData({
          selectorQueryResult: result
        })
      })
      .exec()
  },
  runViewportQuery() {
    wx.pageScrollTo({
      scrollTop: 88
    })
    wx.createSelectorQuery()
      .selectViewport()
      .scrollOffset((result) => {
        this.setData({
          viewportResult: result
        })
      })
      .exec()
  }
})
`],
      ['pages/index/index.wxml', '<view id="card" data-kind="browser" style="left: 8px; top: 10px; width: 200px; height: 40px;">Browser Card</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    page.runSelectorQuery()
    expect(page.data.selectorQueryResult).toEqual({
      bottom: 50,
      dataset: {
        kind: 'browser',
      },
      height: 40,
      id: 'card',
      left: 8,
      right: 208,
      top: 10,
      width: 200,
    })

    page.runViewportQuery()
    expect(page.data.viewportResult).toEqual({
      scrollLeft: 0,
      scrollTop: 88,
    })
  })

  it('supports createSelectorQuery.in(component) in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/lab/index'] })],
      ['app.js', 'App({})'],
      ['pages/lab/index.json', JSON.stringify({
        usingComponents: {
          'status-card': '../../components/status-card/index',
        },
      })],
      ['pages/lab/index.js', `
Page({
  data: {
    scopedRect: null
  },
  inspectScopedQuery() {
    const card = this.selectComponent('#status-card')
    wx.createSelectorQuery()
      .in(card)
      .select('.card-shell')
      .boundingClientRect((result) => {
        this.setData({
          scopedRect: result
        })
      })
      .exec()
  }
})
`],
      ['pages/lab/index.wxml', '<status-card id="status-card" />'],
      ['components/status-card/index.json', '{}'],
      ['components/status-card/index.js', 'Component({})'],
      ['components/status-card/index.wxml', '<view class="card-shell" style="left: 6px; top: 9px; width: 30px; height: 20px;">card</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/lab/index')
    session.renderCurrentPage()

    page.inspectScopedQuery()

    expect(page.data.scopedRect).toEqual({
      bottom: 29,
      height: 20,
      left: 6,
      right: 36,
      top: 9,
      width: 30,
    })
  })

  it('returns array results for selectAll(...).fields(...) in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    summary: ''
  },
  inspectAll() {
    wx.createSelectorQuery()
      .selectAll('.item')
      .fields({
        id: true,
        dataset: true
      }, (result) => {
        this.setData({
          summary: JSON.stringify(result)
        })
      })
      .exec()
  }
})
`],
      ['pages/index/index.wxml', '<view id="item-a" class="item" data-kind="alpha"></view><view id="item-b" class="item" data-kind="beta"></view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    page.inspectAll()

    expect(page.data.summary).toContain('"id":"item-a"')
    expect(page.data.summary).toContain('"kind":"alpha"')
    expect(page.data.summary).toContain('"id":"item-b"')
    expect(page.data.summary).toContain('"kind":"beta"')
  })

  it('returns mark, context and node placeholders in browser runtime selector query', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
      ['app.js', 'App({})'],
      ['pages/index/index.js', `
Page({
  data: {
    summary: ''
  },
  inspectMeta() {
    wx.createSelectorQuery()
      .select('#meta-card')
      .fields({
        context: true,
        mark: true,
        node: true
      }, (result) => {
        this.setData({
          summary: JSON.stringify(result)
        })
      })
      .exec()
  }
})
`],
      ['pages/index/index.wxml', '<view id="meta-card" mark:source="browser-meta"></view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
    const page = session.reLaunch('/pages/index/index')

    page.inspectMeta()

    expect(page.data.summary).toContain('"source":"browser-meta"')
    expect(page.data.summary).toContain('"type":"unsupported-context"')
    expect(page.data.summary).toContain('"type":"view"')
  })

  it('tracks pull-down refresh state and stop calls in browser runtime', () => {
    const files = createBrowserVirtualFiles([
      ['app.json', JSON.stringify({ pages: ['pages/events/index'] })],
      ['app.js', 'App({})'],
      ['pages/events/index.js', `
Page({
  data: {
    logs: []
  },
  onPullDownRefresh() {
    this.setData({
      logs: [...this.data.logs, 'pull-down']
    })
    wx.stopPullDownRefresh()
  }
})
`],
      ['pages/events/index.wxml', '<view>{{logs.0}}</view>'],
    ])

    const session = createBrowserHeadlessSession({ files })
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
    expect(session.renderCurrentPage().wxml).toContain('pull-down')
  })
})
