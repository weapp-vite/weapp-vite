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
expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(browserSession.getSavedFileListSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(browserSession.getCurrentPages()[0]?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(browserSession.getCurrentPages()[0]?.wx.getSavedFileList())
expectType<{ errMsg: string } | undefined>(browserSession.getCurrentPages()[0]?.wx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(browserSession.getCurrentPages()[0]?.wx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(browserSession.getCurrentPages()[0]?.wx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

const headlessSession = createHeadlessSession({ projectPath: '/tmp/project' })
expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<Array<{ createTime: number, filePath: string, size: number }>>(headlessSession.getSavedFileListSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
expectType<{ createTime: number, errMsg: string, size: number } | undefined>(headlessSession.getCurrentPages()[0]?.wx.getSavedFileInfo({ filePath: 'headless://wxfile/saved/0001' }))
expectType<{ errMsg: string, fileList: Array<{ createTime: number, filePath: string, size: number }> } | undefined>(headlessSession.getCurrentPages()[0]?.wx.getSavedFileList())
expectType<{ errMsg: string } | undefined>(headlessSession.getCurrentPages()[0]?.wx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(headlessSession.getCurrentPages()[0]?.wx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(headlessSession.getCurrentPages()[0]?.wx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

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
