import { expectType } from 'tsd'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFiles,
  createHeadlessSession,
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

browserPage?.wx.getFileSystemManager().rmdir({
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

const headlessSession = createHeadlessSession({ projectPath: '/tmp/project' })
const headlessPage = headlessSession.getCurrentPages()[0]

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

headlessPage?.wx.getFileSystemManager().rmdir({
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
