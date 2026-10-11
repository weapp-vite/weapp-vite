import type { MachineE2EChildScope, MachineE2ERecoverableDescendantScope } from '../../packages/devtools-runtime/src/lease/machine'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createManagedWechatProjectJournal } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createContractCleanupKey } from '../../scripts/dependencyContracts/rolldown/helpers.mjs'
import { cleanupDevtoolsCommandScope } from './devtoolsScopeCleanup'

const mocks = vi.hoisted(() => ({ cleanup: vi.fn(), records: vi.fn() }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async original => ({
  ...await original<typeof import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>(),
  cleanupManagedWechatProjects: mocks.cleanup,
  readManagedWechatProjectRecords: mocks.records,
}))

let directory: string
let parent: string
let child: string

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-scope-cleanup-'))
  parent = await createManagedWechatProjectJournal(directory)
  child = await createManagedWechatProjectJournal(directory, parent)
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.records.mockResolvedValue([])
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

function scopeFor(cleanupKey: string) {
  const descendant: MachineE2ERecoverableDescendantScope = {
    id: randomUUID(),
    owner: { pid: process.pid, token: randomUUID() },
    ancestors: [randomUUID()],
    sealed: true,
    completed: false,
    cleanupKey,
  }
  const seal = vi.fn(async () => {})
  const complete = vi.fn(async () => {})
  const recovered = vi.fn()
  const scope: MachineE2EChildScope = {
    environment: {},
    seal,
    complete,
    recoverStoppedDescendants: async (run) => {
      await run(descendant)
      recovered()
    },
  }
  return { scope, seal, complete, recovered }
}

it('verifies the registered descendant journal before completing its cleanup and the parent', async () => {
  const { scope, seal, complete, recovered } = scopeFor(child)
  const events: string[] = []
  mocks.cleanup.mockImplementation(async ({ journalPath }) => {
    events.push(journalPath === child ? 'child-cleaned' : 'parent-cleaned')
  })
  recovered.mockImplementation(() => events.push('child-completed'))
  seal.mockImplementation(async () => {
    events.push('parent-sealed')
  })
  complete.mockImplementation(async () => {
    events.push('parent-completed')
  })
  await cleanupDevtoolsCommandScope(scope, parent)
  expect(events).toEqual(['child-cleaned', 'child-completed', 'parent-sealed', 'parent-cleaned', 'parent-completed'])
  expect(mocks.records).toHaveBeenCalledExactlyOnceWith(child)
})

it.each(['sibling', 'parent', 'relative'] as const)('rejects a %s cleanup key without closing projects', async (kind) => {
  const own = await createManagedWechatProjectJournal(directory, parent)
  const key = kind === 'sibling' ? child : kind === 'parent' ? parent : path.relative(own, child)
  const { scope, complete } = scopeFor(key)
  await expect(cleanupDevtoolsCommandScope(scope, own)).rejects.toThrow('outside its explicitly owned journal subtree')
  expect(mocks.cleanup).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('rejects a child directory whose ownership marker was replaced by another task', async () => {
  const other = await createManagedWechatProjectJournal(directory)
  await fs.copyFile(path.join(other, '.ownership-scope'), path.join(child, '.ownership-scope'))
  const { scope } = scopeFor(child)
  await expect(cleanupDevtoolsCommandScope(scope, parent)).rejects.toThrow()
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it('keeps the descendant incomplete if cleanup returns with an unreleased record', async () => {
  mocks.records.mockResolvedValue([{ state: 'owned' }])
  const { scope, complete, recovered } = scopeFor(child)
  await expect(cleanupDevtoolsCommandScope(scope, parent)).rejects.toThrow('resource cleanup is incomplete')
  expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith({ journalPath: child, scope: 'journal' })
  expect(recovered).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('preserves a failed child cleanup without trying the parent journal', async () => {
  const failure = new Error('native window destruction is unconfirmed')
  mocks.cleanup.mockRejectedValue(failure)
  const { scope, complete, recovered } = scopeFor(child)
  await expect(cleanupDevtoolsCommandScope(scope, parent)).rejects.toBe(failure)
  expect(mocks.cleanup).toHaveBeenCalledOnce()
  expect(recovered).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('preserves unfinished native contract scopes instead of treating them as empty IDE journals', async () => {
  const report = path.join(directory, 'contracts.json')
  const fixture = path.join(directory, 'native-fixture')
  const cleanupKey = createContractCleanupKey(report, fixture, process.pid)
  const { scope, seal, complete, recovered } = scopeFor(cleanupKey)
  await expect(cleanupDevtoolsCommandScope(scope, parent)).rejects.toThrow('outside its explicitly owned journal subtree')
  expect(mocks.cleanup).not.toHaveBeenCalled()
  expect(mocks.records).not.toHaveBeenCalled()
  expect(seal).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
  expect(recovered).not.toHaveBeenCalled()
})
