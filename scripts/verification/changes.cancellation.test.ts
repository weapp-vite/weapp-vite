import { beforeEach, expect, it, vi } from 'vitest'
import { readChanges } from './changes.ts'

const mocks = vi.hoisted(() => ({ git: vi.fn(), readFile: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.git }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.git.mockResolvedValue({ stdout: '' })
})

it('does not launch Git for a cancelled scan', async () => {
  const controller = new AbortController()
  const reason = new Error('scan cancelled')
  controller.abort(reason)
  await expect(readChanges('.', { signal: controller.signal })).rejects.toBe(reason)
  expect(mocks.git).not.toHaveBeenCalled()
})

it('passes cancellation to the active Git command and does not try another automatic base', async () => {
  const controller = new AbortController()
  const reason = new Error('scan cancelled')
  mocks.git.mockImplementation(async (_command: string, args: string[], options: { cancelSignal: AbortSignal }) => {
    expect(options.cancelSignal).toBe(controller.signal)
    if (args[2] === 'merge-base') {
      controller.abort(reason)
      throw new Error('Git was terminated')
    }
    return { stdout: 'fixture-head' }
  })
  await expect(readChanges('.', { signal: controller.signal })).rejects.toBe(reason)
  expect(mocks.git.mock.calls.map(([, args]) => args)).toEqual([
    ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'],
    ['-c', 'core.fsmonitor=false', 'merge-base', 'HEAD', 'origin/main'],
  ])
})

it('does not treat cancellation during a missing file read as a deletion', async () => {
  const controller = new AbortController()
  const reason = new Error('scan cancelled')
  mocks.git.mockImplementation(async (_command: string, args: string[]) => ({
    stdout: args[2] === 'ls-files' ? 'tracked.ts\0' : '',
  }))
  mocks.readFile.mockImplementation(async (_file: string, options: { signal: AbortSignal }) => {
    expect(options.signal).toBe(controller.signal)
    controller.abort(reason)
    throw Object.assign(new Error('file removed'), { code: 'ENOENT' })
  })
  await expect(readChanges('.', { base: 'HEAD', signal: controller.signal })).rejects.toBe(reason)
  expect(mocks.readFile).toHaveBeenCalledOnce()
})
