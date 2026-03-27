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
expectType<string | null>(browserSession.getCurrentPageNavigationBarTitle())
expectType<{ active: boolean, stopCalls: number }>(browserSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(browserSession.getTabBar())
expectType<Record<string, string>>(browserSession.getFileSnapshot())
expectType<string | null>(browserSession.getFileText('headless://wxfile/temp/0001'))
expectType<string>(browserSession.getCurrentPages()[0]?.wx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

const headlessSession = createHeadlessSession({ projectPath: '/tmp/project' })
expectType<{ active: boolean, stopCalls: number }>(headlessSession.getPullDownRefreshState())
expectType<{ visible: boolean }>(headlessSession.getTabBar())
expectType<Record<string, string>>(headlessSession.getFileSnapshot())
expectType<string | null>(headlessSession.getFileText('headless://wxfile/temp/0001'))
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
