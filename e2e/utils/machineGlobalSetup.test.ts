import type { MachineE2ELeaseOptions } from '../../packages/devtools-runtime/src/lease/machine'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease as withPublishedMachineLease } from '@weapp-vite/devtools-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireMachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import { readMachineE2ELeaseSnapshot } from '../../packages/devtools-runtime/src/lease/machineRecovery'
import { INHERITED_LEASE_ENV, parseMachineCredential } from '../../packages/devtools-runtime/src/lease/machineScope'
import { createManagedWechatProjectJournal, MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import setup from '../vitest.e2e.machine.global-setup'

const mocks = vi.hoisted(() => ({
  directory: '',
  scopeFailure: undefined as Error | undefined,
  createJournal: vi.fn<(parent?: string) => Promise<string>>(),
  cleanupProjects: vi.fn<(options: { journalPath: string, scope: string }) => Promise<void>>(),
}))

vi.mock('../../packages/devtools-runtime/src/lease/machine', async (original) => {
  const actual = await original<typeof import('../../packages/devtools-runtime/src/lease/machine')>()
  return {
    ...actual,
    acquireMachineE2ELease: async (options: MachineE2ELeaseOptions = {}) => {
      if (!mocks.directory) {
        throw new Error('Global setup tests must use an isolated machine state directory.')
      }
      const lease = await actual.acquireMachineE2ELease({ ...options, stateDirectory: mocks.directory })
      if (mocks.scopeFailure) {
        lease.createChildScope = async () => {
          throw mocks.scopeFailure
        }
      }
      return lease
    },
  }
})
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
  cleanupManagedWechatProjects: mocks.cleanupProjects,
  readManagedWechatProjectRecords: async () => [],
}))
vi.mock('./devtoolsProcessOwnership', () => ({
  createDevtoolsProjectJournal: mocks.createJournal,
}))

function snapshot() {
  return readMachineE2ELeaseSnapshot({ stateDirectory: mocks.directory })
}

