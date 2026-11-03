import type { ChildProcess } from 'node:child_process'
import type { DevProcessIdentity } from './devProcessCleanup/processes'
import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'
import { sameManagedProcess } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host'
import { resolveWechatInspectionTimeout } from '../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { startDevProcess } from './dev-process'
import { readDevProcessIdentities } from './devProcessCleanup/processes'

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

async function waitUntil(check: () => Promise<boolean>, description: string, timeoutCause?: () => unknown) {
  const deadline = Date.now() + 10_000
  do {
    if (await within(check(), description)) {
      return
    }
    await delay(50)
  } while (Date.now() < deadline)
  throw new Error(`Timed out: ${description}`, timeoutCause ? { cause: timeoutCause() } : undefined)
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

async function captureTree(directory: string, expectedRootPid: number | undefined): Promise<[DevProcessIdentity, DevProcessIdentity]> {
  await waitUntil(async () => Boolean(await readRegistration(directory)), 'process tree registration')
  const registration = (await readRegistration(directory))!
  expect(registration.rootPid).toBe(expectedRootPid)
  // Windows 首次编译内核检查器可能占满 30 秒平台预算，外层等待必须覆盖该预算。
  const identityTimeout = process.platform === 'win32'
    ? resolveWechatInspectionTimeout('win32') + 5_000
    : 15_000
  const identities = await within(readDevProcessIdentities([
    registration.rootPid,
    registration.descendantPid,
  ]), 'registered process identities', identityTimeout)
  const root = identities.get(registration.rootPid)
  const descendant = identities.get(registration.descendantPid)
  if (!root || !descendant) {
    throw new Error('Registered process tree exited before cleanup began')
  }
  return [root, descendant]
}

function treeRunning(identities: DevProcessIdentity[], current: Map<number, DevProcessIdentity | undefined>) {
  return identities.map((identity) => {
    const live = current.get(identity.pid)
    return Boolean(live && sameManagedProcess(identity, live))
  })
}

async function readTreeRunning(identities: DevProcessIdentity[], readIdentities = readDevProcessIdentities) {
  // 身份读取器仅在完整证据确认进程停止或身份变更后，才允许把登记进程视为未运行。
  const current = await readIdentities(identities.map(identity => identity.pid))
  return treeRunning(identities, current)
}

async function waitForTreeExit(identities: DevProcessIdentity[], readIdentities = readDevProcessIdentities) {
  let lastProbeError: unknown
  await waitUntil(async () => {
    let current: Map<number, DevProcessIdentity | undefined>
    try {
      current = await readIdentities(identities.map(identity => identity.pid))
    }
    catch (error) {
      // 退出期间可能跨越终态；失败采样仍未确认退出，必须等待后续完整身份核验。
      lastProbeError = error
      return false
    }
    return treeRunning(identities, current).every(value => !value)
  }, 'registered process tree exit', () => lastProbeError)
}

async function readRegisteredDescendantPid(directory: string): Promise<number | undefined> {
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
  return value.pid
}

async function waitForRegisteredDescendantsExit(pids: number[]) {
  if (!pids.length) {
    return
  }
  const current = await within(readDevProcessIdentities(pids), 'descendant cleanup identity')
  const identities = [...current.values()].filter((identity): identity is DevProcessIdentity => identity !== undefined)
  if (identities.length) {
    await waitForTreeExit(identities)
  }
}

async function cleanupFixture(options: {
  directory: string
  stateDirectories: string[]
  captured: DevProcessIdentity[]
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
  const descendants = await Promise.allSettled(stateDirectories.map(readRegisteredDescendantPid))
  const descendantPids = descendants.flatMap(result => result.status === 'fulfilled' && result.value !== undefined ? [result.value] : [])
  const descendantExit = await Promise.allSettled([waitForRegisteredDescendantsExit(descendantPids)])
  const failures: unknown[] = [...cleanup, ...released, ...descendants, ...descendantExit]
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
    const captured: DevProcessIdentity[] = []
    const originalErrors: unknown[] = []
    try {
      await Promise.all([mkdir(managedDirectory), mkdir(externalDirectory)])
      await copyFile(new URL('./testSupport/devProcessTree.fixture.mjs', import.meta.url), fixture)
      const args = [fixture]
      dev = startDevProcess(process.execPath, args, {
        cwd: directory,
        env: { ...process.env, WEAPP_VITE_PROCESS_FIXTURE_DIR: managedDirectory },
        all: true,
        // 本测试刻意验证不合作进程树的精确强制清理，不声明开发会话正常退出协议。
        ipc: false,
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
      expect(await within(readTreeRunning(externalTree), 'external process identities')).toEqual([true, true])
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

describe('dev process exit observation', () => {
  const identities: DevProcessIdentity[] = [
    { pid: 61, started: 'fixture-root-start', executable: 'fixture-node' },
    { pid: 62, started: 'fixture-child-start', executable: 'fixture-node' },
  ]
  const live = new Map(identities.map(identity => [identity.pid, identity]))
  const gone = new Map(identities.map(identity => [identity.pid, undefined]))

  it('requires a complete gone sample after an inspection failure and a still-running sample', async () => {
    const transient = new Error('process changed state during inspection')
    const readIdentities = vi.fn<typeof readDevProcessIdentities>()
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce(live)
      .mockResolvedValueOnce(gone)

    await expect(waitForTreeExit(identities, readIdentities)).resolves.toBeUndefined()
    expect(readIdentities.mock.calls).toEqual([[[61, 62]], [[61, 62]], [[61, 62]]])
  })

  it('keeps persistent inspection failures pending until the existing deadline and preserves the latest cause', async () => {
    const first = new Error('initial inspection unavailable')
    const latest = new Error('latest inspection unavailable')
    const readIdentities = vi.fn<typeof readDevProcessIdentities>()
      .mockRejectedValueOnce(first)
      .mockRejectedValue(latest)
    const now = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(10_000)
    try {
      const failure = await waitForTreeExit(identities, readIdentities).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) {
        throw new Error('Expected the process tree exit observation to time out')
      }
      expect(failure.message).toBe('Timed out: registered process tree exit')
      expect(failure.cause).toBe(latest)
      expect(readIdentities).toHaveBeenCalledTimes(2)
    }
    finally {
      now.mockRestore()
    }
  })

  it('does not accept a partial tree exit while an original identity still runs', async () => {
    const readIdentities = vi.fn<typeof readDevProcessIdentities>()
      .mockResolvedValue(new Map([
        [identities[0]!.pid, undefined],
        [identities[1]!.pid, identities[1]],
      ]))
    const now = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(10_000)
    try {
      await expect(waitForTreeExit(identities, readIdentities)).rejects.toThrow('Timed out: registered process tree exit')
      expect(readIdentities).toHaveBeenCalledOnce()
    }
    finally {
      now.mockRestore()
    }
  })

  it('keeps an external survivor identity assertion strict when inspection fails', async () => {
    const failure = new Error('external process inspection unavailable')
    const readIdentities = vi.fn<typeof readDevProcessIdentities>().mockRejectedValue(failure)
    await expect(readTreeRunning(identities, readIdentities)).rejects.toBe(failure)
    expect(readIdentities).toHaveBeenCalledOnce()
  })
})
