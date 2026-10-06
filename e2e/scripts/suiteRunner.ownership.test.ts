import type { MachineE2EChildScope, MachineE2ELease, MachineE2ELeaseOptions } from '../../packages/devtools-runtime/src/lease/machine'
import type { IsolatedMachineLease } from '../utils/testSupport/machineLease'
import type { SuiteTask } from './suiteRunner'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIsolatedMachineLease } from '../utils/testSupport/machineLease'
import { runTaskSuite as runTaskSuiteWithOptions } from './suiteRunner'

const { cleanupProjects, scopes } = vi.hoisted(() => ({
  cleanupProjects: vi.fn<(options: { journalPath: string, scope: string }) => Promise<void>>(),
  scopes: [] as MachineE2EChildScope[],
}))
vi.mock('../../packages/devtools-runtime/src/lease/machine', async (original) => {
  const actual = await original<typeof import('../../packages/devtools-runtime/src/lease/machine')>()
  return {
    ...actual,
    withMachineE2ELease: <T>(run: (lease: MachineE2ELease) => Promise<T>, options?: MachineE2ELeaseOptions) => actual.withMachineE2ELease(async (lease) => {
      const create = lease.createChildScope
      lease.createChildScope = async (options) => {
        const scope = await create(options)
        scopes.push(scope)
        return scope
      }
      return await run(lease)
    }, options),
  }
})
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  cleanupManagedWechatProjects: cleanupProjects,
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
}))

let machine: IsolatedMachineLease
function runTaskSuite(...[name, tasks, options]: Parameters<typeof runTaskSuiteWithOptions>) {
  return runTaskSuiteWithOptions(name, tasks, { ...options, machineLeaseOptions: { stateDirectory: machine.stateDirectory } })
}

const journals = new Set<string>()
let previousExitCode: typeof process.exitCode

function journalOf(task: SuiteTask) {
  const journal = task.env?.WEAPP_IDE_MANAGED_PROJECT_JOURNAL
  expect(journal).toBeTruthy()
  journals.add(journal!)
  return journal!
}

describe('suite task project ownership', () => {
  beforeEach(async () => {
    machine = await createIsolatedMachineLease()
    for (const [key, value] of Object.entries(machine.environment)) {
      vi.stubEnv(key, value)
    }
    previousExitCode = process.exitCode
    process.exitCode = undefined
    cleanupProjects.mockImplementation(async ({ journalPath }) => {
      journals.add(journalPath)
    })
  })

  afterEach(async () => {
    process.exitCode = previousExitCode
    try {
      // 故意失败的空日志仅在测试子进程结束后完成；作用域全部释放前保留目录。
      for (const scope of scopes.splice(0).reverse()) {
        await scope.seal()
        await scope.complete()
      }
      await machine.dispose()
    }
    finally {
      journals.clear()
      vi.clearAllMocks()
      vi.unstubAllEnvs()
    }
  })

  it('cleans the inherited journal when a real worker exits before its teardown', async () => {
    const events: string[] = []
    cleanupProjects.mockImplementation(async ({ journalPath, scope }) => {
      journals.add(journalPath)
      expect(scope).toBe('journal')
      expect(await fs.readFile(path.join(journalPath, 'worker-owned-window'), 'utf8')).toBe('registered')
      await fs.rm(path.join(journalPath, 'worker-owned-window'))
      events.push('parent cleaned')
    })

    const exitCode = await runTaskSuite('e2e:worker-crash-unit', [{
      label: 'crashing-worker',
      command: process.execPath,
      args: ['-e', `
        const fs = require('node:fs');
        const path = require('node:path');
        fs.writeFileSync(path.join(process.env.WEAPP_IDE_MANAGED_PROJECT_JOURNAL, 'worker-owned-window'), 'registered');
        process.exit(7);
      `],
    }], {
      writeReport: false,
      afterAll: () => { events.push('suite finished') },
    })

    expect(exitCode).toBe(1)
    expect(cleanupProjects).toHaveBeenCalledOnce()
    expect(events).toEqual(['parent cleaned', 'suite finished'])
  })

  it('awaits cleanup before the next task and assigns distinct task journals', async () => {
    const events: string[] = []
    const cleanupStarted = Promise.withResolvers<void>()
    const releaseCleanup = Promise.withResolvers<void>()
    cleanupProjects.mockImplementationOnce(async ({ journalPath }) => {
      journals.add(journalPath)
      cleanupStarted.resolve()
      await releaseCleanup.promise
      events.push('first cleaned')
    })
    const tasks: SuiteTask[] = ['first', 'second'].map(label => ({ label, command: 'node', args: [] }))
    const running = runTaskSuite('e2e:cleanup-order-unit', tasks, {
      writeReport: false,
      runTask: async (task) => {
        journalOf(task)
        events.push(task.label)
        return 0
      },
    })

    try {
      await cleanupStarted.promise
      expect(events).toEqual(['first'])
    }
    finally {
      releaseCleanup.resolve()
      await running
    }
    expect(events).toEqual(['first', 'first cleaned', 'second'])
    expect(journalOf(tasks[0]!)).not.toBe(journalOf(tasks[1]!))
    expect(cleanupProjects).toHaveBeenCalledTimes(2)
  })

  it.each(['unconfirmed startup', 'window remains open'])('stops the lane on %s even when task failures are allowed', async (message) => {
    cleanupProjects.mockRejectedValueOnce(new Error(message))
    const runTask = vi.fn(async (task: SuiteTask) => {
      journalOf(task)
      return 0
    })
    const beforeEachTask = vi.fn()
    const afterAll = vi.fn()
    const exitCode = await runTaskSuite('e2e:cleanup-failure-unit', [
      { label: 'first', command: 'node', args: [] },
      { label: 'must-not-start', command: 'node', args: [] },
    ], {
      runTask,
      beforeEachTask,
      afterAll,
      failOnTaskFailure: false,
      stopOnTaskFailure: false,
      writeReport: false,
    })

    expect(exitCode).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(beforeEachTask).toHaveBeenCalledOnce()
    expect(runTask).toHaveBeenCalledOnce()
    expect(cleanupProjects).toHaveBeenCalledOnce()
    expect(afterAll).toHaveBeenCalledOnce()
  })

  it('keeps nested task journals within the inherited task tree', async () => {
    await runTaskSuite('e2e:nested-journal-unit', [{ label: 'child', command: 'node', args: [] }], {
      writeReport: false,
      runTask: async (task) => {
        const parentJournal = journalOf(task)
        vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', parentJournal)
        return runTaskSuite('e2e:nested-child-unit', [{ label: 'grandchild', command: 'node', args: [] }], {
          writeReport: false,
          runTask: async (child) => {
            expect(path.dirname(journalOf(child))).toBe(path.join(parentJournal, 'children'))
            return 0
          },
        })
      },
    })
    expect(cleanupProjects).toHaveBeenCalledTimes(2)
  })
})
