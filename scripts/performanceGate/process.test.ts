import type { DevProcessIdentity } from '../../e2e/utils/devProcessCleanup/processes'
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runCollector } from './process'

const fixtures = vi.hoisted(() => ({ execute: vi.fn(), capture: vi.fn(), identities: vi.fn(), alive: vi.fn(), kill: vi.fn() }))
vi.mock('execa', () => ({ execa: fixtures.execute }))
vi.mock('../../e2e/utils/devProcessCleanup/processes', async (original) => {
  const actual = await original<typeof import('../../e2e/utils/devProcessCleanup/processes')>()
  return { ...actual, captureDevProcessTree: fixtures.capture, readDevProcessIdentities: fixtures.identities, isDevProcessAlive: fixtures.alive, killWindowsDevProcesses: fixtures.kill }
})

let directory: string
const rootIdentity: DevProcessIdentity = { pid: 61, started: 'root-generation', executable: 'fixture-node' }
const descendantIdentity: DevProcessIdentity = { pid: 62, started: 'child-generation', executable: 'fixture-node' }

function mockChild(input: { pid?: number } = { pid: rootIdentity.pid }) {
  let resolve!: (value: { exitCode?: number }) => void
  let reject!: (error: Error) => void
  const native = { exitCode: null as number | null, signalCode: null as string | null, connected: false }
  const child = Object.assign(new Promise<{ exitCode?: number }>((res, rej) => {
    resolve = res
    reject = rej
  }), { pid: input.pid, nodeChildProcess: native as typeof native | undefined, all: new EventEmitter(), kill: vi.fn() })
  const exit = (exitCode: number) => {
    native.exitCode = exitCode
    resolve({ exitCode })
  }
  fixtures.execute.mockReturnValueOnce(child)
  return { child, native, exit, reject, resolve }
}

function options() {
  return { cwd: directory, logFile: path.join(directory, 'run.log'), timeoutMs: 500 }
}

async function waitForLaunch() {
  await vi.waitFor(() => expect(fixtures.execute).toHaveBeenCalledTimes(1), { interval: 1 })
}

beforeEach(async () => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  directory = await mkdtemp(path.join(os.tmpdir(), 'performance-process-'))
  fixtures.capture.mockResolvedValue([descendantIdentity, rootIdentity])
  fixtures.identities.mockResolvedValue(new Map([[61, rootIdentity], [62, descendantIdentity]]))
  fixtures.alive.mockReturnValue(false)
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await rm(directory, { recursive: true, force: true })
})

it('does not rediscover or signal a collector PID after its child has exited', async () => {
  const fixture = mockChild()
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  fixture.child.all.emit('data', Buffer.from('failure evidence\n'))
  fixture.exit(3)
  expect(await failed).toMatchObject({ message: expect.stringContaining('exit=3') })
  expect((await failed as Error).message).toBe('Collector failed: exit=3')
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
  expect(fixtures.capture).not.toHaveBeenCalled()
  expect(fixtures.identities).not.toHaveBeenCalled()
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(await readFile(options().logFile, 'utf8')).toContain('failure evidence')
})

it('retains a launch rejection without trying to terminate an absent child', async () => {
  const fixture = mockChild({})
  const launchError = new Error('launch unavailable')
  const failed = runCollector('missing-performance-command', [], options()).catch((error: unknown) => error)
  await waitForLaunch()
  fixture.reject(launchError)
  expect(await failed).toMatchObject({ message: expect.stringContaining('failed'), cause: launchError })
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
  expect(fixtures.capture).not.toHaveBeenCalled()
})

