import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fixtureWindowsProcessRows } from '../testSupport/windowsProcessRows'
import { createDevProcessCleanup } from './index'
import * as processes from './processes'

const execute = vi.hoisted(() => vi.fn())
const query = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
vi.mock('./windowsKernelQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./windowsKernelQuery')>()
  return { ...actual, queryWindowsKernelProcesses: query }
})

const root = { ProcessId: 61, ParentProcessId: 41, ExecutablePath: 'fixture-node', Started: '2026-10-05T12:30:01.0000000Z' }
const child = { ProcessId: 62, ParentProcessId: 61, ExecutablePath: 'fixture-node', Started: '2026-10-05T12:30:02.0000000Z' }
const foreign = { ProcessId: 71, ParentProcessId: 21, ExecutablePath: 'fixture-node', Started: '2026-10-05T12:30:03.0000000Z' }
type Row = Omit<typeof root, 'ExecutablePath'> & { ExecutablePath: string | null }

function fixture() {
  const entries = new Map<number, Row>([root, child, foreign].map(row => [row.ProcessId, { ...row }]))
  let held = true
  let settle!: () => void
  const settledExit = new Promise<void>((resolve) => {
    settle = resolve
  })
  const state = {
    entries,
    exitCode: 128 as number | undefined,
    signal: undefined as string | undefined,
    timedOut: false,
    queryFailure: undefined as Error | undefined,
    absent: new Set<number>(),
    denied: undefined as Error | undefined,
    onTerminate: (pids: number[]) => pids.forEach(pid => state.exit(pid)),
    exit(pid: number) {
      entries.delete(pid)
      if (pid === root.ProcessId) {
        held = false
        settle()
      }
    },
  }
  query.mockImplementation(async (pids?: number[]) => {
    if (state.queryFailure) {
      throw state.queryFailure
    }
    const selected = [...entries.values()].filter(entry => !pids || pids.includes(entry.ProcessId))
    return { exitCode: 0, stdout: fixtureWindowsProcessRows(selected), stderr: '' }
  })
  execute.mockImplementation(async (command: string, args: string[]) => {
    expect(command).toBe('taskkill')
    expect(args).not.toContain('/T')
    expect(args.at(-1)).toBe('/F')
    const pids = args.filter((_arg, index) => index % 2 === 1).map(Number)
    expect(pids.every(pid => pid === root.ProcessId || pid === child.ProcessId)).toBe(true)
    state.onTerminate(pids)
    return { exitCode: state.exitCode, signal: state.signal, timedOut: state.timedOut, stdout: 'original taskkill stdout\r\n', stderr: '原始 taskkill stderr\r\n' }
  })
  const alive = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    expect(signal, 'all termination uses the exact taskkill list').toBe(0)
    if (state.denied) {
      throw state.denied
    }
    if (!entries.has(pid) || state.absent.has(pid)) {
      throw Object.assign(new Error('No such process'), { code: 'ESRCH' })
    }
    return true
  })
  const termination = vi.spyOn(processes, 'killWindowsDevProcesses')
  const cleanup = createDevProcessCleanup({ pid: root.ProcessId, isRootHeld: () => held, disconnectRoot: () => false, settledExit })
  const originalError = async () => termination.mock.results[0]!.value.catch((error: unknown) => error) as Promise<processes.DevProcessTerminationError>
  return { state, cleanup, termination, alive, originalError }
}

