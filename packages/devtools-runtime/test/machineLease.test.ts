import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease, withMachineE2ELease } from '../src/lease/machine'

const userState = vi.hoisted(() => ({ root: '' }))
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, homedir: () => userState.root }
})

const roots: string[] = []
const children: ChildProcess[] = []
const fixtureFile = fileURLToPath(new URL('./fixtures/machineLeaseChild.ts', import.meta.url))
const tsx = import.meta.resolve('tsx')

afterEach(async () => {
  await Promise.all(children.splice(0).map(async (child) => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
  }))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'machine-lease-'))
  roots.push(root)
  await mkdir(path.join(root, 'worktree-a'))
  await mkdir(path.join(root, 'worktree-b'))
  return root
}

interface ChildReady {
  ready?: boolean
  borrowed?: boolean
  environment?: NodeJS.ProcessEnv
  error?: string
}

async function start(root: string, cwd = 'worktree-a', environment: NodeJS.ProcessEnv = {}) {
  // 直接运行当前 Node 可执行文件，不依赖 Windows shell 或 .cmd 命令解析。
  const child = spawn(process.execPath, ['--import', tsx, fixtureFile, root], {
    cwd: path.join(root, cwd),
    env: { ...process.env, WEAPP_VITE_E2E_MACHINE_LEASE: '', ...environment },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  children.push(child)
  const [message] = await once(child, 'message') as [ChildReady]
  return { child, message }
}

async function stop(child: ChildProcess, signal?: NodeJS.Signals) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  const exited = once(child, 'exit')
  if (signal) {
    child.kill(signal)
  }
  else {
    child.send('release')
  }
  await exited
}

it('excludes unrelated processes across worktrees', async () => {
  const root = await fixture()
  const owner = await start(root)
  expect(owner.message.ready).toBe(true)
  const contender = await start(root, 'worktree-b', { WEAPP_AGENT_STATE_DIR: path.join(root, 'other-state') })
  expect(contender.message.error).toContain('another E2E operation owns this machine')
  await stop(owner.child)
  const successor = await start(root, 'worktree-b')
  expect(successor.message.ready).toBe(true)
  await stop(successor.child)
})

it('uses one user machine lease even when project state directories differ', async () => {
  const root = await fixture()
  userState.root = root
  const owner = await acquireMachineE2ELease({ env: { WEAPP_AGENT_STATE_DIR: path.join(root, 'first-state') } })
  try {
    await expect(acquireMachineE2ELease({ env: { WEAPP_AGENT_STATE_DIR: path.join(root, 'second-state') } })).rejects.toThrow('Runtime busy')
  }
  finally {
    await owner.release()
  }
})

it('borrows only a verified live owner and never releases its parent lock', async () => {
  const root = await fixture()
  const owner = await acquireMachineE2ELease({ stateDirectory: root, env: {} })
  const borrowed = await start(root, 'worktree-b', owner.environment)
  expect(borrowed.message.borrowed).toBe(true)
  await expect(owner.release()).rejects.toThrow('child operation')
  await stop(borrowed.child)
  await expect(acquireMachineE2ELease({ stateDirectory: root, env: {} })).rejects.toThrow('Runtime busy')
  await Promise.all([owner.release(), owner.release()])
  expect(owner.released).toBe(true)
  await owner.release()
})

it('rejects forged inheritance instead of treating an environment variable as a bypass', async () => {
  const root = await fixture()
  const owner = await start(root)
  const forged = await start(root, 'worktree-b', {
    WEAPP_VITE_E2E_MACHINE_LEASE: JSON.stringify({ pid: owner.child.pid, token: 'invalid' }),
  })
  expect(forged.message.error).toContain('inherited E2E lease is invalid')
  await stop(owner.child)
  const expired = await start(root, 'worktree-b', owner.message.environment)
  expect(expired.message.error).toContain('inherited E2E lease is invalid')
})

it('holds the lock while orphaned borrowers remain alive after owner termination', async () => {
  const root = await fixture()
  const owner = await start(root)
  const borrower = await start(root, 'worktree-b', owner.message.environment)
  expect(borrower.message.borrowed).toBe(true)
  await stop(owner.child, 'SIGKILL')
  const contender = await start(root)
  expect(contender.message.error).toContain('child operation')
  await stop(borrower.child)
  const successor = await start(root)
  expect(successor.message.ready).toBe(true)
  await stop(successor.child)
})

it('recovers a dead owner and handles cancellation without affecting another owner', async () => {
  const root = await fixture()
  const crashed = await start(root)
  await stop(crashed.child, 'SIGKILL')
  const recovered = await start(root)
  expect(recovered.message.ready).toBe(true)
  await stop(recovered.child, 'SIGTERM')
  const next = await start(root)
  expect(next.message.ready).toBe(true)
  await stop(next.child)
})

it('preserves unknown owners and ownership changes', async () => {
  const root = await fixture()
  const directory = path.join(root, 'machine-e2e')
  await mkdir(directory)
  const ownerFile = path.join(directory, 'owner.json')
  await writeFile(ownerFile, '{"pid":0}')
  await expect(acquireMachineE2ELease({ stateDirectory: root, env: {} })).rejects.toThrow('Runtime busy')
  expect(await readFile(ownerFile, 'utf8')).toBe('{"pid":0}')
  await rm(directory, { recursive: true })
  const owner = await acquireMachineE2ELease({ stateDirectory: root, env: {} })
  const original = await readFile(ownerFile, 'utf8')
  await writeFile(ownerFile, JSON.stringify({ pid: process.pid, token: 'replaced' }))
  await expect(owner.release()).rejects.toThrow('ownership changed')
  expect(JSON.parse(await readFile(ownerFile, 'utf8'))).toEqual({ pid: process.pid, token: 'replaced' })
  await writeFile(ownerFile, original)
  await owner.release()
})

it('supports nested operations and restores inheritance after failure', async () => {
  const root = await fixture()
  const env: NodeJS.ProcessEnv = {}
  const options = { stateDirectory: root, env }
  await expect(withMachineE2ELease(async () => {
    await withMachineE2ELease(async () => true, options)
    throw new Error('injected')
  }, options)).rejects.toThrow('injected')
  expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBeUndefined()
  const next = await acquireMachineE2ELease(options)
  await next.release()
})

it('allows concurrent registered children inside one suite and keeps ownership after child cancellation', async () => {
  const root = await fixture()
  const owner = await acquireMachineE2ELease({ stateDirectory: root, env: {} })
  const borrowers = await Promise.all(Array.from({ length: 3 }, () => start(root, 'worktree-b', owner.environment)))
  expect(borrowers.every(result => result.message.borrowed)).toBe(true)
  await Promise.all(borrowers.map(result => stop(result.child, 'SIGTERM')))
  await expect(acquireMachineE2ELease({ stateDirectory: root, env: {} })).rejects.toThrow('Runtime busy')
  await owner.release()
})

it('keeps an unknown recovery guard and rejects malformed inheritance', async () => {
  const root = await fixture()
  const guard = path.join(root, 'machine-e2e.recovery')
  const owner = await acquireMachineE2ELease({ stateDirectory: root, env: {} })
  await expect(acquireMachineE2ELease({ stateDirectory: root, env: { WEAPP_VITE_E2E_MACHINE_LEASE: '{' } })).rejects.toThrow('inherited E2E lease is invalid')
  await mkdir(guard)
  const marker = path.join(guard, 'unknown-owner')
  await writeFile(marker, 'preserve')
  await expect(owner.release()).rejects.toThrow('recovery is in progress')
  expect(await readFile(marker, 'utf8')).toBe('preserve')
  await rm(guard, { recursive: true })
  await owner.release()
})

it('preserves credentials across concurrently nested scopes and exposes explicit child inheritance', async () => {
  const root = await fixture()
  const env: NodeJS.ProcessEnv = {}
  const options = { stateDirectory: root, env }
  await withMachineE2ELease(async (owner) => {
    const firstReady = Promise.withResolvers<void>()
    const secondReady = Promise.withResolvers<void>()
    const firstDone = Promise.withResolvers<void>()
    const first = withMachineE2ELease(async (borrowed) => {
      expect(borrowed.borrowed).toBe(true)
      firstReady.resolve()
      await secondReady.promise
    }, options).then(() => firstDone.resolve())
    const second = withMachineE2ELease(async (borrowed) => {
      await firstReady.promise
      secondReady.resolve()
      await firstDone.promise
      expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBe(owner.environment.WEAPP_VITE_E2E_MACHINE_LEASE)
      const child = await start(root, 'worktree-b', borrowed.environment)
      expect(child.message.borrowed).toBe(true)
      await stop(child.child)
    }, options)
    await Promise.all([first, second])
    expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBe(owner.environment.WEAPP_VITE_E2E_MACHINE_LEASE)
  }, options)
  expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBeUndefined()
})

it('does not let an unrelated async operation borrow a locally published credential', async () => {
  const root = await fixture()
  const env: NodeJS.ProcessEnv = {}
  const options = { stateDirectory: root, env }
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  const first = withMachineE2ELease(async () => {
    started.resolve()
    await finish.promise
  }, options)
  await started.promise
  try {
    await expect(withMachineE2ELease(async () => 'unrelated', options)).rejects.toThrow('Runtime busy')
  }
  finally {
    finish.resolve()
    await first
  }
  expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBeUndefined()
})
