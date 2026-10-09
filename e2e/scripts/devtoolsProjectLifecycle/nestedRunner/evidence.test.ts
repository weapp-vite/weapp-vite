import type { NestedRunnerReady } from './evidence'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INHERITED_LEASE_ENV } from '../../../../packages/devtools-runtime/src/lease/machineScope'
import { assertNestedRunnerReady, assertNestedRunnerScopesCompleted, NESTED_READY_PREFIX, parseNestedRunnerReady, readNestedRunnerScopes } from './evidence'

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), snapshot: vi.fn(), stateDirectory: vi.fn() }))
vi.mock('../../../../packages/devtools-runtime/src/lease/directory', () => ({ mutateLease: mocks.mutate }))
vi.mock('../../../../packages/devtools-runtime/src/lease/machineContext', () => ({ machineStateDirectory: mocks.stateDirectory }))
vi.mock('../../../../packages/devtools-runtime/src/lease/machineRecoveryState', () => ({ readMachineSnapshot: mocks.snapshot }))
vi.mock('../context', () => ({ isRecord: (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) }))

function fixture() {
  const journalPath = path.resolve('fixture-runner-journal')
  const owner = { pid: process.pid, token: randomUUID() }
  const parent = { id: randomUUID(), owner, ancestors: [], sealed: false, completed: false, cleanupKey: journalPath }
  const child = { ...parent, id: randomUUID(), ancestors: [parent.id], cleanupKey: path.join(journalPath, 'children', 'task') }
  const pid = process.pid + 1
  const state = { scopeId: parent.id, scopes: [parent, child], borrowers: [{ pid, token: randomUUID(), scopes: [parent.id, child.id] }] }
  const evidence: NestedRunnerReady = { pid, id: 'owned-window', journalPath: child.cleanupKey, projectPath: path.resolve('fixture-project'), port: 19001, info: { version: 'selected-version', SDKVersion: 'fixture-sdk' }, ownerHost: undefined, scope: structuredClone(child) }
  const environment = { [INHERITED_LEASE_ENV]: JSON.stringify({ pid: owner.pid, token: parent.id, scopes: [parent.id] }) }
  return { journalPath, owner, parent, child, pid, state, evidence, environment }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.stateDirectory.mockReturnValue(path.resolve('fixture-machine-state'))
  mocks.mutate.mockImplementation(async (_directory, run) => await run())
})

describe('nested runner scope evidence', () => {
  it('reads only the explicitly held subtree under the lease mutation lock', async () => {
    const { state, environment, owner } = fixture()
    const unrelated = { ...state.scopes[0]!, id: randomUUID(), cleanupKey: 'other-task' }
    mocks.snapshot.mockResolvedValue({ owner, scopes: [...state.scopes, unrelated], borrowers: [...state.borrowers, { pid: process.pid + 2, token: randomUUID(), scopes: [unrelated.id] }] })
    expect(await readNestedRunnerScopes(environment)).toEqual(state)
    expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(path.resolve('fixture-machine-state', 'machine-e2e'), expect.any(Function))
    expect(mocks.snapshot).toHaveBeenCalledExactlyOnceWith(path.resolve('fixture-machine-state', 'machine-e2e'))
  })

  it('refuses a root credential with no explicit command scope', async () => {
    const { owner } = fixture()
    await expect(readNestedRunnerScopes({ [INHERITED_LEASE_ENV]: JSON.stringify(owner) })).rejects.toThrow('explicit command scope')
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })

  it('requires the held scope to remain in the ledger', async () => {
    const { environment, owner } = fixture()
    mocks.snapshot.mockResolvedValue({ owner, scopes: [], borrowers: [] })
    await expect(readNestedRunnerScopes(environment)).rejects.toThrow('remain in its machine ledger')
  })

  it('accepts a real unfinished child scope and its registered runner borrower', () => {
    const { evidence, state, journalPath, pid } = fixture()
    const parsed = parseNestedRunnerReady(`${NESTED_READY_PREFIX}${JSON.stringify(evidence)}`)
    expect(parsed).toEqual(evidence)
    expect(() => assertNestedRunnerReady(parsed, state, journalPath, pid)).not.toThrow()
  })

  it.each(['sealed', 'completed'] as const)('rejects a ready receipt whose child is already %s', (key) => {
    const { evidence } = fixture()
    evidence.scope = { ...evidence.scope, [key]: true }
    expect(() => parseNestedRunnerReady(`${NESTED_READY_PREFIX}${JSON.stringify(evidence)}`)).toThrow('unfinished, unsealed task scope')
  })

  it.each([0, -1, 65536])('rejects an invalid automator port %s', (port) => {
    const { evidence } = fixture()
    expect(() => parseNestedRunnerReady(`${NESTED_READY_PREFIX}${JSON.stringify({ ...evidence, port })}`)).toThrow('invalid process or port')
  })

  it('rejects a receipt from a different process handle', () => {
    const { evidence, state, journalPath, pid } = fixture()
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid + 1)).toThrow('created nested runner')
  })

  it('rejects a ledger with no actual descendant task scope', () => {
    const { evidence, state, journalPath, pid } = fixture()
    state.scopes.pop()
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid)).toThrow('task scope must remain registered')
  })

  it('rejects a child journal outside the direct runner journal subtree', () => {
    const { evidence, state, journalPath, pid } = fixture()
    evidence.journalPath = path.join(journalPath, 'other-journal')
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid)).toThrow('direct child')
  })

  it('rejects a cleanup binding that differs from the child journal', () => {
    const { evidence, state, journalPath, pid } = fixture()
    state.scopes[1]!.cleanupKey = path.join(journalPath, 'children', 'another-task')
    evidence.scope = structuredClone(state.scopes[1]!)
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid)).toThrow()
  })

  it('rejects a borrower registered only in the parent runner scope', () => {
    const { evidence, state, journalPath, pid } = fixture()
    state.borrowers[0]!.scopes.pop()
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid)).toThrow('registered live borrower in its child scope')
  })

  it.each(['sealed', 'completed'] as const)('rejects an already %s parent before SIGKILL', (key) => {
    const { evidence, state, journalPath, pid } = fixture()
    state.scopes[0]![key] = true
    expect(() => assertNestedRunnerReady(evidence, state, journalPath, pid)).toThrow('genuinely unsealed command scopes')
  })

  it('requires the original scope IDs and both completion flags after recovery', () => {
    const { state } = fixture()
    const after = { ...state, scopes: state.scopes.map(scope => ({ ...scope, sealed: true, completed: true })) }
    expect(() => assertNestedRunnerScopesCompleted(state, after)).not.toThrow()
    after.scopes[1]!.completed = false
    expect(() => assertNestedRunnerScopesCompleted(state, after)).toThrow('complete every original command scope')
    after.scopes[1]!.completed = true
    after.scopes[1]!.id = randomUUID()
    expect(() => assertNestedRunnerScopesCompleted(state, after)).toThrow()
  })
})
