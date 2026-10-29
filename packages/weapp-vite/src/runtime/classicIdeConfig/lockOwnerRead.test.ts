import { randomUUID } from 'node:crypto'
import fsNative from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { classicIdeConfigLeasePath } from './leases'
import { withClassicIdeConfigLock } from './lock'

const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})

async function fixture(held = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-config-owner-read-'))
  roots.push(root)
  const file = path.join(root, 'project.private.config.json')
  const guard = `${classicIdeConfigLeasePath(file)}.lock`
  await fs.ensureDir(path.dirname(guard))
  const owner = { pid: process.pid + 1, token: randomUUID() }
  const leaf = path.join(guard, owner.token)
  let bytes = ''
  if (held) {
    await fs.outputJSON(leaf, owner)
    bytes = await fsNative.readFile(leaf, 'utf8')
    const kill = process.kill.bind(process)
    vi.spyOn(process, 'kill').mockImplementation((target, signal) => {
      if (target === owner.pid) {
        throw Object.assign(new Error('process exited'), { code: 'ESRCH' })
      }
      return kill(target, signal)
    })
  }
  return { file, guard, owner, leaf, bytes }
}

async function expectKept(context: Awaited<ReturnType<typeof fixture>>) {
  expect(await fsNative.readFile(context.leaf, 'utf8')).toBe(context.bytes)
  expect(await fsNative.readdir(path.dirname(context.guard))).toEqual([path.basename(context.guard)])
}

it.each(['directory', 'token'] as const)('retries a transient owner %s read before reclaiming a dead guard', async (stage) => {
  const { file, guard } = await fixture()
  const failure = Object.assign(new Error('owner read is pending'), { code: 'EPERM' })
  const read = stage === 'directory' ? vi.spyOn(fs, 'readdir') : vi.spyOn(fs, 'readFile')
  read.mockRejectedValueOnce(failure)
  const run = vi.fn(async () => 'recovered')
  await expect(withClassicIdeConfigLock(file, run)).resolves.toBe('recovered')
  expect(read).toHaveBeenCalledTimes(2)
  expect(run).toHaveBeenCalledOnce()
  expect(await fs.pathExists(guard)).toBe(false)
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([])
})

it('enumerates the guard again when it disappears after a token read EPERM', async () => {
  const { file, guard, leaf } = await fixture()
  const read = vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => {
    await fsNative.unlink(leaf)
    await fsNative.rmdir(guard)
    throw Object.assign(new Error('owner was removed during open'), { code: 'EPERM' })
  })
  const run = vi.fn(async () => 'after removal')
  await expect(withClassicIdeConfigLock(file, run)).resolves.toBe('after removal')
  expect(read).toHaveBeenCalledOnce()
  expect(run).toHaveBeenCalledOnce()
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([])
})

it('preserves a replacement live owner after retrying the complete read', async () => {
  const { file, guard, leaf } = await fixture()
  const replacement = { pid: process.pid, token: randomUUID() }
  const replacementLeaf = path.join(guard, replacement.token)
  let now = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const unlink = vi.spyOn(fsNative, 'unlink')
  const read = vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => {
    await fsNative.unlink(leaf)
    await fs.outputJSON(replacementLeaf, replacement)
    throw Object.assign(new Error('old owner was replaced during open'), { code: 'EPERM' })
  })
  const kill = vi.spyOn(process, 'kill').mockImplementation((target) => {
    expect(target).toBe(replacement.pid)
    now = 1000
    return true
  })
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(file, run)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(read).toHaveBeenCalledTimes(2)
  expect(read.mock.calls[1]?.[0]).toBe(replacementLeaf)
  expect(kill).toHaveBeenCalledWith(replacement.pid, 0)
  expect(unlink.mock.calls.some(([target]) => target === replacementLeaf)).toBe(false)
  expect(JSON.parse(await fsNative.readFile(replacementLeaf, 'utf8')) as unknown).toEqual(replacement)
  expect(run).not.toHaveBeenCalled()
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it('retains the persistent read EPERM as the cause at the original deadline', async () => {
  const context = await fixture()
  const failure = Object.assign(new Error('cannot read owner token'), { code: 'EPERM' })
  let now = 0
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const read = vi.spyOn(fs, 'readFile').mockImplementation(async () => {
    if (attempts >= 2) {
      throw new Error('owner read exceeded the original deadline')
    }
    if (++attempts === 2) {
      now = 1000
    }
    throw failure
  })
  const run = vi.fn(async () => {})
  const rejected: unknown = await withClassicIdeConfigLock(context.file, run).catch((error: unknown) => error)
  expect(rejected).toMatchObject({ code: 'EEXIST' })
  expect((rejected as Error).cause).toBe(failure)
  expect(read).toHaveBeenCalledTimes(2)
  expect(run).not.toHaveBeenCalled()
  await expectKept(context)
})

it('shares the publication deadline with owner reads', async () => {
  const context = await fixture()
  const failure = Object.assign(new Error('owner read budget exhausted'), { code: 'EPERM' })
  let now = 0
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(fsNative, 'rename').mockImplementationOnce(async () => {
    now = 900
    throw Object.assign(new Error('guard is occupied'), { code: 'EPERM' })
  })
  const read = vi.spyOn(fs, 'readFile').mockImplementation(async () => {
    if (++attempts > 1) {
      throw new Error('owner read received a fresh budget')
    }
    now = 1000
    throw failure
  })
  const run = vi.fn(async () => {})
  const rejected: unknown = await withClassicIdeConfigLock(context.file, run).catch((error: unknown) => error)
  expect((rejected as Error).cause).toBe(failure)
  expect(read).toHaveBeenCalledOnce()
  expect(run).not.toHaveBeenCalled()
  await expectKept(context)
})

it.each(['EACCES', 'EIO'])('preserves non-contention owner read errors immediately: %s', async (code) => {
  const context = await fixture()
  const failure = Object.assign(new Error('cannot read owner token'), { code })
  const read = vi.spyOn(fs, 'readFile').mockRejectedValue(failure)
  const run = vi.fn(async () => {})
  const rejected: unknown = await withClassicIdeConfigLock(context.file, run).catch((error: unknown) => error)
  expect((rejected as Error).cause).toBe(failure)
  expect(read).toHaveBeenCalledOnce()
  expect(run).not.toHaveBeenCalled()
  await expectKept(context)
})

it.each(['not-json', '{"pid":0,"token":"invalid"}'])('preserves a damaged owner after a transient read error: %s', async (bytes) => {
  const context = await fixture()
  await fsNative.writeFile(context.leaf, bytes)
  const read = vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('open pending'), { code: 'EPERM' }))
  const kill = vi.spyOn(process, 'kill')
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(context.file, run)).rejects.toMatchObject({ code: 'EEXIST' })
  expect(read).toHaveBeenCalledTimes(2)
  expect(kill).not.toHaveBeenCalled()
  expect(run).not.toHaveBeenCalled()
  await expectKept({ ...context, bytes })
})

