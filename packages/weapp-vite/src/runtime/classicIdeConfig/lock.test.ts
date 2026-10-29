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

async function installGuard(guard: string, pid = process.pid) {
  const owner = { pid, token: randomUUID() }
  await fs.outputJSON(path.join(guard, owner.token), owner)
  return { owner, leaf: path.join(guard, owner.token) }
}

function deadProcess(pid: number) {
  const kill = process.kill.bind(process)
  vi.spyOn(process, 'kill').mockImplementation((target, signal) => {
    if (target === pid) {
      throw Object.assign(new Error('process exited'), { code: 'ESRCH' })
    }
    return kill(target, signal)
  })
}

it('serializes competing operations and releases the guard after each operation', async () => {
  const { file, guard } = await fixture()
  let active = 0
  let peak = 0
  const results = await Promise.all(Array.from({ length: 3 }, (_, value) => withClassicIdeConfigLock(file, async () => {
    peak = Math.max(peak, ++active)
    await new Promise<void>(resolve => setImmediate(resolve))
    active--
    return value
  })))
  expect(results).toEqual([0, 1, 2])
  expect(peak).toBe(1)
  expect(await fs.pathExists(guard)).toBe(false)
  expect(await fs.readdir(path.dirname(guard))).toEqual([])
})

it('reclaims a valid guard only after its process is confirmed dead', async () => {
  const { file, guard } = await fixture()
  const pid = process.pid + 1
  await installGuard(guard, pid)
  deadProcess(pid)
  const run = vi.fn(async () => 'recovered')
  await expect(withClassicIdeConfigLock(file, run)).resolves.toBe('recovered')
  expect(run).toHaveBeenCalledOnce()
  expect(await fs.pathExists(guard)).toBe(false)
})

it('recovers an empty guard left between token removal and directory removal', async () => {
  const { file, guard } = await fixture()
  await fs.mkdir(guard)
  await expect(withClassicIdeConfigLock(file, async () => 'empty')).resolves.toBe('empty')
  expect(await fs.pathExists(guard)).toBe(false)
})

it('rechecks a Windows EPERM publication conflict before recovering the dead guard', async () => {
  const { file, guard } = await fixture()
  const pid = process.pid + 1
  await installGuard(guard, pid)
  deadProcess(pid)
  const rename = fsNative.rename.bind(fsNative)
  vi.spyOn(fsNative, 'rename').mockRejectedValueOnce(Object.assign(new Error('directory exists'), { code: 'EPERM' })).mockImplementation(rename)
  await expect(withClassicIdeConfigLock(file, async () => 'recovered')).resolves.toBe('recovered')
  expect(await fs.pathExists(guard)).toBe(false)
})

it.each([false, true])('retains publication permission errors even with an existing guard: %s', async (existing) => {
  const { file, guard } = await fixture()
  const held = existing ? await installGuard(guard) : undefined
  const failure = Object.assign(new Error('cannot publish candidate'), { code: 'EACCES' })
  const kill = vi.spyOn(process, 'kill')
  vi.spyOn(fsNative, 'rename').mockRejectedValue(failure)
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toBe(failure)
  expect(kill).not.toHaveBeenCalled()
  if (held) {
    expect(await fs.readJSON(held.leaf)).toEqual(held.owner)
  }
  else {
    expect(await fs.readdir(path.dirname(guard))).toEqual([])
  }
})

it('retains a Windows EPERM publication error without evidence of a competing guard', async () => {
  const { file, guard } = await fixture()
  const failure = Object.assign(new Error('cannot publish candidate'), { code: 'EPERM' })
  vi.spyOn(fsNative, 'rename').mockRejectedValue(failure)
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toBe(failure)
  expect(await fs.readdir(path.dirname(guard))).toEqual([])
})

it.each(['alive', 'EPERM'] as const)('preserves a guard whose process is %s', async (state) => {
  const { file, guard } = await fixture()
  const { leaf, owner } = await installGuard(guard)
  vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(10_000)
  if (state === 'EPERM') {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('cannot inspect process'), { code: 'EPERM' })
    })
  }
  const run = vi.fn(async () => {})
  const failure: unknown = await withClassicIdeConfigLock(file, run).catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 'EEXIST' })
  expect(String(failure)).toContain(guard)
  expect(run).not.toHaveBeenCalled()
  expect(await fs.readJSON(leaf)).toEqual(owner)
})

it.each([0, -1, 'unknown', null])('preserves an invalid process identity: %s', async (pid) => {
  const { file, guard } = await fixture()
  const token = randomUUID()
  const leaf = path.join(guard, token)
  await fs.outputJSON(leaf, { pid, token })
  const kill = vi.spyOn(process, 'kill')
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toMatchObject({ code: 'EEXIST' })
  expect(kill).not.toHaveBeenCalled()
  expect(await fs.readJSON(leaf)).toEqual({ pid, token })
})

