import type {
  HeadlessWxDownloadFileMockDefinition,
  HeadlessWxUploadFileMockDefinition,
} from '..'
import { expectType } from 'tsd'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFiles,
  createHeadlessSession,
  launch,
} from '..'

const browserFiles = createBrowserVirtualFiles([
  ['app.json', JSON.stringify({ pages: ['pages/index/index'] })],
  ['app.js', 'App({})'],
  ['pages/index/index.js', 'Page({})'],
  ['pages/index/index.wxml', '<view>hello</view>'],
])

const browserSession = createBrowserHeadlessSession({ files: browserFiles })
browserSession.reLaunch('/pages/index/index')
const browserPage = browserSession.getCurrentPages()[0]

expectType<void>(browserSession.mockDownloadFile({
  fileContent: (option) => {
    expectType<string>(option.url)
    return option.filePath ?? 'headless://wxfile/temp/browser-report.txt'
  },
  url: 'https://mock.mpcore.dev/files/report.txt',
}))
expectType<void>(browserSession.mockUploadFile({
  response: (option) => {
    expectType<string>(option.fileContent)
    expectType<string>(option.name)
    return {
      data: option.fileContent,
      statusCode: 201,
    }
  },
  url: 'https://mock.mpcore.dev/upload/report',
}))

expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(browserSession.getSavedFileListSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
expectType<{
  disconnect: () => void
  observe: (selector: string, callback: (result: {
    boundingClientRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    id: string
    intersectionRatio: number
    intersectionRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    relativeRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
  }) => void) => void
  relativeTo: (selector: string, margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
  relativeToViewport: (margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
}>(browserPage?.createIntersectionObserver?.({ thresholds: [0, 1] }))
expectType<{
  disconnect: () => void
  observe: (descriptor: {
    height?: number
    maxHeight?: number
    maxWidth?: number
    minHeight?: number
    minWidth?: number
    orientation?: string
    width?: number
  }, callback: (result: { matches: boolean }) => void) => void
}>(browserPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(browserPage?.wx.createVideoContext('hero-video', browserPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(browserPage?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(browserPage?.wx.getSavedFileList())
expectType<{ abort: () => void }>(browserPage?.wx.downloadFile({
  url: 'https://mock.mpcore.dev/files/report.txt',
  success: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string } | undefined>(result)
  },
}) ?? { abort() {} })
expectType<{ abort: () => void }>(browserPage?.wx.uploadFile({
  url: 'https://mock.mpcore.dev/upload/report',
  filePath: 'headless://wxfile/temp/0001',
  name: 'report',
  success: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number } | undefined>(result)
  },
}) ?? { abort() {} })

browserPage?.wx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, savedFilePath: string } | undefined>(result)
  },
})

browserPage?.wx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

browserPage?.wx.getSavedFileInfo({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number } | undefined>(result)
  },
})

browserPage?.wx.removeSavedFile({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string } | undefined>(result)
  },
})

const headlessSession = createHeadlessSession({ projectPath: '/tmp/project' })
const headlessPage = headlessSession.getCurrentPages()[0]

const headlessDownloadMock: HeadlessWxDownloadFileMockDefinition = {
  fileContent: 'downloaded report',
  url: /report\.txt$/,
}
expectType<void>(headlessSession.mockDownloadFile(headlessDownloadMock))

const headlessUploadMock: HeadlessWxUploadFileMockDefinition = {
  response: (option) => {
    expectType<string>(option.fileContent)
    expectType<Record<string, unknown>>(option.formData ?? {})
    return JSON.stringify({
      accepted: true,
      filePath: option.filePath,
    })
  },
  url: /upload\/report$/,
}
expectType<void>(headlessSession.mockUploadFile(headlessUploadMock))

expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(headlessSession.getSavedFileListSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
expectType<{
  disconnect: () => void
  observe: (selector: string, callback: (result: {
    boundingClientRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    id: string
    intersectionRatio: number
    intersectionRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
    relativeRect: { bottom: number, height: number, left: number, right: number, top: number, width: number }
  }) => void) => void
  relativeTo: (selector: string, margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
  relativeToViewport: (margins?: { bottom?: number, left?: number, right?: number, top?: number }) => any
}>(headlessPage?.createIntersectionObserver?.({ thresholds: [0, 1] }))
expectType<{
  disconnect: () => void
  observe: (descriptor: {
    height?: number
    maxHeight?: number
    maxWidth?: number
    minHeight?: number
    minWidth?: number
    orientation?: string
    width?: number
  }, callback: (result: { matches: boolean }) => void) => void
}>(headlessPage?.createMediaQueryObserver?.())
expectType<{
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}>(headlessPage?.wx.createVideoContext('hero-video', headlessPage))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(headlessPage?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(headlessPage?.wx.getSavedFileList())
expectType<{ abort: () => void }>(headlessPage?.wx.downloadFile({
  url: 'https://mock.mpcore.dev/files/report.txt',
  success: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, statusCode: number, tempFilePath: string } | undefined>(result)
  },
}) ?? { abort() {} })
expectType<{ abort: () => void }>(headlessPage?.wx.uploadFile({
  url: 'https://mock.mpcore.dev/upload/report',
  filePath: 'headless://wxfile/temp/0001',
  name: 'report',
  success: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string, statusCode: number } | undefined>(result)
  },
}) ?? { abort() {} })

headlessPage?.wx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, savedFilePath: string } | undefined>(result)
  },
})

headlessPage?.wx.getSavedFileList({
  success: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> }>(result)
  },
  complete: (result) => {
    expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(result)
  },
})

headlessPage?.wx.getSavedFileInfo({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ createTime: number, errMsg: string, size: number } | undefined>(result)
  },
})

headlessPage?.wx.removeSavedFile({
  filePath: 'headless://wxfile/saved/0001',
  success: (result) => {
    expectType<{ errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string } | undefined>(result)
  },
})

const launchResult = launch({ projectPath: '/tmp/project' })
expectType<Promise<{
  currentPage: () => Promise<unknown>
  pageScrollTo: (scrollTop: number) => Promise<void>
  reLaunch: (route: string) => Promise<unknown>
  scopeSnapshot: (scopeId: string) => Promise<unknown>
  selectAllComponents: (selector: string) => Promise<Array<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> }>>
  selectComponent: (selector: string) => Promise<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> } | null>
  waitForComponent: (selector: string, options?: { interval?: number, timeout?: number }) => Promise<{ callMethod: (methodName: string, ...args: any[]) => Promise<unknown>, scopeId: string, snapshot: () => Promise<unknown> }>
}>>(launchResult)
