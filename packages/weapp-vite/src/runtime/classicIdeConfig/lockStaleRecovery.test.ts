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

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'classic-config-lock-'))
  roots.push(root)
  const file = path.join(root, 'project.private.config.json')
  const guard = `${classicIdeConfigLeasePath(file)}.lock`
  await fs.ensureDir(path.dirname(guard))
  return { file, guard }
}

async function deadGuard() {
  const context = await fixture()
  const owner = { pid: process.pid + 1, token: randomUUID() }
  const leaf = path.join(context.guard, owner.token)
  await fs.outputJSON(leaf, owner)
  const kill = process.kill.bind(process)
  vi.spyOn(process, 'kill').mockImplementation((target, signal) => {
    if (target === owner.pid) {
      throw Object.assign(new Error('process exited'), { code: 'ESRCH' })
    }
    return kill(target, signal)
  })
  return { ...context, owner, leaf }
}

it('retries a transient EPERM only for the observed dead token', async () => {
  const { file, guard, leaf } = await deadGuard()
  const failure = Object.assign(new Error('token deletion is pending'), { code: 'EPERM' })
  const unlink = fsNative.unlink.bind(fsNative)
  let attempts = 0
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (target === leaf && ++attempts === 1) {
      throw failure
    }
    return unlink(target)
  })
  const run = vi.fn(async () => 'recovered')
  await expect(withClassicIdeConfigLock(file, run)).resolves.toBe('recovered')
  expect(attempts).toBe(2)
  expect(run).toHaveBeenCalledOnce()
  expect(await fs.pathExists(guard)).toBe(false)
  expect(await fs.readdir(path.dirname(guard))).toEqual([])
})

it('retains a persistent dead-token EPERM when the original budget expires', async () => {
  const { file, guard, leaf, owner } = await deadGuard()
  const failure = Object.assign(new Error('cannot unlink dead token'), { code: 'EPERM' })
  const unlink = fsNative.unlink.bind(fsNative)
  let now = 0
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (target === leaf) {
      if (++attempts === 2) {
        now = 1000
      }
      throw failure
    }
    return unlink(target)
  })
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(file, run)).rejects.toBe(failure)
  expect(attempts).toBe(2)
  expect(run).not.toHaveBeenCalled()
  expect(await fs.readJSON(leaf)).toEqual(owner)
  expect(await fs.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it('shares one deadline between publication and dead-token deletion', async () => {
  const { file, guard, leaf, owner } = await deadGuard()
  const failure = Object.assign(new Error('dead-token budget exhausted'), { code: 'EPERM' })
  const rename = fsNative.rename.bind(fsNative)
  const unlink = fsNative.unlink.bind(fsNative)
  let now = 0
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(fsNative, 'rename').mockImplementationOnce(async () => {
    now = 900
    throw Object.assign(new Error('directory is occupied'), { code: 'EPERM' })
  }).mockImplementation(rename)
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (target === leaf) {
      if (++attempts > 1) {
        throw new Error('deletion received a fresh budget')
      }
      now = 1000
      throw failure
    }
    return unlink(target)
  })
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(file, run)).rejects.toBe(failure)
  expect(attempts).toBe(1)
  expect(run).not.toHaveBeenCalled()
  expect(await fs.readJSON(leaf)).toEqual(owner)
  expect(await fs.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it('preserves a replacement owner while a delayed dead-token retry finishes', async () => {
  const { file, guard, leaf } = await deadGuard()
  const failure = Object.assign(new Error('token deletion is pending'), { code: 'EPERM' })
  const blocked = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const retried = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  const unlink = fsNative.unlink.bind(fsNative)
  let now = 0
  let verified = false
  let attempts = 0
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (target === leaf) {
      attempts++
      if (attempts === 1) {
        throw failure
      }
      if (attempts === 2) {
        blocked.resolve()
        await resume.promise
        try {
          return await unlink(target)
        }
        finally {
          retried.resolve()
        }
      }
    }
    return unlink(target)
  })
  const oldRun = vi.fn(async () => 'old contender')
  const oldContender = withClassicIdeConfigLock(file, oldRun)
  let replacement: Promise<string> | undefined
  let settled: PromiseSettledResult<string>[] = []
  try {
    await Promise.race([
      blocked.promise,
      oldContender.then(() => {
        throw new Error('old contender finished before retry blocked')
      }),
    ])
    replacement = withClassicIdeConfigLock(file, async () => {
      entered.resolve()
      await finish.promise
      return 'replacement'
    })
    await Promise.race([
      entered.promise,
      replacement.then(() => {
        throw new Error('replacement finished before entering the transaction')
      }),
    ])
    const [token] = await fs.readdir(guard)
    expect(token).toBeDefined()
    const replacementLeaf = path.join(guard, token!)
    const bytes = await fs.readFile(replacementLeaf, 'utf8')
    expect(replacementLeaf).not.toBe(leaf)
    resume.resolve()
    await retried.promise
    expect(oldRun).not.toHaveBeenCalled()
    expect(await fs.readFile(replacementLeaf, 'utf8')).toBe(bytes)
    verified = true
  }
  finally {
    resume.resolve()
    finish.resolve()
    if (!verified) {
      now = 1000
    }
    const drainedReplacement = replacement?.catch((error: unknown) => {
      now = 1000
      throw error
    })
    settled = await Promise.allSettled(drainedReplacement ? [oldContender, drainedReplacement] : [oldContender])
  }
  expect(settled).toEqual([
    { status: 'fulfilled', value: 'old contender' },
    { status: 'fulfilled', value: 'replacement' },
  ])
  expect(oldRun).toHaveBeenCalledOnce()
  expect(await fs.pathExists(guard)).toBe(false)
})

it('preserves an owned-release EPERM without retrying the owner token', async () => {
  const { file, guard } = await fixture()
  const failure = Object.assign(new Error('cannot release own token'), { code: 'EPERM' })
  const unlink = vi.spyOn(fsNative, 'unlink').mockRejectedValue(failure)
  let ownLeaf = ''
  const run = vi.fn(async () => {
    const [token] = await fs.readdir(guard)
    ownLeaf = path.join(guard, token!)
    return 'finished'
  })
  await expect(withClassicIdeConfigLock(file, run)).rejects.toBe(failure)
  expect(run).toHaveBeenCalledOnce()
  expect(unlink).toHaveBeenCalledOnce()
  expect(unlink).toHaveBeenCalledWith(ownLeaf)
  expect(await fs.pathExists(ownLeaf)).toBe(true)
  expect(await fs.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})

it.each(['EACCES', 'EIO'])('preserves non-contention dead-token deletion errors: %s', async (code) => {
  const { file, guard, leaf, owner } = await deadGuard()
  const failure = Object.assign(new Error('cannot unlink dead token'), { code })
  const unlink = vi.spyOn(fsNative, 'unlink').mockRejectedValue(failure)
  const run = vi.fn(async () => {})
  await expect(withClassicIdeConfigLock(file, run)).rejects.toBe(failure)
  expect(unlink).toHaveBeenCalledOnce()
  expect(run).not.toHaveBeenCalled()
  expect(await fs.readJSON(leaf)).toEqual(owner)
  expect(await fs.readdir(path.dirname(guard))).toEqual([path.basename(guard)])
})
