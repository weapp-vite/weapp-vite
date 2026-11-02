import { ChildProcess } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { drainWindowsKernelQueries, queryWindowsKernelProcesses } from './windowsKernelQuery'
import { beginWindowsKernelQueryScope, currentWindowsKernelQueryScope, inWindowsKernelQueryScope, registerWindowsKernelOperation } from './windowsKernelQueryScope'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
vi.mock('./windowsKernelArtifact', () => ({ readWindowsKernelInspector: () => new Uint8Array([77, 90]) }))

const children: ChildProcess[] = []
let directory: string | undefined

beforeEach(() => beginWindowsKernelQueryScope())

afterEach(async () => {
  for (const child of children.splice(0)) {
    child.emit('close', null, 'SIGTERM')
  }
  await drainWindowsKernelQueries(new Error('Test teardown')).catch(() => {})
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  execute.mockReset()
  if (directory) {
    await rm(directory, {
      recursive: true,
      force: true,
    })
  }
})

it('cancels only its own query and keeps the directory until native close, then drains a worker exactly once', async () => {
  directory = await mkdtemp(join(tmpdir(), 'kernel-query-cancellation-'))
  for (const key of ['TMPDIR', 'TMP', 'TEMP']) {
    vi.stubEnv(key, directory)
  }
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  const records = new Map<number, { child: ChildProcess, signal: AbortSignal, failure: Error }>()
  execute.mockImplementation((_command: string, args: string[], options: { cancelSignal: AbortSignal, timeout: number }) => {
    expect(options.timeout).toBeGreaterThan(0)
    expect(options.timeout).toBeLessThanOrEqual(30_000)
    const child = new ChildProcess()
    children.push(child)
    const failure = Object.assign(new Error('original query cancellation'), { timedOut: false, isCanceled: true })
    records.set(Number(args.at(-1)), { child, signal: options.cancelSignal, failure })
    const pending = new Promise((_resolve, reject) => {
      options.cancelSignal.addEventListener('abort', () => {
        child.emit('exit', null, 'SIGTERM')
        reject(failure)
      }, { once: true })
    })
    return Object.assign(pending, { nodeChildProcess: child })
  })
  const owner = new AbortController()
  let firstFinished = false
  const first = queryWindowsKernelProcesses([61], false, { signal: owner.signal }).catch((error: unknown) => error).finally(() => firstFinished = true)
  const second = queryWindowsKernelProcesses([71]).catch((error: unknown) => error)
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
  const firstRecord = records.get(61)!
  const secondRecord = records.get(71)!
  owner.abort(new Error('First query owner cancelled'))
  await Promise.resolve()
  expect(firstRecord.signal.aborted).toBe(true)
  expect(secondRecord.signal.aborted).toBe(false)
  expect(firstFinished).toBe(false)
  expect(await readdir(directory)).toHaveLength(2)
  firstRecord.child.emit('close', null, 'SIGTERM')
  expect(await first).toBe(firstRecord.failure)
  expect(await readdir(directory)).toHaveLength(1)
  const reason = new Error('Worker close requested')
  const draining = drainWindowsKernelQueries(reason)
  expect(drainWindowsKernelQueries(reason)).toBe(draining)
  const outcome = draining.catch((error: unknown) => error)
  expect(secondRecord.signal.aborted).toBe(true)
  expect(await readdir(directory)).toHaveLength(1)
  secondRecord.child.emit('close', null, 'SIGTERM')
  expect(await second).toBe(secondRecord.failure)
  const failure = await outcome as AggregateError
  expect(failure.errors).toEqual([secondRecord.failure])
  expect(failure.cause).toBe(reason)
  expect(await readdir(directory)).toEqual([])
  expect(drainWindowsKernelQueries(new Error('Repeated close'))).toBe(draining)
})

it('freezes follow-up identities after an exit0 query awaiting close and keeps the next generation usable', async () => {
  directory = await mkdtemp(join(tmpdir(), 'kernel-query-generation-'))
  for (const key of ['TMPDIR', 'TMP', 'TEMP']) {
    vi.stubEnv(key, directory)
  }
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  execute.mockImplementation((_command: string, args: string[]) => {
    const child = new ChildProcess()
    children.push(child)
    if (args.includes('71')) {
      queueMicrotask(() => child.emit('close', 0, null))
    }
    return Object.assign(Promise.resolve({ exitCode: 0, stdout: '', stderr: '' }), { nodeChildProcess: child })
  })
  const old = currentWindowsKernelQueryScope()
  const continuation = inWindowsKernelQueryScope(old, async () => {
    await queryWindowsKernelProcesses()
    return queryWindowsKernelProcesses([61])
  })
  const outcome = continuation.catch((error: unknown) => error)
  registerWindowsKernelOperation(old, { cancel() {}, settled: continuation })
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
  const draining = drainWindowsKernelQueries(new Error('Closing original module')).catch((error: unknown) => error)
  expect(await readdir(directory)).toHaveLength(1)
  children[0]!.emit('exit', 0, null)
  children[0]!.emit('close', 0, null)
  expect(await outcome).toMatchObject({ message: expect.stringContaining('scope is closing') })
  expect(await draining).toBeInstanceOf(AggregateError)
  expect(execute).toHaveBeenCalledOnce()
  expect(await readdir(directory)).toEqual([])
  beginWindowsKernelQueryScope()
  expect((await queryWindowsKernelProcesses([71])).exitCode).toBe(0)
  await expect(inWindowsKernelQueryScope(old, () => queryWindowsKernelProcesses([61]))).rejects.toThrow(/scope is closing/)
  expect(execute).toHaveBeenCalledTimes(2)
})
