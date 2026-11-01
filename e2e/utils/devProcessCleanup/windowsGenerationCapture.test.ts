import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureWindowsProcessRows } from '../testSupport/windowsProcessRows'
import { createDevProcessCleanup } from './index'
import { captureDevProcessTree, UnconfirmedDevProcessTreeError } from './processes'

const execute = vi.hoisted(() => vi.fn())
const systemExecute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: systemExecute }))
vi.mock('./windowsKernelQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./windowsKernelQuery')>()
  return { ...actual, queryWindowsKernelProcesses: execute }
})

const root = { ProcessId: 61, ParentProcessId: 1, Started: '2026-10-08T00:00:00.0000208Z', ExecutablePath: 'owned-private/root.exe' }
const child = { ProcessId: 62, ParentProcessId: 61, Started: '2026-10-08T00:00:00.0000309Z', ExecutablePath: 'owned-private/child.exe' }

function queryRows(rows: Parameters<typeof fixtureWindowsProcessRows>[0]) {
  return { exitCode: 0, timedOut: false, stdout: fixtureWindowsProcessRows(rows), stderr: 'private-native-stderr' }
}

function enqueueUnconfirmedCapture() {
  execute.mockResolvedValueOnce(queryRows([root, { ...child, ExecutablePath: null }]))
    .mockResolvedValueOnce(queryRows([{ ...child, ExecutablePath: null }]))
}