it('preserves guards with multiple leaves instead of guessing an owner', async () => {
  const { file, guard } = await fixture()
  const first = await installGuard(guard)
  const second = await installGuard(guard)
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toMatchObject({ code: 'EEXIST' })
  expect((await fs.readdir(guard)).sort()).toEqual([first.owner.token, second.owner.token].sort())
})

it.each(['unlink', 'rmdir'] as const)('does not let a delayed stale %s remove a replacement owner', async (stage) => {
  const { file, guard } = await fixture()
  const pid = process.pid + 1
  const { leaf } = await installGuard(guard, pid)
  deadProcess(pid)
  const blocked = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const attempted = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  const remove = fsNative[stage].bind(fsNative)
  const blockedTarget = stage === 'unlink' ? leaf : guard
  let paused = false
  vi.spyOn(fsNative, stage).mockImplementation(async (target) => {
    if (target === blockedTarget && !paused) {
      paused = true
      blocked.resolve()
      await resume.promise
      try {
        return await remove(target)
      }
      finally {
        attempted.resolve()
      }
    }
    return remove(target)
  })
  const oldRun = vi.fn(async () => 'old contender')
  const oldContender = withClassicIdeConfigLock(file, oldRun)
  await blocked.promise
  const replacement = withClassicIdeConfigLock(file, async () => {
    entered.resolve()
    await finish.promise
    return 'replacement'
  })
  await entered.promise
  const [replacementToken] = await fs.readdir(guard)
  const replacementBytes = await fs.readFile(path.join(guard, replacementToken!), 'utf8')
  resume.resolve()
  await attempted.promise
  expect(oldRun).not.toHaveBeenCalled()
  expect(await fs.readFile(path.join(guard, replacementToken!), 'utf8')).toBe(replacementBytes)
  finish.resolve()
  await expect(replacement).resolves.toBe('replacement')
  await expect(oldContender).resolves.toBe('old contender')
  expect(await fs.pathExists(guard)).toBe(false)
})

it('serializes two reapers of the same dead guard', async () => {
  const { file, guard } = await fixture()
  const pid = process.pid + 1
  const { leaf } = await installGuard(guard, pid)
  deadProcess(pid)
  const observed = Promise.withResolvers<void>()
  const unlink = fsNative.unlink.bind(fsNative)
  let reapers = 0
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (target === leaf) {
      if (++reapers === 2) {
        observed.resolve()
      }
      await observed.promise
    }
    return unlink(target)
  })
  let active = 0
  let peak = 0
  const run = async () => {
    peak = Math.max(peak, ++active)
    await new Promise<void>(resolve => setImmediate(resolve))
    active--
  }
  await Promise.all([withClassicIdeConfigLock(file, run), withClassicIdeConfigLock(file, run)])
  expect(reapers).toBe(2)
  expect(peak).toBe(1)
  expect(await fs.pathExists(guard)).toBe(false)
})

it('keeps the operation failure as the cause when releasing its token also fails', async () => {
  const { file, guard } = await fixture()
  const failure = new Error('operation failed')
  const cleanupFailure = new Error('token removal failed')
  const unlink = fsNative.unlink.bind(fsNative)
  vi.spyOn(fsNative, 'unlink').mockImplementation(async (target) => {
    if (path.dirname(String(target)) === guard) {
      throw cleanupFailure
    }
    return unlink(target)
  })
  const result: unknown = await withClassicIdeConfigLock(file, async () => {
    throw failure
  }).catch((error: unknown) => error)
  expect(result).toBeInstanceOf(AggregateError)
  expect(result).toMatchObject({ cause: failure, errors: [failure, cleanupFailure] })
  expect(await fs.pathExists(guard)).toBe(true)
})

it('cleans only its unpublished candidate after metadata initialization fails', async () => {
  const { file, guard } = await fixture()
  const failure = new Error('candidate write failed')
  vi.spyOn(fs, 'writeFile').mockRejectedValue(failure)
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toBe(failure)
  expect(await fs.readdir(path.dirname(guard))).toEqual([])
})

it('keeps initialization and candidate cleanup errors in order', async () => {
  const { file } = await fixture()
  const failure = new Error('candidate write failed')
  const cleanupFailure = new Error('candidate cleanup failed')
  vi.spyOn(fs, 'writeFile').mockRejectedValue(failure)
  vi.spyOn(fs, 'remove').mockRejectedValue(cleanupFailure)
  await expect(withClassicIdeConfigLock(file, async () => {})).rejects.toMatchObject({ cause: failure, errors: [failure, cleanupFailure] })
})
