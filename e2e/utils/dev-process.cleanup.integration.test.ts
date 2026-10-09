import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { readManagedProcessIdentity, sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { startDevProcess } from './dev-process'

type ProcessIdentity = NonNullable<Awaited<ReturnType<typeof readManagedProcessIdentity>>>
interface TreeRegistration {
  rootPid: number
  descendantPid: number
}

async function within<T>(task: Promise<T>, description: string, timeoutMs = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), timeoutMs)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

async function waitUntil(check: () => Promise<boolean>, description: string) {
  const deadline = Date.now() + 10_000
  do {
    if (await within(check(), description)) {
      return
    }
    await delay(50)
  } while (Date.now() < deadline)
  throw new Error(`Timed out: ${description}`)
}

async function readRegistration(directory: string): Promise<TreeRegistration | undefined> {
  let content: string
  try {
    content = await readFile(path.join(directory, 'ready.json'), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
  const value: unknown = JSON.parse(content)
  if (!value || typeof value !== 'object'
    || !('rootPid' in value) || typeof value.rootPid !== 'number' || !Number.isSafeInteger(value.rootPid) || value.rootPid <= 0
    || !('descendantPid' in value) || typeof value.descendantPid !== 'number' || !Number.isSafeInteger(value.descendantPid) || value.descendantPid <= 0
    || value.rootPid === value.descendantPid || value.rootPid === process.pid || value.descendantPid === process.pid) {
    throw new Error('Invalid process fixture registration')
  }
  return { rootPid: value.rootPid, descendantPid: value.descendantPid }
}

async function captureTree(directory: string, expectedRootPid: number | undefined) {
  await waitUntil(async () => Boolean(await readRegistration(directory)), 'process tree registration')
  const registration = (await readRegistration(directory))!
  expect(registration.rootPid).toBe(expectedRootPid)
  const identities = await within(Promise.all([
    readManagedProcessIdentity(registration.rootPid),
    readManagedProcessIdentity(registration.descendantPid),
  ]), 'registered process identities')
  if (identities.some(identity => !identity)) {
    throw new Error('Registered process tree exited before cleanup began')
  }
  return identities as [ProcessIdentity, ProcessIdentity]
}

async function isSameProcessRunning(identity: ProcessIdentity) {
  // Linux 身份检查读取可执行文件，已停止但尚未回收的 zombie 不算仍在执行。
  const current = await readManagedProcessIdentity(identity.pid)
  return Boolean(current && sameManagedProcess(identity, current))
}

async function waitForTreeExit(identities: ProcessIdentity[]) {
  await waitUntil(async () => {
    const running = await Promise.all(identities.map(isSameProcessRunning))
    return running.every(value => !value)
  }, 'registered process tree exit')
}

async function waitForRegisteredDescendantExit(directory: string) {
  let content: string
  try {
    content = await readFile(path.join(directory, 'descendant.json'), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }
  const value: unknown = JSON.parse(content)
  if (!value || typeof value !== 'object' || !('pid' in value)
    || typeof value.pid !== 'number' || !Number.isSafeInteger(value.pid) || value.pid <= 0 || value.pid === process.pid) {
    throw new Error('Invalid descendant cleanup registration')
  }
  const identity = await within(readManagedProcessIdentity(value.pid), 'descendant cleanup identity')
  if (identity) {
    await waitForTreeExit([identity])
  }
}

async function cleanupFixture(options: {
  directory: string
  stateDirectories: string[]
  captured: ProcessIdentity[]
  dev: ReturnType<typeof startDevProcess> | undefined
  external: ChildProcess | undefined
  originalErrors: unknown[]
}) {
  const { directory, stateDirectories, captured, dev, external, originalErrors } = options
  const cleanup = await Promise.allSettled(stateDirectories.map(async (stateDirectory) => {
    await mkdir(stateDirectory, { recursive: true })
    await writeFile(path.join(stateDirectory, 'cleanup'), '')
  }))
  const released = await Promise.allSettled([
    waitForTreeExit(captured),
    ...(dev ? [within(dev.stop(200), 'managed fixture final cleanup')] : []),
    ...(external ? [waitUntil(async () => external.exitCode !== null || external.signalCode !== null, 'held external child exit')] : []),
  ])
  // 就绪断言也可能提前失败；根退出后仍根据 fixture 登记确认其后代退出，再删除自清理信号。
  const descendants = await Promise.allSettled(stateDirectories.map(waitForRegisteredDescendantExit))
  const failures: unknown[] = [...cleanup, ...released, ...descendants]
    .filter(result => result.status === 'rejected')
    .map(result => result.reason)
  if (!failures.length) {
    try {
      await rm(directory, { recursive: true, force: true })
    }
    catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) {
    throw new AggregateError([...originalErrors, ...failures], 'Process fixture cleanup failed')
  }
}

describe('dev process real process tree cleanup', () => {
  it('closes its registered tree while preserving an identical external command', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'dev-process-tree-'))
    const managedDirectory = path.join(directory, 'managed')
    const externalDirectory = path.join(directory, 'external')
    const fixture = path.join(directory, 'process-tree.mjs')
    let dev: ReturnType<typeof startDevProcess> | undefined
    let external: ChildProcess | undefined
    const captured: ProcessIdentity[] = []
    const originalErrors: unknown[] = []
    try {
      await Promise.all([mkdir(managedDirectory), mkdir(externalDirectory)])
      await copyFile(new URL('./testSupport/devProcessTree.fixture.mjs', import.meta.url), fixture)
      const args = [fixture]
      dev = startDevProcess(process.execPath, args, {
        cwd: directory,
        env: { ...process.env, WEAPP_VITE_PROCESS_FIXTURE_DIR: managedDirectory },
        all: true,
        windowsHide: true,
      })
      external = spawn(process.execPath, args, {
        cwd: directory,
        env: { ...process.env, WEAPP_VITE_PROCESS_FIXTURE_DIR: externalDirectory },
        stdio: 'ignore',
        windowsHide: true,
      })
      let externalError: Error | undefined
      external.on('error', error => externalError = error)
      await dev.waitForOutput('DEV_PROCESS_TREE_READY ', 'registered root and descendant readiness', 10_000)
      if (externalError) {
        throw externalError
      }
      const managedTree = await captureTree(managedDirectory, dev.pid)
      captured.push(...managedTree)
      const externalTree = await captureTree(externalDirectory, external.pid)
      captured.push(...externalTree)

      await within(dev.stop(200), 'managed dev.stop')
      await waitForTreeExit(managedTree)
      if (process.platform !== 'win32') {
        expect(await readFile(path.join(managedDirectory, 'term-ignored'), 'utf8')).toBe(String(managedTree[1].pid))
      }
      // 同一命令行不授予清理权：外部树的根和后代必须保持原进程身份并继续执行。
      expect(await within(Promise.all(externalTree.map(isSameProcessRunning)), 'external process identities')).toEqual([true, true])
      expect(external.exitCode).toBeNull()
      expect(external.signalCode).toBeNull()
    }
    catch (error) {
      originalErrors.push(error)
      throw error
    }
    finally {
      await cleanupFixture({
        directory,
        stateDirectories: [managedDirectory, externalDirectory],
        captured,
        dev,
        external,
        originalErrors,
      })
    }
  }, 60_000)
})