async function captureUnconfirmed(operation: Promise<unknown>) {
  const error = await operation.catch((cause: unknown) => cause)
  if (!(error instanceof UnconfirmedDevProcessTreeError)) {
    throw new Error('Expected an unconfirmed process tree failure.')
  }
  return error
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  vi.spyOn(process, 'kill').mockReturnValue(true)
  vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '0')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Windows generation diagnostic capture and recovery', () => {
  it('binds native query receipts to the exact snapshot and reachable reinspection without adding queries', async () => {
    const grandchild = { ProcessId: 63, ParentProcessId: 62, Started: '2026-10-08T00:00:00.0000409Z', ExecutablePath: 'owned-private/grandchild.exe' }
    const unrelated = { ProcessId: 71, ParentProcessId: 1, Started: root.Started, ExecutablePath: 'unrelated-private/process.exe' }
    execute.mockResolvedValueOnce(queryRows([root, { ...child, Started: null, ExecutablePath: null }, grandchild, unrelated]))
      .mockResolvedValueOnce(queryRows([]))
    const held = vi.fn(() => true)
    const failure = await captureUnconfirmed(captureDevProcessTree(61, held))
    expect(failure.cause).toMatchObject({ message: 'Dev process parent generation is unknown; descendants remain unconfirmed.' })
    expect(failure.diagnostics).toHaveLength(1)
    const diagnostic = failure.diagnostics[0]!
    expect(diagnostic.queries).toEqual([
      expect.objectContaining({ query: 'snapshot', requestedPids: null, status: 'returned', exitCode: 0, signal: null, timedOut: false, startedAt: expect.any(String), completedAt: expect.any(String) }),
      expect.objectContaining({ query: 'identities', requestedPids: [62], status: 'returned', exitCode: 0, signal: null, timedOut: false, startedAt: expect.any(String), completedAt: expect.any(String) }),
    ])
    expect(diagnostic.reinspections).toEqual([expect.objectContaining({ requestedPids: [62], status: 'returned', rows: [] })])
    expect(diagnostic.initialRows.map(row => row.pid)).toEqual([61, 62, 63])
    expect(execute.mock.calls.map(([pids]) => pids)).toEqual([undefined, [62]])
    expect(held).not.toHaveBeenCalled()
    expect(process.kill).not.toHaveBeenCalled()
    expect(systemExecute).not.toHaveBeenCalled()
    const serialized = JSON.stringify(diagnostic)
    for (const privateValue of [root.ExecutablePath, child.ExecutablePath, grandchild.ExecutablePath, unrelated.ExecutablePath, 'private-native-stderr']) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it.each(['returned-timeout', 'rejected'] as const)('keeps a %s identity query distinct from a successful empty reinspection', async (kind) => {
    execute.mockResolvedValueOnce(queryRows([root, { ...child, ExecutablePath: null }]))
    const cause = new Error('private-query-rejection')
    if (kind === 'rejected') {
      execute.mockRejectedValueOnce(cause)
    }
    else {
      execute.mockResolvedValueOnce({ exitCode: undefined, signal: 'SIGTERM', timedOut: true, stdout: 'private-native-stdout', stderr: 'private-native-stderr' })
    }
    const held = vi.fn(() => true)
    const failure = await captureUnconfirmed(captureDevProcessTree(61, held))
    const diagnostic = failure.diagnostics[0]!
    expect(diagnostic.queries).toHaveLength(2)
    expect(diagnostic.queries[1]).toMatchObject({
      query: 'identities',
      requestedPids: [62],
      status: kind === 'rejected' ? 'failed' : 'returned',
      exitCode: null,
      signal: kind === 'rejected' ? null : 'SIGTERM',
      timedOut: kind === 'rejected' ? null : true,
    })
    expect(diagnostic.reinspections).toEqual([expect.objectContaining({ requestedPids: [62], status: 'failed', rows: null })])
    if (kind === 'rejected') {
      expect(failure.cause).toBe(cause)
    }
    else {
      expect(failure.cause).toMatchObject({ message: 'Dev process inspection failed: exitCode=none, signal=SIGTERM, timedOut=true.' })
    }
    expect(execute.mock.calls.map(([pids]) => pids)).toEqual([undefined, [62]])
    expect(held).not.toHaveBeenCalled()
    expect(process.kill).not.toHaveBeenCalled()
    expect(systemExecute).not.toHaveBeenCalled()
    const serialized = JSON.stringify(diagnostic)
    for (const privateValue of ['private-query-rejection', 'private-native-stdout', 'private-native-stderr']) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it('retains the original diagnostic when recovery reconstructs an unconfirmed error after root exit', async () => {
    enqueueUnconfirmedCapture()
    execute.mockResolvedValueOnce(queryRows([child]))
    let held = true
    const disconnect = vi.fn(() => false)
    const cleanup = createDevProcessCleanup({ pid: 61, isRootHeld: () => held, disconnectRoot: disconnect, settledExit: Promise.resolve() })
    const first = await captureUnconfirmed(cleanup(0))
    expect(first.diagnostics).toHaveLength(1)
    expect(first.diagnostics[0]?.initialRows.find(row => row.pid === 62)?.started).toBe(child.Started)
    expect(first.candidates).toEqual([expect.objectContaining({ pid: 62, started: '2026-10-08T00:00:00.0000300Z' })])
    held = false
    const recovered = await captureUnconfirmed(cleanup(0))
    expect(recovered.pids).toEqual([62])
    expect(recovered.diagnostics).toHaveLength(1)
    expect(recovered.diagnostics[0]).toBe(first.diagnostics[0])
    expect(recovered.cause).toBe(first.cause)
    expect(execute.mock.calls.map(([pids]) => pids)).toEqual([undefined, [62], [62]])
    expect(disconnect).not.toHaveBeenCalled()
    expect(process.kill).not.toHaveBeenCalled()
    expect(systemExecute).not.toHaveBeenCalled()
  })

  it('keeps both capture diagnostics when a later valid root snapshot still cannot confirm an earlier descendant', async () => {
    enqueueUnconfirmedCapture()
    execute.mockResolvedValueOnce(queryRows([child]))
    enqueueUnconfirmedCapture()
    execute.mockResolvedValueOnce(queryRows([child]))
      .mockResolvedValueOnce(queryRows([root]))
    const disconnect = vi.fn(() => false)
    const cleanup = createDevProcessCleanup({ pid: 61, isRootHeld: () => true, disconnectRoot: disconnect, settledExit: Promise.resolve() })
    const first = await captureUnconfirmed(cleanup(0))
    const second = await captureUnconfirmed(cleanup(0))
    expect(first.diagnostics).toHaveLength(1)
    expect(second.diagnostics).toHaveLength(1)
    const recovered = await captureUnconfirmed(cleanup(0))
    expect(recovered.pids).toEqual([62])
    expect(recovered.diagnostics).toHaveLength(2)
    expect(recovered.diagnostics[0]).toBe(first.diagnostics[0])
    expect(recovered.diagnostics[1]).toBe(second.diagnostics[0])
    expect(recovered.cause).toBe(second.cause)
    expect(execute.mock.calls.map(([pids]) => pids)).toEqual([undefined, [62], [62], undefined, [62], [62], undefined])
    expect(disconnect).not.toHaveBeenCalled()
    expect(process.kill).not.toHaveBeenCalled()
    expect(systemExecute).not.toHaveBeenCalled()
  })
})
