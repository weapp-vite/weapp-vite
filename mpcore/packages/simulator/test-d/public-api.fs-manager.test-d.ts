import type { HeadlessWx } from '..'
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
declare const browserWx: HeadlessWx

expectType<{ errMsg: string } | undefined>(browserWx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(browserWx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(browserWx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

browserWx.getFileSystemManager().access({
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

browserWx.getFileSystemManager().readFile({
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

browserWx.getFileSystemManager().stat({
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

browserWx.getFileSystemManager().readdir({
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

browserWx.getFileSystemManager().rename({
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

browserWx.getFileSystemManager().copyFile({
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

browserWx.getFileSystemManager().unlink({
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

browserWx.getFileSystemManager().writeFile({
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

browserWx.getFileSystemManager().appendFile({
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

browserWx.getFileSystemManager().mkdir({
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

browserWx.getFileSystemManager().rmdir({
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

expectType<{ errMsg: string } | undefined>(headlessSession.getWx().getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(headlessSession.getWx().getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(headlessSession.getWx().getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

headlessSession.getWx().getFileSystemManager().access({
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

headlessSession.getWx().getFileSystemManager().readFile({
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

headlessSession.getWx().getFileSystemManager().stat({
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

headlessSession.getWx().getFileSystemManager().readdir({
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

headlessSession.getWx().getFileSystemManager().rename({
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

headlessSession.getWx().getFileSystemManager().copyFile({
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

headlessSession.getWx().getFileSystemManager().unlink({
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

headlessSession.getWx().getFileSystemManager().writeFile({
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

headlessSession.getWx().getFileSystemManager().appendFile({
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

headlessSession.getWx().getFileSystemManager().mkdir({
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

headlessSession.getWx().getFileSystemManager().rmdir({
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
