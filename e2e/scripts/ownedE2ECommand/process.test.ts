/* eslint-disable e18e/ban-dependencies -- 真实进程回归需要查询本测试进程的 PGID 和退出状态。 */
import type { MachineE2EChildScope, MachineE2ELease, MachineE2ELeaseOptions } from '../../../packages/devtools-runtime/src/lease/machine'
import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import type { ShutdownFixtureState } from './fixture'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { runOwnedE2ECommand } from '../ownedE2ECommand'
import { createShutdownFixture } from './fixture'

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), scopes: [] as MachineE2EChildScope[], machine: undefined as IsolatedMachineLease | undefined }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', async (original) => {
  const actual = await original<typeof import('../../../packages/devtools-runtime/src/lease/machine')>()
  return {
    ...actual,
    withMachineE2ELease: <T>(run: (lease: MachineE2ELease) => Promise<T>, options?: MachineE2ELeaseOptions) => {
      if (!mocks.machine) {
        throw new Error('Process-group tests require an isolated machine lease.')
      }
      return actual.withMachineE2ELease(async (lease) => {
        const create = lease.createChildScope
        lease.createChildScope = async (options) => {
          const scope = await create(options)
          mocks.scopes.push(scope)
          return scope
        }
        return await run(lease)
      }, { ...options, stateDirectory: mocks.machine.stateDirectory })
    },
  }
})
vi.mock('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async (original) => {
  const actual = await original<typeof import('../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>()
  return { ...actual, cleanupManagedWechatProjects: mocks.cleanup.mockImplementation(actual.cleanupManagedWechatProjects) }
})

beforeEach(async () => {
  mocks.machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(mocks.machine.environment)) {
    vi.stubEnv(key, value)
  }
})

afterEach(async () => {
  try {
    // 用例 finally 已停止其全部 Node fixture，之后才显式完成测试拥有的空窗口日志。
    for (const scope of mocks.scopes.splice(0).reverse()) {
      await scope.seal()
      await scope.complete()
    }
    await mocks.machine?.dispose()
  }
  finally {
    mocks.machine = undefined
    vi.unstubAllEnvs()
  }
})

async function isRunning(pid: number) {
  const result = await execa('ps', ['-p', String(pid), '-o', 'stat='], { reject: false })
  return result.exitCode === 0 && result.stdout.trim() !== '' && !result.stdout.trim().startsWith('Z')
}

// Unix PGID 是本组回归的被测原语；Windows 的 fail-closed 分支由 shutdown.test.ts 覆盖。
describe.skipIf(process.platform === 'win32')('real owned command process groups', () => {
  it.each(['leader-exits', 'nested-runner'] as const)('stops %s before parent journal cleanup or machine lease release', async (scenario) => {
    const fixture = await createShutdownFixture(scenario, mocks.machine!.stateDirectory)
    const controller = new AbortController()
    let state: ShutdownFixtureState | undefined
    let runningAtCleanup: boolean | undefined
    mocks.cleanup.mockImplementation(async () => {
      runningAtCleanup = state ? await isRunning(state.workerPid) : undefined
      if (state?.runnerPid) {
        expect(await isRunning(state.runnerPid)).toBe(false)
      }
    })
    const running = runOwnedE2ECommand(process.execPath, [fixture.leaderFile], { signal: controller.signal })
    try {
      state = await fixture.ready()
      if (scenario === 'nested-runner') {
        const { stdout } = await execa('ps', ['-p', String(state.workerPid), '-o', 'pgid='])
        expect(Number(stdout.trim())).toBe(state.workerPid)
      }
      const cancellationStarted = Date.now()
      controller.abort()
      expect(await running).toBe(1)
      expect(runningAtCleanup).toBe(false)
      expect(await isRunning(state.workerPid)).toBe(false)
      if (scenario === 'nested-runner') {
        expect(await readFile(fixture.completedFile, 'utf8')).toBe('runner-cleanup-finished')
        // 内层 5 秒强杀完成就返回，无需耗尽外层 10 秒收尾期限。
        expect(Date.now() - cancellationStarted).toBeLessThan(9_000)
      }
      expect(await runOwnedE2ECommand(process.execPath, ['-e', 'process.exit(0)'])).toBe(0)
    }
    finally {
      controller.abort()
      // 只处理该测试明确创建并记录的进程，失败路径也不能留下 fixture。
      for (const pid of [state?.workerPid, state?.runnerPid]) {
        if (pid && await isRunning(pid)) {
          process.kill(pid, 'SIGKILL')
        }
      }
      await running.catch(() => {})
      await fixture.dispose()
    }
  }, 20_000)

  it.each(['orphaned-borrower', 'natural-exit'] as const)('preserves the journal when %s leaves an independently running process', async (scenario) => {
    const fixture = await createShutdownFixture(scenario, mocks.machine!.stateDirectory)
    const controller = new AbortController()
    mocks.cleanup.mockClear()
    const running = runOwnedE2ECommand(process.execPath, [fixture.leaderFile], { signal: controller.signal })
    const rejected = scenario === 'orphaned-borrower'
      ? expect(running).rejects.toMatchObject({ errors: [expect.objectContaining({ message: expect.stringContaining('child is still running') })] })
      : expect(running).rejects.toThrow('stop could not be confirmed')
    let state: ShutdownFixtureState | undefined
    try {
      state = await fixture.ready()
      if (scenario === 'orphaned-borrower') {
        controller.abort()
      }
      await rejected
      expect(await isRunning(state.workerPid)).toBe(true)
      expect(mocks.cleanup).not.toHaveBeenCalled()
    }
    finally {
      if (state && await isRunning(state.workerPid)) {
        process.kill(state.workerPid, 'SIGKILL')
        await vi.waitFor(async () => expect(await isRunning(state!.workerPid)).toBe(false))
      }
      controller.abort()
      await running.catch(() => {})
      await fixture.dispose()
    }
  })
})