it('retries the acquisition cleanup read without hiding an empty-guard rmdir EPERM', async () => {
  const { file, guard } = await fixture()
  const failure = Object.assign(new Error('cannot remove empty guard'), { code: 'EPERM' })
  const readdir = fs.readdir.bind(fs)
  const read = vi.spyOn(fs, 'readdir').mockImplementationOnce(readdir).mockRejectedValueOnce(Object.assign(new Error('directory inspection is pending'), { code: 'EPERM' }))
  vi.spyOn(fsNative, 'rmdir').mockRejectedValueOnce(failure)
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(file, run)).rejects.toBe(failure)
  expect(read).toHaveBeenCalledTimes(3)
  expect(run).not.toHaveBeenCalled()
  expect(await fsNative.readdir(guard)).toEqual([])
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it('shares the original deadline with an acquisition rmdir EPERM recheck', async () => {
  const { file, guard } = await fixture()
  const failure = Object.assign(new Error('cleanup read budget exhausted'), { code: 'EPERM' })
  const readdir = fs.readdir.bind(fs)
  let now = 0
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(fsNative, 'rmdir').mockImplementationOnce(async () => {
    now = 900
    throw Object.assign(new Error('empty directory deletion is pending'), { code: 'EPERM' })
  })
  const read = vi.spyOn(fs, 'readdir').mockImplementationOnce(readdir).mockImplementation(async () => {
    if (++attempts > 1) {
      throw new Error('cleanup read received a fresh budget')
    }
    now = 1000
    throw failure
  })
  const run = vi.fn(async () => {})
  const rejected: unknown = await withClassicIdeConfigLock(file, run).catch((error: unknown) => error)
  expect((rejected as Error).cause).toBe(failure)
  expect(read).toHaveBeenCalledTimes(2)
  expect(run).not.toHaveBeenCalled()
  expect(await fsNative.readdir(guard)).toEqual([])
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it('does not retry an owned-release cleanup read EPERM', async () => {
  const { file, guard } = await fixture(false)
  const failure = Object.assign(new Error('cannot inspect release directory'), { code: 'EPERM' })
  const read = vi.spyOn(fs, 'readdir').mockRejectedValue(failure)
  const rmdir = vi.spyOn(fsNative, 'rmdir').mockRejectedValue(Object.assign(new Error('cannot release directory'), { code: 'EPERM' }))
  const run = vi.fn(async () => 'finished')
  const rejected: unknown = await withClassicIdeConfigLock(file, run).catch((error: unknown) => error)
  expect((rejected as Error).cause).toBe(failure)
  expect(read).toHaveBeenCalledOnce()
  expect(rmdir).toHaveBeenCalledOnce()
  expect(run).toHaveBeenCalledOnce()
  expect(await fsNative.readdir(guard)).toEqual([])
  expect(await fsNative.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})