it.each(['ENOENT', 'EACCES'])('retains the resolved ExecaError cause and redacted %s launch diagnostic', async (code) => {
  const fixture = mockChild({})
  const systemError = Object.assign(new Error(`spawn ${directory}/fixture-node ${code}`), { code })
  const launchError = Object.assign(new Error(`Command failed with ${code}: ${directory}/fixture-node`, { cause: systemError }), { name: 'ExecaError', exitCode: undefined, failed: true })
  const failed = runCollector('fixture-node', [], options()).catch((error: unknown) => error)
  await waitForLaunch()
  fixture.resolve(launchError)
  const error = await failed as Error
  expect(error.cause).toBe(launchError)
  expect(error.message).toContain(`exit=unavailable Command failed with ${code}: <checkout>/fixture-node`)
  expect(error.message).not.toContain(directory)
  const log = await readFile(options().logFile, 'utf8')
  expect(log).toContain(code)
  expect(log).not.toContain(directory)
  expect(fixtures.capture).not.toHaveBeenCalled()
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
})

it('bounds a silent child and only releases reverified registered identities', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  fixtures.kill.mockImplementation(async (pids: number[]) => {
    expect(pids).toEqual([62, 61])
    fixture.exit(1)
  })
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  expect(await failed).toMatchObject({ message: expect.stringContaining('deadline exceeded (500 ms)') })
  expect(fixtures.capture).toHaveBeenCalledWith(61, expect.any(Function), undefined)
  expect(fixtures.identities).toHaveBeenCalledWith([62, 61])
  expect(fixtures.kill).toHaveBeenCalledTimes(1)
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(await readFile(options().logFile, 'utf8')).toContain('deadline exceeded (500 ms)')
})

it('keeps the deadline first error and an independent inspection failure', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  const inspectionError = new Error('identity inspection failed')
  fixtures.capture.mockRejectedValue(inspectionError)
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  const error = await failed
  expect(error).toBeInstanceOf(AggregateError)
  expect(error).toMatchObject({ cause: { message: expect.stringContaining('deadline') }, errors: [{ message: expect.stringContaining('deadline') }, inspectionError], stop: { reason: 'cleanup-unconfirmed', resourcesReleased: false, cancelled: false } })
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(fixture.child.all.listenerCount('data')).toBe(0)
  fixture.exit(1)
})

it('preserves a successful result and output without discovering a process tree', async () => {
  const fixture = mockChild()
  const running = runCollector('fixture-node', ['worker'], options())
  await waitForLaunch()
  fixture.child.all.emit('data', Buffer.from('completed evidence\n'))
  fixture.exit(0)
  expect(await running).toEqual({ exitCode: 0 })
  expect(fixtures.capture).not.toHaveBeenCalled()
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.all.listenerCount('data')).toBe(0)
  expect(await readFile(options().logFile, 'utf8')).toContain('completed evidence')
})

it('preserves a reused descendant PID and unrelated identities when rechecking ownership', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  fixtures.identities.mockResolvedValue(new Map([
    [61, rootIdentity],
    [62, { ...descendantIdentity, started: 'another-generation' }],
    [71, { pid: 71, started: 'manual-generation', executable: 'another-installation' }],
  ]))
  fixtures.kill.mockImplementation(async (pids: number[]) => {
    expect(pids).toEqual([61])
    fixture.exit(1)
  })
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  expect(await failed).toMatchObject({ message: expect.stringContaining('deadline') })
  expect(fixtures.kill).toHaveBeenCalledTimes(1)
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
})

it('revokes the native root before stdio drains while keeping registered descendants', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  fixtures.identities.mockImplementation(async () => {
    fixture.native.exitCode = 1
    return new Map([[61, rootIdentity], [62, descendantIdentity]])
  })
  fixtures.kill.mockImplementation(async (pids: number[]) => {
    expect(pids).toEqual([62])
    fixture.exit(1)
  })
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  expect(await failed).toMatchObject({ message: expect.stringContaining('deadline') })
  expect(fixtures.kill).toHaveBeenCalledWith([62])
  expect(fixture.child.kill).not.toHaveBeenCalled()
})

it('keeps a failed recheck independent from the deadline and signals no uncertain process', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  const recheckError = new Error('recheck unavailable')
  fixtures.identities.mockRejectedValue(recheckError)
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  const error = await failed
  expect(error).toBeInstanceOf(AggregateError)
  expect(error).toMatchObject({ errors: [{ message: expect.stringContaining('deadline') }, recheckError] })
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.kill).not.toHaveBeenCalled()
  fixture.exit(1)
})

