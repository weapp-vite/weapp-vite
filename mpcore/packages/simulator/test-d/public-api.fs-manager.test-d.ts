import type { HeadlessWx } from '..'
import { expectType } from 'tsd'
import { createHeadlessSession } from '..'

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

const headlessSession = createHeadlessSession({ projectPath: 'fixture-project' })
const headlessWx = headlessSession.getWx()

expectType<{ errMsg: string } | undefined>(headlessWx.getFileSystemManager().rmdir({ dirPath: 'headless://saved/archive', recursive: true }))
expectType<void>(headlessWx.getFileSystemManager().rmdirSync('headless://saved/archive', true))
expectType<string>(headlessWx.getFileSystemManager().readFileSync('headless://wxfile/temp/0001') ?? '')

headlessWx.getFileSystemManager().access({
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

headlessWx.getFileSystemManager().readFile({
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

headlessWx.getFileSystemManager().stat({
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

headlessWx.getFileSystemManager().readdir({
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

headlessWx.getFileSystemManager().rename({
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

headlessWx.getFileSystemManager().copyFile({
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

headlessWx.getFileSystemManager().unlink({
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

headlessWx.getFileSystemManager().writeFile({
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

headlessWx.getFileSystemManager().appendFile({
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

headlessWx.getFileSystemManager().mkdir({
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

headlessWx.getFileSystemManager().rmdir({
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
