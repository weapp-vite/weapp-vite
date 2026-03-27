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
expectType<{ errMsg: string } | undefined>(browserPage?.wx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(browserPage?.wx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(browserPage?.wx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')
browserPage?.wx.getFileSystemManager().access({
  path: 'headless://wxfile/temp/0001',
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
browserPage?.wx.getFileSystemManager().readFile({
  filePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ data: string, errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string } | undefined>(result)
  },
})
browserPage?.wx.getFileSystemManager().stat({
  path: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, stats: { isDirectory: () => boolean, isFile: () => boolean, size: number } }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, stats: { isDirectory: () => boolean, isFile: () => boolean, size: number } } | undefined>(result)
  },
})
browserPage?.wx.getFileSystemManager().readdir({
  dirPath: 'headless://saved',
  success: (result) => {
    expectType<{ errMsg: string, files: string[] }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, files: string[] } | undefined>(result)
  },
})
browserPage?.wx.getFileSystemManager().rename({
  oldPath: 'headless://temp/source.txt',
  newPath: 'headless://temp/target.txt',
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
browserPage?.wx.getFileSystemManager().copyFile({
  srcPath: 'headless://temp/source.txt',
  destPath: 'headless://temp/copied.txt',
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
browserPage?.wx.getFileSystemManager().unlink({
  filePath: 'headless://temp/source.txt',
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
browserPage?.wx.getFileSystemManager().writeFile({
  filePath: 'headless://temp/source.txt',
  data: 'payload',
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
browserPage?.wx.getFileSystemManager().appendFile({
  filePath: 'headless://temp/source.txt',
  data: 'payload',
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
browserPage?.wx.getFileSystemManager().mkdir({
  dirPath: 'headless://saved/example',
  recursive: true,
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
browserPage?.wx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
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
expectType<{ errMsg: string } | undefined>(headlessPage?.wx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(headlessPage?.wx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(headlessPage?.wx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')
headlessPage?.wx.getFileSystemManager().access({
  path: 'headless://wxfile/temp/0001',
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
headlessPage?.wx.getFileSystemManager().readFile({
  filePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ data: string, errMsg: string }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ data: string, errMsg: string } | undefined>(result)
  },
})
headlessPage?.wx.getFileSystemManager().stat({
  path: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, stats: { isDirectory: () => boolean, isFile: () => boolean, size: number } }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, stats: { isDirectory: () => boolean, isFile: () => boolean, size: number } } | undefined>(result)
  },
})
headlessPage?.wx.getFileSystemManager().readdir({
  dirPath: 'headless://saved',
  success: (result) => {
    expectType<{ errMsg: string, files: string[] }>(result)
  },
  fail: (error) => {
    expectType<Error>(error)
  },
  complete: (result) => {
    expectType<{ errMsg: string, files: string[] } | undefined>(result)
  },
})
headlessPage?.wx.getFileSystemManager().rename({
  oldPath: 'headless://temp/source.txt',
  newPath: 'headless://temp/target.txt',
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
headlessPage?.wx.getFileSystemManager().copyFile({
  srcPath: 'headless://temp/source.txt',
  destPath: 'headless://temp/copied.txt',
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
headlessPage?.wx.getFileSystemManager().unlink({
  filePath: 'headless://temp/source.txt',
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
headlessPage?.wx.getFileSystemManager().writeFile({
  filePath: 'headless://temp/source.txt',
  data: 'payload',
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
headlessPage?.wx.getFileSystemManager().appendFile({
  filePath: 'headless://temp/source.txt',
  data: 'payload',
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
headlessPage?.wx.getFileSystemManager().mkdir({
  dirPath: 'headless://saved/example',
  recursive: true,
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
headlessPage?.wx.saveFile({
  tempFilePath: 'headless://wxfile/temp/0001',
  success: (result) => {
    expectType<{ errMsg: string, savedFilePath: string }>(result)
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
