import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import timers from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renameAtomicFile } from './atomicRename'

const nativeRename = fs.rename
let root: string
let source: string
let destination: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'hmr-rename-lock-'))
  source = path.join(root, '.index.ts.pending')
  destination = path.join(root, 'index.ts')
  await fs.writeFile(source, 'complete new source')
  await fs.writeFile(destination, 'complete old source')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

describe('renameAtomicFile', () => {
  it.each(['EPERM', 'EACCES', 'EBUSY'])('retries Windows %s without exposing partial content or removing the old target', async (code) => {
    const failure = Object.assign(new Error('temporary file lock'), { code })
    const rename = vi.spyOn(fs, 'rename')
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockImplementation(nativeRename)
    const wait = vi.spyOn(timers, 'setTimeout').mockImplementation(async () => {
      expect(await fs.readFile(destination, 'utf8')).toBe('complete old source')
      expect(await fs.readFile(source, 'utf8')).toBe('complete new source')
    })

    await renameAtomicFile(source, destination, { platform: 'win32' })
    expect(rename.mock.calls).toEqual(Array.from({ length: 3 }, () => [source, destination]))
    expect(wait.mock.calls.map(([duration]) => duration)).toEqual([10, 20])
    expect(await fs.readFile(destination, 'utf8')).toBe('complete new source')
    expect(await fs.readdir(root)).toEqual(['index.ts'])
  })

  it('bounds persistent Windows locks and retains both files for the caller to clean up', async () => {
    const failure = Object.assign(new Error('persistent file lock'), { code: 'EPERM' })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(failure)
    const wait = vi.spyOn(timers, 'setTimeout').mockResolvedValue(undefined)
    await expect(renameAtomicFile(source, destination, { platform: 'win32' })).rejects.toBe(failure)
    expect(rename).toHaveBeenCalledTimes(21)
    expect(wait).toHaveBeenCalledTimes(20)
    expect(wait.mock.calls.reduce((sum, [duration]) => sum + (duration ?? 0), 0)).toBe(1550)
    expect(await fs.readFile(destination, 'utf8')).toBe('complete old source')
    expect(await fs.readFile(source, 'utf8')).toBe('complete new source')
  })

  it.each([
    ['linux', 'EPERM'],
    ['darwin', 'EBUSY'],
    ['win32', 'ENOENT'],
    ['win32', 'EIO'],
  ] as const)('does not retry %s %s failures', async (platform, code) => {
    const failure = Object.assign(new Error('publication failed'), { code })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(failure)
    const wait = vi.spyOn(timers, 'setTimeout').mockResolvedValue(undefined)
    await expect(renameAtomicFile(source, destination, { platform })).rejects.toBe(failure)
    expect(rename).toHaveBeenCalledExactlyOnceWith(source, destination)
    expect(wait).not.toHaveBeenCalled()
    expect(await fs.readFile(destination, 'utf8')).toBe('complete old source')
  })

  it('does not attempt publication after the caller has already cancelled', async () => {
    const reason = new Error('sequence cancelled')
    const rename = vi.spyOn(fs, 'rename')
    const wait = vi.spyOn(timers, 'setTimeout')
    await expect(renameAtomicFile(source, destination, { platform: 'win32', signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(rename).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('interrupts Windows backoff with the original deadline reason before another rename', async () => {
    const controller = new AbortController()
    const reason = new DOMException('original sequence deadline', 'TimeoutError')
    const failure = Object.assign(new Error('temporary file lock'), { code: 'EPERM' })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(failure)
    const nativeWait = timers.setTimeout
    const wait = vi.spyOn(timers, 'setTimeout').mockImplementation((...args) => {
      const waiting = nativeWait(...args)
      controller.abort(reason)
      return waiting
    })
    await expect(renameAtomicFile(source, destination, { platform: 'win32', signal: controller.signal })).rejects.toBe(reason)
    expect(rename).toHaveBeenCalledTimes(1)
    expect(wait).toHaveBeenCalledExactlyOnceWith(10, undefined, { signal: controller.signal })
    expect(await fs.readFile(destination, 'utf8')).toBe('complete old source')
    expect(await fs.readFile(source, 'utf8')).toBe('complete new source')
  })

  it('checks cancellation again when backoff has already settled', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled between retries')
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(Object.assign(new Error('locked'), { code: 'EBUSY' }))
    vi.spyOn(timers, 'setTimeout').mockImplementation(async () => {
      controller.abort(reason)
    })
    await expect(renameAtomicFile(source, destination, { platform: 'win32', signal: controller.signal })).rejects.toBe(reason)
    expect(rename).toHaveBeenCalledTimes(1)
  })
})