beforeEach(() => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', undefined)
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

it.each([
  { exitCode: 128, signal: undefined, timedOut: false },
  { exitCode: 1, signal: undefined, timedOut: false },
  { exitCode: undefined, signal: 'SIGTERM', timedOut: true },
])('accepts independently verified exit while preserving the original termination receipt ($exitCode)', async (receipt) => {
  const ctx = fixture()
  Object.assign(ctx.state, receipt)
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
  const error = await ctx.originalError()
  expect(error).toBeInstanceOf(processes.DevProcessTerminationError)
  expect(error.evidence).toEqual({ pids: [62, 61], ...receipt, stdout: 'original taskkill stdout\r\n', stderr: '原始 taskkill stderr\r\n' })
  const output = vi.mocked(process.stdout.write).mock.calls.map(([line]) => String(line)).join('')
  expect(output).toContain(JSON.stringify({ ...error.evidence, ownedProcessesTerminated: true }))
  expect([...ctx.state.entries.keys()]).toEqual([71])
  await ctx.cleanup(0)
  expect(ctx.termination).toHaveBeenCalledOnce()
  expect(query.mock.calls.filter(([pids]) => pids === undefined)).toHaveLength(1)
})

it.each([61, 62])('preserves the original error and retries only the still-owned process %s', async (survivor) => {
  const ctx = fixture()
  ctx.state.onTerminate = pids => pids.filter(pid => pid !== survivor).forEach(pid => ctx.state.exit(pid))
  const failure = await ctx.cleanup(0).catch((error: unknown) => error)
  expect(failure).toBe(await ctx.originalError())
  expect(ctx.termination).toHaveBeenLastCalledWith([62, 61])
  ctx.state.onTerminate = pids => pids.forEach(pid => ctx.state.exit(pid))
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
  await ctx.cleanup(0)
  expect(ctx.termination.mock.calls).toEqual([[[62, 61]], [[survivor]]])
  expect([...ctx.state.entries.keys()]).toEqual([71])
})

it.each(['Started', 'ExecutablePath'] as const)('revokes ownership when the registered PID has a different %s after taskkill', async (field) => {
  const ctx = fixture()
  const replacement = { ...child, [field]: field === 'Started' ? '2026-10-05T12:30:05.0000000Z' : 'replacement-node' }
  ctx.state.onTerminate = () => {
    ctx.state.exit(root.ProcessId)
    ctx.state.entries.set(child.ProcessId, replacement)
  }
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
  await ctx.cleanup(0)
  expect(ctx.state.entries.get(child.ProcessId)).toBe(replacement)
  expect(ctx.state.entries.get(foreign.ProcessId)).toEqual(foreign)
  expect(ctx.termination).toHaveBeenCalledOnce()
  expect(ctx.alive).not.toHaveBeenCalled()
})

it.each(['alive', 'denied', 'query-failed'] as const)('retains the pending identity after %s verification and preserves both original errors', async (mode) => {
  const ctx = fixture()
  const inspectionFailure = Object.assign(new Error('independent verification failed'), { code: 'EPERM' })
  ctx.state.onTerminate = () => {
    ctx.state.exit(root.ProcessId)
    if (mode === 'query-failed') {
      ctx.state.queryFailure = inspectionFailure
    }
    else {
      ctx.state.entries.set(child.ProcessId, { ...child, ExecutablePath: null })
      if (mode === 'denied') {
        ctx.state.denied = inspectionFailure
      }
    }
  }
  const failure = await ctx.cleanup(0).catch((error: unknown) => error) as AggregateError
  const original = await ctx.originalError()
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure.cause).toBe(original)
  expect(failure.errors[0]).toBe(original)
  if (mode === 'alive') {
    expect(failure.errors[1]).toEqual(expect.objectContaining({ message: expect.stringContaining('identity could not be verified') }))
  }
  else {
    expect(failure.errors[1]).toBe(inspectionFailure)
  }
  expect(ctx.state.entries.has(child.ProcessId)).toBe(true)
  ctx.state.denied = undefined
  ctx.state.queryFailure = undefined
  ctx.state.entries.set(child.ProcessId, child)
  ctx.state.onTerminate = pids => pids.forEach(pid => ctx.state.exit(pid))
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
  expect(ctx.termination.mock.calls).toEqual([[[62, 61]], [[62]]])
  expect([...ctx.state.entries.keys()]).toEqual([71])
})

it('requires independent ESRCH before releasing a residual row without executable identity', async () => {
  const ctx = fixture()
  ctx.state.onTerminate = () => {
    ctx.state.exit(root.ProcessId)
    ctx.state.entries.set(child.ProcessId, { ...child, ExecutablePath: null })
    ctx.state.absent.add(child.ProcessId)
  }
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
  expect(ctx.alive).toHaveBeenCalledExactlyOnceWith(child.ProcessId, 0)
  await ctx.cleanup(0)
  expect(ctx.termination).toHaveBeenCalledOnce()
})

it.each([false, true])('diagnostic write failure preserves the cleanup outcome after independently verified exit (%s)', async (exited) => {
  const ctx = fixture()
  if (!exited) {
    ctx.state.onTerminate = () => {}
  }
  vi.mocked(process.stdout.write).mockImplementation(() => {
    throw new Error('diagnostic output failed')
  })
  const result = await ctx.cleanup(0).catch((error: unknown) => error)
  expect(result).toBe(exited ? undefined : await ctx.originalError())
})

it('does not reinterpret an unexpected launcher failure as a successful exit race', async () => {
  const ctx = fixture()
  const failure = new Error('taskkill could not be launched')
  execute.mockRejectedValueOnce(failure)
  await expect(ctx.cleanup(0)).rejects.toBe(failure)
  expect([...ctx.state.entries.keys()]).toEqual([61, 62, 71])
  expect(query.mock.calls).toHaveLength(2)
  await expect(ctx.cleanup(0)).resolves.toBeUndefined()
})