describe('Vitest global setup owns its journal cleanup scope', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    mocks.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vitest-machine-owner-'))
    mocks.scopeFailure = undefined
    vi.stubEnv(INHERITED_LEASE_ENV, undefined)
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, undefined)
    mocks.createJournal.mockImplementation(parent => createManagedWechatProjectJournal(path.join(mocks.directory, 'journals'), parent ?? process.env[MANAGED_PROJECT_JOURNAL_ENV]))
    mocks.cleanupProjects.mockImplementation(async () => {
      // 模拟领域清理从包的 dist 入口再次借用；不能依赖全局 setup 源码模块的上下文。
      await withPublishedMachineLease(async (lease) => {
        expect(lease.borrowed).toBe(true)
      }, { stateDirectory: mocks.directory, env: process.env })
    })
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    // 本测试目录没有真实宿主、端口或外部资源，仅清除隔离的租约与模拟 journal。
    await fs.rm(mocks.directory, { recursive: true, force: true })
    mocks.directory = ''
  })

  it('publishes a journal-bound child credential before preflight and worker startup', async () => {
    const teardown = await setup()
    const journalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]!
    const credential = parseMachineCredential(process.env[INHERITED_LEASE_ENV]!)
    expect(credential.scopes).toHaveLength(1)
    expect((await snapshot()).scopes).toEqual([expect.objectContaining({ id: credential.scopes[0], cleanupKey: journalPath, sealed: false, completed: false })])
    await teardown()
    expect(mocks.cleanupProjects).toHaveBeenCalledExactlyOnceWith({ journalPath, scope: 'journal' })
    expect(process.env[INHERITED_LEASE_ENV]).toBeUndefined()
    expect(process.env[MANAGED_PROJECT_JOURNAL_ENV]).toBeUndefined()
    await expect(fs.access(path.join(mocks.directory, 'machine-e2e'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['unconfirmed startup', 'native window remains open'])('keeps the root lease and journal bound after %s', async (message) => {
    const failure = new Error(message)
    mocks.cleanupProjects.mockRejectedValue(failure)
    const teardown = await setup()
    const journalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]!
    const result = await teardown().catch(error => error as unknown)
    expect(result).toBeInstanceOf(AggregateError)
    expect((result as AggregateError).errors[0]).toBe(failure)
    expect(String((result as AggregateError).errors[1])).toContain('unfinished cleanup')
    expect((await snapshot()).scopes).toEqual([expect.objectContaining({ cleanupKey: journalPath, sealed: true, completed: false })])
    await expect(acquireMachineE2ELease({ env: {} })).rejects.toThrow('Runtime busy')
    expect(process.env[INHERITED_LEASE_ENV]).toBeUndefined()
    expect(process.env[MANAGED_PROJECT_JOURNAL_ENV]).toBeUndefined()
    await expect(fs.access(journalPath)).resolves.toBeUndefined()
  })

  it('uses the parent credential for cleanup after sealing the worker credential', async () => {
    const teardown = await setup()
    const workerCredential = process.env[INHERITED_LEASE_ENV]!
    const implementation = mocks.cleanupProjects.getMockImplementation()!
    mocks.cleanupProjects.mockImplementation(async (options) => {
      expect(parseMachineCredential(process.env[INHERITED_LEASE_ENV]!).scopes).toEqual([])
      await expect(acquireMachineE2ELease({ env: { [INHERITED_LEASE_ENV]: workerCredential } })).rejects.toThrow('scope is sealed')
      await implementation(options)
    })
    await teardown()
  })

  it('nests the global journal under an inherited task and restores its exact environment', async () => {
    const parent = await acquireMachineE2ELease({ env: {} })
    const parentJournal = await createManagedWechatProjectJournal(path.join(mocks.directory, 'journals'))
    const parentScope = await parent.createChildScope({ cleanupKey: parentJournal })
    const parentCredential = parentScope.environment[INHERITED_LEASE_ENV]!
    vi.stubEnv(INHERITED_LEASE_ENV, parentCredential)
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, parentJournal)
    const teardown = await setup()
    const journalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]!
    expect(path.dirname(journalPath)).toBe(path.join(parentJournal, 'children'))
    expect(parseMachineCredential(process.env[INHERITED_LEASE_ENV]!).scopes).toHaveLength(2)
    await teardown()
    expect(process.env[INHERITED_LEASE_ENV]).toBe(parentCredential)
    expect(process.env[MANAGED_PROJECT_JOURNAL_ENV]).toBe(parentJournal)
    const state = await snapshot()
    expect(state.borrowers).toEqual([])
    expect(state.scopes.find(scope => scope.cleanupKey === journalPath)).toMatchObject({ sealed: true, completed: true })
    expect(state.scopes.find(scope => scope.cleanupKey === parentJournal)).toMatchObject({ sealed: false, completed: false })
    await parentScope.seal()
    await parentScope.complete()
    await parent.release()
  })

  it.each(['journal', 'scope'] as const)('releases an empty lease if %s initialization fails', async (stage) => {
    const failure = new Error(`${stage} initialization failed`)
    if (stage === 'journal') {
      mocks.createJournal.mockRejectedValue(failure)
    }
    else {
      mocks.scopeFailure = failure
    }
    await expect(setup()).rejects.toBe(failure)
    expect(mocks.cleanupProjects).not.toHaveBeenCalled()
    expect(process.env[INHERITED_LEASE_ENV]).toBeUndefined()
    expect(process.env[MANAGED_PROJECT_JOURNAL_ENV]).toBeUndefined()
    await expect(fs.access(path.join(mocks.directory, 'machine-e2e'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('leaves a failed nested journal blocking its outer owner after releasing only its borrower', async () => {
    const parent = await acquireMachineE2ELease({ env: {} })
    const parentJournal = await createManagedWechatProjectJournal(path.join(mocks.directory, 'journals'))
    const parentScope = await parent.createChildScope({ cleanupKey: parentJournal })
    vi.stubEnv(INHERITED_LEASE_ENV, parentScope.environment[INHERITED_LEASE_ENV]!)
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, parentJournal)
    const failure = new Error('unconfirmed nested startup')
    mocks.cleanupProjects.mockRejectedValue(failure)
    const teardown = await setup()
    const journalPath = process.env[MANAGED_PROJECT_JOURNAL_ENV]!
    await expect(teardown()).rejects.toBe(failure)
    const state = await snapshot()
    expect(state.borrowers).toEqual([])
    expect(state.scopes.find(scope => scope.cleanupKey === journalPath)).toMatchObject({ sealed: true, completed: false })
    expect(process.env[MANAGED_PROJECT_JOURNAL_ENV]).toBe(parentJournal)
    await expect(parent.release()).rejects.toThrow('unfinished cleanup')
  })

  it('keeps repeated concurrent teardown idempotent', async () => {
    const teardown = await setup()
    const first = teardown()
    expect(teardown()).toBe(first)
    await first
    await teardown()
    expect(mocks.cleanupProjects).toHaveBeenCalledOnce()
  })

  it('completes an empty journal for a headless run without requiring any IDE resource', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
    const teardown = await setup()
    await teardown()
    expect(mocks.cleanupProjects).toHaveBeenCalledOnce()
    await expect(fs.access(path.join(mocks.directory, 'machine-e2e'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
