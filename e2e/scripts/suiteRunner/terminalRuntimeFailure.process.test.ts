import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from 'weapp-ide-cli'
import { createManagedWechatProjectJournal } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { TERMINAL_RUNTIME_FAILURE_MARKER } from '../../utils/terminalRuntimeFailure'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { runTaskSuite as runTaskSuiteWithOptions } from '../suiteRunner'

let machine: IsolatedMachineLease
beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(machine.environment)) {
    vi.stubEnv(key, value)
  }
  const journal = await createManagedWechatProjectJournal(path.dirname(machine.journalPath), machine.journalPath)
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, journal)
}, 30_000)
afterEach(async () => {
  try {
    await machine.dispose()
  }
  finally {
    vi.unstubAllEnvs()
  }
})

function runTaskSuite(...[name, tasks, options]: Parameters<typeof runTaskSuiteWithOptions>) {
  return runTaskSuiteWithOptions(name, tasks, { ...options, machineLeaseOptions: { stateDirectory: machine.stateDirectory } })
}

describe('terminal runtime failures across child process output', () => {
  it.each([
    ['E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED', 0],
    ['E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED', 1],
    ['E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE', 0],
    ['E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE', 1],
  ] as const)('stops after fragmented terminal runtime failure %s with exit %s while ordinary failures are allowed', async (code, exitCode) => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const beforeEachTask = vi.fn()
    const beforeTaskLaunch = vi.fn()
    const onUnsafeRuntime = vi.fn()
    const reason = 'The selected runtime did not complete startup'
    const line = `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code, reason })}${exitCode ? '\n' : ''}`
    const task = {
      label: 'terminal-runtime-failure',
      command: process.execPath,
      args: ['-e', `process.stderr.write(${JSON.stringify(line.slice(0, 13))}); setImmediate(() => { process.stderr.write(${JSON.stringify(line.slice(13))}); process.exitCode = ${exitCode} })`],
    }
    try {
      expect(await runTaskSuite('e2e:test', [task, {
        label: 'must-not-launch',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
      }], { beforeEachTask, beforeTaskLaunch, onUnsafeRuntime, failOnTaskFailure: false, stopOnTaskFailure: false, writeReport: false })).toBe(1)
      expect(beforeEachTask).toHaveBeenCalledTimes(1)
      expect(beforeTaskLaunch).toHaveBeenCalledTimes(1)
      expect(task).toMatchObject({ runtimeBlocker: { code, reason }, unsafeRuntimeReason: reason })
      expect(onUnsafeRuntime).toHaveBeenCalledExactlyOnceWith(reason)
    }
    finally {
      process.exitCode = previousExitCode
    }
  })

  it('continues after malformed terminal markers while preserving the ordinary failure', async () => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const beforeEachTask = vi.fn()
    const beforeTaskLaunch = vi.fn()
    const onUnsafeRuntime = vi.fn()
    const lines = [
      `${TERMINAL_RUNTIME_FAILURE_MARKER}not-json`,
      `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: 'UNKNOWN', reason: 'failed' })}`,
      `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED', reason: '' })}`,
      `${TERMINAL_RUNTIME_FAILURE_MARKER}${JSON.stringify({ code: 'E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED', reason: 'failed', extra: true })}`,
    ].join('\n')
    const task = {
      label: 'malformed-terminal-marker',
      command: process.execPath,
      args: ['-e', `console.log(${JSON.stringify(lines)}); process.exitCode = 1`],
    }
    try {
      expect(await runTaskSuite('e2e:test', [task, {
        label: 'ordinary-next-task',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
      }], { beforeEachTask, beforeTaskLaunch, onUnsafeRuntime, failOnTaskFailure: false, stopOnTaskFailure: false, writeReport: false })).toBe(1)
      expect(beforeEachTask).toHaveBeenCalledTimes(2)
      expect(beforeTaskLaunch).toHaveBeenCalledTimes(2)
      expect(task).not.toHaveProperty('runtimeBlocker', expect.anything())
      expect(task).not.toHaveProperty('unsafeRuntimeReason', expect.anything())
      expect(onUnsafeRuntime).not.toHaveBeenCalled()
    }
    finally {
      process.exitCode = previousExitCode
    }
  })

  it.each([0, 1])('continues after pending and recovered boot diagnostics with exit %s', async (exitCode) => {
    const previousExitCode = process.exitCode
    process.exitCode = undefined
    const beforeTaskLaunch = vi.fn()
    const onUnsafeRuntime = vi.fn()
    try {
      expect(await runTaskSuite('e2e:test', [{
        label: 'ordinary-or-recovered',
        command: process.execPath,
        args: ['-e', `console.log('[warn] [runtime:devtools-log] state=pending simulator launch failed'); console.log('[info] [runtime:devtools-log] state=recovered webview page ready'); process.exitCode = ${exitCode}`],
      }, {
        label: 'ordinary-next-task',
        command: process.execPath,
        args: ['-e', 'process.exit(0)'],
      }], { beforeTaskLaunch, onUnsafeRuntime, failOnTaskFailure: false, stopOnTaskFailure: false, writeReport: false })).toBe(exitCode)
      expect(beforeTaskLaunch).toHaveBeenCalledTimes(2)
      expect(onUnsafeRuntime).not.toHaveBeenCalled()
    }
    finally {
      process.exitCode = previousExitCode
    }
  })
})
