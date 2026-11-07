import type { HeadlessWxFileSystemError } from '../src/host'
import { expect, it, vi } from 'vitest'
import { createHeadlessWxState } from '../src/runtime/wxState'

it.each(['access', 'appendFile', 'copyFile', 'mkdir', 'readFile', 'readdir', 'rmdir', 'rename', 'stat', 'unlink', 'writeFile'] as const)('reports a wx-compatible %s failure to fail and complete', (method) => {
  const fs = createHeadlessWxState().getFileSystemManager()
  const events: string[] = []
  let failed: HeadlessWxFileSystemError | undefined
  let completed: unknown
  const option = {
    success: vi.fn(),
    fail(error: HeadlessWxFileSystemError) {
      events.push('fail')
      failed = error
    },
    complete(result: unknown) {
      events.push('complete')
      completed = result
    },
  }
  const invoke = {
    access: () => fs.access({ ...option, path: 'missing' }),
    appendFile: () => fs.appendFile({ ...option, filePath: 'missing', data: 'content', encoding: 'invalid' }),
    copyFile: () => fs.copyFile({ ...option, srcPath: 'missing', destPath: 'copy' }),
    mkdir: () => fs.mkdir({ ...option, dirPath: '' }),
    readFile: () => fs.readFile({ ...option, filePath: 'missing' }),
    readdir: () => fs.readdir({ ...option, dirPath: 'missing' }),
    rmdir: () => fs.rmdir({ ...option, dirPath: 'missing' }),
    rename: () => fs.rename({ ...option, oldPath: 'missing', newPath: 'renamed' }),
    stat: () => fs.stat({ ...option, path: 'missing' }),
    unlink: () => fs.unlink({ ...option, filePath: 'missing' }),
    writeFile: () => fs.writeFile({ ...option, filePath: 'missing', data: 'content', encoding: 'invalid' }),
  }
  expect(invoke[method]()).toBeUndefined()
  expect(option.success).not.toHaveBeenCalled()
  expect(failed).toBeInstanceOf(Error)
  expect(failed?.errMsg).toBe(failed?.message)
  expect(failed?.errMsg.length).toBeGreaterThan(0)
  expect(completed).toBe(failed)
  expect(events).toEqual(['fail', 'complete'])
})

it('keeps async missing-file errors in callbacks while sync operations throw', () => {
  const fs = createHeadlessWxState().getFileSystemManager()
  expect(() => fs.unlink({ filePath: 'missing' })).not.toThrow()
  expect(() => fs.unlinkSync('missing')).toThrow('no such file')
})

it('propagates caller callback errors without reporting them as filesystem failures', () => {
  const fs = createHeadlessWxState().getFileSystemManager()
  fs.writeFileSync('source', 'content')
  const fail = vi.fn()
  const error = new Error('caller callback failed')
  expect(() => fs.readFile({
    filePath: 'source',
    success: () => { throw error },
    fail,
  })).toThrow(error)
  expect(fail).not.toHaveBeenCalled()
})
