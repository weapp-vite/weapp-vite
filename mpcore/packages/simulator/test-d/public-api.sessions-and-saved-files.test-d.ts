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

expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(browserSession.getSavedFileListSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
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

expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(headlessSession.getSavedFileListSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
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