it('preserves interruption and failed capture without waiting for a live root to settle', async () => {
  const fixture = mockChild()
  const previousListeners = process.listeners('SIGTERM')
  const inspectionError = new Error('interrupted capture failed')
  fixtures.capture.mockRejectedValue(inspectionError)
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  const interrupt = process.listeners('SIGTERM').find(listener => !previousListeners.includes(listener))
  expect(interrupt).toBeTypeOf('function')
  interrupt!('SIGTERM')
  const error = await failed
  expect(error).toBeInstanceOf(AggregateError)
  expect(error).toMatchObject({ cause: { message: 'Collector interrupted' }, errors: [{ message: 'Collector interrupted' }, inspectionError], stop: { reason: 'cleanup-unconfirmed', resourcesReleased: false, cancelled: true } })
  expect(fixture.native.exitCode).toBeNull()
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(process.listeners('SIGTERM')).toEqual(previousListeners)
  fixture.exit(1)
})

it('retains cancellation after its registered resources have been released', async () => {
  const fixture = mockChild()
  const previousListeners = process.listeners('SIGINT')
  fixtures.kill.mockImplementation(async () => fixture.exit(1))
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  const interrupt = process.listeners('SIGINT').find(listener => !previousListeners.includes(listener))
  expect(interrupt).toBeTypeOf('function')
  interrupt!('SIGINT')
  const error = await failed
  expect(error).toMatchObject({ cause: { message: 'Collector interrupted' }, errors: [{ message: 'Collector interrupted' }], stop: { reason: 'cancelled', resourcesReleased: true, cancelled: true } })
  expect(fixtures.kill).toHaveBeenCalledWith([62, 61])
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(process.listeners('SIGINT')).toEqual(previousListeners)
})

it('retains a termination failure and does not fall back to an unverified root kill', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  const terminationError = new Error('owned termination failed')
  fixtures.kill.mockRejectedValue(terminationError)
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  const error = await failed
  expect(error).toBeInstanceOf(AggregateError)
  expect(error).toMatchObject({ errors: [{ message: expect.stringContaining('deadline') }, terminationError] })
  expect(fixture.child.kill).not.toHaveBeenCalled()
  expect(await readFile(options().logFile, 'utf8')).toContain('Collector cleanup failed: Error: owned termination failed')
  fixture.exit(1)
})

it('signals only reverified individual POSIX identities rather than an old process group', async () => {
  vi.useFakeTimers()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  const fixture = mockChild()
  const signal = vi.spyOn(process, 'kill').mockImplementation((pid) => {
    if (pid === 61) {
      fixture.exit(1)
    }
    return true
  })
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(500)
  expect(await failed).toMatchObject({ message: expect.stringContaining('deadline') })
  expect(signal.mock.calls).toEqual([[62, 'SIGTERM'], [61, 'SIGTERM']])
  expect(fixtures.execute).toHaveBeenCalledTimes(1)
})

it('does not treat a bare PID without a native child handle as held ownership', async () => {
  vi.useFakeTimers()
  const fixture = mockChild()
  fixture.child.nodeChildProcess = undefined
  const failed = runCollector('fixture-node', ['worker'], options()).catch((error: unknown) => error)
  await waitForLaunch()
  await vi.advanceTimersByTimeAsync(2_500)
  expect(await failed).toMatchObject({ errors: [{ message: expect.stringContaining('deadline') }, { message: expect.stringContaining('stdio drain timed out') }] })
  expect(fixtures.capture).not.toHaveBeenCalled()
  expect(fixtures.identities).not.toHaveBeenCalled()
  expect(fixtures.kill).not.toHaveBeenCalled()
  expect(fixture.child.kill).not.toHaveBeenCalled()
  fixture.exit(1)
})
